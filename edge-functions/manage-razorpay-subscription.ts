// ============================================================
// Edge Function: manage-razorpay-subscription   (AutoPay: create / cancel)
// ============================================================
// SECURITY (Phase 1B):
//  - Login (user JWT) zaroori; store ka owner wahi hona chahiye.
//  - Ek hi plan: store ka base price ₹199 ho to RAZORPAY_PLAN_REGULAR,
//    ₹49 (super-admin ne special set kiya) ho to RAZORPAY_PLAN_SPECIAL_49.
//    Client plan/tier/price kuch nahi bhej sakta.
//  - AutoPay already active ho to duplicate subscription nahi banti.
//  - Access yahan kabhi grant nahi hota — sirf webhook (charged) se.
//
// DEPLOY: Dashboard -> Edge Functions -> "manage-razorpay-subscription" -> paste.
//   "Verify JWT" = ON.
// SECRETS: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//   RAZORPAY_PLAN_REGULAR (₹199 plan id), RAZORPAY_PLAN_SPECIAL_49 (₹49 plan id)
//   (purane RAZORPAY_PLAN_FOUNDING_* / REGULAR_* ab use nahi hote)
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? Deno.env.get("RAZORPAY_SECRET");
    if (!KEY_ID || !KEY_SECRET) return json({ error: "Payment system configured nahi hai" }, 500);
    const rzpAuth = "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = token ? await admin.auth.getUser(token) : { data: null, error: new Error("no token") };
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Login zaroori hai" }, 401);

    const { action, store_id } = await req.json();
    if (!store_id) return json({ error: "store_id zaroori hai" }, 400);

    const { data: store } = await admin
      .from("stores")
      .select("id, name, user_id, subscription_base_price, razorpay_subscription_id, autopay_enabled, subscription_status, is_active, subscription_expires_at")
      .eq("id", store_id)
      .maybeSingle();
    if (!store || store.user_id !== user.id) return json({ error: "Store nahi mili" }, 404);

    if (action === "cancel") {
      if (!store.razorpay_subscription_id) return json({ error: "Koi active AutoPay subscription nahi hai" }, 400);
      // Mandate kabhi approve hi nahi hua ("created") to Razorpay par cancel ki zaroorat nahi — wo apne aap expire hota hai.
      const pre = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(store.razorpay_subscription_id)}`, { headers: { Authorization: rzpAuth } });
      const preData = await pre.json().catch(() => ({}));
      if (pre.ok && preData.status === "created") {
        await admin.from("stores").update({ subscription_status: "cancelled", autopay_enabled: false }).eq("id", store.id);
        return json({ success: true });
      }
      const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(store.razorpay_subscription_id)}/cancel`, {
        method: "POST",
        headers: { Authorization: rzpAuth, "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_at_cycle_end: 0 }),
      });
      const d = await r.json();
      if (!r.ok) return json({ error: d.error?.description || "Cancel nahi ho paaya" }, 400);
      // Paid period (subscription_expires_at) chhoona nahi — woh tak access chalta rahega.
      await admin.from("stores").update({ subscription_status: "cancelled", autopay_enabled: false }).eq("id", store.id);
      return json({ success: true });
    }

    if (action !== "create") return json({ error: "Invalid action" }, 400);

    // Renewal window: payment sirf tab jab plan khatam hone me <= 7 din bache ho (ya khatam ho chuka ho)
    {
      const exp = store.subscription_expires_at ? new Date(store.subscription_expires_at).getTime() : 0;
      const activeNow = store.is_active !== false && exp > Date.now();
      if (activeNow && exp - Date.now() > 7 * 24 * 60 * 60 * 1000) {
        const till = new Date(exp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        return json({ error: `Aapka plan ${till} tak chalu hai. Payment renewal ke 7 din pehle se khulti hai.` }, 400);
      }
    }

    if (store.autopay_enabled && store.razorpay_subscription_id && ["active", "payment_pending"].includes(store.subscription_status)) {
      // Pehle Razorpay se asli status poochho. Agar user ne mandate approve kiye bina
      // checkout band kar diya ("created"), to wahi subscription dobara kholo, naya nahi.
      const cur = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(store.razorpay_subscription_id)}`, {
        headers: { Authorization: rzpAuth },
      });
      const curData = await cur.json().catch(() => ({}));
      if (cur.ok && curData.status === "created") {
        return json({ subscription_id: store.razorpay_subscription_id, key_id: KEY_ID });
      }
      if (cur.ok && ["authenticated", "active", "pending"].includes(curData.status)) {
        return json({ error: "AutoPay pehle se chal raha hai" }, 400);
      }
      // cancelled / completed / expired / halted ya fetch fail -> neeche naya subscription bana do
      if (!cur.ok) return json({ error: "AutoPay ka status abhi check nahi ho paaya. Thodi der baad try karein." }, 502);
    }

    const base = Number(store.subscription_base_price) === 49 ? 49 : 199;
    const planId = base === 49 ? Deno.env.get("RAZORPAY_PLAN_SPECIAL_49") : Deno.env.get("RAZORPAY_PLAN_REGULAR");
    if (!planId) return json({ error: "Plan configure nahi hai. Support se sampark karein." }, 500);

    const r = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: rzpAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        customer_notify: 1,
        total_count: 120, // ~10 saal; "jab tak cancel na ho"
        notes: { store_id: store.id, store_name: store.name, base_price: String(base) },
      }),
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d.error?.description || "Subscription create nahi ho paayi" }, 400);

    await admin.from("stores").update({
      razorpay_subscription_id: d.id,
      autopay_enabled: true,
      subscription_status: "payment_pending", // mandate approve + pehla charge baaki
    }).eq("id", store.id);

    return json({ subscription_id: d.id, key_id: KEY_ID });
  } catch (e) {
    console.error("manage-razorpay-subscription error:", e);
    return json({ error: "Kuch gadbad ho gayi" }, 500);
  }
});
