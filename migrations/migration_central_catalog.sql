-- ============================================================
-- CENTRAL PRODUCT CATALOG — saare 12 shop types ke liye
-- ============================================================
-- Pichli migration (migration_beauty_kids_catalog.sql) ne catalog_products,
-- catalog_brands aur "Add to My Shop" already bana diya tha. Yeh migration:
--
--   1. products.is_available  — dukaandar ka "Available: Yes/No" (purane sab products = Yes)
--   2. add_catalog_product_to_shop() — ab availability bhi leta hai
--   3. get_catalog_link_status() — jin products ko Super Admin ne catalog se
--      deactivate kiya, unki owner ko warning dikhane ke liye (product safe rehta hai)
--   4. place_order() — SAME signature; bas "Available: No" product ka order reject
--   5. Baaki 10 shop types ka starter catalog (kirana, medical, kapde, mobile,
--      hardware, footwear, stationery, bakery, restaurant, salon)
--
-- Purane shops/products/orders/inventory/GST/RLS ko yeh badalti nahi:
-- ek default-true column + naye functions + naya data.
-- Pehle migration_purchase_supplier.sql aur migration_beauty_kids_catalog.sql chali honi chahiye.
-- ============================================================

do $$
begin
  if to_regclass('public.catalog_products') is null then
    raise exception 'Pehle migration_beauty_kids_catalog.sql run karein.';
  end if;
  if to_regprocedure('apply_stock_change(uuid,uuid,integer,text,text,uuid,text,boolean)') is null then
    raise exception 'Pehle migration_purchase_supplier.sql run karein.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Availability (shop-specific)
-- ------------------------------------------------------------
alter table products add column if not exists is_available boolean not null default true;

-- ------------------------------------------------------------
-- 2. Catalog -> Add to My Shop (availability ke saath)
--    p_variants: [{"label","unit","price","mrp","stock","barcode","gst_rate"}]
-- ------------------------------------------------------------
drop function if exists add_catalog_product_to_shop(uuid, uuid, jsonb, text);

