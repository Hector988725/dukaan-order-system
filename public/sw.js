// ============================================================
// MINIMAL SERVICE WORKER — sirf "installable app" banane ke liye
// ============================================================
// Jaan-bujh kar koi data cache nahi karta. Yeh app live orders,
// live stock, live pricing dikhata hai — agar hum purana data cache
// karke offline dikhayein, to dukaandar/customer ko galat (stale)
// stock ya price dikh sakta hai, jo real nuksan kar sakta hai.
// Isliye yeh service worker sirf har request ko seedha network pe
// bhej deta hai — iska ek hi kaam hai: browser ko "installable"
// criteria satisfy karana.
// ============================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Sirf apni hi site ke GET requests ko touch karte hain (installability
  // ke liye itna hi kaafi hai). Doosri site (jaise Supabase, Razorpay) ke
  // requests ko bilkul chhoo bhi nahi rahe — unhe browser khud normally
  // handle karega, isse cross-origin API calls (jaise payment) mein koi
  // confusion/interference nahi hoga.
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(fetch(event.request));
});
