import React, { useState, useMemo } from "react";
import { Search, Plus, Minus, MessageCircle, RotateCcw } from "lucide-react";
import { createOrder, fetchCustomerByPhone, createKhataCustomer, addKhataTransaction } from "../lib/api";
import { getVariantPricing, getQuantityDealPrice } from "../lib/theme";

// ============================================================
// QUICK BILL (POS / Walk-in Billing)
// ============================================================
// Dukaandar counter par khada customer ke liye khud order banata hai —
// customer apna phone use nahi karta. Products select karo → total
// dikhta hai → payment step mein "abhi kitna mila" bharo (Cash/UPI),
// jo baaki bacha wo customer ke Khata mein automatically chadh jaata
// hai (phone number se) → bill ready, WhatsApp par bhej sakte hain.
// Order turant "Delivered" status ke saath banta hai (Pickup type)
// kyunki saman turant customer ko de diya gaya hota hai.
// ============================================================

export default function QuickBill({ store, products, onOrderPlaced }) {
  const [stage, setStage] = useState("billing"); // billing | payment | receipt
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({}); // variantId -> qty
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [receivedInput, setReceivedInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastOrder, setLastOrder] = useState(null);

  const allVariants = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name, productEmoji: p.emoji }))),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allVariants;
    return allVariants.filter(
      (v) => v.productName.toLowerCase().includes(q) || v.label?.toLowerCase().includes(q) || (v.barcode && v.barcode === search.trim())
    );
  }, [allVariants, search]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([variantId, qty]) => {
        const v = allVariants.find((av) => av.id === variantId);
        return v ? { ...v, qty } : null;
      })
      .filter(Boolean);
  }, [cart, allVariants]);

  const cartTotal = cartItems.reduce((sum, it) => {
    const deal = getQuantityDealPrice(it, it.qty);
    return sum + (deal ? deal.total : getVariantPricing(it).effectivePrice * it.qty);
  }, 0);
  const cartCount = cartItems.reduce((sum, it) => sum + it.qty, 0);

  const addToCart = (variantId) => {
    const v = allVariants.find((av) => av.id === variantId);
    if (!v) return;
    setCart((c) => {
      const current = c[variantId] || 0;
      if (current >= (v.stock ?? 0)) return c; // stock khatam
      return { ...c, [variantId]: current + 1 };
    });
  };
  const decFromCart = (variantId) => {
    setCart((c) => {
      const newQty = (c[variantId] || 0) - 1;
      const copy = { ...c };
      if (newQty <= 0) delete copy[variantId];
      else copy[variantId] = newQty;
      return copy;
    });
  };

  const goToPayment = () => {
    setReceivedInput(String(cartTotal));
    setPaymentMethod(store.upi_id ? "UPI" : "Cash");
    setError("");
    setStage("payment");
  };

  const received = Number(receivedInput) || 0;
  const remaining = Math.max(0, Math.round((cartTotal - received) * 100) / 100);

  const upiLink = store.upi_id && received > 0
    ? `upi://pay?pa=${encodeURIComponent(store.upi_id)}&pn=${encodeURIComponent(store.name)}&am=${received}&cu=INR&tn=${encodeURIComponent("Quick Bill - " + store.name)}`
    : "";
  const qrImageUrl = upiLink ? `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(upiLink)}` : "";

  const handleCompleteBill = async () => {
    setError("");
    if (received > cartTotal) { setError("Mila hua amount total se zyada nahi ho sakta."); return; }
    if (remaining > 0 && customerPhone.trim().replace(/\D/g, "").length < 10) {
      setError("Baaki raashi Khata mein daalne ke liye customer ka 10-digit phone number chahiye.");
      return;
    }
    setSubmitting(true);
    try {
      const orderNumber = "ORD" + Math.floor(1000 + Math.random() * 9000);
      const payload = {
        store_id: store.id,
        order_number: orderNumber,
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim() || "",
        address: "",
        landmark: null,
        pincode: "",
        order_type: "Pickup",
        delivery_fee: 0,
        payment_method: remaining > 0 ? `${paymentMethod} + Khata` : paymentMethod,
        payment_status: remaining > 0 ? `₹${received} liye, ₹${remaining} Khata mein` : "Paid",
        status: "Delivered",
        items: cartItems.map((it) => ({ variant_id: it.id, name: it.productName, variant: it.label, qty: it.qty, unit: it.unit, price: it.price })),
        total: cartTotal,
      };
      await createOrder(payload);

      if (remaining > 0) {
        const phone = customerPhone.trim();
        const existing = await fetchCustomerByPhone(store.id, phone);
        const customerId = existing?.id || (await createKhataCustomer(store.id, phone, customerName.trim() || "Walk-in Customer"));
        await addKhataTransaction(store.id, customerId, "debit", remaining, `Quick Bill ${orderNumber} - baaki raashi`);
      }

      setLastOrder({
        orderNumber, items: cartItems, total: cartTotal, received, remaining,
        customerName: customerName.trim(), customerPhone: customerPhone.trim(), paymentMethod,
      });
      setStage("receipt");
      onOrderPlaced?.();
    } catch (e) {
      setError(e.message || "Bill complete nahi ho paaya.");
    } finally {
      setSubmitting(false);
    }
  };

  const startNewBill = () => {
    setCart({});
    setSearch("");
    setCustomerName("");
    setCustomerPhone("");
    setReceivedInput("");
    setError("");
    setLastOrder(null);
    setStage("billing");
  };

  const shareOnWhatsapp = () => {
    if (!lastOrder) return;
    const lines = [
      `🧾 ${store.name}`,
      `Bill No: ${lastOrder.orderNumber}`,
      ``,
      ...lastOrder.items.map((it) => `${it.qty} × ${it.productName}${it.label ? " (" + it.label + ")" : ""} — ₹${it.price * it.qty}`),
      ``,
      `Total: ₹${lastOrder.total}`,
      `Mila: ₹${lastOrder.received} (${lastOrder.paymentMethod})`,
    ];
    if (lastOrder.remaining > 0) lines.push(`Khata mein baaki: ₹${lastOrder.remaining}`);
    lines.push(``, `Dhanyawad! 🙏`);
    const text = encodeURIComponent(lines.join("\n"));
    const digits = lastOrder.customerPhone.replace(/\D/g, "").slice(-10);
    const waPhone = digits.length === 10 ? "91" + digits : "";
    window.open(`https://wa.me/${waPhone}?text=${text}`, "_blank");
  };

  return (
    <div>
      {stage === "billing" && (
        <>
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <Search size={15} color="#8B8576" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product khojein ya barcode scan karein..."
              style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "9px", padding: "10px 10px 10px 32px", fontSize: "13px", fontFamily: "inherit", outline: "none" }}
            />
          </div>

          <div style={{ maxHeight: "min(52vh, 420px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingBottom: cartCount > 0 ? "70px" : 0 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#8B8576", fontSize: "13px" }}>Koi product nahi mila.</div>
            )}
            {filtered.map((v) => {
              const qty = cart[v.id] || 0;
              const pricing = getVariantPricing(v);
              const outOfStock = (v.stock ?? 0) <= 0;
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid #E3DECF", borderRadius: "9px", padding: "8px 10px" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>{v.productEmoji || "📦"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.productName}{v.label && v.label !== "Standard" ? ` — ${v.label}` : ""}</div>
                    <div style={{ fontSize: "11px", color: "#8B8576" }}>₹{pricing.effectivePrice}{v.unit ? `/${v.unit}` : ""} · Stock: {v.stock ?? 0}</div>
                  </div>
                  {outOfStock ? (
                    <span style={{ fontSize: "10px", color: "#B3261E", fontWeight: 700, flexShrink: 0 }}>Out of Stock</span>
                  ) : qty === 0 ? (
                    <button onClick={() => addToCart(v.id)} style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "7px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Add</button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1B4332", borderRadius: "7px", padding: "4px 8px", flexShrink: 0 }}>
                      <button onClick={() => decFromCart(v.id)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }}><Minus size={13} /></button>
                      <span style={{ color: "white", fontWeight: 700, fontSize: "12.5px", minWidth: "14px", textAlign: "center" }}>{qty}</span>
                      <button onClick={() => addToCart(v.id)} disabled={qty >= v.stock} style={{ background: "none", border: "none", color: "white", cursor: qty >= v.stock ? "not-allowed" : "pointer", opacity: qty >= v.stock ? 0.5 : 1, display: "flex" }}><Plus size={13} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {cartCount > 0 && (
            <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #E3DECF", padding: "10px 0 0", marginTop: "8px" }}>
              <button onClick={goToPayment} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1B4332", color: "white", border: "none", borderRadius: "10px", padding: "13px 16px", fontSize: "13.5px", fontWeight: 700, cursor: "pointer" }}>
                <span>{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
                <span>Bill Banayein · ₹{cartTotal} →</span>
              </button>
            </div>
          )}
        </>
      )}

      {stage === "payment" && (
        <div>
          <div style={{ background: "#F7F5F0", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", color: "#8B8576", marginBottom: "4px" }}>{cartCount} item{cartCount !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#1B4332" }}>₹{cartTotal}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            <Field label="Customer ka Naam (optional)" value={customerName} onChange={setCustomerName} placeholder="jaise Ramesh" />
            <Field label={`Phone Number ${remaining > 0 ? "(Khata ke liye zaroori)" : "(optional)"}`} value={customerPhone} onChange={setCustomerPhone} placeholder="10-digit number" />
          </div>

          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Abhi Kitna Mila?</div>
            <input
              value={receivedInput}
              onChange={(e) => setReceivedInput(e.target.value)}
              type="text"
              inputMode="decimal"
              style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "10px 12px", fontSize: "16px", fontWeight: 700, fontFamily: "inherit", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {["Cash", "UPI"].map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                disabled={m === "UPI" && !store.upi_id}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: "8px", fontSize: "12.5px", fontWeight: 700, cursor: m === "UPI" && !store.upi_id ? "not-allowed" : "pointer",
                  border: paymentMethod === m ? "1.5px solid #1B4332" : "1px solid #E3DECF",
                  background: paymentMethod === m ? "#E7F0EA" : "white",
                  color: paymentMethod === m ? "#1B4332" : "#5C5747",
                  opacity: m === "UPI" && !store.upi_id ? 0.5 : 1,
                }}
              >
                {m}{m === "UPI" && !store.upi_id ? " (Settings mein UPI ID daalein)" : ""}
              </button>
            ))}
          </div>

          {paymentMethod === "UPI" && received > 0 && qrImageUrl && (
            <div style={{ textAlign: "center", marginBottom: "12px" }}>
              <img src={qrImageUrl} alt="UPI QR" style={{ width: 150, height: 150, borderRadius: "10px", border: "1px solid #E3DECF" }} />
              <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "4px" }}>Customer se ₹{received} scan karwayein</div>
            </div>
          )}

          {remaining > 0 && (
            <div style={{ background: "#FDECEA", border: "1px solid #F0C4BE", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#5C5747", marginBottom: "12px" }}>
              ⚠️ Baaki <b>₹{remaining}</b> customer ke Khata mein jud jaayega.
            </div>
          )}

          {error && <div style={{ color: "#B3261E", fontSize: "12px", marginBottom: "10px" }}>{error}</div>}

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setStage("billing")} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "9px", padding: "11px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Wapas</button>
            <button disabled={submitting} onClick={handleCompleteBill} style={{ flex: 1.5, background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontSize: "12.5px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Ho raha hai..." : "Bill Complete Karein"}
            </button>
          </div>
        </div>
      )}

      {stage === "receipt" && lastOrder && (
        <div>
          <div style={{ textAlign: "center", padding: "6px 0 16px" }}>
            <div style={{ fontSize: "34px", marginBottom: "6px" }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>Bill Ready!</div>
            <div style={{ fontSize: "11px", color: "#8B8576" }}>Bill No: {lastOrder.orderNumber}</div>
          </div>

          <div style={{ background: "#F7F5F0", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px" }}>
            {lastOrder.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0" }}>
                <span>{it.qty} × {it.productName}{it.label && it.label !== "Standard" ? ` (${it.label})` : ""}</span>
                <span>₹{it.price * it.qty}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #E3DECF", marginTop: "6px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "13.5px" }}>
              <span>Total</span><span>₹{lastOrder.total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#5C5747", marginTop: "3px" }}>
              <span>Mila ({lastOrder.paymentMethod})</span><span>₹{lastOrder.received}</span>
            </div>
            {lastOrder.remaining > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#B3261E", fontWeight: 700, marginTop: "3px" }}>
                <span>Khata mein baaki</span><span>₹{lastOrder.remaining}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={shareOnWhatsapp} style={{ flex: 1.4, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
              <MessageCircle size={14} /> WhatsApp Par Bhejein
            </button>
            <button onClick={startNewBill} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "white", border: "1px solid #E3DECF", borderRadius: "9px", padding: "11px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>
              <RotateCcw size={13} /> Naya Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "12.5px", fontFamily: "inherit", outline: "none" }} />
    </div>
  );
}
