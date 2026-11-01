// ============================================================
// Supabase Edge Function: manage-razorpay-subscription
// ============================================================
// Do kaam karta hai (action field se decide hota hai):
//   action: "create" — naya Razorpay Subscription banata hai (UPI
//           AutoPay/e-mandate ke liye), store ka razorpay_subscription_id
//           save karta hai, client ko subscription_id wapas deta hai
//           checkout kholne ke liye.
//   action: "cancel" — existing subscription cancel karta hai.
//
// SECURITY: Plan (aur uska price) client se NAHI liya jaata — client
// sirf "basic"/"premium" batata hai, yeh function khud DB se store ka
// asli founding_member status check karke sahi Razorpay Plan ID
// resolve karta hai. Isse koi bhi client-side tampering se sasta plan
// nahi le sakta.
//
// DEPLOY: Supabase Dashboard → Edge Functions → Deploy new function
// → naam "manage-razorpay-subscription" → yeh poora code paste karo.
//
// ZAROORI SECRETS (Edge Function Secrets mein set karna):
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//   RAZORPAY_PLAN_FOUNDING_BASIC     (₹49/month wala Razorpay Plan ID)
//   RAZORPAY_PLAN_REGULAR_BASIC      (₹299/month)
//   RAZORPAY_PLAN_FOUNDING_PREMIUM   (₹499/month)
//   RAZORPAY_PLAN_REGULAR_PREMIUM    (₹999/month)
//   SUPABASE_URL                     (already available by default)
//   SUPABASE_SERVICE_ROLE_KEY        (Project Settings → API se copy karo)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const AUTH_HEADER = "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

const PLAN_IDS: Record<string, string> = {
  founding_basic: Deno.env.get("RAZORPAY_PLAN_FOUNDING_BASIC") || "",
  regular_basic: Deno.env.get("RAZORPAY_PLAN_REGULAR_BASIC") || "",
  founding_premium: Deno.env.get("RAZORPAY_PLAN_FOUNDING_PREMIUM") || "",
  regular_premium: Deno.env.get("RAZORPAY_PLAN_REGULAR_PREMIUM") || "",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, store_id, tier } = body;

    if (!store_id) {
      return json({ error: "store_id zaroori hai" }, 400);
    }

    // Store ka asli founding_member status DB se khud check karte hain
    // — client par bharosa nahi karte pricing ke liye.
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name, whatsapp_number, founding_member, razorpay_subscription_id")
      .eq("id", store_id)
      .single();

    if (storeErr || !store) {
      return json({ error: "Store nahi mili" }, 404);
    }

    if (action === "cancel") {
      if (!store.razorpay_subscription_id) {
        return json({ error: "Koi active AutoPay subscription nahi hai" }, 400);
      }
      const cancelRes = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${store.razorpay_subscription_id}/cancel`,
        {
          method: "POST",
          headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
          body: JSON.stringify({ cancel_at_cycle_end: 0 }),
        }
      );
      const cancelData = await cancelRes.json();
      if (!cancelRes.ok) {
        return json({ error: cancelData.error?.description || "Cancel nahi ho paaya" }, 400);
      }
      await supabase
        .from("stores")
        .update({ subscription_status: "cancelled", autopay_enabled: false })
        .eq("id", store_id);
      return json({ success: true });
    }

    // action === "create"
    if (tier !== "basic" && tier !== "premium") {
      return json({ error: "tier 'basic' ya 'premium' hona chahiye" }, 400);
    }
    const planKey = `${store.founding_member ? "founding" : "regular"}_${tier}`;
    const planId = PLAN_IDS[planKey];
    if (!planId) {
      return json({ error: `Plan ID configure nahi hai: ${planKey}. Edge Function secrets check karein.` }, 500);
    }

    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        customer_notify: 1,
        // 120 mahine (10 saal) — practically "jab tak cancel na ho".
        // Razorpay total_count zaroori maangta hai, isliye ek bada
        // number use kiya hai infinite jaisa behavior ke liye.
        total_count: 120,
        notes: { store_id: store.id, store_name: store.name, plan_key: planKey },
      }),
    });
    const subData = await subRes.json();
    if (!subRes.ok) {
      return json({ error: subData.error?.description || "Subscription create nahi ho paayi" }, 400);
    }

    await supabase
      .from("stores")
      .update({
        razorpay_subscription_id: subData.id,
        plan_tier: tier,
        autopay_enabled: true,
        subscription_status: "payment_pending", // mandate abhi approve hona baaki hai
      })
      .eq("id", store_id);

    return json({ subscription_id: subData.id, key_id: RAZORPAY_KEY_ID });
  } catch (e) {
    return json({ error: e.message || "Kuch gadbad ho gayi" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
