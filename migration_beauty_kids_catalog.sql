-- ============================================================
-- NAYI SHOP CATEGORIES: Cosmetics / Beauty  +  Gift / Toys / Kids
-- + CENTRAL PRODUCT CATALOG + SUPER ADMIN CONTROL
-- ============================================================
-- Yeh koi alag system nahi hai — wahi stores / products / variants /
-- orders / place_order / GST / RLS use hota hai. Bas yeh add hota hai:
--
--   1. business_type_settings — type enable/disable + label/description
--      (signup dropdown ise padhta hai; row na ho to type enabled maana
--      jaata hai, isliye purane types par koi asar nahi)
--   2. business_categories    — category -> sub-category list, har type ke liye
--   3. catalog_brands         — brand suggestions
--   4. catalog_products       — Central Product Catalog (super admin manage karta hai)
--   5. products mein 4 NAYE NULLABLE columns: brand, sub_category,
--      age_group, catalog_product_id  (purane products jaise the waise)
--   6. add_catalog_product_to_shop() — catalog se "Add to My Shop"
--      (apna selling price + apna stock; stock centralized logic se)
--
-- Purane shops/products/orders/inventory/GST/auth/RLS ko yeh file
-- TOUCH nahi karti: sirf naye tables + products mein nullable columns.
--
-- Pehle migration_purchase_supplier.sql chali honi chahiye
-- (apply_stock_change wahin hai).
-- ============================================================

do $$
begin
  if to_regprocedure('apply_stock_change(uuid,uuid,integer,text,text,uuid,text,boolean)') is null then
    raise exception 'Pehle migration_purchase_supplier.sql run karein (apply_stock_change chahiye).';
  end if;
  if to_regclass('public.super_admins') is null then
    raise exception 'Pehle migration_superadmin.sql run karein (super_admins table chahiye).';
  end if;
end $$;

