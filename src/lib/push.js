import { supabase } from "./supabase";
import { isStandalone, isIOS } from "./installApp";

// ============================================================
// WEB PUSH (free). Browser ka apna push service + Supabase edge function `send-push`.
// Env: VITE_VAPID_PUBLIC_KEY (build time). Ek device = ek subscription.
// ============================================================
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function keyBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// 'unavailable' (server key set nahi) | 'unsupported' | 'needs-install' (iPhone: pehle Home Screen par add) | 'denied' | 'off' | 'on'
export async function pushState() {
  if (!VAPID) return "unavailable";
  if (!pushSupported()) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch { return "off"; }
}

async function getSubscription() {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
  const j = sub.toJSON ? sub.toJSON() : {};
  return { endpoint: sub.endpoint, p256dh: (j.keys && j.keys.p256dh) || b64url(sub.getKey("p256dh")), auth: (j.keys && j.keys.auth) || b64url(sub.getKey("auth")), sub };
}

async function ask() {
  const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (p !== "granted") throw new Error("denied");
}

// Logged-in user (owner / staff / rider / distributor)
export async function enablePush(role) {
  await ask();
  const s = await getSubscription();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: s.endpoint, p_p256dh: s.p256dh, p_auth: s.auth, p_role: role || null });
  if (error) throw error;
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await supabase.rpc("remove_push_subscription", { p_endpoint: sub.endpoint }).then(() => {}, () => {});
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
}

// Customer: sirf is ek order ke liye (order number + phone se verify hota hai)
export async function enableCustomerPush({ storeId, orderNumber, phone }) {
  await ask();
  const s = await getSubscription();
  const { error } = await supabase.rpc("save_customer_push", {
    p_store_id: storeId, p_order_number: orderNumber, p_phone: phone, p_endpoint: s.endpoint, p_p256dh: s.p256dh, p_auth: s.auth,
  });
  if (error) throw error;
}

// Logout par: is device se push hatao (agla user apne naam se dobara on karega)
export function pushOnLogout() { return disablePush(); }
