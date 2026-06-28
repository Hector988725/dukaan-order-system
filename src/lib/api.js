import { supabase, STORE_SLUG } from "./supabase";

// ============================================================
// STORE
// ============================================================
export async function fetchStore() {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", STORE_SLUG)
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
