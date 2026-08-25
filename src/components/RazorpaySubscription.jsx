import React, { useState } from "react";
import { CreditCard, Check, AlertCircle, Loader2, Shield, Smartphone } from "lucide-react";
import { loadRazorpayScript, activateSubscription, RAZORPAY_KEY_ID, RAZORPAY_PLAN_ID } from "../lib/api";

// ============================================================
// RAZORPAY SUBSCRIPTION PAYMENT PAGE
// Dukaandar yahan se ₹199/mahine UPI Autopay setup karta hai
// ============================================================
export default function RazorpaySubscription({ store, user, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("monthly");

  const plans = [
    { id: "monthly", label: "1 Mahina", months: 1, amount: 199, popular: false },
    { id: "quarterly", label: "3 Mahine", months: 3, amount: 549, saving: 48, popular: true },
    { id: "halfyearly", label: "6 Mahine", months: 6, amount: 999, saving: 195, popular: false },
    { id: "yearly", label: "1 Saal", months: 12, amount: 1799, saving: 589, popular: false },
  ];

  const selected = plans.find((p) => p.id === selectedPlan);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError("Payment system load nahi ho paaya. Internet check karein.");
        setLoading(false);
        return;
      }

      // Step 1: Edge Function se server-side Razorpay order create karo
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const orderRes = await fetch(
        `${supabaseUrl}/functions/v1/create-razorpay-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
          },
          body: JSON.stringify({
            amount: selected.amount,
            currency: "INR",
            store_id: store.id,
            store_name: store.name,
            months: selected.months,
          }),
        }
      );

      const orderData = await orderRes.json();

      if (!orderRes.ok || orderData.error) {
        throw new Error(orderData.error || "Order create nahi ho paaya");
      }

      // Contact number properly format karo
      const rawNumber = store.whatsapp_number || "";
      const contactNumber = rawNumber.startsWith("91")
        ? "+" + rawNumber
        : rawNumber.startsWith("+")
        ? rawNumber
        : "+91" + rawNumber;

      // Step 2: Razorpay checkout kholo server-side order_id se
      // Ab QR properly generate hoga kyunki valid order_id hai
      const options = {
        key: orderData.key_id,
        order_id: orderData.order_id, // ← Server-side order ID — QR ke liye zaroori
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Dukaan Order System",
        description: `${selected.label} — ${store.name}`,
        prefill: {
          name: store.name,
          contact: contactNumber,
        },
        notes: {
          store_id: store.id,
          store_slug: store.slug,
          plan: selectedPlan,
          months: String(selected.months),
        },
        theme: { color: "#1B4332" },
        handler: async function (response) {
          if (!response.razorpay_payment_id) {
            setError("Payment ID nahi mili. Support se sampark karein.");
            setLoading(false);
            return;
          }
          try {
            await activateSubscription(
              store.id,
              response.razorpay_payment_id,
              selected.months
            );
            const expiry = new Date();
            expiry.setMonth(expiry.getMonth() + selected.months);
            const msg = encodeURIComponent(
              `✅ *Dukaan Order System — Payment Confirmed*\n\nDukaan: ${store.name}\nPlan: ${selected.label}\nAmount: ₹${selected.amount}\nPayment ID: ${response.razorpay_payment_id}\nValid Till: ${expiry.toLocaleDateString("en-IN")}\n\nAapki dukaan active ho gayi hai! 🎉`
            );
            window.open(`https://wa.me/${store.whatsapp_number}?text=${msg}`, "_blank");
            onSuccess?.();
          } catch (err) {
            setError(
              "Payment hua lekin activation mein problem aayi. " +
              "Payment ID note kar lein: " + response.razorpay_payment_id
            );
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => { setLoading(false); },
          escape: true,
          backdropclose: false,
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setError("Payment fail ho gayi: " + (response.error?.description || "Dobara try karein."));
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError("Kuch gadbad ho gayi: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "24px 18px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#E7F0EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <CreditCard size={26} color="#1B4332" />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "19px", color: "#1A1A1A" }}>
          Subscription Activate Karein
        </div>
        <div style={{ fontSize: "12.5px", color: "#8B8576", marginTop: "4px" }}>
          {store.name} — UPI se pay karein, koi card nahi chahiye
        </div>
      </div>

      {/* Plan selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
              border: selectedPlan === plan.id ? "2px solid #1B4332" : "1px solid #E3DECF",
              background: selectedPlan === plan.id ? "#E7F0EA" : "white",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selectedPlan === plan.id ? "#1B4332" : "#D4D0C5"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {selectedPlan === plan.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1B4332" }} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#1A1A1A" }}>{plan.label}</div>
                {plan.saving && <div style={{ fontSize: "11px", color: "#1B4332", fontWeight: 600 }}>₹{plan.saving} bachao</div>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#1B4332" }}>₹{plan.amount}</div>
              <div style={{ fontSize: "10.5px", color: "#8B8576" }}>₹{Math.round(plan.amount / plan.months)}/mahine</div>
            </div>
            {plan.popular && (
              <div style={{ position: "absolute", top: -8, right: 12, background: "#D4A24C", color: "#123026", fontSize: "9.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "999px" }}>
                POPULAR
              </div>
            )}
          </button>
        ))}
      </div>

      {/* UPI info */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#F7F5F0", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
        <Smartphone size={20} color="#1B4332" />
        <div style={{ fontSize: "12px", color: "#5C5747", lineHeight: 1.5 }}>
          <b>UPI se pay karein</b> — PhonePe, GPay, Paytm — koi card ya net banking nahi chahiye. Sirf UPI PIN daalo.
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#FDECEA", borderRadius: "9px", padding: "10px 12px", marginBottom: "14px" }}>
          <AlertCircle size={16} color="#B3261E" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div style={{ fontSize: "12px", color: "#B3261E" }}>{error}</div>
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          width: "100%", padding: "14px 0", borderRadius: "11px", border: "none",
          background: loading ? "#D8D2BF" : "#1B4332", color: "white",
          fontWeight: 800, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
      >
        {loading ? (
          <><Loader2 size={16} className="spin" /> Payment khul rahi hai...</>
        ) : (
          <>₹{selected.amount} UPI se Pay Karein</>
        )}
      </button>

      {/* Security note */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "12px" }}>
        <Shield size={13} color="#8B8576" />
        <span style={{ fontSize: "11px", color: "#8B8576" }}>Razorpay ke through secure payment — aapki details safe hain</span>
      </div>
    </div>
  );
}
