import React, { useState } from "react";
import { PackageSearch, X, Loader2, Phone, MessageCircle, Check } from "lucide-react";
import { fetchOrderTracking } from "../lib/api";

// ============================================================
// ORDER TRACKING — order_number se, koi login nahi. Backend mein abhi
// live GPS/location-tracking exist nahi karta, isliye yahan koi fake
// map/ETA nahi dikhaya — sirf status stepper + (agar assign hua ho)
// delivery boy ka naam/phone/"Call" CTA, jo real hai.
// ============================================================

const STEPS_DELIVERY = [
  { key: "New", label: "Order Place Hua" },
  { key: "Accepted", label: "Order Accept Hua" },
  { key: "Preparing", label: "Packing Complete" },
  { key: "Ready", label: "Ready" },
  { key: "Out for Delivery", label: "Out for Delivery" },
  { key: "Delivered", label: "Delivered" },
];
const STEPS_PICKUP = [
  { key: "New", label: "Order Place Hua" },
  { key: "Accepted", label: "Order Accept Hua" },
  { key: "Preparing", label: "Packing Complete" },
  { key: "Ready", label: "Pickup ke liye Ready" },
  { key: "Delivered", label: "Pickup Ho Gaya" },
];

export default function OrderTrackingButton({ store }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ddemo-btn"
        style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.14)", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
      >
        <PackageSearch size={13} /> Order Track Karein
      </button>
      {open && <OrderTrackingModal store={store} onClose={() => setOpen(false)} />}
    </>
  );
}

export function OrderTrackingModal({ store, onClose, initialOrderNumber }) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const handleCheck = async () => {
    if (!orderNumber.trim()) { setError("Order number daalein."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await fetchOrderTracking(store.id, orderNumber.trim().toUpperCase());
      if (!data) {
        setError("Yeh order number nahi mila. Sahi se check karein.");
        setOrder(null);
      } else {
        setOrder(data);
      }
    } catch (e) {
      setError("Kuch gadbad ho gayi, dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  const steps = order?.order_type === "Pickup" ? STEPS_PICKUP : STEPS_DELIVERY;
  const currentIdx = order ? steps.findIndex((s) => s.key === order.status) : -1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "380px", maxHeight: "85vh", overflowY: "auto", padding: "20px", margin: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontWeight: 700, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Fraunces', serif" }}><PackageSearch size={17} /> Order Track Karein</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" }}><X size={18} /></button>
        </div>

        {!order ? (
          <>
            <div style={{ fontSize: "12px", color: "#8B8576", marginBottom: "10px" }}>Apna Order Number daalein (jaise ORD1234) — yeh aapko order place karte hi mila tha.</div>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="jaise ORD1234"
              style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", outline: "none", marginBottom: "8px", fontFamily: "inherit" }}
              autoFocus
            />
            {error && <div style={{ color: "#B3261E", fontSize: "11.5px", marginBottom: "8px" }}>{error}</div>}
            <button onClick={handleCheck} disabled={loading} className="ddemo-btn" style={{ width: "100%", background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              {loading ? <Loader2 size={15} className="spin" /> : "Track Karein"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: "12px", color: "#8B8576", marginBottom: "16px" }}>Order <b>{order.order_number}</b> · ₹{order.total}</div>

            {/* Visual stepper */}
            <div style={{ marginBottom: "18px" }}>
              {steps.map((s, i) => {
                const done = i <= currentIdx;
                const isLast = i === steps.length - 1;
                return (
                  <div key={s.key} style={{ display: "flex", gap: "10px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: done ? "#1B4332" : "#E3DECF",
                        color: "white",
                      }}>
                        {done && (i < currentIdx ? <Check size={13} /> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />)}
                      </div>
                      {!isLast && <div style={{ width: 2, flex: 1, minHeight: "20px", background: i < currentIdx ? "#1B4332" : "#E3DECF" }} />}
                    </div>
                    <div style={{ paddingBottom: isLast ? 0 : "18px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: done ? 700 : 500, color: done ? "#1A1A1A" : "#8B8576" }}>{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {order.status === "Out for Delivery" && (
              <div style={{ background: "#E7F0EA", borderRadius: "10px", padding: "12px", marginBottom: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#1B4332" }}>🛵 Aapka saaman raaste mein hai</div>
              </div>
            )}

            {order.delivery_boy_name && (order.status === "Out for Delivery" || order.status === "Ready") && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F5F0", borderRadius: "10px", padding: "12px" }}>
                <div>
                  <div style={{ fontSize: "10.5px", color: "#8B8576" }}>Delivery Boy</div>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>{order.delivery_boy_name}</div>
                </div>
                {order.delivery_boy_phone && (
                  <a href={`tel:${order.delivery_boy_phone}`} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1B4332", color: "white", borderRadius: "999px", padding: "8px 14px", textDecoration: "none", fontSize: "12px", fontWeight: 700 }}>
                    <Phone size={13} /> Call
                  </a>
                )}
              </div>
            )}

            <button onClick={() => { setOrder(null); setOrderNumber(""); }} style={{ width: "100%", background: "transparent", border: "1px solid #E3DECF", borderRadius: "9px", padding: "9px 0", fontSize: "12px", fontWeight: 700, color: "#5C5747", cursor: "pointer", marginTop: "14px" }}>
              Dusra Order Check Karein
            </button>
          </>
        )}
      </div>
    </div>
  );
}
