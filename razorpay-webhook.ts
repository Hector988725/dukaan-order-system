// ============================================================
// Supabase Edge Function: razorpay-webhook
// ============================================================
// Razorpay yahan events bhejta hai jab bhi UPI AutoPay mandate
// approve hota hai, har mahine payment charge hota hai, fail hota
// hai, ya cancel hota hai. Yeh app khule bina, background mein hota
// hai — isliye webhook hi sach ka source hai.
//
// DEPLOY: Supabase Dashboard → Edge Functions → Deploy new function
// → naam "razorpay-webhook" → yeh poora code paste karo.
//
// Deploy hone ke baad iska URL milega, jaisa:
//   https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
// Yeh URL Razorpay Dashboard → Settings → Webhooks mein jaake add
// karna hai (neeche steps mein bataya hai).
//
// ZAROORI SECRETS:
//   RAZORPAY_WEBHOOK_SECRET   (Razorpay Dashboard se milta hai jab
//                              webhook banate ho — Key Secret se ALAG hai)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Yeh function bina auth (JWT) ke publicly accessible honi chahiye
// (Razorpay ke paas humara login token nahi hota) — isliye signature
// verification hi security hai. Supabase Dashboard mein is function
// ke liye "Enforce JWT Verification" OFF karna zaroori hai.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    const isValid = await verifySignature(rawBody, signature, WEBHOOK_SECRET);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency check — Razorpay kabhi-kabhi retry karta hai, isliye
    // same event dobara process na ho.
    const eventId = event.id || null;
    if (eventId) {
      const { data: existing } = await supabase
        .from("razorpay_webhook_events")
        .select("id")
        .eq("razorpay_event_id", eventId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ ok: true, note: "duplicate, skipped" }), { status: 200 });
      }
    }

    const eventType = event.event as string;
    const subscriptionEntity = event.payload?.subscription?.entity;
    const razorpaySubId = subscriptionEntity?.id;

    let newStatus: string | null = null;
    let nextBillingDate: string | null = null;
    let subscriptionExpiresAt: string | null = null;

    switch (eventType) {
      case "subscription.authenticated":
      case "subscription.activated":
        newStatus = "active";
        break;
      case "subscription.charged":
        newStatus = "active";
        // charge_at aur current_end Unix seconds mein aate hain
        if (subscriptionEntity?.charge_at) {
          nextBillingDate = new Date(subscriptionEntity.charge_at * 1000).toISOString();
        }
        if (subscriptionEntity?.current_end) {
          subscriptionExpiresAt = new Date(subscriptionEntity.current_end * 1000).toISOString();
        }
        break;
      case "subscription.pending":
        newStatus = "payment_pending";
        break;
      case "subscription.halted":
        newStatus = "payment_failed";
        break;
      case "subscription.cancelled":
        newStatus = "cancelled";
        break;
      case "subscription.completed":
        newStatus = "expired";
        break;
      default:
        // Doosre event types (payment.captured waghera) — abhi ignore,
        // bas log kar dete hain reference ke liye.
        break;
    }

    // Store find karo — pehle razorpay_subscription_id se, warna
    // notes.store_id se (subscription create ke waqt humne notes mein
    // store_id bheja tha).
    let storeId: string | null = null;
    if (razorpaySubId) {
      const { data: matchedStore } = await supabase
        .from("stores")
        .select("id")
        .eq("razorpay_subscription_id", razorpaySubId)
        .maybeSingle();
      storeId = matchedStore?.id || null;
    }
    if (!storeId && subscriptionEntity?.notes?.store_id) {
      storeId = subscriptionEntity.notes.store_id;
    }

    if (newStatus && razorpaySubId) {
      await supabase.rpc("apply_subscription_webhook_update", {
        p_razorpay_subscription_id: razorpaySubId,
        p_status: newStatus,
        p_next_billing_date: nextBillingDate,
        p_subscription_expires_at: subscriptionExpiresAt,
      });
    }

    // Audit log — chahe process hua ho ya na hua ho, record rakhte hain.
    await supabase.from("razorpay_webhook_events").insert({
      razorpay_event_id: eventId,
      event_type: eventType,
      store_id: storeId,
      payload: event,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    // Razorpay ko turant bata do fail hua (yeh retry karega), aur
    // apne logs mein error dikh jaayega.
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

// Razorpay webhook signature: HMAC-SHA256(webhook_secret, raw_body),
// hex digest, "X-Razorpay-Signature" header se compare karte hain.
async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === signature;
}
