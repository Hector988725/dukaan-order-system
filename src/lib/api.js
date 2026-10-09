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
// ACCOUNT SETTINGS — email/password change, current-password verify
// ke saath. Existing signIn/signUp/updatePassword ko bilkul nahi
// chheda — yeh sirf unke upar ek security layer add karte hain.
// ============================================================

// Current password sahi hai ya nahi check karta hai (bina session
// change kiye) — Supabase mein isका koi seedha "verify" API nahi hai,
// isliye hum khud ke email+password se dobara signIn try karte hain.
// Agar galat hai to "Invalid login credentials" error throw hoga.
export async function verifyCurrentPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Naya email set karta hai — Supabase khud confirmation email bhejta
// hai NAYE address par, jab tak wahan confirm na ho email badalta nahi
// (yeh Supabase ka built-in secure default hai, humne kuch alag nahi kiya).
export async function changeEmail(newEmail) {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

// Naya password set karta hai (current-password verify hone ke BAAD
// hi is function ko call kiya jaata hai — AccountSettings.jsx dekhein).
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ============================================================
// STORE
// ============================================================
export async function fetchStoreBySlug(slug) {
  // Public storefront sirf `public_stores` view se padhta hai (safe columns).
  // is_active yahan server-side computed hai (flag AND expiry), is_owner bhi.
  const { data, error } = await supabase
    .from("public_stores")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
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

// URL slug badalna — jaan-bujh kar isko har jagah easily available nahi
// banaya (sirf Store Settings mein, spasht warning ke saath), kyunki
// agar customer ne purana link save/bookmark kiya hai to woh tootega.
export async function updateStoreSlug(storeId, newSlug) {
  const { error } = await supabase.from("stores").update({ slug: newSlug }).eq("id", storeId);
  if (error) throw error;
}

export async function createStore(userId, { slug, name, business_type, whatsapp_number, upi_id, address }) {
  // Subscription/pricing/founding fields client se NAHI bheje jaate. DB trigger
  // (guard_store_protected_columns) naye store ko hamesha "inactive, unpaid,
  // ₹199" shuru karta hai; activation sirf server-verified payment se hoti hai.
  const { data, error } = await supabase
    .from("stores")
    .insert({ user_id: userId, slug, name, business_type, whatsapp_number, upi_id, address })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Ek hi click mein saare products ka GST rate set karna — har product
// mein jaakar alag-alag edit karna practical nahi hai.
export async function applyGstRateToAllProducts(storeId, rate) {
  const { data, error } = await supabase.rpc("apply_gst_rate_to_all_products", { p_store_id: storeId, p_rate: rate });
  if (error) throw error;
  return data; // kitne variants update hue
}

// Signup URL mein agar ?ref=CODE tha, is store ko us distributor se
// permanently jod deta hai (server-side RPC, invalid code par silently
// no-op — signup kabhi fail nahi hona chahiye galat ref code ki wajah se).
export async function attributeStoreToReferral(storeId, referralCode) {
  const { error } = await supabase.rpc("attribute_store_to_referral_code", {
    p_store_id: storeId,
    p_referral_code: referralCode,
  });
  if (error) throw error;
}

// ============================================================
// DISTRIBUTOR — self-serve portal (/distributor)
// ============================================================
// Naya distributor apna login khud banata hai (signUp se), phir apne
// referral_code se is RPC ke through us account ko apne distributor
// record se jodta hai (ek baar hi karna hota hai). Referral code public hai,
// isliye saath me Super Admin ka diya private, ek-baar-ka Claim Code lagta hai.
export async function claimDistributorAccount(referralCode, claimCode) {
  const { data, error } = await supabase.rpc("claim_distributor_account", { p_referral_code: referralCode, p_claim_code: claimCode });
  if (error) throw error;
  if (data === "ok") return;
  if (data === "locked") throw new Error("Too many wrong attempts. Please try again after 15 minutes.");
  if (data === "already_linked") throw new Error("This account is already linked to a distributor record.");
  throw new Error("Referral Code or Claim Code is incorrect, expired, or already used. Please ask for a new Claim Code.");
}

// Distributor apna dashboard dekhta hai isse — apna hi data aata hai
// (RPC security-definer hai, auth.uid() se khud match karta hai).
export async function fetchDistributorDashboard() {
  const { data, error } = await supabase.rpc("get_distributor_dashboard");
  if (error) throw error;
  return data?.[0] || null;
}

// Step 4B — distributor portal extras (migration_distributor_portal_b.sql)
export async function fetchDistributorProfile() {
  const { data, error } = await supabase.rpc("get_distributor_profile");
  if (error) throw error;
  return data?.[0] || null;
}
export async function fetchDistributorReferredShops(limit = 100, offset = 0) {
  const { data, error } = await supabase.rpc("get_distributor_referred_shops", { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return data || [];
}
export async function fetchDistributorCommissionHistory(months = 12) {
  const { data, error } = await supabase.rpc("get_distributor_commission_history", { p_months: months });
  if (error) throw error;
  return data || [];
}

// Sirf 500+ active-paid shops wale distributors register kar sakte hain
// (RPC khud yeh check karta hai, live count se — permanent milestone
// nahi, agar shops kam ho jaayein to eligibility bhi chali jaati hai).
export async function registerDistributorNominee(distributorId, name, relationship, phone) {
  const { data, error } = await supabase.rpc("register_distributor_nominee", {
    p_distributor_id: distributorId,
    p_name: name,
    p_relationship: relationship,
    p_phone: phone,
  });
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

// Stock ab seedha table UPDATE se nahi badalta — database mein trigger
// ise block karta hai. Saara stock change ek hi centralized function
// (apply_stock_change) se guzarta hai, aur har change stock_movements
// mein log hota hai. (migration_purchase_supplier.sql dekhein)

// Absolute value set karta hai (Edit Variant form).
export async function updateVariantStock(variantId, newStock) {
  const { error } = await supabase.rpc("set_variant_stock", { p_variant_id: variantId, p_new_stock: Number(newStock) });
  if (error) throw error;
}

// +/- buttons ke liye — delta based, isliye 2 jagah se ek saath badalne par bhi galat nahi hota.
export async function adjustVariantStock(variantId, delta) {
  const { data, error } = await supabase.rpc("adjust_variant_stock", { p_variant_id: variantId, p_delta: Number(delta) });
  if (error) throw error;
  return data;
}

// ---- Product CRUD ----
export async function createProduct(storeId, { name, category, emoji, image_url, image_urls, description, sort_order, brand, sub_category, age_group }) {
  const photos = image_urls && image_urls.length > 0 ? image_urls : (image_url ? [image_url] : []);
  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: storeId, name, category, emoji: emoji || "📦",
      image_url: photos[0] || null, image_urls: photos, description: description || null,
      sort_order: sort_order || 0,
      // Naye optional fields (Cosmetics / Gift-Toys). Purane business types
      // ye bhejte hi nahi, to unke rows mein yeh NULL rehte hain.
      ...(brand !== undefined ? { brand: brand || null } : {}),
      ...(sub_category !== undefined ? { sub_category: sub_category || null } : {}),
      ...(age_group !== undefined ? { age_group: age_group || null } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(productId, { name, category, emoji, image_url, image_urls, description, brand, sub_category, age_group }) {
  const photos = image_urls && image_urls.length > 0 ? image_urls : (image_url ? [image_url] : []);
  const { error } = await supabase
    .from("products")
    .update({
      name, category, emoji, image_url: photos[0] || null, image_urls: photos, description: description || null,
      ...(brand !== undefined ? { brand: brand || null } : {}),
      ...(sub_category !== undefined ? { sub_category: sub_category || null } : {}),
      ...(age_group !== undefined ? { age_group: age_group || null } : {}),
    })
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
    await supabase.rpc("refresh_storage_usage", { p_store_id: storeId });
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


export async function deleteProduct(productId) {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
}

// ---- Variant CRUD ----
export async function createVariant(productId, { label, unit, price, stock, barcode, mrp, offer_enabled, offer_price, offer_starts_at, offer_ends_at, qty_deal_tiers, gst_rate }) {
  const { data, error } = await supabase
    .from("variants")
    .insert({
      product_id: productId, label, unit, price, stock: stock || 0, barcode: barcode || null, mrp: mrp || null,
      offer_enabled: offer_enabled || false, offer_price: offer_price || null,
      offer_starts_at: offer_starts_at || null, offer_ends_at: offer_ends_at || null,
      qty_deal_tiers: qty_deal_tiers && qty_deal_tiers.length > 0 ? qty_deal_tiers : null,
      gst_rate: gst_rate || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVariant(variantId, { label, unit, price, stock, barcode, mrp, offer_enabled, offer_price, offer_starts_at, offer_ends_at, qty_deal_tiers, gst_rate }) {
  const { error } = await supabase
    .from("variants")
    .update({
      label, unit, price, barcode: barcode || null, mrp: mrp || null,
      offer_enabled: offer_enabled || false, offer_price: offer_price || null,
      offer_starts_at: offer_starts_at || null, offer_ends_at: offer_ends_at || null,
      qty_deal_tiers: qty_deal_tiers && qty_deal_tiers.length > 0 ? qty_deal_tiers : null,
      gst_rate: gst_rate || 0,
    })
    .eq("id", variantId);
  if (error) throw error;
  // Stock alag se, centralized function ke through (direct UPDATE block hai).
  if (stock !== undefined && stock !== null && stock !== "") {
    await updateVariantStock(variantId, stock);
  }
}

export async function deleteVariant(variantId) {
  const { error } = await supabase.from("variants").delete().eq("id", variantId);
  if (error) throw error;
}

// ---- Store Settings ----
export async function updateStoreSettings(storeId, { name, whatsapp_number, upi_id, address, logo_url, tagline, timings, delivery_fee, free_delivery_above, auto_hours_enabled, opens_at, closes_at, banner_images, facebook_url, instagram_url, youtube_url, gmb_url, maps_link, delivery_enabled, gst_enabled, gst_price_type, gst_state, gstin }) {
  const { error } = await supabase
    .from("stores")
    .update({ name, whatsapp_number, upi_id, address, logo_url, tagline, timings, delivery_fee, free_delivery_above, auto_hours_enabled, opens_at, closes_at, banner_images, facebook_url, instagram_url, youtube_url, gmb_url, maps_link, delivery_enabled, gst_enabled, gst_price_type, gst_state, gstin })
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
    p_booking_date: orderPayload.booking_date || null,
    p_booking_slot: orderPayload.booking_slot || null,
    p_customer_state: orderPayload.customer_state || null,
    p_discount_amount: orderPayload.discount_amount || 0,
    p_taxable_amount: orderPayload.taxable_amount ?? null,
    p_cgst_amount: orderPayload.cgst_amount || 0,
    p_sgst_amount: orderPayload.sgst_amount || 0,
    p_igst_amount: orderPayload.igst_amount || 0,
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
  // undefined = landmark touch nahi karna; "" = jaan-bujh kar khaali (null store).
  const { error } = await supabase.rpc("save_customer_details", {
    p_store_id: storeId, p_phone: phone, p_name: name, p_address: address,
    p_landmark: landmark === undefined ? null : (landmark || ""),
    p_update_landmark: landmark !== undefined,
    p_pincode: pincode,
  });
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
        image_url: row.image_url || undefined,
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

// Countdown timers ke liye — customer ke phone ki local clock galat ho
// sakti hai, isliye server ka asli time ek baar fetch karke offset
// nikalte hain (CustomerView mount hote hi).
export async function fetchServerTime() {
  const { data, error } = await supabase.rpc("get_server_time");
  if (error) throw error;
  return new Date(data);
}

// ============================================================
// COMBO OFFER — multiple products ek bundle price par
// ============================================================
export async function fetchCombos(storeId) {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(id, qty, variants(id, label, unit, price, stock, gst_rate, product_id, products(id, name, emoji, image_url)))")
    .eq("store_id", storeId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Admin panel mein sab combos dikhane ke liye (active + inactive dono)
export async function fetchAllCombosForAdmin(storeId) {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(id, qty, variant_id, variants(id, label, unit, price, product_id, products(id, name, emoji)))")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCombo(storeId, { name, combo_price, image_url }, items) {
  const { data, error } = await supabase.rpc("create_combo_with_items", {
    p_store_id: storeId, p_name: name, p_combo_price: combo_price, p_image_url: image_url || null,
    p_items: items.map((it) => ({ variant_id: it.variant_id, qty: it.qty })),
  });
  if (error) throw error;
  return data; // combo id
}

export async function updateCombo(comboId, { name, combo_price, image_url }, items) {
  const { error } = await supabase.rpc("update_combo_with_items", {
    p_combo_id: comboId, p_name: name, p_combo_price: combo_price, p_image_url: image_url || null,
    p_items: items.map((it) => ({ variant_id: it.variant_id, qty: it.qty })),
  });
  if (error) throw error;
}

export async function toggleComboActive(comboId, active) {
  const { error } = await supabase.from("combos").update({ active }).eq("id", comboId);
  if (error) throw error;
}

export async function deleteCombo(comboId) {
  const { error } = await supabase.from("combos").delete().eq("id", comboId);
  if (error) throw error;
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

export async function createDeliveryBoy(storeId, { name, phone, photo_url, vehicle_type, vehicle_number }) {
  const { data, error } = await supabase
    .from("delivery_boys")
    .insert({
      store_id: storeId, name, phone, photo_url: photo_url || null,
      vehicle_type: vehicle_type || "Bike", vehicle_number: vehicle_number || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDeliveryBoy(id, { name, phone, photo_url, vehicle_type, vehicle_number }) {
  const { error } = await supabase.from("delivery_boys")
    .update({ name, phone, photo_url, vehicle_type: vehicle_type || "Bike", vehicle_number: vehicle_number || null })
    .eq("id", id);
  if (error) throw error;
}

export async function setDeliveryBoyLoginEnabled(id, enabled) {
  const { error } = await supabase.from("delivery_boys").update({ login_enabled: enabled }).eq("id", id);
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

// Order par delivery boy assign / reassign karna (server-side RPC).
// Yeh delivery_assignments mein current assignment banata hai, orders.
// delivery_boy_id sync karta hai aur boy ko in-app notification bhejta
// hai. Order status ko touch nahi karta. deliveryBoyId = null => unassign.
export async function assignDeliveryBoy(orderId, deliveryBoyId, method = "SHOP_DELIVERY") {
  const { error } = await supabase.rpc("assign_delivery", {
    p_order_id: orderId, p_boy_id: deliveryBoyId || null, p_method: method,
  });
  if (error) throw error;
}

// ---- Owner: delivery methods / dashboard / history / login invite ----
export async function fetchStoreDeliveryMethods(storeId) {
  const { data, error } = await supabase.rpc("list_store_delivery_methods", { p_store_id: storeId });
  if (error) throw error;
  return data || [];
}
export async function setStoreDeliveryMethod(storeId, method, enabled) {
  const { error } = await supabase.rpc("set_store_delivery_method", { p_store_id: storeId, p_method: method, p_enabled: enabled });
  if (error) throw error;
}
export async function fetchDeliveryDashboard(storeId) {
  const { data, error } = await supabase.rpc("get_delivery_dashboard", { p_store_id: storeId });
  if (error) throw error;
  return data;
}
export async function fetchStoreDeliveryAssignments(storeId, { boyId = null, from = null, to = null } = {}) {
  const { data, error } = await supabase.rpc("get_store_delivery_assignments", {
    p_store_id: storeId, p_boy_id: boyId, p_from: from, p_to: to,
  });
  if (error) throw error;
  return data || [];
}
export async function generateDeliveryInvite(boyId) {
  const { data, error } = await supabase.rpc("generate_delivery_invite", { p_boy_id: boyId });
  if (error) throw error;
  return data;
}
export async function revokeDeliveryLogin(boyId) {
  const { error } = await supabase.rpc("revoke_delivery_login", { p_boy_id: boyId });
  if (error) throw error;
}

// ---- Delivery boy app (sirf apna data; sab kuch RPC se) ----
export async function claimDeliveryInvite(code) {
  const { data, error } = await supabase.rpc("claim_delivery_invite", { p_code: code });
  if (error) throw error;
  return data;
}
export async function fetchMyDeliveryProfile() {
  const { data, error } = await supabase.rpc("get_my_delivery_profile");
  if (error) throw error;
  return (data && data[0]) || null;
}
export async function fetchMyDeliveries(scope = "active", from = null, to = null) {
  const { data, error } = await supabase.rpc("get_my_deliveries", { p_scope: scope, p_from: from, p_to: to });
  if (error) throw error;
  return data || [];
}
export async function updateDeliveryStatus(assignmentId, newStatus) {
  const { data, error } = await supabase.rpc("delivery_update_status", { p_assignment_id: assignmentId, p_new_status: newStatus });
  if (error) throw error;
  return data;
}
export async function fetchMyDeliveryNotifications() {
  const { data, error } = await supabase.from("delivery_notifications").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}
export async function markDeliveryNotificationsRead() {
  const { error } = await supabase.rpc("mark_delivery_notifications_read");
  if (error) throw error;
}
// Realtime: naya notification aate hi callback (RLS ki wajah se sirf apne milte hain).
// Realtime na chale to DeliveryApp polling fallback use karta hai.
export function subscribeToMyDeliveryNotifications(boyId, onNew) {
  const channel = supabase
    .channel("delivery-notif-" + boyId)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "delivery_notifications", filter: `delivery_boy_id=eq.${boyId}` },
      (payload) => onNew(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ============================================================
// ORDER TRACKING — customer login ke bina, sirf order_number se apna
// order dekh sake. `orders` table ki RLS (owner-only select) bilkul
// nahi badli — yeh security-definer RPC sirf tracking-relevant fields
// deta hai jab exact order_number match ho.
// ============================================================
export async function fetchOrderTracking(storeId, orderNumber, phone) {
  const { data, error } = await supabase.rpc("get_order_tracking", { p_store_id: storeId, p_order_number: orderNumber, p_phone: phone });
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

// Customer apna khata dekhe — guest (login nahi), phone + 4-digit PIN se.
// PIN dukaandar generate karke customer ko deta hai. Return:
// { status: 'ok' | 'invalid' | 'locked', khata_balance, transactions }
export async function fetchMyKhata(storeId, phone, pin) {
  const { data, error } = await supabase.rpc("get_my_khata", { p_store_id: storeId, p_phone: phone, p_pin: pin });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || { status: "invalid", khata_balance: 0, transactions: [] };
}

// Dukaandar: customer ke liye naya random 4-digit PIN banao. PIN sirf
// isi ek baar wapas milta hai (database me sirf hash rehta hai); dobara
// generate karne par purana PIN band ho jata hai.
export async function generateKhataPin(customerId) {
  const { data, error } = await supabase.rpc("generate_khata_pin", { p_customer_id: customerId });
  if (error) throw error;
  return data;
}

// Dukaandar: kin customers ka PIN set hai -> Set of customer ids
export async function fetchKhataPinStatus(storeId) {
  const { data, error } = await supabase.rpc("get_khata_pin_status", { p_store_id: storeId });
  if (error) throw error;
  return new Set((data || []).map((r) => r.customer_id));
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

// ------------------------------------------------------------
// SUBSCRIPTION PAYMENTS — Phase 1B
// Browser kabhi subscription activate NAHI karta. Amount, plan aur activation
// sab server (edge functions + DB) tay karta hai. Har call user ke login
// token (JWT) ke saath jaati hai, anon key ke saath nahi.
// ------------------------------------------------------------
async function callAuthedFunction(name, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Login session nahi mili. Dobara login karein.");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: supabaseKey },
    body: JSON.stringify(payload),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok || data.error) throw new Error(data.error || "Request fail hui");
  return data;
}

// One-time payment: server amount tay karke Razorpay order banata hai.
export function createSubscriptionOrder(storeId, months) {
  return callAuthedFunction("create-razorpay-order", { store_id: storeId, months });
}

// Checkout ke baad: server signature + amount verify karke subscription badhata hai.
export function verifySubscriptionPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  return callAuthedFunction("verify-razorpay-payment", { razorpay_order_id, razorpay_payment_id, razorpay_signature });
}

// AutoPay (UPI e-mandate): plan server store ke price se chunta hai.
export async function createRazorpaySubscription(storeId) {
  return callAuthedFunction("manage-razorpay-subscription", { action: "create", store_id: storeId });
}

export async function cancelRazorpaySubscription(storeId) {
  return callAuthedFunction("manage-razorpay-subscription", { action: "cancel", store_id: storeId });
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


// ============================================================
// SUPPLIERS + PURCHASES
// ============================================================
// Saari writes security-definer RPCs se hoti hain (owner check ke saath);
// reads RLS ke through (sirf apni dukaan ka data dikhta hai).
// Detail: migration_purchase_supplier.sql

function cleanRpcError(error) {
  const msg = (error && error.message) || "Kuch gadbad ho gayi";
  const m = msg.match(/^(?:STOCK_UNAVAILABLE|VARIANT_MISSING):\s*(.*)$/);
  return new Error(m ? m[1] : msg);
}

export async function fetchSuppliers(storeId) {
  const { data, error } = await supabase.rpc("get_suppliers_overview", { p_store_id: storeId });
  if (error) throw cleanRpcError(error);
  return data || [];
}

export async function saveSupplier(storeId, { id, name, phone, address, gstin, notes, openingPayable, isActive }) {
  const { data, error } = await supabase.rpc("upsert_supplier", {
    p_store_id: storeId,
    p_name: name,
    p_phone: phone || null,
    p_address: address || null,
    p_gstin: gstin || null,
    p_notes: notes || null,
    p_supplier_id: id || null,
    p_opening_payable: id ? 0 : Number(openingPayable) || 0,
    p_is_active: isActive !== false,
  });
  if (error) throw cleanRpcError(error);
  return Array.isArray(data) ? data[0] : data;
}

export async function recordSupplierPayment(storeId, supplierId, amount, method, note) {
  const { data, error } = await supabase.rpc("record_supplier_payment", {
    p_store_id: storeId, p_supplier_id: supplierId, p_amount: Number(amount), p_method: method || "Cash", p_note: note || null,
  });
  if (error) throw cleanRpcError(error);
  return data; // naya payable balance
}

export async function fetchSupplierTransactions(supplierId) {
  const { data, error } = await supabase
    .from("supplier_transactions")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw cleanRpcError(error);
  return data || [];
}

// supplierId optional — diya to sirf us supplier ki purchase history.
export async function fetchPurchases(storeId, { supplierId, limit = 100 } = {}) {
  let q = supabase
    .from("purchases")
    .select("*, suppliers(name), purchase_items(*)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (supplierId) q = q.eq("supplier_id", supplierId);
  const { data, error } = await q;
  if (error) throw cleanRpcError(error);
  return data || [];
}

// { variant_id: last_purchase_price } — New Purchase mein price prefill ke liye.
export async function fetchLastPurchasePrices(storeId) {
  const { data, error } = await supabase
    .from("variant_purchase_prices")
    .select("variant_id, last_purchase_price")
    .eq("store_id", storeId);
  if (error) throw cleanRpcError(error);
  const map = {};
  (data || []).forEach((r) => { map[r.variant_id] = Number(r.last_purchase_price); });
  return map;
}

// status: "Draft" | "Ordered" | "Received" (Received = save + turant stock add)
export async function savePurchase(storeId, { purchaseId, supplierId, items, status, invoiceNumber, purchaseDate, notes, paidNow, paymentMethod }) {
  const { data, error } = await supabase.rpc("save_purchase", {
    p_store_id: storeId,
    p_supplier_id: supplierId,
    p_items: items.map((i) => ({ variant_id: i.variantId, qty: Number(i.qty), purchase_price: Number(i.price) })),
    p_status: status,
    p_purchase_id: purchaseId || null,
    p_invoice_number: invoiceNumber || null,
    p_purchase_date: purchaseDate || null,
    p_notes: notes || null,
    p_paid_now: Number(paidNow) || 0,
    p_payment_method: paymentMethod || "Cash",
  });
  if (error) throw cleanRpcError(error);
  return Array.isArray(data) ? data[0] : data;
}

export async function markPurchaseOrdered(storeId, purchaseId) {
  const { error } = await supabase.rpc("mark_purchase_ordered", { p_store_id: storeId, p_purchase_id: purchaseId });
  if (error) throw cleanRpcError(error);
}

// receipts = null -> baaki sab receive; ya [{ itemId, qty }] (partial)
export async function receivePurchase(storeId, purchaseId, { receipts, paidNow, paymentMethod } = {}) {
  const { data, error } = await supabase.rpc("receive_purchase", {
    p_store_id: storeId,
    p_purchase_id: purchaseId,
    p_receipts: receipts ? receipts.map((r) => ({ item_id: r.itemId, qty: Number(r.qty) })) : null,
    p_paid_now: Number(paidNow) || 0,
    p_payment_method: paymentMethod || "Cash",
  });
  if (error) throw cleanRpcError(error);
  return Array.isArray(data) ? data[0] : data;
}

export async function cancelPurchase(storeId, purchaseId) {
  const { error } = await supabase.rpc("cancel_purchase", { p_store_id: storeId, p_purchase_id: purchaseId });
  if (error) throw cleanRpcError(error);
}


// ============================================================
// BUSINESS CATEGORIES (Cosmetics / Gift-Toys) + CENTRAL CATALOG
// ============================================================
// Config tables (business_type_settings / business_categories) sabke
// liye readable hain; catalog_products / catalog_brands sirf apne
// business type ke shop owner ko dikhte hain (RLS). Saari writes
// sirf Super Admin ki. Detail: migration_beauty_kids_catalog.sql

// { business_type: { is_enabled, label, description } } — row na ho to enabled maana jaata hai.
export async function fetchBusinessTypeSettings() {
  const { data, error } = await supabase.from("business_type_settings").select("*");
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.business_type] = r; });
  return map;
}

const _categoryCache = {};
// [{ name, subs: [name, ...] }] — is business type ki main + sub categories.
// Khaali array = is type ke liye koi preset nahi (purane types), form pehle jaisa rahega.
export async function fetchBusinessCategories(businessType) {
  if (_categoryCache[businessType]) return _categoryCache[businessType];
  const { data, error } = await supabase
    .from("business_categories")
    .select("id, name, parent_id, sort_order")
    .eq("business_type", businessType)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const mains = rows.filter((r) => !r.parent_id);
  const tree = mains.map((m) => ({ name: m.name, subs: rows.filter((r) => r.parent_id === m.id).map((r) => r.name) }));
  _categoryCache[businessType] = tree;
  return tree;
}

export async function fetchCatalogProducts(businessType) {
  const { data, error } = await supabase
    .from("catalog_products")
    .select("*")
    .eq("business_type", businessType)
    .eq("is_active", true)
    .order("category")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function fetchCatalogBrands(businessType) {
  const { data, error } = await supabase
    .from("catalog_brands")
    .select("name, business_type")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data || []).filter((b) => !b.business_type || b.business_type === businessType).map((b) => b.name);
}

// variants: [{ label, unit, price, mrp, stock, barcode, gst_rate }]
export async function addCatalogProductToShop(storeId, catalogProductId, variants, brand, available = true) {
  const { data, error } = await supabase.rpc("add_catalog_product_to_shop", {
    p_store_id: storeId,
    p_catalog_product_id: catalogProductId,
    p_variants: variants.map((v) => ({
      label: v.label || "Standard",
      unit: v.unit || null,
      price: Number(v.price),
      mrp: v.mrp === "" || v.mrp == null ? null : Number(v.mrp),
      stock: Number(v.stock) || 0,
      barcode: v.barcode || null,
      gst_rate: v.gst_rate === "" || v.gst_rate == null ? null : Number(v.gst_rate),
    })),
    p_brand: brand || null,
    p_available: available !== false,
  });
  if (error) throw new Error((error.message || "Add nahi ho paaya").replace(/^(STOCK_UNAVAILABLE|VARIANT_MISSING):\s*/, ""));
  return Array.isArray(data) ? data[0] : data;
}

// Catalog se Super Admin ne jin products ko deactivate kiya, unki id -> true.
// Shop ka product safe rehta hai (order bhi chalta hai); owner ko sirf warning dikhti hai.
export async function fetchCatalogLinkStatus(storeId) {
  const { data, error } = await supabase.rpc("get_catalog_link_status", { p_store_id: storeId });
  if (error) return {};
  const map = {};
  (data || []).forEach((r) => { map[r.product_id] = true; });
  return map;
}

// Dukaandar ka "Available: Yes/No" — No hone par storefront mein "Out of Stock" jaisa dikhta hai
// aur order server-side par bhi reject hota hai.
export async function updateProductAvailability(productId, available) {
  const { error } = await supabase.from("products").update({ is_available: !!available }).eq("id", productId);
  if (error) throw error;
}

// ============================================================
// SHOP STAFF (migration_shop_staff_a.sql) — sab kuch RPC se
// ============================================================
export async function addShopStaff(storeId, name, phone) {
  const { data, error } = await supabase.rpc("add_shop_staff", { p_store_id: storeId, p_name: name, p_phone: phone || null });
  if (error) throw error;
  return data;
}
export async function fetchShopStaff(storeId) {
  const { data, error } = await supabase.rpc("get_shop_staff", { p_store_id: storeId });
  if (error) throw error;
  return data || [];
}
export async function updateShopStaff(staffId, name, permissions, isActive) {
  const { error } = await supabase.rpc("update_shop_staff", { p_staff_id: staffId, p_name: name, p_permissions: permissions, p_is_active: isActive });
  if (error) throw error;
}
export async function removeShopStaff(staffId) {
  const { error } = await supabase.rpc("remove_shop_staff", { p_staff_id: staffId });
  if (error) throw error;
}
export async function generateShopStaffInvite(staffId, resetLogin = false) {
  const { data, error } = await supabase.rpc("generate_shop_staff_invite", { p_staff_id: staffId, p_reset_login: resetLogin });
  if (error) throw error;
  return data;
}
export async function claimShopStaffInvite(code) {
  const { data, error } = await supabase.rpc("claim_shop_staff_invite", { p_code: code });
  if (error) throw error;
  return data;
}
export async function fetchMyStaffContext() {
  const { data, error } = await supabase.rpc("get_my_staff_context");
  if (error) throw error;
  return (data && data[0]) || null;
}
export async function staffFetchOrders(storeId, limit = 50) {
  const { data, error } = await supabase.rpc("staff_get_orders", { p_store_id: storeId, p_limit: limit });
  if (error) throw error;
  return data || [];
}
export async function setOrderStatusRpc(orderId, status) {
  const { error } = await supabase.rpc("set_order_status", { p_order_id: orderId, p_status: status });
  if (error) throw error;
}
export async function confirmOrderPaymentRpc(orderId) {
  const { error } = await supabase.rpc("set_order_payment_confirmed", { p_order_id: orderId });
  if (error) throw error;
}
export async function setVariantPriceRpc(variantId, price) {
  const { error } = await supabase.rpc("set_variant_price", { p_variant_id: variantId, p_price: price });
  if (error) throw error;
}
export async function setProductAvailabilityRpc(productId, available) {
  const { error } = await supabase.rpc("set_product_availability", { p_product_id: productId, p_available: !!available });
  if (error) throw error;
}
