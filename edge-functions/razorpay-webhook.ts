// ============================================================
// Edge Function: razorpay-webhook
// ============================================================
// Razorpay yahan events bhejta hai (AutoPay + one-time order paid).
// DEPLOY: "razorpay-webhook" -> paste.  "Verify JWT" = OFF (Razorpay ke paas
// hamara token nahi hota) — security HMAC signature se hai.
// SECRETS: RAZORPAY_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Razorpay Dashboard -> Webhooks mein ye events ON rakho:
//   subscription.authenticated, subscription.activated, subscription.charged,
//   subscription.pending, subscription.halted, subscription.cancelled,
//   subscription.completed, order.paid   (payment.captured bhi chalega)
//
// Phase 1B changes:
//  - Signature timing-safe compare.
//  - Event ID header (X-Razorpay-Event-Id) se idempotency (pehle body.id
//    use hota tha jo Razorpay bhejta hi nahi).
//  - Event pehle "claim" hota hai; processing fail ho to claim hat jaata hai
//    taaki Razorpay ka retry dobara process kar sake.
//  - DB update ka error ab ignore nahi hota.
//  - Access sirf subscription.charged (asli paisa kata) par; authenticated /
//    activated par nahi. Charged amount plan se match na kare to grant nahi.
//  - One-time order.paid / payment.captured bhi subscription_payments se
//    match karke activate hota hai (browser band ho jaaye tab bhi).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

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
async function sha256Hex(msg: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const ok = (body: unknown = { ok: true }) => new Response(JSON.stringify(body), { status: 200 });

Deno.serve(async (req) => {
  let admin: ReturnType<typeof createClient> | null = null;
  let claimedId: string | null = null;
  try {
    if (!WEBHOOK_SECRET) return new Response(JSON.stringify({ error: "not configured" }), { status: 500 });
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const expected = await hmacHex(WEBHOOK_SECRET, rawBody);
    if (!safeEqual(expected, signature)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    const event = JSON.parse(rawBody);
    admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const eventId: string = req.headers.get("x-razorpay-event-id") || event.id || (await sha256Hex(rawBody));
    const eventType = String(event.event || "");

    // --- idempotency: pehle check, phir claim (unique index se race-safe) ---
    const { data: existing } = await admin.from("razorpay_webhook_events").select("id").eq("razorpay_event_id", eventId).maybeSingle();
    if (existing) return ok({ ok: true, note: "duplicate, skipped" });
    const { error: claimErr } = await admin.from("razorpay_webhook_events").insert({
      razorpay_event_id: eventId, event_type: eventType, store_id: null, payload: event,
    });
    if (claimErr) {
      if ((claimErr as { code?: string }).code === "23505") return ok({ ok: true, note: "duplicate, skipped" });
      throw new Error("event claim failed: " + claimErr.message);
    }
    claimedId = eventId;

    let storeId: string | null = null;

    // ======================= SUBSCRIPTION (AutoPay) =======================
    const sub = event.payload?.subscription?.entity;
    if (eventType.startsWith("subscription.") && sub?.id) {
      const { data: store } = await admin
        .from("stores").select("id, subscription_base_price").eq("razorpay_subscription_id", sub.id).maybeSingle();
      if (!store) {
        console.error("webhook: subscription ka store nahi mila", sub.id);
      } else {
        storeId = store.id;
        let status: string | null = null;
        let nextBilling: string | null = null;
        let expiresAt: string | null = null;

        switch (eventType) {
          case "subscription.authenticated": status = "payment_pending"; break; // mandate approve, paisa abhi nahi kata
          case "subscription.activated": status = "active"; break;             // expiry/access yahan nahi
          case "subscription.charged": {
            const payAmount = Number(event.payload?.payment?.entity?.amount);
            const expectedAmount = (Number(store.subscription_base_price) === 49 ? 49 : 199) * 100;
            if (!payAmount || payAmount < expectedAmount) {
              console.error("webhook: charged amount plan se match nahi karta", { sub: sub.id, payAmount, expectedAmount });
            } else {
              status = "active";
              if (sub.charge_at) nextBilling = new Date(sub.charge_at * 1000).toISOString();
              if (sub.current_end) expiresAt = new Date(sub.current_end * 1000).toISOString();
            }
            break;
          }
          case "subscription.pending": status = "payment_pending"; break;
          case "subscription.halted": status = "payment_failed"; break;
          case "subscription.cancelled": status = "cancelled"; break;
          case "subscription.completed": status = "expired"; break;
        }

        if (status) {
          const { error } = await admin.rpc("apply_subscription_webhook_update", {
            p_razorpay_subscription_id: sub.id,
            p_status: status,
            p_next_billing_date: nextBilling,
            p_subscription_expires_at: expiresAt,
          });
          if (error) throw new Error("apply_subscription_webhook_update: " + error.message);
        }
      }
    }

    // ======================= ONE-TIME ORDER =======================
    if (eventType === "order.paid" || eventType === "payment.captured") {
      const pay = event.payload?.payment?.entity;
      const orderId = pay?.order_id || event.payload?.order?.entity?.id;
      const paymentId = pay?.id;
      if (orderId && paymentId) {
        const { data: row } = await admin.from("subscription_payments").select("id, store_id").eq("razorpay_order_id", orderId).maybeSingle();
        if (row) {   // nahi mila = subscription (AutoPay) payment, upar handle ho chuka
          storeId = row.store_id;
          if (pay.status === "captured") {
            const { error } = await admin.rpc("activate_subscription_payment", {
              p_order_id: orderId, p_payment_id: paymentId, p_amount_paise: Number(pay.amount),
            });
            if (error) {
              const permanent = /mismatch|unknown order|different payment/i.test(error.message);
              if (permanent) console.error("webhook: order activate rejected:", error.message, { orderId, paymentId });
              else throw new Error("activate_subscription_payment: " + error.message);
            }
          }
        }
      }
    }

    if (storeId) await admin.from("razorpay_webhook_events").update({ store_id: storeId }).eq("razorpay_event_id", eventId);
    return ok();
  } catch (e) {
    console.error("Webhook error:", e);
    // processing fail hui -> claim hatao taaki Razorpay ka retry dobara chal sake
    if (admin && claimedId) {
      try { await admin.from("razorpay_webhook_events").delete().eq("razorpay_event_id", claimedId); } catch (_) { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: "processing failed" }), { status: 500 });
  }
});
