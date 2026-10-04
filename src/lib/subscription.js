// ============================================================
// Subscription renewal window — ek hi jagah
// Payment ka option sirf tab dikhta hai jab:
//   - dukaan inactive/expire ho chuki ho, ya
//   - expiry mein RENEWAL_WINDOW_DAYS ya usse kam din bache hon.
// Payment hone ke baad (jitne mahine ka pay kiya) agla renewal
// window tab tak band rehta hai. Server (edge functions) bhi yahi rule
// lagata hai — isliye browser se bypass nahi hota.
// ============================================================
export const RENEWAL_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getRenewalState(store) {
  const expiry = store?.subscription_expires_at ? new Date(store.subscription_expires_at) : null;
  const now = Date.now();
  const flagOn = store?.is_active !== false;
  const active = flagOn && !!expiry && expiry.getTime() > now;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - now) / DAY_MS) : null;
  const isFree = !!expiry && expiry.getFullYear() >= 2090; // free/lifetime shops
  const due = !active || (!isFree && daysLeft <= RENEWAL_WINDOW_DAYS);
  const renewalOpensOn = expiry && !isFree ? new Date(expiry.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS) : null;
  return { expiry, active, daysLeft, isFree, due, expiringSoon: active && due, renewalOpensOn };
}
