import { supabase } from "../lib/supabase";

// ============================================================
// SUPER ADMIN AUTH CHECK
// ============================================================
export async function checkIsSuperAdmin(email) {
  if (!email) return false;
  const { data } = await supabase
    .from("super_admins")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export async function fetchDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [storesRes, ordersRes, paymentsRes, newTodayRes] = await Promise.all([
    supabase.from("stores").select("id, is_active, subscription_expires_at, created_at"),
    supabase.from("orders").select("id, total, status"),
    supabase.from("payment_logs").select("id, amount, status"),
    supabase.from("stores").select("id").gte("created_at", today.toISOString()),
  ]);

  const stores = storesRes.data || [];
  const orders = ordersRes.data || [];
  const payments = paymentsRes.data || [];
  const newToday = newTodayRes.data || [];

  const now = new Date();
  const activeStores = stores.filter(s =>
    s.is_active &&
    s.subscription_expires_at &&
    new Date(s.subscription_expires_at) > now
  );
  const expiredStores = stores.filter(s =>
    !s.is_active ||
    !s.subscription_expires_at ||
    new Date(s.subscription_expires_at) <= now
  );

  const totalRevenue = payments
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    totalStores: stores.length,
    activeStores: activeStores.length,
    expiredStores: expiredStores.length,
    totalOrders: orders.length,
    totalRevenue,
    newStoresToday: newToday.length,
  };
}

// ============================================================
// STORES MANAGEMENT
// ============================================================
export async function fetchAllStoresAdmin() {
  // Security note: yeh direct view-select nahi karta (view auth.users
  // ke saath join karke owner emails leak kar sakta tha) — ek
  // security-definer RPC use karta hai jo sirf super admin ko hi data
  // deta hai, poori tarah verify karke.
  const { data, error } = await supabase.rpc("get_admin_stores");
  if (error) {
    console.warn("get_admin_stores RPC fail hua, fallback try kar rahe hain:", error);
    const { data: basic } = await supabase.from("stores").select("*").order("created_at", { ascending: false });
    return basic || [];
  }
  return data || [];
}

export async function fetchStoreOrders(storeId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminActivateStore(storeId) {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 1);
  const { error } = await supabase
    .from("stores")
    .update({ is_active: true, subscription_expires_at: expiry.toISOString() })
    .eq("id", storeId);
  if (error) throw error;
}

export async function adminDeactivateStore(storeId) {
  const { error } = await supabase
    .from("stores")
    .update({ is_active: false })
    .eq("id", storeId);
  if (error) throw error;
}

export async function adminExtendSubscription(storeId, months) {
  const { data: store } = await supabase
    .from("stores")
    .select("subscription_expires_at")
    .eq("id", storeId)
    .single();

  const base = store?.subscription_expires_at && new Date(store.subscription_expires_at) > new Date()
    ? new Date(store.subscription_expires_at)
    : new Date();

  const newExpiry = new Date(base);
  newExpiry.setMonth(newExpiry.getMonth() + months);

  const { error } = await supabase
    .from("stores")
    .update({ is_active: true, subscription_expires_at: newExpiry.toISOString() })
    .eq("id", storeId);
  if (error) throw error;
  return newExpiry;
}

export async function adminDeleteStore(storeId) {
  const { error } = await supabase
    .from("stores")
    .delete()
    .eq("id", storeId);
  if (error) throw error;
}

// ============================================================
// ALL ORDERS (for monitoring)
// ============================================================
export async function fetchAllOrdersAdmin(storeId = null) {
  let query = supabase
    .from("orders")
    .select("*, stores(name, slug)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================
// PAYMENTS
// ============================================================
export async function fetchAllPaymentsAdmin() {
  const { data, error } = await supabase
    .from("payment_logs")
    .select("*, stores(name, slug)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

// ============================================================
// SUBSCRIPTION PLANS
// ============================================================
export async function fetchSubscriptionPlans() {
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order");
  return data || [];
}

export async function updateSubscriptionPlan(id, updates) {
  const { error } = await supabase
    .from("subscription_plans")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function createSubscriptionPlan(plan) {
  const { error } = await supabase
    .from("subscription_plans")
    .insert(plan);
  if (error) throw error;
}

export async function deleteSubscriptionPlan(id) {
  const { error } = await supabase
    .from("subscription_plans")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// ANALYTICS - Daily data
// ============================================================
export async function fetchAnalytics() {
  // Last 30 days registrations
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: stores } = await supabase
    .from("stores")
    .select("created_at, is_active, subscription_expires_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const { data: payments } = await supabase
    .from("payment_logs")
    .select("created_at, amount, status")
    .eq("status", "paid")
    .gte("created_at", thirtyDaysAgo.toISOString());

  // Group by date
  const dailyRegistrations = {};
  const dailyRevenue = {};

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyRegistrations[key] = 0;
    dailyRevenue[key] = 0;
  }

  (stores || []).forEach(s => {
    const key = s.created_at.split("T")[0];
    if (dailyRegistrations[key] !== undefined) dailyRegistrations[key]++;
  });

  (payments || []).forEach(p => {
    const key = p.created_at.split("T")[0];
    if (dailyRevenue[key] !== undefined) dailyRevenue[key] += Number(p.amount);
  });

  return {
    dailyRegistrations: Object.entries(dailyRegistrations).map(([date, count]) => ({ date, count })),
    dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
  };
}
