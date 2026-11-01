-- Dukaan -> Verilo, Phase 2: verilo_shop_products view (sirf naya view, purana kuch nahi badalta)
-- Phase 1 (migration_verilo_phase1.sql) pehle chal chuka hona chahiye.
-- Kya dikhata hai: sirf wahi shops (verilo_shops me jo hain: opt-in + active + non-test) ke
--   available aur stock me wale products: naam, category, brand, sub_category, photo, "se shuru" price.
-- Kya NAHI dikhata: stock ki ginti, cost, orders, customers, description.
-- Undo: undo_verilo_phase2.sql

do $$
declare missing text;
begin
  if to_regclass('public.verilo_shops') is null then
    raise exception 'Pehle migration_verilo_phase1.sql chalao (verilo_shops view nahi mila).';
  end if;

  select string_agg(c, ', ') into missing
  from unnest(array['id','store_id','name','category','brand','sub_category','image_url','is_available']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'products' and column_name = c);
  if missing is not null then
    raise exception 'products table me ye columns nahi mile: %', missing;
  end if;

  select string_agg(c, ', ') into missing
  from unnest(array['product_id','price','stock']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'variants' and column_name = c);
  if missing is not null then
    raise exception 'variants table me ye columns nahi mile: %', missing;
  end if;
end $$;

-- Dukaan ke storefront jaisa hi rule: product tabhi "milta hai" jab owner ne available rakha ho
-- aur kam se kam ek variant ka stock > 0 ho.
create or replace view public.verilo_shop_products as
select
  p.id          as product_id,
  p.store_id,
  p.name,
  p.category,
  p.brand,
  p.sub_category,
  p.image_url,
  min(v.price)  as price_from
from public.products p
join public.verilo_shops s on s.store_id = p.store_id
join public.variants v on v.product_id = p.id and v.stock > 0
where coalesce(p.is_available, true) = true
group by p.id;

grant select on public.verilo_shop_products to anon, authenticated;
