// ============================================================
// Edge Function: send-push   (free Web Push sender)
// ============================================================
// Database triggers (migration_web_push.sql) isko pg_net se call karte hain.
// Ye subscriptions dhoondh kar browser ke push service ko message bhejta hai.
//
// DEPLOY: Dashboard -> Edge Functions -> "send-push" -> paste.
//   "Verify JWT" = OFF  (call database se aata hai, user login se nahi; security ke liye PUSH_SECRET header check hota hai)
// SECRETS (Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (npx web-push generate-vapid-keys)
//   VAPID_SUBJECT  = mailto:tumhara-email@example.com
//   PUSH_SECRET    = koi lamba random string (wahi push_config.secret me daalo)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (default available)
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PUSH_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json({ error: "VAPID keys missing" }, 500);
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", pub, priv);

  let b: { user_ids?: string[]; order_id?: string | null; title?: string; body?: string; url?: string; tag?: string; final?: boolean };
  try { b = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const userIds = Array.isArray(b.user_ids) ? b.user_ids.filter((x) => typeof x === "string").slice(0, 200) : [];
  const orderId = typeof b.order_id === "string" ? b.order_id : null;
  if (userIds.length === 0 && !orderId) return json({ sent: 0 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const subs: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
  if (userIds.length) {
    const { data } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", userIds);
    subs.push(...(data || []));
  }
  if (orderId) {
    const { data } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("order_id", orderId);
    subs.push(...(data || []));
  }

  const payload = JSON.stringify({ title: String(b.title || "Dukaan").slice(0, 120), body: String(b.body || "").slice(0, 240), url: String(b.url || "/"), tag: b.tag });
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);   // user ne notifications band kar diye / app hata di
      else console.error("push failed", code, (e as Error).message);
    }
  }));
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
  // order khatam (Delivered / Cancelled): customer ki is order ki subscriptions saaf
  if (b.final && orderId) await db.from("push_subscriptions").delete().eq("order_id", orderId);
  return json({ sent, removed: dead.length });
});
