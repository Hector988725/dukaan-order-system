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


// ============================================================
// WEB PUSH — server (edge function `send-push`) se aaya notification dikhana
// ============================================================
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Dukaan";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) {
        try { if ("navigate" in c && c.url !== url) await c.navigate(url); } catch (e) { /* ignore */ }
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
