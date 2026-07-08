import React, { useState } from "react";
import { TrendingUp, Bell, Package, Receipt, MessageCircle, AlertCircle, Minus, Plus } from "lucide-react";
import { updateOrderStatus, updatePaymentStatus, updateVariantStock } from "../lib/api";

// Order Status flow (5 stages): New → Accepted → Preparing → Out for Delivery → Delivered
const statusMeta = {
  New: { label: "Naya Order", color: "#B3261E", bg: "#FDECEA" },
  Accepted: { label: "Accepted", color: "#9A6B00", bg: "#FFF4DB" },
  Preparing: { label: "Taiyar ho raha hai", color: "#9A6B00", bg: "#FFF4DB" },
  "Out for Delivery": { label: "Out for Delivery", color: "#1B4332", bg: "#E7F0EA" },
  Delivered: { label: "Delivered", color: "#1B4332", bg: "#E7F0EA" },
};
const nextStatus = { New: "Accepted", Accepted: "Preparing", Preparing: "Out for Delivery", "Out for Delivery": "Delivered", Delivered: null };
const nextLabel = { New: "Order Accept karein", Accepted: "Taiyar karna shuru karein", Preparing: "Out for Delivery Mark karein", "Out for Delivery": "Delivered Mark karein", Delivered: null };

// Payment Status badge colors (payment_status order_status se alag track hota hai)
const paymentStatusMeta = {
  "Cash on Delivery": { color: "#5C5747", bg: "#F0EEE6" },
  "Pending Verification": { color: "#9A6B00", bg: "#FFF4DB" },
  "Payment Confirmed": { color: "#1B4332", bg: "#E7F0EA" },
};