-- ------------------------------------------------------------
-- 0. Super admin check (RLS policies mein use hota hai)
-- ------------------------------------------------------------
create or replace function _is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from super_admins where email = auth.email());
$$;
grant execute on function _is_super_admin() to anon, authenticated;

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------
create table if not exists business_type_settings (
  business_type text primary key,
  is_enabled boolean not null default true,
  label text,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists business_categories (
  id uuid primary key default gen_random_uuid(),
  business_type text not null,
  name text not null,
  parent_id uuid references business_categories(id) on delete cascade,  -- null = main category
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_business_categories
  on business_categories (business_type, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists idx_business_categories_type on business_categories (business_type, sort_order);

create table if not exists catalog_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,            -- null = sabhi types ke liye
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_catalog_brands on catalog_brands (lower(name), coalesce(business_type, ''));

create table if not exists catalog_products (
  id uuid primary key default gen_random_uuid(),
  business_type text not null,
  name text not null,
  brand text,
  category text not null,
  sub_category text,
  description text,
  image_url text,
  mrp numeric,
  gst_rate numeric not null default 0,
  barcode text,
  unit text not null default 'piece',
  age_group text,
  variants jsonb not null default '[]'::jsonb,  -- optional: [{"label":"Shade 01","unit":"piece","mrp":199,"barcode":"..."}]
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_catalog_products_type on catalog_products (business_type, is_active);

-- products: naye nullable columns (purane rows NULL rahenge)
alter table products add column if not exists brand text;
alter table products add column if not exists sub_category text;
alter table products add column if not exists age_group text;
alter table products add column if not exists catalog_product_id uuid references catalog_products(id) on delete set null;
-- ek catalog product ek shop mein sirf ek baar
create unique index if not exists uq_products_store_catalog
  on products (store_id, catalog_product_id) where catalog_product_id is not null;

-- ------------------------------------------------------------
-- 2. RLS
--    * settings / categories: public config -> sabhi padh sakte hain
--    * brands / catalog products: sirf apne business type ke shop ka owner padh sakta hai
--    * likhna: SIRF super admin
-- ------------------------------------------------------------
alter table business_type_settings enable row level security;
alter table business_categories enable row level security;
alter table catalog_brands enable row level security;
alter table catalog_products enable row level security;

revoke all on business_type_settings, business_categories, catalog_brands, catalog_products from anon;
grant select on business_type_settings, business_categories to anon;
grant select, insert, update, delete on business_type_settings, business_categories, catalog_brands, catalog_products to authenticated;

drop policy if exists "Anyone reads type settings" on business_type_settings;
create policy "Anyone reads type settings" on business_type_settings for select using (true);
drop policy if exists "Super admin writes type settings" on business_type_settings;
create policy "Super admin writes type settings" on business_type_settings for all
  using (_is_super_admin()) with check (_is_super_admin());

drop policy if exists "Anyone reads business categories" on business_categories;
create policy "Anyone reads business categories" on business_categories for select using (true);
drop policy if exists "Super admin writes business categories" on business_categories;
create policy "Super admin writes business categories" on business_categories for all
  using (_is_super_admin()) with check (_is_super_admin());

drop policy if exists "Logged-in reads brands" on catalog_brands;
drop policy if exists "Owners read brands of own type" on catalog_brands;
create policy "Owners read brands of own type" on catalog_brands for select
  using (
    _is_super_admin()
    or (is_active and exists (
      select 1 from stores s
      where s.user_id = auth.uid() and (catalog_brands.business_type is null or s.business_type = catalog_brands.business_type)
    ))
  );
drop policy if exists "Super admin writes brands" on catalog_brands;
create policy "Super admin writes brands" on catalog_brands for all
  using (_is_super_admin()) with check (_is_super_admin());

drop policy if exists "Logged-in reads catalog products" on catalog_products;
drop policy if exists "Owners read catalog of own type" on catalog_products;
create policy "Owners read catalog of own type" on catalog_products for select
  using (
    _is_super_admin()
    or (is_active and exists (
      select 1 from stores s
      where s.user_id = auth.uid() and s.business_type = catalog_products.business_type
    ))
  );
drop policy if exists "Super admin writes catalog products" on catalog_products;
create policy "Super admin writes catalog products" on catalog_products for all
  using (_is_super_admin()) with check (_is_super_admin());

-- ------------------------------------------------------------
-- 3. CATALOG -> "ADD TO MY SHOP"
--    p_variants: [{"label","unit","price","mrp","stock","barcode","gst_rate"}]
--    Selling price + stock dukaandar ka apna; baaki catalog se prefill.
--    Stock centralized apply_stock_change se (stock_movements mein 'opening').
-- ------------------------------------------------------------
create or replace function add_catalog_product_to_shop(
  p_store_id uuid,
  p_catalog_product_id uuid,
  p_variants jsonb,
  p_brand text default null
)
returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store stores;
  cp catalog_products;
  prod products;
  item jsonb;
  v_price numeric;
  v_stock int;
  v_label text;
  v_var_id uuid;
  v_next_order int;
begin
  perform _assert_store_owner(p_store_id);

  select * into v_store from stores where id = p_store_id;
  select * into cp from catalog_products where id = p_catalog_product_id and is_active;
  if not found then
    raise exception 'Catalog product nahi mila';
  end if;
  if cp.business_type is distinct from v_store.business_type then
    raise exception 'Yeh catalog product is dukaan ke type ka nahi hai';
  end if;
  if exists (select 1 from products where store_id = p_store_id and catalog_product_id = cp.id) then
    raise exception 'Yeh product aapki dukaan mein pehle se hai';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'Kam se kam ek variant (price ke saath) daalein';
  end if;

  -- validate sab pehle
  for item in select * from jsonb_array_elements(p_variants)
  loop
    v_price := (item->>'price')::numeric;
    v_stock := coalesce((item->>'stock')::int, 0);
    if v_price is null or v_price <= 0 then
      raise exception 'Selling price 0 se zyada hona chahiye';
    end if;
    if v_stock < 0 then
      raise exception 'Stock negative nahi ho sakta';
    end if;
  end loop;

  select coalesce(max(sort_order), 0) + 1 into v_next_order from products where store_id = p_store_id;

  insert into products (store_id, name, category, emoji, sort_order, description, image_url, image_urls, brand, sub_category, age_group, catalog_product_id)
  values (
    p_store_id, cp.name, cp.category, '📦', v_next_order, cp.description, cp.image_url,
    case when cp.image_url is null then '[]'::jsonb else jsonb_build_array(cp.image_url) end,
    coalesce(nullif(trim(p_brand), ''), cp.brand), cp.sub_category, cp.age_group, cp.id
  )
  returning * into prod;

  for item in select * from jsonb_array_elements(p_variants)
  loop
    v_label := coalesce(nullif(trim(item->>'label'), ''), 'Standard');
    v_stock := coalesce((item->>'stock')::int, 0);

    insert into variants (product_id, label, unit, price, stock, mrp, barcode, gst_rate)
    values (
      prod.id, v_label,
      coalesce(nullif(trim(item->>'unit'), ''), cp.unit, 'piece'),
      (item->>'price')::numeric, 0,
      nullif(item->>'mrp', '')::numeric,
      nullif(trim(item->>'barcode'), ''),
      coalesce(nullif(item->>'gst_rate', '')::numeric, cp.gst_rate, 0)
    )
    returning id into v_var_id;

    if v_stock > 0 then
      perform apply_stock_change(p_store_id, v_var_id, v_stock, 'opening', 'catalog', prod.id, 'Added from Central Catalog');
    end if;
  end loop;

  return prod;
end;
$$;
grant execute on function add_catalog_product_to_shop(uuid, uuid, jsonb, text) to authenticated;

-- ------------------------------------------------------------
-- 4. SEED — types, categories, sub-categories, brands, starter catalog
--    (idempotent: dobara chalane par duplicate nahi banta.)
--    Starter catalog products generic hain, bina MRP / GST ke —
--    Super Admin apne hisaab se edit/add karega.
-- ------------------------------------------------------------
insert into business_type_settings (business_type, is_enabled, label, description) values
  ('cosmetics', true, 'Cosmetics / Beauty Store', 'Makeup, skin care, hair care aur beauty products ek hi jagah'),
  ('giftstoy',  true, 'Gift / Toys / Kids Store', 'Toys, games, gifts aur bachchon ka saaman')
on conflict (business_type) do nothing;

-- (Koi temporary table use nahi hota — Supabase SQL Editor mein temp tables
--  script ke beech gayab ho jaate hain. Isliye seed seedha VALUES se hota hai.)

-- categories + sub-categories
do $seed$
declare
  r record;
  v_main_id uuid;
begin
  for r in
    select * from (values
  ('cosmetics','Makeup','Lipstick',1),('cosmetics','Makeup','Lip Gloss',2),('cosmetics','Makeup','Foundation',3),
  ('cosmetics','Makeup','Compact',4),('cosmetics','Makeup','Concealer',5),('cosmetics','Makeup','Blush',6),
  ('cosmetics','Makeup','Eyeliner',7),('cosmetics','Makeup','Kajal',8),('cosmetics','Makeup','Mascara',9),
  ('cosmetics','Makeup','Nail Polish',10),
  ('cosmetics','Face Care','Face Wash',1),('cosmetics','Face Care','Moisturizer',2),('cosmetics','Face Care','Sunscreen',3),
  ('cosmetics','Face Care','Serum',4),('cosmetics','Face Care','Toner',5),
  ('cosmetics','Hair Care','Shampoo',1),('cosmetics','Hair Care','Conditioner',2),('cosmetics','Hair Care','Hair Oil',3),
  ('cosmetics','Hair Care','Hair Color',4),('cosmetics','Hair Care','Hair Styling',5),
  ('cosmetics','Body Care','Body Lotion',1),('cosmetics','Body Care','Body Wash',2),('cosmetics','Body Care','Deodorant',3),
  ('cosmetics','Perfume / Fragrance',null,0),
  ('cosmetics','Personal Care',null,0),
  ('cosmetics','Beauty Accessories','Brushes & Applicators',1),('cosmetics','Beauty Accessories','Combs',2),('cosmetics','Beauty Accessories','Mirrors',3),
  ('cosmetics','Other Beauty Products',null,0),
  ('giftstoy','Toys','Soft Toys',1),('giftstoy','Toys','Educational Toys',2),('giftstoy','Toys','Remote Control Toys',3),
  ('giftstoy','Toys','Baby Toys',4),('giftstoy','Toys','Dolls',5),('giftstoy','Toys','Cars & Vehicles',6),
  ('giftstoy','Toys','Action Figures',7),('giftstoy','Toys','Building Blocks',8),
  ('giftstoy','Games & Puzzles','Board Games',1),('giftstoy','Games & Puzzles','Puzzles',2),
  ('giftstoy','Games & Puzzles','Outdoor Games',3),('giftstoy','Games & Puzzles','Indoor Games',4),
  ('giftstoy','Kids Books & School','Kids Books',1),('giftstoy','Kids Books & School','School Supplies',2),
  ('giftstoy','Party & Birthday','Birthday Items',1),('giftstoy','Party & Birthday','Party Decorations',2),
  ('giftstoy','Gifts','Gift Items',1),('giftstoy','Gifts','Gift Hampers',2),('giftstoy','Gifts','Greeting Cards',3),('giftstoy','Gifts','Gift Wrapping',4),
  ('giftstoy','Kids & Baby Accessories','Kids Accessories',1),('giftstoy','Kids & Baby Accessories','Baby Accessories',2),
  ('giftstoy','Other Kids/Gift Products',null,0)
    ) as s(bt, main, sub, ord)
  loop
    select id into v_main_id from business_categories
      where business_type = r.bt and name = r.main and parent_id is null;
    if v_main_id is null then
      insert into business_categories (business_type, name, sort_order)
      values (r.bt, r.main, (select coalesce(max(sort_order), 0) + 1 from business_categories where business_type = r.bt and parent_id is null))
      returning id into v_main_id;
    end if;
    if r.sub is not null then
      insert into business_categories (business_type, name, parent_id, sort_order)
      values (r.bt, r.sub, v_main_id, r.ord)
      on conflict do nothing;
    end if;
  end loop;
end
$seed$;

insert into catalog_brands (name, business_type) values
  ('Lakme','cosmetics'),('Maybelline','cosmetics'),('L''Oreal Paris','cosmetics'),('Nivea','cosmetics'),
  ('Himalaya','cosmetics'),('Garnier','cosmetics'),('Dove','cosmetics'),('Colorbar','cosmetics'),
  ('Sugar','cosmetics'),('Mamaearth','cosmetics'),('Biotique','cosmetics'),('Ponds','cosmetics'),
  ('Vaseline','cosmetics'),('Neutrogena','cosmetics'),('Revlon','cosmetics'),('Streax','cosmetics'),
  ('Pantene','cosmetics'),('Head & Shoulders','cosmetics'),('Clinic Plus','cosmetics'),('Parachute','cosmetics'),
  ('Fogg','cosmetics'),('Wild Stone','cosmetics'),('Plum','cosmetics'),('Minimalist','cosmetics'),
  ('Faces Canada','cosmetics'),('Swiss Beauty','cosmetics'),('Lotus Herbals','cosmetics'),
  ('Funskool','giftstoy'),('Hot Wheels','giftstoy'),('Barbie','giftstoy'),('Lego','giftstoy'),
  ('Hasbro','giftstoy'),('Fisher-Price','giftstoy'),('Skillmatics','giftstoy'),('Webby','giftstoy'),
  ('Ratnas','giftstoy'),('Archies','giftstoy'),('Camlin','giftstoy'),('Classmate','giftstoy'),
  ('Doms','giftstoy'),('Nataraj','giftstoy')
on conflict do nothing;

-- starter catalog (generic naam, koi brand/MRP/GST nahi)
insert into catalog_products (business_type, name, category, sub_category, unit, age_group)
select s.bt, s.name, s.cat, s.sub, s.unit, s.age
from (values
  ('cosmetics','Matte Lipstick','Makeup','Lipstick','piece',null),
  ('cosmetics','Liquid Lip Gloss','Makeup','Lip Gloss','piece',null),
  ('cosmetics','Liquid Foundation','Makeup','Foundation','bottle',null),
  ('cosmetics','Compact Powder','Makeup','Compact','piece',null),
  ('cosmetics','Concealer Stick','Makeup','Concealer','piece',null),
  ('cosmetics','Blush Palette','Makeup','Blush','piece',null),
  ('cosmetics','Waterproof Eyeliner','Makeup','Eyeliner','piece',null),
  ('cosmetics','Smudge-proof Kajal','Makeup','Kajal','piece',null),
  ('cosmetics','Volumizing Mascara','Makeup','Mascara','piece',null),
  ('cosmetics','Nail Polish','Makeup','Nail Polish','bottle',null),
  ('cosmetics','Gel Face Wash','Face Care','Face Wash','tube',null),
  ('cosmetics','Daily Moisturizer','Face Care','Moisturizer','tube',null),
  ('cosmetics','Sunscreen Lotion','Face Care','Sunscreen','tube',null),
  ('cosmetics','Face Serum','Face Care','Serum','bottle',null),
  ('cosmetics','Face Toner','Face Care','Toner','bottle',null),
  ('cosmetics','Shampoo','Hair Care','Shampoo','bottle',null),
  ('cosmetics','Conditioner','Hair Care','Conditioner','bottle',null),
  ('cosmetics','Hair Oil','Hair Care','Hair Oil','bottle',null),
  ('cosmetics','Hair Color','Hair Care','Hair Color','box',null),
  ('cosmetics','Hair Gel / Wax','Hair Care','Hair Styling','jar',null),
  ('cosmetics','Body Lotion','Body Care','Body Lotion','bottle',null),
  ('cosmetics','Body Wash','Body Care','Body Wash','bottle',null),
  ('cosmetics','Deodorant Spray','Body Care','Deodorant','bottle',null),
  ('cosmetics','Perfume','Perfume / Fragrance',null,'bottle',null),
  ('cosmetics','Makeup Brush Set','Beauty Accessories','Brushes & Applicators','piece',null),
  ('cosmetics','Hair Comb','Beauty Accessories','Combs','piece',null),
  ('cosmetics','Compact Mirror','Beauty Accessories','Mirrors','piece',null),
  ('giftstoy','Soft Teddy Bear','Toys','Soft Toys','piece','All ages'),
  ('giftstoy','Educational Learning Toy','Toys','Educational Toys','piece','3-6 years'),
  ('giftstoy','Remote Control Car','Toys','Remote Control Toys','piece','5+ years'),
  ('giftstoy','Baby Rattle Set','Toys','Baby Toys','set','0-2 years'),
  ('giftstoy','Doll','Toys','Dolls','piece','3+ years'),
  ('giftstoy','Toy Car','Toys','Cars & Vehicles','piece','3+ years'),
  ('giftstoy','Action Figure','Toys','Action Figures','piece','5+ years'),
  ('giftstoy','Building Blocks Set','Toys','Building Blocks','box','3+ years'),
  ('giftstoy','Board Game','Games & Puzzles','Board Games','box','6+ years'),
  ('giftstoy','Jigsaw Puzzle','Games & Puzzles','Puzzles','box','5+ years'),
  ('giftstoy','Outdoor Game Set','Games & Puzzles','Outdoor Games','set','5+ years'),
  ('giftstoy','Indoor Game','Games & Puzzles','Indoor Games','box','5+ years'),
  ('giftstoy','Kids Story Book','Kids Books & School','Kids Books','piece','3-8 years'),
  ('giftstoy','School Supplies Kit','Kids Books & School','School Supplies','set','5+ years'),
  ('giftstoy','Birthday Candle Set','Party & Birthday','Birthday Items','packet',null),
  ('giftstoy','Party Decoration Kit','Party & Birthday','Party Decorations','set',null),
  ('giftstoy','Gift Item','Gifts','Gift Items','piece',null),
  ('giftstoy','Gift Hamper','Gifts','Gift Hampers','box',null),
  ('giftstoy','Greeting Card','Gifts','Greeting Cards','piece',null),
  ('giftstoy','Gift Wrapping Paper','Gifts','Gift Wrapping','pack',null),
  ('giftstoy','Kids Hair Accessories','Kids & Baby Accessories','Kids Accessories','set',null),
  ('giftstoy','Baby Accessories','Kids & Baby Accessories','Baby Accessories','set','0-2 years')
) as s(bt, name, cat, sub, unit, age)
where not exists (select 1 from catalog_products c where c.business_type = s.bt and lower(c.name) = lower(s.name));
