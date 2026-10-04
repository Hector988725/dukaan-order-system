// ============================================================
// Edge Function: verify-razorpay-payment   (NAYA — ONE-TIME payment ke baad)
// ============================================================
// Checkout ke baad browser yahan order_id + payment_id + signature bhejta hai.
// Hum: (1) login + ownership check, (2) Razorpay signature verify,
// (3) Razorpay API se payment fetch karke amount/order match check,
// (4) tabhi DB function se subscription badhate hain.
// Browser kabhi subscription activate nahi kar sakta.
//
// DEPLOY: Dashboard -> Edge Functions -> "verify-razorpay-payment" -> paste.
//   "Verify JWT" = ON.
// SECRETS: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (ya RAZORPAY_SECRET)
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

    const body = await req.json();
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    if (!orderId || !paymentId || !signature) return json({ error: "Payment details adhoori hain" }, 400);

    // Hamara apna order record + ownership
    const { data: row } = await admin
      .from("subscription_payments")
      .select("id, store_id, amount_paise, status, stores(user_id)")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();
    // generic "nahi mila" message: order ids guess karke info na nikle
    // deno-lint-ignore no-explicit-any
    const ownerId = (row as any)?.stores?.user_id;
    if (!row || ownerId !== user.id) return json({ error: "Order nahi mila" }, 404);

    // Signature: HMAC_SHA256(order_id|payment_id, key_secret)
    const expected = await hmacHex(KEY_SECRET, `${orderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) return json({ error: "Payment signature galat hai" }, 400);

    // Razorpay se payment ki asli state
    const pRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: rzpAuth } });
    let pay = await pRes.json();
    if (!pRes.ok) return json({ error: "Payment verify nahi ho paayi" }, 400);
    if (pay.order_id !== orderId || pay.currency !== "INR" || Number(pay.amount) !== Number(row.amount_paise)) {
      console.error("payment mismatch", { orderId, paymentId });
      return json({ error: "Payment details match nahi hui" }, 400);
    }
    if (pay.status === "authorized") {
      const cRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`, {
        method: "POST",
        headers: { Authorization: rzpAuth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: row.amount_paise, currency: "INR" }),
      });
      pay = await cRes.json();
      if (!cRes.ok) return json({ error: "Payment capture nahi ho paayi" }, 400);
    }
    if (pay.status !== "captured") return json({ error: "Payment abhi complete nahi hui" }, 400);

    // Activate (idempotent, service_role-only DB function)
    const { data: expiresAt, error: actErr } = await admin.rpc("activate_subscription_payment", {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_paise: Number(pay.amount),
    });
    if (actErr) {
      console.error("activate error:", actErr.message);
      return json({ error: "Activation fail hui. Payment ID note karein: " + paymentId }, 500);
    }
    return json({ success: true, expires_at: expiresAt });
  } catch (e) {
    console.error("verify-razorpay-payment error:", e);
    return json({ error: "Kuch gadbad ho gayi" }, 500);
  }
});
