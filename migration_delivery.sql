-- ============================================================
-- DELIVERY MANAGEMENT + ORDER TYPE (Pickup/Delivery) + TRACKING
-- ============================================================
-- Existing `orders.status` column ko hi extend kar rahe hain (koi naya
-- status column nahi) — bas ek naya intermediate status "Ready" istemal
-- hoga jo app-level (DashboardView.jsx) mein already handle hoga.
-- Purane orders (jinka status 'New'/'Accepted'/'Preparing'/'Out for
-- Delivery'/'Delivered' hai) bilkul unaffected rehte hain.
-- ============================================================

-- ---- 1. Order type: customer ne Pickup ya Delivery chuna ----
alter table orders add column if not exists order_type text not null default 'Delivery' check (order_type in ('Pickup', 'Delivery'));

-- ---- 2. Delivery boys — dukaandar apna staff khud manage karta hai ----
create table if not exists delivery_boys (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  name text not null,
  phone text not null,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_delivery_boys_store on delivery_boys(store_id);

alter table delivery_boys enable row level security;

-- Same ownership pattern jo products/variants mein already hai — anyone
-- (customer, tracking screen ke liye) dekh sake, sirf owner CRUD kare.
create policy "Anyone can view delivery boys" on delivery_boys for select using (true);
create policy "Owner can insert delivery boys" on delivery_boys for insert
  with check (exists (select 1 from stores where stores.id = delivery_boys.store_id and stores.user_id = auth.uid()));
create policy "Owner can update delivery boys" on delivery_boys for update
  using (exists (select 1 from stores where stores.id = delivery_boys.store_id and stores.user_id = auth.uid()));
create policy "Owner can delete delivery boys" on delivery_boys for delete
  using (exists (select 1 from stores where stores.id = delivery_boys.store_id and stores.user_id = auth.uid()));

-- ---- 3. Order par kaunsa delivery boy assign hai ----
alter table orders add column if not exists delivery_boy_id uuid references delivery_boys(id);

-- ============================================================
-- 4. place_order() ko extend karo — order_type bhi accept kare.
-- Purana 11-parameter wala function hata kar naya 12-parameter wala
-- banate hain (default 'Delivery' rakha hai, taaki agar kahin purana
-- call reh bhi jaaye to bhi fail na ho).
-- ============================================================
drop function if exists place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric);

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
  p_order_type text default 'Delivery'
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
  v_new_stock int;
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

    update variants
    set stock = stock - v_qty
    where id = v_variant_id and stock >= v_qty
    returning stock into v_new_stock;

    if not found then
      raise exception 'STOCK_UNAVAILABLE: % ka stock kam pad gaya', v_product_name;
    end if;
  end loop;

  insert into orders (
    store_id, order_number, customer_name, customer_phone, address,
    landmark, pincode, payment_method, payment_status, status, items, total, order_type
  ) values (
    p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total, p_order_type
  )
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text) to anon, authenticated;

-- ============================================================
-- 5. Order Tracking RPC — customer login ke bina, sirf order_number se
-- apna order track kar sake. `orders` table ki RLS abhi bhi sirf owner
-- ko hi SELECT deti hai (yeh nahi badla) — is RPC ke through customer
-- ko sirf tracking-relevant fields milte hain (address/phone jaise
-- sensitive fields nahi), aur sirf tab jab use poora sahi order_number
-- pata ho (jo use order place karte hi mil chuka hota hai) — jaise
-- real-world courier tracking IDs kaam karte hain.
-- ============================================================
create or replace function get_order_tracking(p_store_id uuid, p_order_number text)
returns table (
  order_number text, status text, order_type text, items jsonb, total numeric, created_at timestamptz,
  delivery_boy_name text, delivery_boy_phone text
)
language sql
security definer
set search_path = public
as $$
  select o.order_number, o.status, o.order_type, o.items, o.total, o.created_at,
    db.name, db.phone
  from orders o
  left join delivery_boys db on db.id = o.delivery_boy_id
  where o.store_id = p_store_id and o.order_number = p_order_number
  limit 1;
$$;

grant execute on function get_order_tracking(uuid, text) to anon, authenticated;

-- ============================================================
-- NOTE: Existing orders (jinka order_type column pehle nahi tha) sab
-- automatically 'Delivery' ban jaayenge (default value) — koi manual
-- data-fix nahi chahiye. Existing status flow (New/Accepted/Preparing/
-- Out for Delivery/Delivered) bilkul same rehta hai — app-level UI
-- naya "Ready" status intermediate step ke roop mein use karega.
-- ============================================================
