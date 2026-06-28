-- ============================================================
-- DUKAAN ORDER SYSTEM - DATABASE SCHEMA
-- ============================================================
-- Yeh file Supabase ke SQL Editor mein paste karni hai.
-- Isse 4 tables banegi: stores, products, variants, orders
-- ============================================================

-- 1. STORES TABLE
-- Har dukaandar ki entry yahan hogi. "slug" unke store ka unique URL naam hai
-- jaise: yourapp.com/sharma-kirana  -> slug = "sharma-kirana"
create table stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  whatsapp_number text not null,
  upi_id text,
  address text,
  created_at timestamptz default now()
);

-- 2. PRODUCTS TABLE
-- Har product ek store se juda hota hai (store_id se)
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  name text not null,
  category text not null,
  emoji text default '📦',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 3. VARIANTS TABLE
-- Har product ke andar 1 ya zyada variants (alag rate/size/brand)
-- Yahi feature hai jisse "Chini Normal ₹42" aur "Chini Madhur Brand ₹52" alag-alag store hote hain
create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  label text not null,        -- jaise "Normal", "Madhur Brand", "Basmati Premium"
  unit text not null,          -- jaise "kg", "litre", "packet", "piece"
  price numeric not null,
  stock int not null default 0,
  created_at timestamptz default now()
);

-- 4. ORDERS TABLE
-- Har customer order yahan store hota hai
create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  order_number text not null,   -- jaise "ORD1042" - dikhane ke liye
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  landmark text,
  pincode text not null,
  payment_method text not null,  -- "COD" ya "UPI Paid"
  items jsonb not null,           -- order ke saare items ek JSON array mein
  total numeric not null,
  status text not null default 'new',  -- 'new' | 'preparing' | 'delivered'
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES - taaki data fast load ho
-- ============================================================
create index idx_products_store on products(store_id);
create index idx_variants_product on variants(product_id);
create index idx_orders_store on orders(store_id);
create index idx_orders_status on orders(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Yeh zaroori hai taaki:
-- - Customer sirf products dekh sake, orders bana sake
-- - Dukaandar apne hi store ka data dekh/badal sake
alter table stores enable row level security;
alter table products enable row level security;
alter table variants enable row level security;
alter table orders enable row level security;

-- Sabko products/stores dekhne dein (public storefront ke liye)
create policy "Public can view stores" on stores for select using (true);
create policy "Public can view products" on products for select using (true);
create policy "Public can view variants" on variants for select using (true);

-- Sabko order banane dein (customer order place karega)
create policy "Public can create orders" on orders for insert with check (true);

-- Abhi demo ke liye dukaandar ko bhi public access se admin karne dein.
-- NOTE: Jab real multiple-dukaandar system banayenge, isse "authenticated"
-- users tak limit karna padega (login system ke saath) - abhi single-store
-- testing ke liye yeh simple rakha hai.
create policy "Public can view orders" on orders for select using (true);
create policy "Public can update orders" on orders for update using (true);
create policy "Public can update variant stock" on variants for update using (true);
create policy "Public can insert products" on products for insert with check (true);
create policy "Public can insert variants" on variants for insert with check (true);

-- ============================================================
-- SAMPLE DATA (Demo Kirana Store)
-- ============================================================
insert into stores (slug, name, whatsapp_number, upi_id, address)
values ('sharma-kirana', 'Sharma Kirana Store', '919876543210', 'sharmakirana@upi', 'Bus Stand Road, Amānganj');

-- Products + Variants ko ek saath insert karne ke liye, hum store ka id nikalenge
do $$
declare
  v_store_id uuid;
  v_product_id uuid;
begin
  select id into v_store_id from stores where slug = 'sharma-kirana';

  -- Chini (Sugar)
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Chini (Sugar)', 'Staples', '🧂', 1) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Normal', 'kg', 42, 35),
    (v_product_id, 'Madhur Brand', 'kg', 52, 12);

  -- Chawal (Rice)
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Chawal (Rice)', 'Rice & Grains', '🍚', 2) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Sela Rice', 'kg', 68, 60),
    (v_product_id, 'Basmati - Daily', 'kg', 95, 40),
    (v_product_id, 'Basmati - Premium', 'kg', 140, 10);

  -- Khaane ka Tel (Oil)
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Khaane ka Tel (Oil)', 'Oil & Ghee', '🛢️', 3) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Sarso Tel - 1 Litre Pouch', 'pouch', 165, 24),
    (v_product_id, 'Sarso Tel - 5 Litre Tin', 'tin', 780, 8),
    (v_product_id, 'Fortune Sunflower - 1 Litre', 'pouch', 195, 15);

  -- Toor Dal
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Toor Dal', 'Dal & Pulses', '🫘', 4) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Normal', 'kg', 130, 24),
    (v_product_id, 'Premium (Chamakti)', 'kg', 155, 16);

  -- Atta (Wheat Flour)
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Atta (Wheat Flour)', 'Rice & Grains', '🌾', 5) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Local Chakki', 'kg', 32, 50),
    (v_product_id, 'Aashirvaad - 10kg Bag', 'bag', 410, 9);

  -- Lal Mirch Powder
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Lal Mirch Powder', 'Spices', '🌶️', 6) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Normal', 'kg', 220, 0),
    (v_product_id, 'Kashmiri', 'kg', 320, 0);

  -- Haldi Powder
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Haldi Powder', 'Spices', '✨', 7) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Normal', 'kg', 180, 12);

  -- Chai Patti (Tea)
  insert into products (store_id, name, category, emoji, sort_order) values (v_store_id, 'Chai Patti (Tea)', 'Beverages', '🍵', 8) returning id into v_product_id;
  insert into variants (product_id, label, unit, price, stock) values
    (v_product_id, 'Local - 250g Packet', 'packet', 85, 20),
    (v_product_id, 'Tata Tea Gold - 1kg', 'packet', 460, 6);
end $$;
