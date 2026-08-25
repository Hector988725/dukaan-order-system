-- ============================================================
-- MULTI-TENANT UPGRADE - NEW SCHEMA
-- ============================================================
-- Yeh schema purane single-store setup ko replace karta hai.
-- Ab har dukaandar apna account bana sakta hai aur uski apni
-- alag dukaan (store) hogi, apne URL slug ke saath.
--
-- IMPORTANT: Agar aapne pehle wala schema.sql already chalaya
-- hai, toh pehle purane tables delete karein (neeche section 0),
-- fir yeh poora file run karein.
-- ============================================================

-- ============================================================
-- 0. PURANE TABLES HATAYEIN (agar pehle se hain)
-- ============================================================
drop table if exists orders cascade;
drop table if exists variants cascade;
drop table if exists products cascade;
drop table if exists stores cascade;

-- ============================================================
-- 1. STORES TABLE (ab user_id se linked - owner kaun hai)
-- ============================================================
create table stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  slug text unique not null,
  name text not null,
  business_type text default 'general',  -- 'kirana', 'hardware', 'medical', 'mobile', 'general'
  whatsapp_number text not null,
  upi_id text,
  address text,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. PRODUCTS TABLE
-- ============================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  name text not null,
  category text not null,
  emoji text default '📦',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. VARIANTS TABLE
-- ============================================================
create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  label text not null,
  unit text not null,
  price numeric not null,
  stock int not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- 4. ORDERS TABLE
-- ============================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  order_number text not null,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  landmark text,
  pincode text not null,
  payment_method text not null,
  items jsonb not null,
  total numeric not null,
  status text not null default 'new',
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_stores_user on stores(user_id);
create index idx_stores_slug on stores(slug);
create index idx_products_store on products(store_id);
create index idx_variants_product on variants(product_id);
create index idx_orders_store on orders(store_id);
create index idx_orders_status on orders(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Ownership-based
-- ============================================================
-- Core idea:
-- - Koi bhi (customer) STORE/PRODUCTS/VARIANTS dekh sakta hai (storefront ke liye)
-- - Koi bhi ORDER bana sakta hai (customer order place karega)
-- - Sirf STORE KA OWNER apne store ka data EDIT/DELETE kar sakta hai
-- - Sirf STORE KA OWNER apne orders dekh/update kar sakta hai

alter table stores enable row level security;
alter table products enable row level security;
alter table variants enable row level security;
alter table orders enable row level security;

-- ---- STORES ----
create policy "Anyone can view stores" on stores for select using (true);
create policy "Owner can insert own store" on stores for insert with check (auth.uid() = user_id);
create policy "Owner can update own store" on stores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owner can delete own store" on stores for delete using (auth.uid() = user_id);

-- ---- PRODUCTS ----
create policy "Anyone can view products" on products for select using (true);
create policy "Owner can insert products" on products for insert
  with check (exists (select 1 from stores where stores.id = products.store_id and stores.user_id = auth.uid()));
create policy "Owner can update products" on products for update
  using (exists (select 1 from stores where stores.id = products.store_id and stores.user_id = auth.uid()));
create policy "Owner can delete products" on products for delete
  using (exists (select 1 from stores where stores.id = products.store_id and stores.user_id = auth.uid()));

-- ---- VARIANTS ----
create policy "Anyone can view variants" on variants for select using (true);
create policy "Owner can insert variants" on variants for insert
  with check (exists (
    select 1 from products join stores on stores.id = products.store_id
    where products.id = variants.product_id and stores.user_id = auth.uid()
  ));
create policy "Owner can update variants" on variants for update
  using (exists (
    select 1 from products join stores on stores.id = products.store_id
    where products.id = variants.product_id and stores.user_id = auth.uid()
  ));
create policy "Owner can delete variants" on variants for delete
  using (exists (
    select 1 from products join stores on stores.id = products.store_id
    where products.id = variants.product_id and stores.user_id = auth.uid()
  ));

-- ---- ORDERS ----
-- Customer (jo logged in nahi hai) order bana sake
create policy "Anyone can create orders" on orders for insert with check (true);
-- Sirf store owner apne orders dekh sake
create policy "Owner can view own orders" on orders for select
  using (exists (select 1 from stores where stores.id = orders.store_id and stores.user_id = auth.uid()));
-- Sirf store owner order status update kar sake
create policy "Owner can update own orders" on orders for update
  using (exists (select 1 from stores where stores.id = orders.store_id and stores.user_id = auth.uid()));

-- ============================================================
-- HELPER FUNCTION: Naya store banate waqt slug unique check karna
-- ============================================================
create or replace function is_slug_available(check_slug text)
returns boolean as $$
begin
  return not exists (select 1 from stores where slug = check_slug);
end;
$$ language plpgsql security definer;

-- ============================================================
-- NOTE: Demo/sample data is file mein nahi hai.
-- Naya dukaandar signup karega toh uska store empty banega,
-- aur woh khud Admin Panel se apne products add karega.
-- ============================================================
