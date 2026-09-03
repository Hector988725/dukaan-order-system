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
      // Koi free trial nahi — signup hote hi store inactive rehta hai,
      // dashboard turant payment screen dikhata hai. Pehle yahan koi
      // is_active/subscription_expires_at nahi diya jaata tha, isliye
      // table ka default (30-din free trial) apply ho jaata tha —
      // ab explicitly override kar rahe hain taaki payment mandatory ho.
      is_active: false,
      subscription_expires_at: null,
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
export async function createVariant(productId, { label, unit, price, stock, barcode }) {
  const { data, error } = await supabase
    .from("variants")
    .insert({ product_id: productId, label, unit, price, stock: stock || 0, barcode: barcode || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVariant(variantId, { label, unit, price, stock, barcode }) {
  const { error } = await supabase
    .from("variants")
    .update({ label, unit, price, stock, barcode: barcode || null })
    .eq("id", variantId);
  if (error) throw error;
}

export async function deleteVariant(variantId) {
  const { error } = await supabase.from("variants").delete().eq("id", variantId);
  if (error) throw error;
}

// ---- Store Settings ----
export async function updateStoreSettings(storeId, { name, whatsapp_number, upi_id, address, logo_url, tagline, timings, delivery_fee, free_delivery_above }) {
  const { error } = await supabase
    .from("stores")
    .update({ name, whatsapp_number, upi_id, address, logo_url, tagline, timings, delivery_fee, free_delivery_above })
    .eq("id", storeId);
  if (error) throw error;
}

// Quick toggle — "Abhi Open Hain?" switch ke liye, poori settings-form
// save karne ki zaroorat nahi, ek tap mein turant badal jaata hai.
export async function toggleStoreOpen(storeId, isOpen) {
  const { error } = await supabase.from("stores").update({ is_open: isOpen }).eq("id", storeId);
  if (error) throw error;
}

// ============================================================
// ORDERS
// ============================================================
// Orders ki poori history kabhi ek saath load nahi karte — dukaan
// mahino/saalon purani ho jaaye to yeh hazaron rows ek baar mein la
// sakta tha, jisse dashboard dheere-dheere slow hota jaata. Ab default
// 50 sabse naye orders aate hain, aur zaroorat par "Purane Orders"
// button se agle 50 load hote hain (cursor-based: last order ke
// created_at se pehle wale).
export async function fetchOrders(storeId, { limit = 50, before = null } = {}) {
  let query = supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Order place karta hai AUR stock atomically kam karta hai (ek hi
// database transaction mein) — isse overselling kabhi nahi hoti,
// chahe 2 customers same second mein last item order karein.
export async function createOrder(orderPayload) {
  const { data, error } = await supabase.rpc("place_order", {
    p_store_id: orderPayload.store_id,
    p_order_number: orderPayload.order_number,
    p_customer_name: orderPayload.customer_name,
    p_customer_phone: orderPayload.customer_phone,
    p_address: orderPayload.address,
    p_landmark: orderPayload.landmark,
    p_pincode: orderPayload.pincode,
    p_payment_method: orderPayload.payment_method,
    p_payment_status: orderPayload.payment_status,
    p_status: orderPayload.status,
    p_items: orderPayload.items,
    p_total: orderPayload.total,
    p_order_type: orderPayload.order_type || "Delivery",
    p_delivery_fee: orderPayload.delivery_fee || 0,
  });
  if (error) {
    // Function ke andar se aane wale friendly error messages ko clean
    // karke dikhate hain (Postgres inhe "STOCK_UNAVAILABLE: ..." jaise
    // prefix ke saath deta hai).
    const msg = error.message || "";
    if (msg.includes("STOCK_UNAVAILABLE:")) throw new Error(msg.split("STOCK_UNAVAILABLE:")[1].trim());
    if (msg.includes("VARIANT_MISSING:")) throw new Error(msg.split("VARIANT_MISSING:")[1].trim());
    throw error;
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}

// Galti se bana ya test order delete karne ke liye. Yeh sirf order
// record hataata hai — agar us order ne stock decrement kiya tha, woh
// automatically wapas nahi aata (Products tab se manually adjust karein).
export async function deleteOrder(orderId) {
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
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
  const payload = { store_id: storeId, phone, name, address, pincode, updated_at: new Date().toISOString() };
  // undefined = is order-type mein yeh field maanga hi nahi gaya tha
  // (jaise Pickup order mein landmark) — isse column ko bilkul touch
  // nahi karte, jo pehle se saved hai wahi rehta hai. Explicit khaali
  // string = customer ne Delivery order mein jaan-bujh kar landmark
  // khaali chhoda — usse null store karte hain (jaisa pehle tha).
  if (landmark !== undefined) payload.landmark = landmark || null;
  const { error } = await supabase
    .from("customers")
    .upsert(payload, { onConflict: "store_id,phone" });
  if (error) throw error;
}

// ============================================================
// BARCODE — sirf apni dukaan ke products mein dhoondhta hai
// ============================================================
export async function findVariantByBarcode(storeId, barcode) {
  const { data, error } = await supabase.rpc("find_variant_by_barcode", { p_store_id: storeId, p_barcode: barcode });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

// ============================================================
// CSV BULK UPLOAD — existing createProduct/createVariant hi reuse
// karta hai (ek-ek row ke liye), taaki wahi validation/behavior chale
// jo manual add mein hai. Har row ka result (success/fail) return karta
// hai taaki UI mein dikhaya ja sake ki kaunsi lines fail hui.
//
// Expected CSV rows (grouped by product_name+category — same product
// ki multiple rows alag-alag variants ban jaati hain):
// product_name, category, variant_label, unit, price, stock, description, barcode
// ============================================================
export async function bulkImportProducts(storeId, rows) {
  const results = [];
  // Same product (name+category match) ki rows ek saath group karte
  // hain, taaki ek hi product multiple variants ke saath bane, alag-alag
  // duplicate products na ban jaayein.
  const productGroups = new Map();
  rows.forEach((row, idx) => {
    const key = `${row.product_name.trim().toLowerCase()}|||${row.category.trim().toLowerCase()}`;
    if (!productGroups.has(key)) productGroups.set(key, { row, variantRows: [] });
    productGroups.get(key).variantRows.push({ ...row, _rowIndex: idx });
  });

  for (const { row, variantRows } of productGroups.values()) {
    try {
      const product = await createProduct(storeId, {
        name: row.product_name.trim(),
        category: row.category.trim(),
        description: row.description || null,
        emoji: row.emoji || "📦",
        sort_order: 0,
      });
      for (const vr of variantRows) {
        try {
          await createVariant(product.id, {
            label: vr.variant_label?.trim() || "Standard",
            unit: vr.unit?.trim() || "piece",
            price: Number(vr.price),
            stock: Number(vr.stock) || 0,
            barcode: vr.barcode?.trim() || null,
          });
          results.push({ rowIndex: vr._rowIndex, success: true, product: row.product_name });
        } catch (vErr) {
          results.push({ rowIndex: vr._rowIndex, success: false, product: row.product_name, error: vErr.message });
        }
      }
    } catch (pErr) {
      variantRows.forEach((vr) => results.push({ rowIndex: vr._rowIndex, success: false, product: row.product_name, error: pErr.message }));
    }
  }
  return results;
}

// ============================================================
// DELIVERY BOYS — dukaandar apna delivery staff khud manage karta hai
// (hum delivery boy provide nahi karte, sirf management tool dete hain)
// ============================================================
export async function fetchDeliveryBoys(storeId) {
  const { data, error } = await supabase
    .from("delivery_boys")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createDeliveryBoy(storeId, { name, phone, photo_url }) {
  const { data, error } = await supabase
    .from("delivery_boys")
    .insert({ store_id: storeId, name, phone, photo_url: photo_url || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDeliveryBoy(id, { name, phone, photo_url }) {
  const { error } = await supabase.from("delivery_boys").update({ name, phone, photo_url }).eq("id", id);
  if (error) throw error;
}

export async function toggleDeliveryBoyActive(id, isActive) {
  const { error } = await supabase.from("delivery_boys").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteDeliveryBoy(id) {
  const { error } = await supabase.from("delivery_boys").delete().eq("id", id);
  if (error) throw error;
}

// Order par delivery boy assign karna — order status ko touch nahi
// karta, sirf delivery_boy_id set karta hai. Dukaandar isके baad
// alag se "Out for Delivery" status pe advance karega.
export async function assignDeliveryBoy(orderId, deliveryBoyId) {
  const { error } = await supabase.from("orders").update({ delivery_boy_id: deliveryBoyId }).eq("id", orderId);
  if (error) throw error;
}

// ============================================================
// ORDER TRACKING — customer login ke bina, sirf order_number se apna
// order dekh sake. `orders` table ki RLS (owner-only select) bilkul
// nahi badli — yeh security-definer RPC sirf tracking-relevant fields
// deta hai jab exact order_number match ho.
// ============================================================
export async function fetchOrderTracking(storeId, orderNumber) {
  const { data, error } = await supabase.rpc("get_order_tracking", { p_store_id: storeId, p_order_number: orderNumber });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

// Dashboard ke "Aaj ka Khata Collection" hero-number ke liye
export async function fetchTodaysKhataCollection(storeId) {
  const { data, error } = await supabase.rpc("get_todays_khata_collection", { p_store_id: storeId });
  if (error) throw error;
  return Number(data) || 0;
}

// ============================================================
// KHATA / UDHAARI — dukaandar aur customer dono ko SAME record
// dikhta hai (ek hi ledger table, RPC ke through dono taraf se read).
// ============================================================

// Dukaandar ka poora khata overview — jin customers ka balance 0 nahi
// hai unki list, sabse zyada due wale upar (dashboard "Khata" tab ke liye).
export async function fetchStoreKhataOverview(storeId) {
  const { data, error } = await supabase.rpc("get_store_khata_overview", { p_store_id: storeId });
  if (error) throw error;
  return data || [];
}

// Ek customer ki poori transaction history (dukaandar customer-detail view ke liye)
export async function fetchCustomerKhataHistory(customerId) {
  const { data, error } = await supabase.rpc("get_customer_khata_history", { p_customer_id: customerId });
  if (error) throw error;
  return data || [];
}

// Naya "walk-in" customer banao sirf Khata ke liye (kabhi online order
// nahi kiya) — agar isi phone se record pehle se hai (online order ya
// pehle se khata), wahi return hota hai, duplicate nahi banta.
export async function createKhataCustomer(storeId, phone, name) {
  const { data, error } = await supabase.rpc("create_khata_customer", { p_store_id: storeId, p_phone: phone, p_name: name });
  if (error) throw error;
  return data; // customer id
}

// Naya udhaar (debit) ya payment-received (credit) entry — atomic RPC,
// balance aur transaction dono ek hi operation mein update hote hain
// (jaise stock+order atomic hai place_order mein), isliye kabhi
// out-of-sync nahi ho sakte.
export async function addKhataTransaction(storeId, customerId, type, amount, description) {
  const { data, error } = await supabase.rpc("add_khata_transaction", {
    p_store_id: storeId, p_customer_id: customerId, p_type: type, p_amount: amount, p_description: description || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// Customer apna khata dekhe — guest, sirf phone-number se (login nahi
// hai), read-only. Yehi RPC dukaandar wali same table se read karta
// hai, isliye dono taraf hamesha ek jaisa balance/history dikhta hai.
export async function fetchMyKhata(storeId, phone) {
  const { data, error } = await supabase.rpc("get_my_khata", { p_store_id: storeId, p_phone: phone });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || { khata_balance: 0, transactions: [] };
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
