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
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null, event);
  });
  return () => data.subscription.unsubscribe();
}

// Forgot-password flow: email pe ek reset-link bhejta hai. Link click
// karne par Supabase khud user ko wapas isi site pe laata hai ek
// special "PASSWORD_RECOVERY" auth-event ke saath, jo App.jsx sunta hai.
export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// Reset-link click karne ke baad naya password set karne ke liye.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
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

const FOUNDING_MEMBER_LIMIT = 20;
const FOUNDING_PRICE = 99;
const REGULAR_PRICE = 199;

export async function createStore(userId, { slug, name, business_type, whatsapp_number, upi_id, address }) {
  // Pehli 20 dukaano ko founding-member price (₹99/month, hamesha ke
  // liye lock) milta hai — yeh signup ke waqt hi decide ho jaata hai
  // total existing (real) stores count karke, aur permanently store ho
  // jaata hai. `is_test_store=true` wali dukaane (jaise owner ki apni
  // testing ke liye banayi hui stores) is count mein shamil NAHI hoti —
  // isliye asli 20 slots hamesha sirf real customers ke liye reserved
  // rehte hain, chahe kitni bhi test stores bani ho.
  const { count, error: countError } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .or("is_test_store.is.null,is_test_store.eq.false");
  if (countError) throw countError;

  const isFoundingMember = (count || 0) < FOUNDING_MEMBER_LIMIT;

  const { data, error } = await supabase
    .from("stores")
    .insert({
      user_id: userId, slug, name, business_type, whatsapp_number, upi_id, address,
      founding_member: isFoundingMember,
      subscription_base_price: isFoundingMember ? FOUNDING_PRICE : REGULAR_PRICE,
    })
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
export async function createProduct(storeId, { name, category, emoji, image_url, image_urls, description, sort_order }) {
  const photos = image_urls && image_urls.length > 0 ? image_urls : (image_url ? [image_url] : []);
  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: storeId, name, category, emoji: emoji || "📦",
      image_url: photos[0] || null, image_urls: photos, description: description || null,
      sort_order: sort_order || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(productId, { name, category, emoji, image_url, image_urls, description }) {
  const photos = image_urls && image_urls.length > 0 ? image_urls : (image_url ? [image_url] : []);
  const { error } = await supabase
    .from("products")
    .update({ name, category, emoji, image_url: photos[0] || null, image_urls: photos, description: description || null })
    .eq("id", productId);
  if (error) throw error;
}

// Yeh 2 functions jaan-bujh kar chhote/alag rakhe gaye hain — upar wala
// updateProduct() poora record overwrite karta hai (name/category/emoji
// bhi), isliye usse reuse karne par featured-toggle ya reorder karte waqt
// galti se doosri fields corrupt ho sakti thi.
export async function updateProductFeatured(productId, featured) {
  const { error } = await supabase.from("products").update({ featured }).eq("id", productId);
  if (error) throw error;
}

export async function updateProductOrder(productId, sortOrder) {
  const { error } = await supabase.from("products").update({ sort_order: sortOrder }).eq("id", productId);
  if (error) throw error;
}

// ---- Image Upload ----
// Har dukaan ka fixed storage quota hai (default 5GB) — isse zyada
// upload nahi hone diya jaata, taaki platform ka storage-cost
// unpredictable na badhe. Upload se pehle available space check
// karta hai, aur success ke baad `storage_used_bytes` badhata hai.
export async function uploadProductImage(file, storeId) {
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("storage_used_bytes, storage_limit_bytes")
    .eq("id", storeId)
    .single();
  if (storeErr) throw storeErr;

  const used = store.storage_used_bytes || 0;
  const limit = store.storage_limit_bytes || 5 * 1024 * 1024 * 1024;
  if (used + file.size > limit) {
    const usedGB = (used / (1024 * 1024 * 1024)).toFixed(2);
    const limitGB = (limit / (1024 * 1024 * 1024)).toFixed(0);
    throw new Error(`Aapki dukaan ka storage space (${limitGB}GB) bhar chuka hai (${usedGB}GB use ho chuka hai). Purani photos hata kar jagah banayein, ya zyada space ke liye humse sampark karein.`);
  }

  const ext = file.name.split(".").pop();
  const fileName = `${storeId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  // Best-effort: usage counter badha dete hain. Agar yeh fail bhi ho
  // jaaye, photo already upload ho chuki hai, isliye user ko error
  // nahi dikhate — sirf quota tracking thodi si off ho sakti hai.
  try {
    await supabase.from("stores").update({ storage_used_bytes: used + file.size }).eq("id", storeId);
  } catch (trackErr) {
    console.warn("Storage usage track nahi ho paayi:", trackErr);
  }

  const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
  return urlData.publicUrl;
}

// Store settings screen mein storage usage dikhane ke liye
export async function fetchStorageUsage(storeId) {
  const { data, error } = await supabase
    .from("stores")
    .select("storage_used_bytes, storage_limit_bytes")
    .eq("id", storeId)
    .single();
  if (error) throw error;
  return data;
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
export async function updateStoreSettings(storeId, { name, whatsapp_number, upi_id, address, logo_url, tagline, timings }) {
  const { error } = await supabase
    .from("stores")
    .update({ name, whatsapp_number, upi_id, address, logo_url, tagline, timings })
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

// Sirf payment_status update karta hai (order_status ko touch nahi karta) —
// dukaandar apne UPI app mein payment manually verify karke ye call karta hai.
export async function updatePaymentStatus(orderId, paymentStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", orderId);
  if (error) throw error;
}

// ============================================================
// CUSTOMERS — Guest checkout ke liye saved delivery details
// (phone-number ke basis par, koi login/password nahi)
// ============================================================

// Store ke andar diye gaye phone number se pichli saved details dhoondhta hai.
// Agar koi match nahi mila to null return karta hai (naya customer maana jaata hai).
// Security note: yeh direct table select nahi karta (RLS se poori
// table expose ho sakti thi) — ek security-definer RPC use karta hai
// jo sirf EXACT phone-match wala ek record deta hai, kuch aur nahi.
export async function fetchCustomerByPhone(storeId, phone) {
  const { data, error } = await supabase.rpc("get_customer_by_phone", { p_store_id: storeId, p_phone: phone });
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

// Order place hone ke baad customer ki details save/update karta hai
// (store_id + phone par unique, isliye dobara order karne par naya
// duplicate record nahi banta, existing record hi update ho jaata hai).
export async function upsertCustomerDetails(storeId, { phone, name, address, landmark, pincode }) {
  const { error } = await supabase
    .from("customers")
    .upsert(
      { store_id: storeId, phone, name, address, landmark: landmark || null, pincode, updated_at: new Date().toISOString() },
      { onConflict: "store_id,phone" }
    );
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

// ============================================================
// RAZORPAY SUBSCRIPTION
// ============================================================
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "";
export const RAZORPAY_PLAN_ID = import.meta.env.VITE_RAZORPAY_PLAN_ID || "plan_T8uv8ubtqXG0JD";

// Razorpay script load karna
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Subscription activate karna after payment
export async function activateSubscription(storeId, razorpaySubscriptionId, months = 1) {
  const newExpiry = new Date();
  newExpiry.setMonth(newExpiry.getMonth() + months);

  const { error } = await supabase
    .from("stores")
    .update({
      is_active: true,
      subscription_expires_at: newExpiry.toISOString(),
      razorpay_subscription_id: razorpaySubscriptionId || null,
    })
    .eq("id", storeId);
  if (error) throw error;
  return newExpiry;
}

// Super admin ke liye - sab stores ki list
export async function fetchAllStores() {
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, is_active, subscription_expires_at, whatsapp_number, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
