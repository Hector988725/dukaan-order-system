import { supabase } from "./supabase";

// ============================================================
// AUTH
// ============================================================
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return () => data.subscription.unsubscribe();
}

// ============================================================
// STORE
// ============================================================
export async function fetchStoreBySlug(slug) {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  // Subscription check: agar expire ho gayi toh inactive mark karo
  if (data && data.subscription_expires_at && new Date(data.subscription_expires_at) < new Date()) {
    // Auto-deactivate (background mein)
    supabase.from("stores").update({ is_active: false }).eq("id", data.id);
    return { ...data, is_active: false };
  }
  return data;
}

export async function fetchStoreByUserId(userId) {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkSlugAvailable(slug) {
  const { data, error } = await supabase.rpc("is_slug_available", { check_slug: slug });
  if (error) throw error;
  return data;
}

export async function createStore(userId, { slug, name, business_type, whatsapp_number, upi_id, address }) {
  const { data, error } = await supabase
    .from("stores")
    .insert({ user_id: userId, slug, name, business_type, whatsapp_number, upi_id, address })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// PRODUCTS + VARIANTS
// ============================================================
export async function fetchProducts(storeId) {
  const { data, error } = await supabase
    .from("products")
    .select("*, variants(*)")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateVariantStock(variantId, newStock) {
  const { error } = await supabase
    .from("variants")
    .update({ stock: newStock })
    .eq("id", variantId);
  if (error) throw error;
}

// ---- Product CRUD ----
export async function createProduct(storeId, { name, category, emoji, image_url, sort_order }) {
  const { data, error } = await supabase
    .from("products")
    .insert({ store_id: storeId, name, category, emoji: emoji || "📦", image_url: image_url || null, sort_order: sort_order || 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(productId, { name, category, emoji, image_url }) {
  const { error } = await supabase
    .from("products")
    .update({ name, category, emoji, image_url: image_url !== undefined ? image_url : null })
    .eq("id", productId);
  if (error) throw error;
}

// ---- Image Upload ----
export async function uploadProductImage(file, storeId) {
  const ext = file.name.split(".").pop();
  const fileName = `${storeId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ---- Subscription Management ----
export async function fetchSubscriptionStatus(storeId) {
  const { data, error } = await supabase
    .from("stores")
    .select("is_active, subscription_expires_at, subscription_plan")
    .eq("id", storeId)
    .single();
  if (error) throw error;
  return data;
}

export async function renewSubscription(storeId, months = 1) {
  // Subscription renew karna - current date se months add karo
  const { data: current } = await supabase
    .from("stores")
    .select("subscription_expires_at")
    .eq("id", storeId)
    .single();

  const currentExpiry = current?.subscription_expires_at
    ? new Date(current.subscription_expires_at)
    : new Date();

  // Agar already expire ho gayi toh aaj se calculate karo
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + months);

  const { error } = await supabase
    .from("stores")
    .update({
      is_active: true,
      subscription_expires_at: newExpiry.toISOString(),
    })
    .eq("id", storeId);
  if (error) throw error;
  return newExpiry;
}

export async function deactivateStore(storeId) {
  const { error } = await supabase
    .from("stores")
    .update({ is_active: false })
    .eq("id", storeId);
  if (error) throw error;
}

export async function deleteProduct(productId) {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
}

// ---- Variant CRUD ----
export async function createVariant(productId, { label, unit, price, stock }) {
  const { data, error } = await supabase
    .from("variants")
    .insert({ product_id: productId, label, unit, price, stock: stock || 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVariant(variantId, { label, unit, price, stock }) {
  const { error } = await supabase
    .from("variants")
    .update({ label, unit, price, stock })
    .eq("id", variantId);
  if (error) throw error;
}

export async function deleteVariant(variantId) {
  const { error } = await supabase.from("variants").delete().eq("id", variantId);
  if (error) throw error;
}

// ---- Store Settings ----
export async function updateStoreSettings(storeId, { name, whatsapp_number, upi_id, address }) {
  const { error } = await supabase
    .from("stores")
    .update({ name, whatsapp_number, upi_id, address })
    .eq("id", storeId);
  if (error) throw error;
}

// ============================================================
// ORDERS
// ============================================================
export async function fetchOrders(storeId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createOrder(orderPayload) {
  const { data, error } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}

// ============================================================
// REALTIME - jab naya order aaye, dukaandar ko turant pata chal jaye
// ============================================================
export function subscribeToOrders(storeId, onNewOrder) {
  const channel = supabase
    .channel("orders-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
      (payload) => onNewOrder(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
