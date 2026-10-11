-- ============================================================
-- PURCHASE ORDER + SUPPLIER MANAGEMENT + CENTRALIZED STOCK
-- ============================================================
-- Kya add ho raha hai:
--   1. suppliers                — har dukaan ke apne suppliers (+ payable balance)
--   2. purchases / purchase_items — purchase orders (Draft → Ordered →
--      Partially Received → Received / Cancelled)
--   3. supplier_transactions    — supplier ka ledger (purchase = payable badha,
--      payment = payable ghata). Khata jaisa hi pattern, bas ulta
--      (yahan dukaandar supplier ko deta hai).
--   4. variant_purchase_prices  — last purchase price (PRIVATE table).
--      NOTE: yeh jaan-bujh kar `variants` mein nahi rakha, kyunki
--      `variants` ko "Anyone can view" policy ke through customer bhi
--      padh sakte hain — cost price customer ko kabhi nahi dikhna chahiye.
--   5. stock_movements          — stock ka audit trail (kab, kyun, kitna)
--   6. apply_stock_change()     — STOCK BADLANE KA EKMAATRA RASTA.
--      place_order (sale), purchase receive, manual +/- — sab isi se guzarte
--      hain. variants.stock par ek trigger bhi laga hai jo seedha
--      UPDATE block karta hai (taaki koi naya code galti se bypass na kare).
--
-- Multi-tenant safety: har table mein store_id hai; RLS sirf store ke
-- owner ko SELECT deti hai; saari writes security-definer RPCs se hoti
-- hain jo pehle `_assert_store_owner` se ownership check karte hain.
--
-- Is file ko Supabase SQL Editor mein ek baar poora run karein.
-- Existing data/tables/columns ko touch nahi karti (sirf naye tables +
-- place_order ko usi signature par replace karti hai).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Internal helper: kya logged-in user is store ka owner hai?
-- ------------------------------------------------------------
create or replace function _assert_store_owner(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;
end;
$$;
revoke all on function _assert_store_owner(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  gstin text,
  notes text,
  payable_balance numeric not null default 0,  -- + = dukaandar ko dena hai, - = advance diya hua
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_suppliers_store_name on suppliers(store_id, lower(name));
create index if not exists idx_suppliers_store on suppliers(store_id);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  purchase_seq int not null,
  purchase_number text not null,
  status text not null default 'Draft'
    check (status in ('Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled')),
  invoice_number text,
  purchase_date date not null default current_date,
  notes text,
  total_amount numeric not null default 0,     -- order ka total (ordered qty x price)
  received_amount numeric not null default 0,  -- ab tak receive hue maal ki value (= supplier payable mein jo judd chuka)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ordered_at timestamptz,
  received_at timestamptz,
  unique (store_id, purchase_seq)
);
create index if not exists idx_purchases_store on purchases(store_id, created_at desc);
create index if not exists idx_purchases_supplier on purchases(supplier_id);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  variant_id uuid references variants(id) on delete set null,  -- variant baad mein delete ho to history bachi rahe
  product_name text not null,   -- snapshot (history ke liye)
  variant_label text,
  unit text,
  qty_ordered int not null check (qty_ordered > 0),
  qty_received int not null default 0,
  purchase_price numeric not null check (purchase_price >= 0),
  line_total numeric generated always as (qty_ordered * purchase_price) stored,
  check (qty_received >= 0 and qty_received <= qty_ordered)
);
create index if not exists idx_purchase_items_purchase on purchase_items(purchase_id);
create index if not exists idx_purchase_items_store on purchase_items(store_id);

create table if not exists supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  type text not null check (type in ('opening', 'purchase', 'payment')),
  amount numeric not null check (amount > 0),
  running_balance numeric not null,  -- is entry ke baad ka payable (snapshot)
  purchase_id uuid references purchases(id) on delete set null,
  payment_method text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_supplier_tx_supplier on supplier_transactions(supplier_id, created_at desc);
create index if not exists idx_supplier_tx_store on supplier_transactions(store_id);

