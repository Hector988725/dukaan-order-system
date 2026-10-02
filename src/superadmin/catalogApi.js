import { supabase } from "../lib/supabase";

// Super Admin: business types, categories, brands, central catalog.
// Saari writes RLS se sirf super admin ke liye allowed hain
// (migration_beauty_kids_catalog.sql). Normal user ke liye yeh calls fail honge.

const must = ({ data, error }) => { if (error) throw error; return data; };

// ---- Business types ----
export const listTypeSettings = async () => must(await supabase.from("business_type_settings").select("*"));
export const saveTypeSettings = async (businessType, { is_enabled, label, description }) =>
  must(await supabase.from("business_type_settings").upsert(
    { business_type: businessType, is_enabled, label: label || null, description: description || null, updated_at: new Date().toISOString() },
    { onConflict: "business_type" }
  ));

// ---- Categories ----
export const listCategories = async (businessType) =>
  must(await supabase.from("business_categories").select("*").eq("business_type", businessType).order("sort_order").order("name"));
export const addCategory = async (businessType, name, parentId = null, sortOrder = 0) =>
  must(await supabase.from("business_categories").insert({ business_type: businessType, name: name.trim(), parent_id: parentId, sort_order: sortOrder }));
export const renameCategory = async (id, name) =>
  must(await supabase.from("business_categories").update({ name: name.trim() }).eq("id", id));
export const deleteCategory = async (id) =>
  must(await supabase.from("business_categories").delete().eq("id", id));

// ---- Brands ----
export const listBrands = async (businessType) =>
  must(await supabase.from("catalog_brands").select("*").or(`business_type.eq.${businessType},business_type.is.null`).order("name"));
export const addBrand = async (businessType, name) =>
  must(await supabase.from("catalog_brands").insert({ business_type: businessType, name: name.trim() }));
export const renameBrand = async (id, name) =>
  must(await supabase.from("catalog_brands").update({ name: name.trim() }).eq("id", id));
export const deleteBrand = async (id) =>
  must(await supabase.from("catalog_brands").delete().eq("id", id));

// ---- Catalog products ----
export const listCatalogProducts = async (businessType) =>
  must(await supabase.from("catalog_products").select("*").eq("business_type", businessType).order("category").order("name"));

export const saveCatalogProduct = async (businessType, form) => {
  const row = {
    business_type: businessType,
    name: form.name.trim(),
    brand: form.brand?.trim() || null,
    category: form.category,
    sub_category: form.sub_category || null,
    description: form.description?.trim() || null,
    image_url: form.image_url || null,
    mrp: form.mrp === "" || form.mrp == null ? null : Number(form.mrp),
    gst_rate: form.gst_rate === "" || form.gst_rate == null ? 0 : Number(form.gst_rate),
    barcode: form.barcode?.trim() || null,
    unit: form.unit || "piece",
    age_group: form.age_group || null,
    variants: (form.variants || [])
      .filter((v) => v.label && v.label.trim())
      .map((v) => ({ label: v.label.trim(), unit: v.unit || form.unit || "piece", mrp: v.mrp === "" || v.mrp == null ? null : Number(v.mrp) })),
    is_active: form.is_active !== false,
    updated_at: new Date().toISOString(),
  };
  if (form.id) return must(await supabase.from("catalog_products").update(row).eq("id", form.id));
  return must(await supabase.from("catalog_products").insert(row));
};
export const setCatalogProductActive = async (id, is_active) =>
  must(await supabase.from("catalog_products").update({ is_active, updated_at: new Date().toISOString() }).eq("id", id));
export const deleteCatalogProduct = async (id) =>
  must(await supabase.from("catalog_products").delete().eq("id", id));

// Catalog product ki image — product-images bucket ke `catalog/` folder mein.
export async function uploadCatalogImage(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error("Photo 2MB se chhoti honi chahiye.");
  const ext = file.name.split(".").pop();
  const path = `catalog/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

// Kitni dukaanon ne yeh catalog product apni shop mein add kiya hai (deactivate/delete se pehle warning ke liye).
export async function countShopsUsingCatalogProduct(id) {
  const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("catalog_product_id", id);
  if (error) throw error;
  return count || 0;
}

// CSV import: rows = [{ name, brand, category, sub_category, mrp, gst_rate, unit, barcode, age_group, description, image_url, is_active }]
// Duplicate (naam + brand, us business type mein) skip hota hai. Result: { added, skipped, failed: [{row, reason}] }
export async function importCatalogProducts(businessType, rows) {
  const existing = await listCatalogProducts(businessType);
  const seen = new Set(existing.map((e) => `${e.name.toLowerCase()}|${(e.brand || "").toLowerCase()}`));
  const toInsert = [];
  const failed = [];
  let skipped = 0;
  rows.forEach((r, idx) => {
    const name = (r.name || "").trim();
    const category = (r.category || "").trim();
    if (!name || !category) { failed.push({ row: idx + 2, reason: "name aur category zaroori hain" }); return; }
    const mrp = r.mrp === "" || r.mrp == null ? null : Number(r.mrp);
    const gst = r.gst_rate === "" || r.gst_rate == null ? 0 : Number(r.gst_rate);
    if ((mrp !== null && !(mrp >= 0)) || !(gst >= 0)) { failed.push({ row: idx + 2, reason: "mrp / gst_rate number hona chahiye" }); return; }
    const key = `${name.toLowerCase()}|${(r.brand || "").trim().toLowerCase()}`;
    if (seen.has(key)) { skipped++; return; }
    seen.add(key);
    const active = String(r.is_active ?? "").trim().toLowerCase();
    toInsert.push({
      business_type: businessType, name, category,
      brand: (r.brand || "").trim() || null,
      sub_category: (r.sub_category || "").trim() || null,
      mrp, gst_rate: gst,
      unit: (r.unit || "").trim() || "piece",
      barcode: (r.barcode || "").trim() || null,
      age_group: (r.age_group || "").trim() || null,
      description: (r.description || "").trim() || null,
      image_url: (r.image_url || "").trim() || null,
      is_active: !["false", "no", "0", "inactive"].includes(active),
    });
  });
  let added = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await supabase.from("catalog_products").insert(chunk);
    if (error) failed.push({ row: `batch ${i / 200 + 1}`, reason: error.message });
    else added += chunk.length;
  }
  // naye brands ko brand list mein bhi daalo (jo pehle se hain unhe chhod ke)
  try {
    const have = new Set((await listBrands(businessType)).map((b) => b.name.toLowerCase()));
    const fresh = Array.from(new Set(toInsert.map((r) => r.brand).filter(Boolean))).filter((b) => !have.has(b.toLowerCase()));
    if (fresh.length) await supabase.from("catalog_brands").insert(fresh.map((name) => ({ name, business_type: businessType })));
  } catch (e) { /* brand list optional hai — import fail nahi hota */ }
  return { added, skipped, failed };
}

export const CSV_TEMPLATE = "name,brand,category,sub_category,mrp,gst_rate,unit,barcode,age_group,description,image_url,is_active\nParle-G Biscuit,Parle,Biscuits & Snacks,,10,18,79g,,,,,true\n";
