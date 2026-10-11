-- ============================================================
-- KHATA / UDHAARI SYSTEM
-- ============================================================
-- Dukaandar aur customer dono ko EK HI record dikhna chahiye — isliye
-- yeh ek single ledger table hai (source of truth), koi alag copy
-- dukaandar-side aur customer-side ke liye nahi banayi. Dono taraf se
-- reads isi table se hoti hain (alag RPCs se, security ke liye), isliye
-- dispute (dukaandar bole kuch, customer bole kuch) structurally ho hi
-- nahi sakta.
--
-- Balance store karne ke bajaye "running_balance" har transaction row
-- mein bhi save karte hain (audit/history ke liye asaan) + customers
-- table mein ek "khata_balance" column current balance ke liye — dono
-- ek hi atomic RPC (add_khata_transaction) ke through update hote hain,
-- isliye kabhi out-of-sync nahi ho sakte (jaise stock+order atomic hai).
-- ============================================================

-- ---- customers table mein current balance ----
alter table customers add column if not exists khata_balance numeric not null default 0;

-- Khata ke liye dukaandar ko aise customer bhi add karne hain jinhone
-- kabhi online order nahi kiya (sirf dukaan par aakar udhaar liya) —
-- unke paas address/pincode nahi hota. Yeh columns pehle NOT NULL the
-- (sirf checkout flow ke liye zaroori the) — ab optional kar rahe hain.
-- Existing rows par koi asar nahi (unke values already bhare hain).
alter table customers alter column address drop not null;
alter table customers alter column pincode drop not null;

-- ---- ledger: har udhaar/payment ki entry ----
create table if not exists khata_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  type text not null check (type in ('debit', 'credit')), -- debit = naya udhaar (customer ka store se), credit = payment mila
  amount numeric not null check (amount > 0),
  description text, -- jaise "Order ORD1234", "Cash payment received", "Advance"
  running_balance numeric not null, -- is transaction ke baad ka balance (audit trail ke liye, snapshot)
  created_by uuid references auth.users(id), -- dukaandar jisne entry ki (order-linked ho to null reh sakta hai)
  order_id uuid references orders(id) on delete set null, -- agar order se link hai (COD-udhaar jaisa case)
  created_at timestamptz default now()
);

create index if not exists idx_khata_store on khata_transactions(store_id);
create index if not exists idx_khata_customer on khata_transactions(customer_id);
create index if not exists idx_khata_created_at on khata_transactions(created_at);

alter table khata_transactions enable row level security;

-- Existing customers table jaisa hi pattern: direct SELECT/INSERT kisi
-- ko bhi nahi milta (yeh customer ka financial data hai, customers
-- table se bhi zyada sensitive) — sab kuch RPC ke through, jo exact
-- ownership/phone-match check karta hai.
revoke all on khata_transactions from anon, authenticated;

-- ============================================================
-- RPC 0: Dukaandar ek naya "walk-in" customer bana sake sirf Khata ke
-- liye (jisne kabhi online order nahi kiya) — naam + phone se, address
-- optional. Agar is phone se pehle se record hai (online order se bana
-- ho ya pehle se khata mein add ho), wahi existing record return karta
-- hai — duplicate nahi banata.
-- ============================================================
create or replace function create_khata_customer(p_store_id uuid, p_phone text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into customers (store_id, phone, name, address, pincode)
  values (p_store_id, p_phone, p_name, null, null)
  on conflict (store_id, phone) do update set name = excluded.name
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function create_khata_customer(uuid, text, text) to authenticated;

-- ============================================================
-- RPC 1: Atomic transaction add karo + balance update karo
-- (jaisa place_order stock ke saath atomic hai)
-- ============================================================
create or replace function add_khata_transaction(
  p_store_id uuid,
  p_customer_id uuid,
  p_type text,
  p_amount numeric,
  p_description text
)
returns table (
  id uuid, new_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric;
  v_new_balance numeric;
  v_new_id uuid;
begin
  -- Sirf store ka owner hi khata entry add kar sake
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_type not in ('debit', 'credit') then
    raise exception 'Invalid transaction type';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount 0 se zyada hona chahiye';
  end if;

  -- Row lock lagakar current balance nikalo, taaki 2 entries same waqt
  -- add hone par race-condition se galat balance na bane.
  select khata_balance into v_current_balance from customers where id = p_customer_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Customer nahi mila';
  end if;

  v_new_balance := case when p_type = 'debit' then v_current_balance + p_amount else v_current_balance - p_amount end;

  update customers set khata_balance = v_new_balance where id = p_customer_id;

  insert into khata_transactions (store_id, customer_id, type, amount, description, running_balance, created_by)
  values (p_store_id, p_customer_id, p_type, p_amount, p_description, v_new_balance, auth.uid())
  returning khata_transactions.id into v_new_id;

  return query select v_new_id, v_new_balance;
end;
$$;

grant execute on function add_khata_transaction(uuid, uuid, text, numeric, text) to authenticated;

-- ============================================================
-- RPC 2: Dukaandar ka poora Khata overview (dashboard summary + list)
-- ============================================================
create or replace function get_store_khata_overview(p_store_id uuid)
returns table (
  customer_id uuid, customer_name text, customer_phone text, khata_balance numeric, last_transaction_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select c.id, c.name, c.phone, c.khata_balance,
    (select max(kt.created_at) from khata_transactions kt where kt.customer_id = c.id)
  from customers c
  where c.store_id = p_store_id and c.khata_balance != 0
  order by c.khata_balance desc;
end;
$$;

grant execute on function get_store_khata_overview(uuid) to authenticated;

-- ============================================================
-- RPC 3: Ek customer ki poori transaction history (dukaandar side)
-- ============================================================
create or replace function get_customer_khata_history(p_customer_id uuid)
returns table (
  id uuid, type text, amount numeric, description text, running_balance numeric, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from customers c join stores s on s.id = c.store_id
    where c.id = p_customer_id and s.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select kt.id, kt.type, kt.amount, kt.description, kt.running_balance, kt.created_at
  from khata_transactions kt
  where kt.customer_id = p_customer_id
  order by kt.created_at desc;
end;
$$;

grant execute on function get_customer_khata_history(uuid) to authenticated;

-- ============================================================
-- RPC 4: Customer apna khata dekh sake (guest, phone-based — jaise
-- get_customer_by_phone pattern). Read-only, koi edit customer se nahi
-- ho sakta — sirf dukaandar entry kar sakta hai.
-- ============================================================
create or replace function get_my_khata(p_store_id uuid, p_phone text)
returns table (
  khata_balance numeric,
  transactions jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    c.khata_balance,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', kt.type, 'amount', kt.amount, 'description', kt.description,
        'running_balance', kt.running_balance, 'created_at', kt.created_at
      ) order by kt.created_at desc)
      from khata_transactions kt where kt.customer_id = c.id
    ), '[]'::jsonb)
  from customers c
  where c.store_id = p_store_id and c.phone = p_phone
  limit 1;
$$;

grant execute on function get_my_khata(uuid, text) to anon, authenticated;

-- ============================================================
-- NOTE: Purane customers (jinka khata_balance pehle se 0 hai) is
-- feature se bilkul unaffected rehte hain — default 0 hai, koi
-- existing data touch nahi hota.
-- ============================================================
