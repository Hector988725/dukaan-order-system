-- ============================================================
-- DEMO STORES: Cosmetics / Beauty  +  Gift / Toys / Kids
-- ============================================================
-- /demo page par dikhne wali 2 naye sample dukaanein — apne ALAG login
-- ke saath (jaise baaki demo dukaanein), taaki dukaandar ko login karke
-- Admin Panel, Central Catalog, Purchase sab dikha sako.
--
-- PEHLE (sirf 2 minute ka kaam):
-- 1. migration_beauty_kids_catalog.sql chali honi chahiye.
-- 2. Supabase Dashboard -> Authentication -> Users -> "Add User":
--      Email: demo.cosmetics@dukaan.local   Password: (aapka choice)
--      Email: demo.toys@dukaan.local        Password: (aapka choice)
--    dono mein "Auto Confirm User" ON rakhein.
-- 3. Ab yeh poori script run karein — UUID copy-paste ki zaroorat NAHI,
--    script email se khud user dhoondh leti hai.
--
-- Script dobara chalane par jo demo dukaan pehle se hai use nahi chhedti
-- (skip karti hai). Fresh start chahiye to pehle us store ko delete karein.
-- Dono stores `is_test_store = true` hain (founding-member count mein nahi judti).
-- Photo nahi hai, emoji dikhte hain — Admin se photo upload kar sakte hain.
-- ============================================================

do $$
declare
  c_cosmetics_email constant text := 'demo.cosmetics@dukaan.local';
  c_toys_email      constant text := 'demo.toys@dukaan.local';
  v_owner uuid;
  v_cos_store uuid;
  v_toy_store uuid;
  v_store uuid;
  v_prod uuid;
  v_cp uuid;
  v_n_cos int := 0;
  v_n_toy int := 0;
  v_n int;
  r record;
  v record;
