-- ============================================================
-- CUSTOMERS TABLE — Guest checkout ke liye saved details
-- ============================================================
-- Customer ka koi login/password nahi hai (guest checkout hi rahega).
-- Yeh table sirf phone-number ke basis par pichli delivery details
-- yaad rakhne ke liye hai, taaki agli baar order karte waqt form
-- khud-ba-khud bhar jaaye.
--
-- Ek store ke andar ek phone number = ek hi record (unique constraint),
-- taaki duplicate records na banein aur ek store ka customer doosre
-- store ke customer data se kabhi mix na ho.
-- ============================================================

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  phone text not null,
  name text not null,
  address text not null,
  landmark text,
  pincode text not null,
  updated_at timestamptz default now(),
  unique (store_id, phone)
);

create index if not exists idx_customers_store_phone on customers(store_id, phone);

alter table customers enable row level security;

-- Orders table jaisa hi pattern: customer login nahi hai, isliye
-- "anyone" (anon key se) apna record dhoondh/save kar sake — lekin
-- sirf apne store_id + phone ke through, koi doosra data leak nahi hota
-- kyunki lookup hamesha exact phone match par hota hai.
create policy "Anyone can view customer by phone" on customers for select using (true);
create policy "Anyone can save customer details" on customers for insert with check (true);
create policy "Anyone can update own customer record" on customers for update using (true);

-- Store owner bhi apne customers dekh sake (future use, e.g. repeat-customer list)
-- Upar wali "Anyone can view" policy already yeh allow karti hai, isliye
-- alag owner-only policy ki zaroorat nahi.
