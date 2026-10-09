import React, { useState } from "react";
import { CreditCard, Check, AlertCircle, Loader2, Shield, Smartphone, RefreshCw, XCircle, Repeat } from "lucide-react";
import { loadRazorpayScript, createSubscriptionOrder, verifySubscriptionPayment, createRazorpaySubscription, cancelRazorpaySubscription } from "../lib/api";

import { friendlyError } from "../lib/errors";
// ============================================================
// RAZORPAY SUBSCRIPTION PAYMENT PAGE
// Ek hi plan (saari features) — ₹199/month (super admin ne special price
// set kiya ho to ₹49). Billing-cycle 1/3/6/12 mahine. Do mode: One-Time
// (Orders API) aur AutoPay (UPI e-mandate).
// SECURITY: yahan dikhaya gaya price sirf display ke liye hai. Asli amount
// server tay karta hai, aur subscription sirf server-verified payment ya
// Razorpay webhook se activate hoti hai — browser kuch activate nahi karta.
// ============================================================
export default function RazorpaySubscription({ store, user, onSuccess, canPay = true }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [paymentMode, setPaymentMode] = useState("onetime"); // "onetime" | "autopay"
  const [autopaySuccess, setAutopaySuccess] = useState(false);
  const [paidInfo, setPaidInfo] = useState(null); // one-time payment verify hone ke baad

  const basePrice = Number(store.subscription_base_price) === 49 ? 49 : 199;

  // Discount % server ke compute_subscription_amount() jaisa hi hai
  const discountPct = { quarterly: 48 / 597, halfyearly: 195 / 1194, yearly: 589 / 2388 };
  const plans = [
    { id: "monthly", label: "1 Mahina", months: 1, amount: basePrice, popular: false },
    { id: "quarterly", label: "3 Mahine", months: 3, amount: Math.round(basePrice * 3 * (1 - discountPct.quarterly)), saving: Math.round(basePrice * 3 * discountPct.quarterly), popular: true },
    { id: "halfyearly", label: "6 Mahine", months: 6, amount: Math.round(basePrice * 6 * (1 - discountPct.halfyearly)), saving: Math.round(basePrice * 6 * discountPct.halfyearly), popular: false },
    { id: "yearly", label: "1 Saal", months: 12, amount: Math.round(basePrice * 12 * (1 - discountPct.yearly)), saving: Math.round(basePrice * 12 * discountPct.yearly), popular: false },
  ];

  const selected = plans.find((p) => p.id === selectedPlan);

  // Agar AutoPay pehle se set-up hai (kisi bhi status mein — active,
  // pending, failed, cancelled), pehle uska status dikhate hain,
  // payment options seedha nahi.
  const hasAutopayHistory = !!store.razorpay_subscription_id && store.autopay_enabled;

  const handleAutopaySetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError("Payment system load nahi ho paaya. Internet check karein.");
        setLoading(false);
        return;
      }
      const subData = await createRazorpaySubscription(store.id);

      const rawNumber = store.whatsapp_number || "";
      const contactNumber = rawNumber.startsWith("91") ? "+" + rawNumber : rawNumber.startsWith("+") ? rawNumber : "+91" + rawNumber;

      const options = {
        key: subData.key_id,
        subscription_id: subData.subscription_id, // ← order_id ki jagah subscription_id, yehi AutoPay/e-mandate flow trigger karta hai
        name: "Dukaan Order System",
        description: `AutoPay — ₹${basePrice}/month — ${store.name}`,
        prefill: { name: store.name, contact: contactNumber },
        theme: { color: "#1B4332" },
        handler: function () {
          // Mandate approve ho gaya — asli "active" status webhook se
          // aayega (thoda time lag sakta hai), isliye yahan optimistic
          // success dikhate hain aur thodi der baad store refresh karte hain.
          setAutopaySuccess(true);
          setLoading(false);
          setTimeout(() => onSuccess?.(), 3000);
        },
        modal: {
          ondismiss: () => { setLoading(false); },
          escape: true,
          backdropclose: false,
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setError("Mandate setup fail ho gaya: " + (response.error?.description || "Dobara try karein."));
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError("Kuch gadbad ho gayi: " + friendlyError(err));
      setLoading(false);
    }
  };

  const handleCancelAutopay = async () => {
    if (!confirm("AutoPay cancel karna chahte hain? Aapko har mahine manually pay karna hoga.")) return;
    setLoading(true);
    setError(null);
    try {
      await cancelRazorpaySubscription(store.id);
      onSuccess?.();
    } catch (err) {
      setError("Cancel nahi ho paaya: " + friendlyError(err));
      setLoading(false);
    }
  };

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

      // Step 1: server amount tay karke Razorpay order banata hai (login token ke saath)
      const orderData = await createSubscriptionOrder(store.id, selected.months);

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
        theme: { color: "#1B4332" },
        handler: async function (response) {
          if (!response.razorpay_payment_id || !response.razorpay_signature) {
            setError("Payment details nahi mili. Support se sampark karein. Payment ID: " + (response.razorpay_payment_id || "—"));
            setLoading(false);
            return;
          }
          try {
            // Server signature + amount verify karke subscription badhata hai
            const result = await verifySubscriptionPayment({
              razorpay_order_id: response.razorpay_order_id || orderData.order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const expiry = result.expires_at ? new Date(result.expires_at) : null;
            const msg = encodeURIComponent(
              `✅ *Dukaan Order System — Payment Confirmed*\n\nDukaan: ${store.name}\nPlan: ${selected.label}\nAmount: ₹${selected.amount}\nPayment ID: ${response.razorpay_payment_id}\n${expiry ? `Valid Till: ${expiry.toLocaleDateString("en-IN")}\n` : ""}\nAapki dukaan active ho gayi hai! 🎉`
            );
            window.open(`https://wa.me/${store.whatsapp_number}?text=${msg}`, "_blank");
            // Shop pehle se active ho to ye panel screen par rehta hai — isliye
            // loading band karke success dikhate hain (warna button atka rehta).
            setPaidInfo({ amount: selected.amount, expiry });
            setLoading(false);
            onSuccess?.();
          } catch (err) {
            setError(
              "Payment hua lekin activation confirm nahi hui. Thodi der baad page refresh karein; " +
              "phir bhi na ho to Payment ID ke saath support se sampark karein: " + response.razorpay_payment_id
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
      setError("Kuch gadbad ho gayi: " + friendlyError(err));
      setLoading(false);
    }
  };

  // Renewal ka waqt nahi aaya: sirf AutoPay status (agar hai) dikhao, payment options nahi.
  if (!canPay && !hasAutopayHistory) return null;

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "24px 18px" }}>
      {canPay && (
        <>
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

        </>
      )}

      {paidInfo && (
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#E7F0EA", borderRadius: "9px", padding: "12px 14px", marginBottom: "16px" }}>
          <Check size={16} color="#1B4332" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div style={{ fontSize: "12.5px", color: "#1B4332" }}>
            Payment ho gaya ₹{paidInfo.amount}. {paidInfo.expiry ? `Subscription ${paidInfo.expiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} tak valid hai.` : "Subscription badh gayi hai."}
          </div>
        </div>
      )}

      {autopaySuccess && (
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#E7F0EA", borderRadius: "9px", padding: "12px 14px", marginBottom: "16px" }}>
          <Check size={16} color="#1B4332" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div style={{ fontSize: "12.5px", color: "#1B4332" }}>AutoPay mandate approve ho gaya! Status confirm hote hi (kuch second mein) aapki dukaan active ho jaayegi.</div>
        </div>
      )}

      {hasAutopayHistory && !autopaySuccess && (
        <AutopayStatusCard store={store} onCancel={handleCancelAutopay} onRetry={handleAutopaySetup} loading={loading} />
      )}

      {canPay && (!hasAutopayHistory || store.subscription_status === "cancelled" || store.subscription_status === "payment_failed") && !autopaySuccess && (
        <>
          {/* Payment mode toggle */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              onClick={() => setPaymentMode("onetime")}
              style={{ flex: 1, padding: "10px", borderRadius: "9px", cursor: "pointer", fontSize: "12px", fontWeight: 700, border: paymentMode === "onetime" ? "2px solid #1B4332" : "1px solid #E3DECF", background: paymentMode === "onetime" ? "#E7F0EA" : "white", color: "#1A1A1A" }}
            >
              One-Time Payment
            </button>
            <button
              onClick={() => setPaymentMode("autopay")}
              style={{ flex: 1, padding: "10px", borderRadius: "9px", cursor: "pointer", fontSize: "12px", fontWeight: 700, border: paymentMode === "autopay" ? "2px solid #1B4332" : "1px solid #E3DECF", background: paymentMode === "autopay" ? "#E7F0EA" : "white", color: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
            >
              <Repeat size={13} /> AutoPay (UPI)
            </button>
          </div>

          {paymentMode === "onetime" ? (
            <>
              {/* Plan selector (billing cycle) */}
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
                  <b>UPI se pay karein</b> — PhonePe, GPay, Paytm — koi card ya net banking nahi chahiye. Sirf UPI PIN daalo. Har baar khud renew karna hoga.
                </div>
              </div>

              {error && (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#FDECEA", borderRadius: "9px", padding: "10px 12px", marginBottom: "14px" }}>
                  <AlertCircle size={16} color="#B3261E" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div style={{ fontSize: "12px", color: "#B3261E" }}>{error}</div>
                </div>
              )}

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
                {loading ? (<><Loader2 size={16} className="spin" /> Payment khul rahi hai...</>) : (<>₹{selected.amount} UPI se Pay Karein</>)}
              </button>
            </>
          ) : (
            <>
              {/* AutoPay setup */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#F7F5F0", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                <Repeat size={20} color="#1B4332" />
                <div style={{ fontSize: "12px", color: "#5C5747", lineHeight: 1.5 }}>
                  <b>UPI AutoPay (e-mandate)</b> — ek baar approve karo, har mahine ₹{basePrice} automatic kat jaayega. Kabhi bhi cancel kar sakte hain.
                </div>
              </div>

              {error && (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#FDECEA", borderRadius: "9px", padding: "10px 12px", marginBottom: "14px" }}>
                  <AlertCircle size={16} color="#B3261E" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div style={{ fontSize: "12px", color: "#B3261E" }}>{error}</div>
                </div>
              )}

              <button
                onClick={handleAutopaySetup}
                disabled={loading}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: "11px", border: "none",
                  background: loading ? "#D8D2BF" : "#1B4332", color: "white",
                  fontWeight: 800, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                {loading ? (<><Loader2 size={16} className="spin" /> Mandate khul raha hai...</>) : (<>₹{basePrice}/month AutoPay Set Karein</>)}
              </button>
            </>
          )}

          {/* Security note */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "12px" }}>
            <Shield size={13} color="#8B8576" />
            <span style={{ fontSize: "11px", color: "#8B8576" }}>Razorpay ke through secure payment — aapki details safe hain</span>
          </div>

          <div style={{ fontSize: "10.5px", color: "#8B8576", textAlign: "center", marginTop: "10px", lineHeight: 1.5 }}>
            Saari features ek hi plan mein. Yeh price sirf SaaS subscription ke liye hai — domain, payment-gateway fees, SMS/WhatsApp jaisi third-party costs alag ho sakti hain.
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// AUTOPAY STATUS CARD — jab store ke paas already koi Razorpay
// Subscription hai (kisi bhi status mein), yeh dikhta hai payment
// options ki jagah. Asli status webhook se update hota hai.
// ============================================================
function AutopayStatusCard({ store, onCancel, onRetry, loading }) {
  const statusConfig = {
    active: { label: "Active", color: "#1B4332", bg: "#E7F0EA", icon: Check, note: "AutoPay chal raha hai — har mahine automatic charge hoga." },
    payment_pending: { label: "Payment Pending", color: "#8A6A0F", bg: "#FFF4DB", icon: Loader2, note: "Payment process ho raha hai ya retry ho raha hai. Thodi der mein status update hoga." },
    payment_failed: { label: "Payment Failed", color: "#B3261E", bg: "#FDECEA", icon: XCircle, note: "AutoPay charge fail ho gaya. Neeche se dobara setup karein ya One-Time Payment use karein." },
    cancelled: { label: "Cancelled", color: "#8B8576", bg: "#F0EEE6", icon: XCircle, note: "AutoPay cancel ho chuka hai. Neeche se dobara setup kar sakte hain." },
    expired: { label: "Expired", color: "#8B8576", bg: "#F0EEE6", icon: XCircle, note: "Subscription khatam ho chuki hai." },
  };
  const cfg = statusConfig[store.subscription_status] || statusConfig.expired;
  const Icon = cfg.icon;

  return (
    <div style={{ background: cfg.bg, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <Icon size={16} color={cfg.color} className={store.subscription_status === "payment_pending" ? "spin" : undefined} />
        <span style={{ fontWeight: 800, fontSize: "13.5px", color: cfg.color }}>AutoPay: {cfg.label}</span>
      </div>
      <div style={{ fontSize: "12px", color: "#5C5747", marginBottom: store.next_billing_date ? "8px" : 0 }}>{cfg.note}</div>
      {store.next_billing_date && store.subscription_status === "active" && (
        <div style={{ fontSize: "12px", color: "#5C5747" }}>
          Agli billing date: <b>{new Date(store.next_billing_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b>
        </div>
      )}
      {store.subscription_status === "payment_pending" && (
        <button
          onClick={onRetry}
          disabled={loading}
          style={{ marginTop: "10px", marginRight: "8px", background: "#1B4332", border: "none", color: "white", borderRadius: "7px", padding: "7px 14px", fontSize: "11.5px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Khul raha hai..." : "AutoPay Approve Karein"}
        </button>
      )}
      {(store.subscription_status === "active" || store.subscription_status === "payment_pending") && (
        <button
          onClick={onCancel}
          disabled={loading}
          style={{ marginTop: "10px", background: "none", border: "1px solid " + cfg.color, color: cfg.color, borderRadius: "7px", padding: "6px 12px", fontSize: "11.5px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
        >
          AutoPay Cancel Karein
        </button>
      )}
    </div>
  );
}
