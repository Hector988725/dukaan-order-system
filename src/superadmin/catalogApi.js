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
