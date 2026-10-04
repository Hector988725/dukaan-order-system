// ============================================================
// Edge Function: create-razorpay-order   (ONE-TIME payment)
// ============================================================
// SECURITY (Phase 1B):
//  - Caller ka login (user JWT) zaroori hai; anon key se nahi chalega.
//  - store_id ka owner wahi hona chahiye jo login hai.
//  - AMOUNT client se NAHI aata. Server store ke asli base price
//    (₹199, ya super-admin ne ₹49 set kiya ho) aur months se khud
//    nikalta hai (DB function compute_subscription_amount).
//  - Order ka record subscription_payments mein banta hai; usi record
//    ke amount se baad mein payment verify hota hai.
//
// DEPLOY: Dashboard -> Edge Functions -> "create-razorpay-order" -> paste.
//   "Verify JWT" = ON (default) rakho.
// SECRETS: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (ya purana RAZORPAY_SECRET)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (default available)
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Login check
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = token ? await admin.auth.getUser(token) : { data: null, error: new Error("no token") };
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Login zaroori hai" }, 401);

    // 2. Input
    const body = await req.json();
    const storeId = String(body.store_id || "");
    const months = Number(body.months);
    if (!storeId) return json({ error: "store_id zaroori hai" }, 400);
    if (![1, 3, 6, 12].includes(months)) return json({ error: "months 1, 3, 6 ya 12 hona chahiye" }, 400);

    // 3. Ownership
    const { data: store } = await admin
      .from("stores").select("id, name, user_id, subscription_base_price").eq("id", storeId).maybeSingle();
    if (!store || store.user_id !== user.id) return json({ error: "Store nahi mili" }, 404);

    // 4. Price server-side
    const base = Number(store.subscription_base_price) === 49 ? 49 : 199;
    const { data: amountRupees, error: amtErr } = await admin.rpc("compute_subscription_amount", { p_base: base, p_months: months });
    if (amtErr || !amountRupees) return json({ error: "Amount calculate nahi ho paaya" }, 500);
    const amountPaise = Number(amountRupees) * 100;

    // 5. Razorpay order
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`.slice(0, 40),
        notes: { store_id: store.id, months: String(months), purpose: "subscription" },
      }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order.error?.description || "Order create nahi ho paaya" }, 400);

    // 6. Server-side record (isi se baad mein verify hoga)
    const { error: insErr } = await admin.from("subscription_payments").insert({
      store_id: store.id,
      razorpay_order_id: order.id,
      months,
      base_price: base,
      amount_paise: amountPaise,
      created_by: user.id,
    });
    if (insErr) return json({ error: "Order save nahi ho paaya" }, 500);

    return json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: KEY_ID });
  } catch (e) {
    console.error("create-razorpay-order error:", e);
    return json({ error: "Kuch gadbad ho gayi" }, 500);
  }
});
