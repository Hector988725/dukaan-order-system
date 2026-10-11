-- ============================================================
-- SECURITY FIX: Customers table data leak
-- ============================================================
-- PEHLE: "Anyone can view customer by phone" using (true) — is policy
-- ki wajah se koi bhi (public anon key se) SEEDHA poori customers
-- table padh sakta tha: `GET /rest/v1/customers?select=*` — matlab
-- sabhi stores ke sabhi customers ka naam/phone/address ek saath leak
-- ho sakta tha, sirf apna record nahi.
--
-- AB: Table ka direct SELECT access poori tarah band kar diya hai.
-- Lookup ab sirf ek RPC function (`get_customer_by_phone`) ke through
-- hota hai jo security-definer hai — yeh sirf EXACT store_id + phone
-- match wala ek record return karta hai, poori table kabhi expose
-- nahi hoti.
-- ============================================================

drop policy if exists "Anyone can view customer by phone" on customers;

create or replace function get_customer_by_phone(p_store_id uuid, p_phone text)
returns table (
  id uuid, store_id uuid, phone text, name text,
  address text, landmark text, pincode text, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, store_id, phone, name, address, landmark, pincode, updated_at
  from customers
  where store_id = p_store_id and phone = p_phone
  limit 1;
$$;

grant execute on function get_customer_by_phone(uuid, text) to anon, authenticated;