export default function DashboardView({ store, products, orders, onRefresh }) {
  const [tab, setTab] = useState("orders");
  const todaysSales = orders.filter((o) => o.status === "Delivered").reduce((s, o) => s + Number(o.total), 0);
  const allVariants = products.flatMap((p) => p.variants);
  const lowStock = allVariants.filter((v) => v.stock > 0 && v.stock <= 10).length;
  const outOfStock = allVariants.filter((v) => v.stock === 0).length;
  const newOrderCount = orders.filter((o) => o.status === "New").length;

  const handleAdvance = async (order) => {
    const next = nextStatus[order.status];
    if (!next) return;
    try {
      await updateOrderStatus(order.id, next);
      onRefresh();
    } catch (e) {
      alert("Status update nahi ho paaya: " + e.message);
    }
  };

  // Dukaandar apne UPI app mein payment manually verify karke ye dabata hai —
  // ye sirf payment_status badalta hai, order_status ko bilkul touch nahi karta.
  const handlePaymentConfirm = async (order) => {
    try {
      await updatePaymentStatus(order.id, "Payment Confirmed");
      onRefresh();
    } catch (e) {
      alert("Payment confirm nahi ho paaya: " + e.message);
    }
  };

  const handleStockChange = async (variant, delta) => {
    const newStock = Math.max(0, variant.stock + delta);
    try {
      await updateVariantStock(variant.id, newStock);
      onRefresh();
    } catch (e) {
      alert("Stock update nahi ho paaya: " + e.message);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", padding: "16px 18px 0" }}>
        <StatCard icon={<TrendingUp size={15} />} label="Aaj ki Sale" value={`₹${todaysSales}`} />
        <StatCard icon={<Bell size={15} />} label="Naye Orders" value={newOrderCount} highlight={newOrderCount > 0} />
        <StatCard icon={<Package size={15} />} label="Kam Stock" value={lowStock + outOfStock} />
      </div>

      <div style={{ display: "flex", gap: "4px", padding: "16px 18px 0", borderBottom: "1px solid #E3DECF" }}>
        {[{ id: "orders", label: "Orders", icon: <Receipt size={14} /> }, { id: "products", label: "Products & Stock", icon: <Package size={14} /> }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", fontSize: "12.5px", fontWeight: 700,
            border: "none", background: "transparent", cursor: "pointer",
            color: tab === t.id ? "#1B4332" : "#8B8576",
            borderBottom: tab === t.id ? "2.5px solid #1B4332" : "2.5px solid transparent",
            marginBottom: "-1px",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 18px 18px" }}>
        {tab === "orders" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {orders.length === 0 && <EmptyState text="Abhi koi order nahi aaya hai." />}
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} onAdvance={() => handleAdvance(o)} onPaymentConfirm={() => handlePaymentConfirm(o)} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {products.map((p) => (
              <ProductVariantsCard key={p.id} product={p} onChange={handleStockChange} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ textAlign: "center", padding: "40px 0", color: "#8B8576", fontSize: "13px" }}>{text}</div>;
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div style={{ background: highlight ? "#FDECEA" : "white", border: "1px solid #E3DECF", borderRadius: "11px", padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: highlight ? "#B3261E" : "#8B8576", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 800, color: highlight ? "#B3261E" : "#1A1A1A", fontFamily: "'Fraunces', serif" }}>{value}</div>
    </div>
  );
}

function OrderCard({ order, onAdvance, onPaymentConfirm }) {
  const meta = statusMeta[order.status] || statusMeta.New;
  const payMeta = paymentStatusMeta[order.payment_status] || paymentStatusMeta["Cash on Delivery"];
  const needsPaymentVerification = order.payment_method === "UPI" && order.payment_status === "Pending Verification";

  return (
    <div className="ddemo-card" style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{order.customer_name}</div>
          <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "1px" }}>{order.order_number} · {new Date(order.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <span style={{ background: meta.bg, color: meta.color, fontSize: "10.5px", fontWeight: 700, padding: "4px 9px", borderRadius: "999px", whiteSpace: "nowrap" }}>{meta.label}</span>
      </div>

      <div style={{ fontSize: "12px", color: "#5C5747", marginBottom: "8px", lineHeight: 1.5 }}>
        {order.items.map((it, i) => (
          <span key={i}>{it.name}{it.variant ? ` (${it.variant})` : ""} – {it.qty}{it.unit}{i < order.items.length - 1 ? ", " : ""}</span>
        ))}
      </div>

      <div style={{ fontSize: "11.5px", color: "#8B8576", marginBottom: "8px" }}>
        📍 {order.address}{order.landmark ? ` (${order.landmark})` : ""} – {order.pincode}
      </div>

      {/* Payment Mode, Payment Status, Order Status — teeno alag-alag, clearly labelled */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
        <InfoPill label="Payment Mode" value={order.payment_method} />
        <InfoPill label="Payment Status" value={order.payment_status} color={payMeta.color} bg={payMeta.bg} />
        <InfoPill label="Order Status" value={order.status} color={meta.color} bg={meta.bg} />
        <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "13px", color: "#1A1A1A" }}>₹{order.total}</span>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <a href={`https://wa.me/91${order.customer_phone}`} target="_blank" rel="noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", border: "1px solid #25D366", color: "#178C42", textDecoration: "none", fontSize: "12px", fontWeight: 700, borderRadius: "8px", padding: "8px 0" }}>
          <MessageCircle size={14} /> WhatsApp
        </a>
        {needsPaymentVerification ? (
          <button onClick={onPaymentConfirm} className="ddemo-btn" style={{ flex: 1.4, background: "#9A6B00", color: "white", border: "none", fontSize: "12px", fontWeight: 700, borderRadius: "8px", padding: "8px 0", cursor: "pointer" }}>
            Payment Confirm Karein
          </button>
        ) : nextLabel[order.status] ? (
          <button onClick={onAdvance} className="ddemo-btn" style={{ flex: 1.4, background: "#1B4332", color: "white", border: "none", fontSize: "12px", fontWeight: 700, borderRadius: "8px", padding: "8px 0", cursor: "pointer" }}>
            {nextLabel[order.status]}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InfoPill({ label, value, color = "#5C5747", bg = "#F0EEE6" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: bg, color, fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px" }}>
      <span style={{ opacity: 0.75, fontWeight: 600 }}>{label}:</span> {value}
    </span>
  );
}

function ProductVariantsCard({ product, onChange }) {
  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "12px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <span style={{ fontSize: "20px" }}>{product.emoji}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "13px" }}>{product.name}</div>
          <div style={{ fontSize: "10.5px", color: "#8B8576" }}>{product.category}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {product.variants.map((v) => {
          const low = v.stock > 0 && v.stock <= 10;
          const out = v.stock === 0;
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#F7F5F0", borderRadius: "8px", padding: "8px 10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "12px" }}>{v.label}</div>
                <div style={{ fontSize: "10.5px", color: "#8B8576" }}>₹{v.price} / {v.unit}</div>
              </div>
              {(low || out) && (
                <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "9.5px", fontWeight: 700, color: out ? "#B3261E" : "#9A6B00", background: out ? "#FDECEA" : "#FFF4DB", padding: "2px 6px", borderRadius: "999px" }}>
                  <AlertCircle size={10} /> {out ? "Khatam" : "Kam"}
                </span>
              )}
              <button onClick={() => onChange(v, -1)} className="ddemo-btn" style={stockBtn}><Minus size={12} /></button>
              <span style={{ fontWeight: 700, fontSize: "12.5px", minWidth: "24px", textAlign: "center" }}>{v.stock}</span>
              <button onClick={() => onChange(v, 1)} className="ddemo-btn" style={stockBtn}><Plus size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const stockBtn = { width: 24, height: 24, borderRadius: "6px", border: "1px solid #E3DECF", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
