-- ============================================================
-- BARCODE SUPPORT (Product Management ka 3rd tareeka)
-- ============================================================
-- Existing `variants` table mein bas ek naya optional column add kar
-- rahe hain — koi existing data touch nahi hota, purane variants ka
-- barcode simply NULL rahega.
--
-- NOTE on uniqueness: Barcode (UPC/EAN) real duniya mein manufacturer
-- ke hisaab se globally unique hote hain, LEKIN 2 alag dukaanein
-- (jaise 2 kirana stores) donon "Parle-G 100g" bech sakti hain jiska
-- barcode same hoga — isliye humne DB-level "globally unique"
-- constraint jaan-bujh kar NAHI lagaya (warna dusri dukaan wahi product
-- add hi nahi kar paati). Duplicate-within-same-store check app-level
-- (api.js) mein hota hai scan/save karte waqt.
-- ============================================================

alter table variants add column if not exists barcode text;
create index if not exists idx_variants_barcode on variants(barcode) where barcode is not null;

-- ============================================================
-- Owner-only barcode lookup — sirf apni dukaan ke products mein
-- dhoondhta hai (dusri dukaan ka data kabhi nahi dikhega, chahe
-- barcode match ho).
-- ============================================================
create or replace function find_variant_by_barcode(p_store_id uuid, p_barcode text)
returns table (
  variant_id uuid, product_id uuid, product_name text, product_category text, product_emoji text,
  variant_label text, variant_unit text, variant_price numeric, variant_stock int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select v.id, p.id, p.name, p.category, p.emoji, v.label, v.unit, v.price, v.stock
  from variants v
  join products p on p.id = v.product_id
  where p.store_id = p_store_id and v.barcode = p_barcode
  limit 1;
end;
$$;

grant execute on function find_variant_by_barcode(uuid, text) to authenticated;