create table if not exists variant_purchase_prices (
  variant_id uuid primary key references variants(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  last_purchase_price numeric not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_vpp_store on variant_purchase_prices(store_id);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  variant_id uuid not null references variants(id) on delete cascade,
  delta int not null,
  stock_after int not null,
  reason text not null
    check (reason in ('sale', 'purchase_receive', 'manual_adjust', 'sale_return', 'purchase_return', 'order_cancel', 'opening')),
  ref_type text,   -- 'order' | 'purchase' | 'manual'
  ref_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_mov_variant on stock_movements(variant_id, created_at desc);
create index if not exists idx_stock_mov_store on stock_movements(store_id, created_at desc);

-- ------------------------------------------------------------
-- 2. RLS — sirf store owner padh sakta hai; direct write kisi ko nahi
--    (writes sirf neeche ke RPCs se). anon ko kuch bhi nahi.
-- ------------------------------------------------------------
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table supplier_transactions enable row level security;
alter table variant_purchase_prices enable row level security;
alter table stock_movements enable row level security;

revoke all on suppliers, purchases, purchase_items, supplier_transactions, variant_purchase_prices, stock_movements from anon;
revoke insert, update, delete on suppliers, purchases, purchase_items, supplier_transactions, variant_purchase_prices, stock_movements from authenticated;
grant select on suppliers, purchases, purchase_items, supplier_transactions, variant_purchase_prices, stock_movements to authenticated;

drop policy if exists "Owner can view suppliers" on suppliers;
create policy "Owner can view suppliers" on suppliers for select
  using (exists (select 1 from stores s where s.id = suppliers.store_id and s.user_id = auth.uid()));

drop policy if exists "Owner can view purchases" on purchases;
create policy "Owner can view purchases" on purchases for select
  using (exists (select 1 from stores s where s.id = purchases.store_id and s.user_id = auth.uid()));

drop policy if exists "Owner can view purchase items" on purchase_items;
create policy "Owner can view purchase items" on purchase_items for select
  using (exists (select 1 from stores s where s.id = purchase_items.store_id and s.user_id = auth.uid()));

drop policy if exists "Owner can view supplier transactions" on supplier_transactions;
create policy "Owner can view supplier transactions" on supplier_transactions for select
  using (exists (select 1 from stores s where s.id = supplier_transactions.store_id and s.user_id = auth.uid()));

drop policy if exists "Owner can view purchase prices" on variant_purchase_prices;
create policy "Owner can view purchase prices" on variant_purchase_prices for select
  using (exists (select 1 from stores s where s.id = variant_purchase_prices.store_id and s.user_id = auth.uid()));

drop policy if exists "Owner can view stock movements" on stock_movements;
create policy "Owner can view stock movements" on stock_movements for select
  using (exists (select 1 from stores s where s.id = stock_movements.store_id and s.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. CENTRALIZED STOCK LOGIC
-- ------------------------------------------------------------
-- apply_stock_change: stock badalne ka ek hi function.
--   * variant us store ka hona zaroori (cross-store galti/attack nahi)
--   * row lock (FOR UPDATE) -> race condition nahi
--   * stock negative nahi jaata (jab tak p_allow_negative na ho)
--   * har change stock_movements mein log hota hai
-- Yeh function sirf doosre security-definer functions call karte hain;
-- client (anon/authenticated) seedha call nahi kar sakta.
create or replace function apply_stock_change(
  p_store_id uuid,
  p_variant_id uuid,
  p_delta int,
  p_reason text,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_note text default null,
  p_allow_negative boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock int;
  v_name text;
  v_new int;
begin
  select v.stock, p.name into v_stock, v_name
  from variants v
  join products p on p.id = v.product_id
  where v.id = p_variant_id and p.store_id = p_store_id
  for update of v;

  if not found then
    raise exception 'VARIANT_MISSING: Product is dukaan mein nahi mila';
  end if;

  if p_delta = 0 then
    return v_stock;
  end if;

  v_new := v_stock + p_delta;
  if v_new < 0 and not p_allow_negative then
    raise exception 'STOCK_UNAVAILABLE: % ka stock kam pad gaya', v_name;
  end if;

  perform set_config('app.stock_ctx', '1', true);
  update variants set stock = v_new where id = p_variant_id;
  perform set_config('app.stock_ctx', '', true);

  insert into stock_movements (store_id, variant_id, delta, stock_after, reason, ref_type, ref_id, note, created_by)
  values (p_store_id, p_variant_id, p_delta, v_new, p_reason, p_ref_type, p_ref_id, p_note, auth.uid());

  return v_new;
end;
$$;
revoke all on function apply_stock_change(uuid, uuid, int, text, text, uuid, text, boolean) from public, anon, authenticated;

-- Guard: variants.stock ko seedha UPDATE karna block (sirf apply_stock_change ke andar allowed).
-- (INSERT par yeh nahi lagta, isliye naya variant banate waqt opening stock pehle ki tarah chalta hai.)
-- SQL Editor se kabhi manually stock theek karna ho to:
--   select set_config('app.stock_ctx', '1', true); update variants set stock = 5 where id = '...';
create or replace function guard_variant_stock()
returns trigger
language plpgsql
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.stock_ctx', true), '') <> '1' then
    raise exception 'Stock seedha change nahi ho sakta — apply_stock_change / set_variant_stock use karein';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_variant_stock on variants;
create trigger trg_guard_variant_stock
  before update of stock on variants
  for each row execute function guard_variant_stock();

-- Dukaandar ka manual stock set (Edit Variant form) — absolute value.
create or replace function set_variant_stock(p_variant_id uuid, p_new_stock int, p_note text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_cur int;
begin
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'Stock 0 ya usse zyada hona chahiye';
  end if;

  select p.store_id, v.stock into v_store_id, v_cur
  from variants v join products p on p.id = v.product_id
  where v.id = p_variant_id;
  if not found then
    raise exception 'Variant nahi mila';
  end if;

  perform _assert_store_owner(v_store_id);

  return apply_stock_change(v_store_id, p_variant_id, p_new_stock - v_cur, 'manual_adjust', 'manual', null, p_note);
end;
$$;
grant execute on function set_variant_stock(uuid, int, text) to authenticated;

-- Dashboard ke +/- buttons — delta based (0 se neeche nahi jaata, pehle jaisa).
create or replace function adjust_variant_stock(p_variant_id uuid, p_delta int, p_note text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_cur int;
begin
  select p.store_id into v_store_id
  from variants v join products p on p.id = v.product_id
  where v.id = p_variant_id;
  if not found then
    raise exception 'Variant nahi mila';
  end if;

  perform _assert_store_owner(v_store_id);

  -- lock leke current stock dekho, taaki clamp sahi ho
  select stock into v_cur from variants where id = p_variant_id for update;
  return apply_stock_change(v_store_id, p_variant_id, greatest(p_delta, -v_cur), 'manual_adjust', 'manual', null, p_note);
end;
$$;
grant execute on function adjust_variant_stock(uuid, int, text) to authenticated;

-- ------------------------------------------------------------
-- 4. place_order — SAME signature, bas stock ab apply_stock_change se.
--    (migration_gst_tax.sql wala latest version; baaki sab bilkul same.)
--    Extra safety: qty <= 0 reject (pehle negative qty se stock badh sakta
--    tha) aur variant us hi store ka hona zaroori.
-- ------------------------------------------------------------
create or replace function place_order(
  p_store_id uuid,
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_landmark text,
  p_pincode text,
  p_payment_method text,
  p_payment_status text,
  p_status text,
  p_items jsonb,
  p_total numeric,
  p_order_type text default 'Delivery',
  p_delivery_fee numeric default 0,
  p_booking_date date default null,
  p_booking_slot text default null,
  p_customer_state text default null,
  p_discount_amount numeric default 0,
  p_taxable_amount numeric default null,
  p_cgst_amount numeric default 0,
  p_sgst_amount numeric default 0,
  p_igst_amount numeric default 0
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_product_name text;
  v_order_id uuid := gen_random_uuid();
  new_order orders;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_variant_id := (item->>'variant_id')::uuid;
    v_qty := (item->>'qty')::int;
    v_product_name := coalesce(item->>'name', 'Item');

    if v_variant_id is null then
      raise exception 'VARIANT_MISSING: % ke liye variant ID nahi mila', v_product_name;
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'STOCK_UNAVAILABLE: % ki quantity sahi nahi hai', v_product_name;
    end if;

    perform apply_stock_change(p_store_id, v_variant_id, -v_qty, 'sale', 'order', v_order_id);
  end loop;

  insert into orders (
    id, store_id, order_number, customer_name, customer_phone, address,
    landmark, pincode, payment_method, payment_status, status, items, total, order_type, delivery_fee,
    booking_date, booking_slot, customer_state, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount
  ) values (
    v_order_id, p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total, p_order_type,
    case when p_order_type in ('Pickup', 'Appointment', 'Dine In') then 0 else p_delivery_fee end,
    p_booking_date, p_booking_slot, p_customer_state, p_discount_amount, p_taxable_amount, p_cgst_amount, p_sgst_amount, p_igst_amount
  )
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text, numeric, date, text, text, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. SUPPLIER RPCs
-- ------------------------------------------------------------
create or replace function upsert_supplier(
  p_store_id uuid,
  p_name text,
  p_phone text default null,
  p_address text default null,
  p_gstin text default null,
  p_notes text default null,
  p_supplier_id uuid default null,
  p_opening_payable numeric default 0,   -- sirf naya supplier banate waqt (pehle se baaki udhaar)
  p_is_active boolean default true
)
returns suppliers
language plpgsql
security definer
set search_path = public
as $$
declare
  sup suppliers;
begin
  perform _assert_store_owner(p_store_id);

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Supplier ka naam zaroori hai';
  end if;

  if p_supplier_id is null then
    insert into suppliers (store_id, name, phone, address, gstin, notes, is_active)
    values (p_store_id, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_address), ''), nullif(trim(p_gstin), ''), nullif(trim(p_notes), ''), true)
    returning * into sup;

    if coalesce(p_opening_payable, 0) > 0 then
      update suppliers set payable_balance = p_opening_payable where id = sup.id returning * into sup;
      insert into supplier_transactions (store_id, supplier_id, type, amount, running_balance, note, created_by)
      values (p_store_id, sup.id, 'opening', p_opening_payable, p_opening_payable, 'Opening balance (pehle se baaki)', auth.uid());
    end if;
  else
    update suppliers
    set name = trim(p_name), phone = nullif(trim(p_phone), ''), address = nullif(trim(p_address), ''),
        gstin = nullif(trim(p_gstin), ''), notes = nullif(trim(p_notes), ''), is_active = coalesce(p_is_active, true)
    where id = p_supplier_id and store_id = p_store_id
    returning * into sup;
    if not found then
      raise exception 'Supplier nahi mila';
    end if;
  end if;

  return sup;
exception
  when unique_violation then
    raise exception 'Is naam ka supplier pehle se hai';
end;
$$;
grant execute on function upsert_supplier(uuid, text, text, text, text, text, uuid, numeric, boolean) to authenticated;

-- Supplier list + totals (ek hi call mein). Owner na ho to khaali result.
create or replace function get_suppliers_overview(p_store_id uuid)
returns table (
  id uuid, name text, phone text, address text, gstin text, notes text,
  is_active boolean, payable_balance numeric,
  total_purchased numeric, purchase_count bigint, last_purchase_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.phone, s.address, s.gstin, s.notes, s.is_active, s.payable_balance,
         coalesce(sum(p.received_amount) filter (where p.status <> 'Cancelled'), 0) as total_purchased,
         count(p.id) filter (where p.status <> 'Cancelled') as purchase_count,
         max(p.purchase_date) filter (where p.status <> 'Cancelled') as last_purchase_date
  from suppliers s
  left join purchases p on p.supplier_id = s.id
  where s.store_id = p_store_id
    and exists (select 1 from stores st where st.id = p_store_id and st.user_id = auth.uid())
  group by s.id
  order by s.is_active desc, s.name;
$$;
grant execute on function get_suppliers_overview(uuid) to authenticated;

-- Internal: payment record (supplier row lock ke saath)
create or replace function _record_supplier_payment(
  p_store_id uuid, p_supplier_id uuid, p_amount numeric,
  p_method text, p_note text, p_purchase_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
  v_new numeric;
begin
  select payable_balance into v_bal from suppliers
  where id = p_supplier_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Supplier nahi mila';
  end if;

  v_new := v_bal - p_amount;
  update suppliers set payable_balance = v_new where id = p_supplier_id;

  insert into supplier_transactions (store_id, supplier_id, type, amount, running_balance, purchase_id, payment_method, note, created_by)
  values (p_store_id, p_supplier_id, 'payment', p_amount, v_new, p_purchase_id, p_method, p_note, auth.uid());

  return v_new;
end;
$$;
revoke all on function _record_supplier_payment(uuid, uuid, numeric, text, text, uuid) from public, anon, authenticated;

-- Supplier ko payment — payable ghatega. Zyada de diya to balance negative
-- (advance) ho jaata hai, jaise customer khata mein.
create or replace function record_supplier_payment(
  p_store_id uuid,
  p_supplier_id uuid,
  p_amount numeric,
  p_method text default 'Cash',
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount 0 se zyada hona chahiye';
  end if;
  if p_method not in ('Cash', 'UPI', 'Bank Transfer', 'Other') then
    raise exception 'Payment method galat hai';
  end if;
  return _record_supplier_payment(p_store_id, p_supplier_id, p_amount, p_method, nullif(trim(p_note), ''), null);
end;
$$;
grant execute on function record_supplier_payment(uuid, uuid, numeric, text, text) to authenticated;

-- ------------------------------------------------------------
-- 6. PURCHASE RPCs
-- ------------------------------------------------------------

-- Internal: maal receive karo. p_receipts = null -> baaki sab receive;
-- warna [{"item_id": "...", "qty": 5}, ...] (partial).
-- Stock +, supplier payable +, last purchase price update, status update —
-- sab usi transaction mein.
create or replace function _receive_purchase(p_store_id uuid, p_purchase_id uuid, p_receipts jsonb)
returns purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  pur purchases;
  it purchase_items;
  v_rem int;
  v_qty int;
  v_value numeric := 0;
  v_units int := 0;
  v_bal numeric;
  v_new_bal numeric;
  v_all_received boolean;
begin
  select * into pur from purchases where id = p_purchase_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Purchase nahi mila';
  end if;
  if pur.status in ('Cancelled', 'Received') then
    raise exception 'Is purchase ko receive nahi kar sakte (status: %)', pur.status;
  end if;

  for it in select * from purchase_items where purchase_id = p_purchase_id order by id for update
  loop
    v_rem := it.qty_ordered - it.qty_received;
    if v_rem <= 0 then
      continue;
    end if;

    if p_receipts is null then
      v_qty := v_rem;
    else
      select coalesce(sum((e->>'qty')::int), 0) into v_qty
      from jsonb_array_elements(p_receipts) e
      where (e->>'item_id')::uuid = it.id;
      if v_qty < 0 then
        raise exception 'Receive quantity negative nahi ho sakti';
      end if;
      if v_qty > v_rem then
        raise exception 'Receive quantity ordered se zyada nahi ho sakti (%)', it.product_name;
      end if;
    end if;

    if v_qty = 0 then
      continue;
    end if;
    if it.variant_id is null then
      raise exception '"%" product delete ho chuka hai — receive nahi kar sakte', it.product_name;
    end if;

    perform apply_stock_change(p_store_id, it.variant_id, v_qty, 'purchase_receive', 'purchase', p_purchase_id, null);

    update purchase_items set qty_received = qty_received + v_qty where id = it.id;
    v_value := v_value + v_qty * it.purchase_price;
    v_units := v_units + v_qty;

    insert into variant_purchase_prices (variant_id, store_id, last_purchase_price, updated_at)
    values (it.variant_id, p_store_id, it.purchase_price, now())
    on conflict (variant_id) do update
      set last_purchase_price = excluded.last_purchase_price, updated_at = now();
  end loop;

  if v_units = 0 then
    raise exception 'Receive karne ke liye kam se kam ek item ki quantity daalein';
  end if;

  if v_value > 0 then
    select payable_balance into v_bal from suppliers where id = pur.supplier_id for update;
    v_new_bal := v_bal + v_value;
    update suppliers set payable_balance = v_new_bal where id = pur.supplier_id;
    insert into supplier_transactions (store_id, supplier_id, type, amount, running_balance, purchase_id, note, created_by)
    values (p_store_id, pur.supplier_id, 'purchase', v_value, v_new_bal, p_purchase_id, 'Purchase ' || pur.purchase_number, auth.uid());
  end if;

  select bool_and(qty_received = qty_ordered) into v_all_received from purchase_items where purchase_id = p_purchase_id;

  update purchases
  set status = case when v_all_received then 'Received' else 'Partially Received' end,
      received_amount = received_amount + v_value,
      received_at = case when v_all_received then now() else received_at end,
      updated_at = now()
  where id = p_purchase_id
  returning * into pur;

  return pur;
end;
$$;
revoke all on function _receive_purchase(uuid, uuid, jsonb) from public, anon, authenticated;

-- Naya purchase banao ya Draft/Ordered purchase edit karo.
--   p_status: 'Draft' | 'Ordered' | 'Received' (Received = save + turant stock receive)
--   p_items : [{"variant_id": "...", "qty": 20, "purchase_price": 10}, ...]
--   p_paid_now: sirf 'Received' ke saath — supplier ko abhi di gayi payment
create or replace function save_purchase(
  p_store_id uuid,
  p_supplier_id uuid,
  p_items jsonb,
  p_status text default 'Draft',
  p_purchase_id uuid default null,
  p_invoice_number text default null,
  p_purchase_date date default null,
  p_notes text default null,
  p_paid_now numeric default 0,
  p_payment_method text default 'Cash'
)
returns purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  pur purchases;
  item jsonb;
  v_variant uuid;
  v_qty int;
  v_price numeric;
  v_total numeric := 0;
  v_seq int;
  v_pname text;
  v_vlabel text;
  v_vunit text;
begin
  perform _assert_store_owner(p_store_id);

  if p_status not in ('Draft', 'Ordered', 'Received') then
    raise exception 'Status galat hai';
  end if;
  if not exists (select 1 from suppliers where id = p_supplier_id and store_id = p_store_id and is_active) then
    raise exception 'Supplier select karein';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Kam se kam ek product add karein';
  end if;
  if coalesce(p_paid_now, 0) < 0 then
    raise exception 'Paid amount negative nahi ho sakta';
  end if;
  if coalesce(p_paid_now, 0) > 0 and p_status <> 'Received' then
    raise exception 'Payment tabhi record hoga jab maal receive ho';
  end if;
  if p_payment_method not in ('Cash', 'UPI', 'Bank Transfer', 'Other') then
    raise exception 'Payment method galat hai';
  end if;

  -- Pehle sab items validate + total nikalo
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (item->>'qty')::int;
    v_price := (item->>'purchase_price')::numeric;
    if (item->>'variant_id') is null then
      raise exception 'Product select karein';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity 0 se zyada honi chahiye';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Purchase price galat hai';
    end if;
    if not exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = (item->>'variant_id')::uuid and p.store_id = p_store_id
    ) then
      raise exception 'Product is dukaan mein nahi mila';
    end if;
    v_total := v_total + v_qty * v_price;
  end loop;

  if coalesce(p_paid_now, 0) > v_total then
    raise exception 'Paid amount purchase total se zyada nahi ho sakta';
  end if;

  if p_purchase_id is null then
    perform pg_advisory_xact_lock(hashtextextended('purchase_seq:' || p_store_id::text, 0));
    select coalesce(max(purchase_seq), 0) + 1 into v_seq from purchases where store_id = p_store_id;

    insert into purchases (store_id, supplier_id, purchase_seq, purchase_number, status, invoice_number, purchase_date, notes, total_amount, created_by, ordered_at)
    values (
      p_store_id, p_supplier_id, v_seq, 'PUR-' || lpad(v_seq::text, 4, '0'),
      case when p_status = 'Draft' then 'Draft' else 'Ordered' end,
      nullif(trim(p_invoice_number), ''), coalesce(p_purchase_date, current_date), nullif(trim(p_notes), ''),
      v_total, auth.uid(), case when p_status = 'Draft' then null else now() end
    )
    returning * into pur;
  else
    select * into pur from purchases where id = p_purchase_id and store_id = p_store_id for update;
    if not found then
      raise exception 'Purchase nahi mila';
    end if;
    if pur.status not in ('Draft', 'Ordered') or exists (select 1 from purchase_items where purchase_id = pur.id and qty_received > 0) then
      raise exception 'Sirf Draft ya Ordered purchase edit ho sakti hai';
    end if;

    update purchases
    set supplier_id = p_supplier_id,
        status = case when p_status = 'Draft' then 'Draft' else 'Ordered' end,
        invoice_number = nullif(trim(p_invoice_number), ''),
        purchase_date = coalesce(p_purchase_date, purchase_date),
        notes = nullif(trim(p_notes), ''),
        total_amount = v_total,
        ordered_at = case when p_status = 'Draft' then null else coalesce(ordered_at, now()) end,
        updated_at = now()
    where id = pur.id
    returning * into pur;

    delete from purchase_items where purchase_id = pur.id;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    select p.name, v.label, v.unit into v_pname, v_vlabel, v_vunit
    from variants v join products p on p.id = v.product_id
    where v.id = (item->>'variant_id')::uuid;

    insert into purchase_items (purchase_id, store_id, variant_id, product_name, variant_label, unit, qty_ordered, purchase_price)
    values (pur.id, p_store_id, (item->>'variant_id')::uuid, v_pname, v_vlabel, v_vunit, (item->>'qty')::int, (item->>'purchase_price')::numeric);
  end loop;

  if p_status = 'Received' then
    pur := _receive_purchase(p_store_id, pur.id, null);
    if coalesce(p_paid_now, 0) > 0 then
      perform _record_supplier_payment(p_store_id, p_supplier_id, p_paid_now, p_payment_method, 'Paid at purchase ' || pur.purchase_number, pur.id);
    end if;
  end if;

  return pur;
end;
$$;
grant execute on function save_purchase(uuid, uuid, jsonb, text, uuid, text, date, text, numeric, text) to authenticated;

-- Draft -> Ordered
create or replace function mark_purchase_ordered(p_store_id uuid, p_purchase_id uuid)
returns purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  pur purchases;
begin
  perform _assert_store_owner(p_store_id);
  update purchases
  set status = 'Ordered', ordered_at = coalesce(ordered_at, now()), updated_at = now()
  where id = p_purchase_id and store_id = p_store_id and status = 'Draft'
  returning * into pur;
  if not found then
    raise exception 'Sirf Draft purchase ko Ordered mark kar sakte hain';
  end if;
  return pur;
end;
$$;
grant execute on function mark_purchase_ordered(uuid, uuid) to authenticated;

-- Maal receive (poora ya partial). p_receipts null = baaki sab.
create or replace function receive_purchase(
  p_store_id uuid,
  p_purchase_id uuid,
  p_receipts jsonb default null,
  p_paid_now numeric default 0,
  p_payment_method text default 'Cash'
)
returns purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  pur purchases;
  v_before numeric;
  v_value numeric;
begin
  perform _assert_store_owner(p_store_id);

  if coalesce(p_paid_now, 0) < 0 then
    raise exception 'Paid amount negative nahi ho sakta';
  end if;
  if p_payment_method not in ('Cash', 'UPI', 'Bank Transfer', 'Other') then
    raise exception 'Payment method galat hai';
  end if;

  select received_amount into v_before from purchases where id = p_purchase_id and store_id = p_store_id;
  if not found then
    raise exception 'Purchase nahi mila';
  end if;

  pur := _receive_purchase(p_store_id, p_purchase_id, p_receipts);
  v_value := pur.received_amount - v_before;

  if coalesce(p_paid_now, 0) > v_value then
    raise exception 'Paid amount receive hue maal ki value se zyada nahi ho sakta';
  end if;
  if coalesce(p_paid_now, 0) > 0 then
    perform _record_supplier_payment(p_store_id, pur.supplier_id, p_paid_now, p_payment_method, 'Paid at receiving ' || pur.purchase_number, pur.id);
  end if;

  return pur;
end;
$$;
grant execute on function receive_purchase(uuid, uuid, jsonb, numeric, text) to authenticated;

-- Cancel: Draft / Ordered / Partially Received. Jo maal pehle hi receive
-- ho chuka (stock + payable) woh waise hi rehta hai — sirf baaki cancel hota hai.
create or replace function cancel_purchase(p_store_id uuid, p_purchase_id uuid)
returns purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  pur purchases;
begin
  perform _assert_store_owner(p_store_id);
  update purchases
  set status = 'Cancelled', updated_at = now()
  where id = p_purchase_id and store_id = p_store_id and status in ('Draft', 'Ordered', 'Partially Received')
  returning * into pur;
  if not found then
    raise exception 'Yeh purchase cancel nahi ho sakti (Received ya pehle se Cancelled)';
  end if;
  return pur;
end;
$$;
grant execute on function cancel_purchase(uuid, uuid) to authenticated;