create or replace function add_catalog_product_to_shop(
  p_store_id uuid,
  p_catalog_product_id uuid,
  p_variants jsonb,
  p_brand text default null,
  p_available boolean default true
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

  insert into products (store_id, name, category, emoji, sort_order, description, image_url, image_urls, brand, sub_category, age_group, catalog_product_id, is_available)
  values (
    p_store_id, cp.name, cp.category, '📦', v_next_order, cp.description, cp.image_url,
    case when cp.image_url is null then '[]'::jsonb else jsonb_build_array(cp.image_url) end,
    coalesce(nullif(trim(p_brand), ''), cp.brand), cp.sub_category, cp.age_group, cp.id,
    coalesce(p_available, true)
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
grant execute on function add_catalog_product_to_shop(uuid, uuid, jsonb, text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. Deactivated catalog products — owner ko sirf apni dukaan ke liye status
--    (catalog_products RLS inactive rows owner ko nahi dikhati, isliye yeh function)
-- ------------------------------------------------------------
create or replace function get_catalog_link_status(p_store_id uuid)
returns table (product_id uuid, catalog_product_id uuid, catalog_active boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select p.id, p.catalog_product_id, c.is_active
    from products p
    join catalog_products c on c.id = p.catalog_product_id
    where p.store_id = p_store_id and c.is_active = false;
end;
$$;
grant execute on function get_catalog_link_status(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. place_order — SAME signature; "Available: No" product ka order reject
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

    -- Dukaandar ne product ko "Available: No" kiya ho to order nahi (storefront bhi rokta hai,
    -- yeh server-side guard hai taaki seedha API call se bhi na ho sake)
    if exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = v_variant_id and p.store_id = p_store_id and p.is_available = false
    ) then
      raise exception 'STOCK_UNAVAILABLE: % abhi uplabdh nahi hai', v_product_name;
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


-- ============================================================
-- 5. STARTER CATALOG — baaki 10 shop types
--    Sirf naam / brand / category / unit — MRP, GST aur photo Super Admin
--    ("Categories & Catalog" tab -> Import CSV ya edit) se bharte hain.
--    (Ek exception: Parle-G, jo aapne example mein diya tha.)
--    Medical mein sirf OTC / general items hain. Idempotent: dobara chalane par duplicate nahi.
-- ============================================================
insert into catalog_products (business_type, name, brand, category, unit, mrp, gst_rate)
select s.bt, s.name, s.brand, s.cat, s.unit, s.mrp, coalesce(s.gst, 0)
from (values
  -- kirana
  ('kirana','Parle-G Biscuit','Parle','Biscuits & Snacks','79g',10::numeric,18::numeric),
  ('kirana','Good Day Butter Cookies','Britannia','Biscuits & Snacks','packet',null,null),
  ('kirana','Marie Gold Biscuit','Britannia','Biscuits & Snacks','packet',null,null),
  ('kirana','Maggi Noodles','Nestle','Biscuits & Snacks','packet',null,null),
  ('kirana','Aashirwad Atta','Aashirwad','Staples','kg',null,null),
  ('kirana','Tata Salt','Tata','Staples','kg',null,null),
  ('kirana','Sunflower Oil','Fortune','Staples','litre',null,null),
  ('kirana','Basmati Rice',null,'Staples','kg',null,null),
  ('kirana','Toor Dal',null,'Staples','kg',null,null),
  ('kirana','Sugar',null,'Staples','kg',null,null),
  ('kirana','Tea Powder','Brooke Bond','Beverages','packet',null,null),
  ('kirana','Butter','Amul','Dairy','packet',null,null),
  ('kirana','Detergent Powder','Surf Excel','Household','packet',null,null),
  ('kirana','Dishwash Bar','Vim','Household','piece',null,null),
  ('kirana','Toothpaste','Colgate','Personal Care','tube',null,null),
  ('kirana','Bathing Soap','Lifebuoy','Personal Care','piece',null,null),
  ('kirana','Turmeric Powder (Haldi)',null,'Spices','packet',null,null),
  ('kirana','Red Chilli Powder',null,'Spices','packet',null,null),
  -- medical (OTC / general)
  ('medical','Paracetamol 500mg Tablets',null,'Medicines (OTC)','strip',null,null),
  ('medical','Cetirizine 10mg Tablets',null,'Medicines (OTC)','strip',null,null),
  ('medical','ORS Powder',null,'Medicines (OTC)','packet',null,null),
  ('medical','Cough Syrup',null,'Medicines (OTC)','bottle',null,null),
  ('medical','Vapour Rub','Vicks','Medicines (OTC)','piece',null,null),
  ('medical','Antiseptic Liquid','Dettol','First Aid','bottle',null,null),
  ('medical','Adhesive Bandage (Pack)','Band-Aid','First Aid','packet',null,null),
  ('medical','Crepe Bandage',null,'First Aid','piece',null,null),
  ('medical','Cotton Roll',null,'First Aid','piece',null,null),
  ('medical','Hand Sanitizer',null,'Personal Care','bottle',null,null),
  ('medical','Digital Thermometer',null,'Health Devices','piece',null,null),
  ('medical','BP Monitor (Digital)',null,'Health Devices','piece',null,null),
  ('medical','Glucometer Strips',null,'Health Devices','box',null,null),
  ('medical','Face Mask (Pack of 10)',null,'Personal Care','packet',null,null),
  -- clothing
  ('clothing','Men''s T-Shirt',null,'Men','piece',null,null),
  ('clothing','Men''s Jeans',null,'Men','piece',null,null),
  ('clothing','Men''s Formal Shirt',null,'Men','piece',null,null),
  ('clothing','Track Pants',null,'Men','piece',null,null),
  ('clothing','Kurta',null,'Men','piece',null,null),
  ('clothing','Saree',null,'Women','piece',null,null),
  ('clothing','Kurti',null,'Women','piece',null,null),
  ('clothing','Leggings',null,'Women','piece',null,null),
  ('clothing','Dupatta',null,'Women','piece',null,null),
  ('clothing','Kids Frock',null,'Kids','piece',null,null),
  ('clothing','Kids T-Shirt',null,'Kids','piece',null,null),
  ('clothing','Innerwear Set',null,'Innerwear','set',null,null),
  -- mobile
  ('mobile','Mobile Charger',null,'Chargers & Cables','piece',null,null),
  ('mobile','USB Cable',null,'Chargers & Cables','piece',null,null),
  ('mobile','Power Bank',null,'Chargers & Cables','piece',null,null),
  ('mobile','Wired Earphones',null,'Audio','piece',null,null),
  ('mobile','Bluetooth Earbuds',null,'Audio','piece',null,null),
  ('mobile','Bluetooth Speaker',null,'Audio','piece',null,null),
  ('mobile','Tempered Glass',null,'Protection','piece',null,null),
  ('mobile','Back Cover',null,'Protection','piece',null,null),
  ('mobile','Memory Card',null,'Storage','piece',null,null),
  ('mobile','Pen Drive',null,'Storage','piece',null,null),
  ('mobile','Wireless Mouse',null,'Computer Accessories','piece',null,null),
  ('mobile','Keyboard',null,'Computer Accessories','piece',null,null),
  ('mobile','Smart Watch',null,'Wearables','piece',null,null),
  -- hardware
  ('hardware','Hammer',null,'Hand Tools','piece',null,null),
  ('hardware','Screwdriver Set',null,'Hand Tools','set',null,null),
  ('hardware','Adjustable Spanner',null,'Hand Tools','piece',null,null),
  ('hardware','Measuring Tape',null,'Hand Tools','piece',null,null),
  ('hardware','Plier',null,'Hand Tools','piece',null,null),
  ('hardware','Drill Bit Set',null,'Power Tool Accessories','set',null,null),
  ('hardware','LED Bulb',null,'Electrical','piece',null,null),
  ('hardware','Electrical Wire',null,'Electrical','coil',null,null),
  ('hardware','Switch',null,'Electrical','piece',null,null),
  ('hardware','PVC Pipe',null,'Plumbing','piece',null,null),
  ('hardware','Tap / Faucet',null,'Plumbing','piece',null,null),
  ('hardware','Wall Putty',null,'Paint','kg',null,null),
  ('hardware','Paint Brush',null,'Paint','piece',null,null),
  ('hardware','Padlock',null,'Locks & Fittings','piece',null,null),
  ('hardware','Nuts & Bolts (Assorted)',null,'Locks & Fittings','packet',null,null),
  -- footwear
  ('footwear','Sports Shoes',null,'Shoes','pair',null,null),
  ('footwear','School Shoes',null,'Shoes','pair',null,null),
  ('footwear','Formal Shoes',null,'Shoes','pair',null,null),
  ('footwear','Sneakers',null,'Shoes','pair',null,null),
  ('footwear','Casual Sandals',null,'Sandals & Slippers','pair',null,null),
  ('footwear','Flip Flops',null,'Sandals & Slippers','pair',null,null),
  ('footwear','Ladies Sandals',null,'Sandals & Slippers','pair',null,null),
  ('footwear','Kids Shoes',null,'Kids','pair',null,null),
  ('footwear','Socks (Pair)',null,'Accessories','pair',null,null),
  -- stationery
  ('stationery','Notebook (Ruled)','Classmate','Notebooks','piece',null,null),
  ('stationery','Ball Pen','Reynolds','Pens & Pencils','piece',null,null),
  ('stationery','Gel Pen',null,'Pens & Pencils','piece',null,null),
  ('stationery','Pencil (Pack)','Natraj','Pens & Pencils','packet',null,null),
  ('stationery','Eraser',null,'Pens & Pencils','piece',null,null),
  ('stationery','Sharpener',null,'Pens & Pencils','piece',null,null),
  ('stationery','Geometry Box','Camlin','School Supplies','piece',null,null),
  ('stationery','Crayons','Doms','Art Supplies','box',null,null),
  ('stationery','Sketch Pens','Camlin','Art Supplies','box',null,null),
  ('stationery','A4 Paper (Ream)',null,'Paper','ream',null,null),
  ('stationery','Glue Stick',null,'Office Supplies','piece',null,null),
  ('stationery','Scissors',null,'Office Supplies','piece',null,null),
  ('stationery','File Folder',null,'Office Supplies','piece',null,null),
  ('stationery','Marker Pen',null,'Office Supplies','piece',null,null),
  -- bakery
  ('bakery','Black Forest Cake',null,'Cakes','kg',null,null),
  ('bakery','Pineapple Cake',null,'Cakes','kg',null,null),
  ('bakery','Chocolate Cake',null,'Cakes','kg',null,null),
  ('bakery','Pastry',null,'Cakes','piece',null,null),
  ('bakery','Cupcake',null,'Cakes','piece',null,null),
  ('bakery','Bread',null,'Bread & Buns','packet',null,null),
  ('bakery','Cookies',null,'Biscuits & Cookies','packet',null,null),
  ('bakery','Motichoor Laddu',null,'Mithai','kg',null,null),
  ('bakery','Kaju Barfi',null,'Mithai','kg',null,null),
  ('bakery','Gulab Jamun',null,'Mithai','kg',null,null),
  ('bakery','Rasgulla',null,'Mithai','kg',null,null),
  ('bakery','Namkeen Mix',null,'Namkeen','kg',null,null),
  -- restaurant
  ('restaurant','Dal Fry',null,'Main Course','plate',null,null),
  ('restaurant','Paneer Butter Masala',null,'Main Course','plate',null,null),
  ('restaurant','Mix Veg',null,'Main Course','plate',null,null),
  ('restaurant','Roti',null,'Breads','piece',null,null),
  ('restaurant','Butter Naan',null,'Breads','piece',null,null),
  ('restaurant','Jeera Rice',null,'Rice','plate',null,null),
  ('restaurant','Veg Biryani',null,'Rice','plate',null,null),
  ('restaurant','Veg Thali',null,'Thali','plate',null,null),
  ('restaurant','Samosa',null,'Starters','piece',null,null),
  ('restaurant','Masala Chai',null,'Beverages','cup',null,null),
  ('restaurant','Cold Drink',null,'Beverages','bottle',null,null),
  ('restaurant','Gulab Jamun (2 pcs)',null,'Desserts','plate',null,null),
  -- salon (services)
  ('salon','Haircut (Men)',null,'Hair','service',null,null),
  ('salon','Haircut (Women)',null,'Hair','service',null,null),
  ('salon','Hair Spa',null,'Hair','service',null,null),
  ('salon','Hair Color',null,'Hair','service',null,null),
  ('salon','Head Massage',null,'Hair','service',null,null),
  ('salon','Facial',null,'Skin','service',null,null),
  ('salon','Cleanup',null,'Skin','service',null,null),
  ('salon','Bleach',null,'Skin','service',null,null),
  ('salon','Waxing (Full Arms)',null,'Waxing & Threading','service',null,null),
  ('salon','Eyebrow Threading',null,'Waxing & Threading','service',null,null),
  ('salon','Manicure',null,'Hands & Feet','service',null,null),
  ('salon','Pedicure',null,'Hands & Feet','service',null,null),
  ('salon','Bridal Makeup',null,'Makeup','service',null,null)
) as s(bt, name, brand, cat, unit, mrp, gst)
where not exists (
  select 1 from catalog_products c
  where c.business_type = s.bt and lower(c.name) = lower(s.name) and lower(coalesce(c.brand, '')) = lower(coalesce(s.brand, ''))
);

-- jo brands catalog mein aaye, unhe brand suggestion list mein bhi daalo
insert into catalog_brands (name, business_type)
select distinct brand, business_type from catalog_products where brand is not null
on conflict do nothing;
