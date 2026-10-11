-- ============================================================
-- SUPER ADMIN MIGRATION
-- Supabase SQL Editor mein paste karke Run karein
-- SAFE: Koi existing table modify/delete nahi hoga
-- ============================================================

-- 1. Super Admin table
create table if not exists super_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- RLS enable
alter table super_admins enable row level security;
create policy "Super admins can view own record" on super_admins
  for select using (auth.email() = email);

-- 2. Subscription Plans table (admin editable)
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  months int not null,
  price numeric not null,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table subscription_plans enable row level security;
create policy "Anyone can view plans" on subscription_plans for select using (true);
create policy "Super admin can manage plans" on subscription_plans for all
  using (exists (select 1 from super_admins where email = auth.email()));

-- 3. Default plans insert
insert into subscription_plans (name, months, price, sort_order) values
  ('1 Mahina', 1, 199, 1),
  ('3 Mahine', 3, 549, 2),
  ('6 Mahine', 6, 999, 3),
  ('1 Saal', 12, 1799, 4)
on conflict do nothing;

-- 4. Payments log table (Razorpay payments track karne ke liye)
create table if not exists payment_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  razorpay_payment_id text,
  razorpay_order_id text,
  amount numeric not null,
  status text not null default 'created', -- created | paid | failed
  months int default 1,
  created_at timestamptz default now()
);
alter table payment_logs enable row level security;
create policy "Store owner can view own payments" on payment_logs for select
  using (exists (select 1 from stores where stores.id = payment_logs.store_id and stores.user_id = auth.uid()));
create policy "Super admin can view all payments" on payment_logs for select
  using (exists (select 1 from super_admins where email = auth.email()));
create policy "Anyone can insert payment log" on payment_logs for insert with check (true);
create policy "Super admin can update payments" on payment_logs for update
  using (exists (select 1 from super_admins where email = auth.email()));

-- 5. Stores table mein owner contact ke liye view banate hain
-- (Taaki super admin user ka email/phone dekh sake without breaking RLS)
create or replace view store_details_admin as
  select
    s.id, s.slug, s.name, s.business_type, s.whatsapp_number,
    s.address, s.is_active, s.subscription_expires_at,
    s.subscription_plan, s.razorpay_subscription_id, s.created_at,
    u.email as owner_email,
    (select count(*) from orders o where o.store_id = s.id) as total_orders,
    (select coalesce(sum(o.total), 0) from orders o where o.store_id = s.id) as total_revenue,
    (select count(*) from products p where p.store_id = s.id) as total_products
  from stores s
  left join auth.users u on u.id = s.user_id;

-- 6. Super admin ka email yahan daalo (aapka email)
-- Yeh line run karne se pehle apna email daalo
insert into super_admins (email)
values ('officialhector365@gmail.com')
on conflict (email) do nothing;

-- ============================================================
-- VERIFICATION: Yeh query chalao aur check karo sab theek hai
-- ============================================================
-- select * from super_admins;
-- select * from subscription_plans;
-- select count(*) from stores;