begin
  if to_regclass('public.catalog_products') is null
     or not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'age_group') then
    raise exception 'Pehle migration_beauty_kids_catalog.sql run karein.';
  end if;

  -- Store sirf tab banta hai jab pehle se na ho (nayi bani store ki id hi variable mein aati hai;
  -- pehle se maujood store ke products dobara nahi daale jaate).
  if not exists (select 1 from stores where slug = 'demo-cosmetics') then
    select id into v_owner from auth.users where email = c_cosmetics_email;
    if v_owner is null then
      raise exception 'Supabase Authentication mein % user banayein, phir script dobara chalayein.', c_cosmetics_email;
    end if;
    insert into stores (user_id, slug, name, business_type, whatsapp_number, address, tagline, timings, is_open, is_test_store)
    values (v_owner, 'demo-cosmetics', 'Rose & Glow Cosmetics', 'cosmetics', '919999999911', 'Main Market, Shahdol', 'Beauty jo aap par khile', '10:00 AM To 9:00 PM', true, true)
    returning id into v_cos_store;
  end if;

  if not exists (select 1 from stores where slug = 'demo-toys') then
    select id into v_owner from auth.users where email = c_toys_email;
    if v_owner is null then
      raise exception 'Supabase Authentication mein % user banayein, phir script dobara chalayein.', c_toys_email;
    end if;
    insert into stores (user_id, slug, name, business_type, whatsapp_number, address, tagline, timings, is_open, is_test_store)
    values (v_owner, 'demo-toys', 'Happy Kids Toys & Gifts', 'giftstoy', '919999999912', 'Station Road, Shahdol', 'Har muskaan ke liye ek khilona', '10:00 AM To 9:00 PM', true, true)
    returning id into v_toy_store;
  end if;

  -- products: (type, name, category, sub-category, brand, emoji, age group, catalog naam, variants [label, price, mrp, stock])
  for r in
    select * from (values
      -- ---------- COSMETICS ----------
      ('cosmetics','Matte Lipstick','Makeup','Lipstick','Lakme','💄',null,'Matte Lipstick',
        '[["Shade 01 Nude",249,299,15],["Shade 02 Rose Pink",249,299,12],["Shade 03 Classic Red",249,299,10]]'),
      ('cosmetics','Liquid Lip Gloss','Makeup','Lip Gloss','Maybelline','💋',null,null,
        '[["Clear Shine",199,249,20],["Berry Blush",199,249,14]]'),
      ('cosmetics','Smudge-proof Kajal','Makeup','Kajal','Lakme','👁️',null,'Smudge-proof Kajal',
        '[["Jet Black",165,199,30]]'),
      ('cosmetics','Nail Polish','Makeup','Nail Polish','Colorbar','💅',null,'Nail Polish',
        '[["Cherry Red",99,129,25],["Baby Pink",99,129,22],["Nude Beige",99,129,18]]'),
      ('cosmetics','Compact Powder','Makeup','Compact','Lakme','🪞',null,'Compact Powder',
        '[["Ivory",229,275,12],["Natural",229,275,15],["Warm Beige",229,275,9]]'),
      ('cosmetics','Gel Face Wash','Face Care','Face Wash','Himalaya','🧴',null,'Gel Face Wash',
        '[["100 ml",120,140,40],["200 ml",210,245,25]]'),
      ('cosmetics','Sunscreen Lotion SPF 50','Face Care','Sunscreen','Neutrogena','☀️',null,null,
        '[["50 ml",399,450,18]]'),
      ('cosmetics','Face Serum','Face Care','Serum','Minimalist','✨',null,'Face Serum',
        '[["30 ml",599,699,10]]'),
      ('cosmetics','Anti-Dandruff Shampoo','Hair Care','Shampoo','Head & Shoulders','🧴',null,'Shampoo',
        '[["180 ml",185,210,30],["340 ml",330,380,20]]'),
      ('cosmetics','Coconut Hair Oil','Hair Care','Hair Oil','Parachute','🥥',null,null,
        '[["200 ml",95,110,45],["500 ml",215,245,25]]'),
      ('cosmetics','Body Lotion','Body Care','Body Lotion','Nivea','🧴',null,'Body Lotion',
        '[["200 ml",215,249,22],["400 ml",380,445,14]]'),
      ('cosmetics','Deodorant Spray','Body Care','Deodorant','Fogg','🌬️',null,'Deodorant Spray',
        '[["150 ml",199,249,28]]'),
      ('cosmetics','Perfume','Perfume / Fragrance',null,'Wild Stone','🌸',null,'Perfume',
        '[["100 ml",349,499,16]]'),
      ('cosmetics','Makeup Brush Set','Beauty Accessories','Brushes & Applicators',null,'🖌️',null,'Makeup Brush Set',
        '[["Set of 5",299,399,15]]'),
      ('cosmetics','Compact Mirror','Beauty Accessories','Mirrors',null,'🪞',null,'Compact Mirror',
        '[["Round",79,99,30],["Heart Shape",79,99,24]]'),
      -- ---------- GIFT / TOYS ----------
      ('giftstoy','Soft Teddy Bear','Toys','Soft Toys','Webby','🧸','All ages','Soft Teddy Bear',
        '[["1 ft",299,399,12],["2 ft",599,799,8],["3 ft",1099,1499,4]]'),
      ('giftstoy','Remote Control Car','Toys','Remote Control Toys','Webby','🚗','6-8 years','Remote Control Car',
        '[["Red",699,899,10],["Blue",699,899,8]]'),
      ('giftstoy','Building Blocks Set','Toys','Building Blocks','Funskool','🧱','3-5 years','Building Blocks Set',
        '[["100 pcs",399,499,15],["250 pcs",799,999,9]]'),
      ('giftstoy','Fashion Doll','Toys','Dolls','Barbie','👧','3-5 years','Doll',
        '[["Pink Dress",599,799,10],["Blue Dress",599,799,8]]'),
      ('giftstoy','Toy Car','Toys','Cars & Vehicles','Hot Wheels','🏎️','3-5 years','Toy Car',
        '[["Single Car",99,149,50],["5-Car Pack",449,599,12]]'),
      ('giftstoy','Baby Rattle Set','Toys','Baby Toys','Fisher-Price','🪀','0-2 years','Baby Rattle Set',
        '[["Set of 4",249,349,14]]'),
      ('giftstoy','Ludo & Snakes Ladder','Games & Puzzles','Board Games','Funskool','🎲','6-8 years','Board Game',
        '[["Standard",199,249,20]]'),
      ('giftstoy','Jigsaw Puzzle','Games & Puzzles','Puzzles','Skillmatics','🧩','6-8 years','Jigsaw Puzzle',
        '[["100 pcs",249,299,16],["200 pcs",399,499,10]]'),
      ('giftstoy','Moral Stories Book','Kids Books & School','Kids Books',null,'📚','3-5 years','Kids Story Book',
        '[["Hindi",99,125,30],["English",99,125,25]]'),
      ('giftstoy','School Stationery Kit','Kids Books & School','School Supplies','Camlin','✏️','6-8 years','School Supplies Kit',
        '[["Kit",349,399,18]]'),
      ('giftstoy','Birthday Candle Set','Party & Birthday','Birthday Items',null,'🕯️',null,'Birthday Candle Set',
        '[["Pack of 24",49,60,60]]'),
      ('giftstoy','Party Decoration Kit','Party & Birthday','Party Decorations',null,'🎈',null,'Party Decoration Kit',
        '[["Balloons + Banner",299,399,14]]'),
      ('giftstoy','Gift Hamper','Gifts','Gift Hampers',null,'🎁',null,'Gift Hamper',
        '[["Chocolate Hamper",499,599,10],["Kids Surprise Hamper",799,999,6]]'),
      ('giftstoy','Greeting Card','Gifts','Greeting Cards',null,'💌',null,'Greeting Card',
        '[["Birthday Card",40,50,60],["Thank You Card",40,50,40]]'),
      ('giftstoy','Gift Wrapping Paper','Gifts','Gift Wrapping',null,'🎀',null,'Gift Wrapping Paper',
        '[["5 Sheets",60,75,35]]')
    ) as t(bt, name, cat, sub, brand, emoji, age, catalog_name, variants)
  loop
    if r.bt = 'cosmetics' then
      v_store := v_cos_store; v_n_cos := v_n_cos + 1; v_n := v_n_cos;
    else
      v_store := v_toy_store; v_n_toy := v_n_toy + 1; v_n := v_n_toy;
    end if;
    continue when v_store is null;   -- yeh store pehle se thi, products nahi chhedte

    -- kuch products Central Catalog se juday hain (picker mein "Added" dikhega);
    -- baaki custom hain (Add Custom Product ka demo)
    v_cp := null;
    if r.catalog_name is not null then
      select id into v_cp from catalog_products where business_type = r.bt and lower(name) = lower(r.catalog_name) limit 1;
    end if;

    insert into products (store_id, name, category, emoji, sort_order, brand, sub_category, age_group, catalog_product_id)
    values (v_store, r.name, r.cat, r.emoji, v_n, r.brand, r.sub, r.age, v_cp)
    returning id into v_prod;

    for v in select * from jsonb_array_elements(r.variants::jsonb) loop
      insert into variants (product_id, label, unit, price, mrp, stock)
      values (v_prod, v.value->>0, 'piece', (v.value->>1)::numeric, (v.value->>2)::numeric, (v.value->>3)::int);
    end loop;
  end loop;
end $$;

-- Check: dono dukaanein aur unke products
select s.slug, s.business_type, count(distinct p.id) as products, count(v.id) as variants
from stores s
left join products p on p.store_id = s.id
left join variants v on v.product_id = p.id
where s.slug in ('demo-cosmetics', 'demo-toys')
group by s.slug, s.business_type order by s.slug;
