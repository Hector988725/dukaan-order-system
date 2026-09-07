-- ============================================================
-- COMBO OFFER — multiple products/variants ek fixed "bundle price"
-- par bech sakte hain (jaise "Chai Combo: Doodh 1L + Chini 1kg @ ₹99")
-- ============================================================
-- 2 tables: `combos` (bundle ka naam/price/photo/active-flag) aur
-- `combo_items` (bundle ke andar kaunse variants, kitni qty). Order
-- place hone par combo ko place_order RPC ke andar special-case NAHI
-- karte — CustomerView combo ko checkout se pehle hi uske underlying
-- variants mein "expand" kar deta hai (har component ek normal item
-- ban jaata hai, price:0, taaki total sirf combo_price se aaye aur
-- stock phir bhi correctly decrement ho, kyunki place_order variant_id
-- dekhkar hi stock ghatata hai).

-- ---- 1. Combos ----
create table if not exists combos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  name text not null,
  combo_price numeric not null check (combo_price > 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_combos_store on combos(store_id);

-- ---- 2. Combo ke andar kaunse variants, kitni qty ----
create table if not exists combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid references combos(id) on delete cascade not null,
  variant_id uuid references variants(id) on delete cascade not null,
  qty int not null check (qty > 0)
);
create index if not exists idx_combo_items_combo on combo_items(combo_id);
create index if not exists idx_combo_items_variant on combo_items(variant_id);

alter table combos enable row level security;
alter table combo_items enable row level security;

-- ---- RLS: same ownership pattern jo products/variants mein hai ----
-- Anyone (customer, storefront ke liye) dekh sake, sirf owner CRUD kare.
create policy "Anyone can view combos" on combos for select using (true);
create policy "Owner can insert combos" on combos for insert
  with check (exists (select 1 from stores where stores.id = combos.store_id and stores.user_id = auth.uid()));
create policy "Owner can update combos" on combos for update
  using (exists (select 1 from stores where stores.id = combos.store_id and stores.user_id = auth.uid()));
create policy "Owner can delete combos" on combos for delete
  using (exists (select 1 from stores where stores.id = combos.store_id and stores.user_id = auth.uid()));

create policy "Anyone can view combo items" on combo_items for select using (true);
-- combo_items par direct insert/update/delete kabhi nahi hota (dono
-- hamesha create_combo_with_items/update_combo_with_items RPC ke
-- through hote hain, jo poore items-set ko ek atomic transaction mein
-- replace karte hain) — isliye yahan koi owner insert/update/delete
-- policy jaan-bujh kar nahi di, sirf RPC (security definer, RLS
-- bypass karta hai) hi likh sakta hai.

-- ============================================================
-- RPC 1: Naya combo banao, uske items ke saath — dono ek hi atomic
-- transaction mein (jaisa khata/order mein pattern hai).
-- p_items format: [{"variant_id": "...", "qty": 2}, ...]
-- ============================================================
create or replace function create_combo_with_items(
  p_store_id uuid,
  p_name text,
  p_combo_price numeric,
  p_image_url text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_combo_id uuid;
  item jsonb;
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 2 then
    raise exception 'Combo mein kam se kam 2 items hone chahiye';
  end if;

  insert into combos (store_id, name, combo_price, image_url)
  values (p_store_id, p_name, p_combo_price, p_image_url)
  returning id into v_combo_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    -- Har variant is store ka hi hai, yeh confirm karte hain (koi
    -- doosri dukaan ka variant_id galti se/jaan-bujh kar na daala ja sake).
    if not exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = (item->>'variant_id')::uuid and p.store_id = p_store_id
    ) then
      raise exception 'Variant is store ka nahi hai';
    end if;

    insert into combo_items (combo_id, variant_id, qty)
    values (v_combo_id, (item->>'variant_id')::uuid, (item->>'qty')::int);
  end loop;

  return v_combo_id;
end;
$$;

grant execute on function create_combo_with_items(uuid, text, numeric, text, jsonb) to authenticated;

-- ============================================================
-- RPC 2: Existing combo edit karo — naam/price/photo update, aur
-- items ka poora set replace (purane hata kar naye daal do, taaki
-- "kaunsa item hataya kaunsa add kiya" ka alag-alag logic na likhna pade).
-- ============================================================
create or replace function update_combo_with_items(
  p_combo_id uuid,
  p_name text,
  p_combo_price numeric,
  p_image_url text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  item jsonb;
begin
  select store_id into v_store_id from combos
  where id = p_combo_id and exists (
    select 1 from stores where stores.id = combos.store_id and stores.user_id = auth.uid()
  );
  if v_store_id is null then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 2 then
    raise exception 'Combo mein kam se kam 2 items hone chahiye';
  end if;

  update combos set name = p_name, combo_price = p_combo_price, image_url = p_image_url
  where id = p_combo_id;

  delete from combo_items where combo_id = p_combo_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    if not exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = (item->>'variant_id')::uuid and p.store_id = v_store_id
    ) then
      raise exception 'Variant is store ka nahi hai';
    end if;

    insert into combo_items (combo_id, variant_id, qty)
    values (p_combo_id, (item->>'variant_id')::uuid, (item->>'qty')::int);
  end loop;
end;
$$;

grant execute on function update_combo_with_items(uuid, text, numeric, text, jsonb) to authenticated;

-- ============================================================
-- NOTE: toggleComboActive() aur deleteCombo() (api.js mein already
-- likhe ja chuke hain) direct table update/delete use karte hain, RPC
-- nahi — upar wali "Owner can update/delete combos" policy unhe already
-- cover kar leti hai, alag RPC ki zaroorat nahi.
-- ============================================================
