import React, { useState, useEffect } from "react";
import { TrendingUp, Bell, Package, Receipt, MessageCircle, AlertCircle, Minus, Plus, BookText, X } from "lucide-react";
import { updateOrderStatus, updatePaymentStatus, updateVariantStock, assignDeliveryBoy, fetchTodaysKhataCollection } from "../lib/api";

// Order Status flow (extend hui hai — existing column/values nahi badle,
// bas ek naya intermediate "Ready" status add kiya hai):
// New → Accepted → Preparing (UI mein "Packing" dikhta hai) → Ready →
//   Delivery order: Ready → (delivery boy assign) → Out for Delivery → Delivered
//   Pickup order:   Ready → Delivered (customer khud dukaan se le gaya)
const statusMeta = {
  New: { label: "Naya Order", color: "#B3261E", bg: "#FDECEA" },
  Accepted: { label: "Accepted", color: "#9A6B00", bg: "#FFF4DB" },
  Preparing: { label: "Packing", color: "#9A6B00", bg: "#FFF4DB" },
  Ready: { label: "Ready", color: "#1B4332", bg: "#E7F0EA" },
  "Out for Delivery": { label: "Out for Delivery", color: "#1B4332", bg: "#E7F0EA" },
  Delivered: { label: "Delivered", color: "#1B4332", bg: "#E7F0EA" },
};

// Dashboard "Control Center" pipeline strip ke liye stage order —
// Home screen par turant dikhta hai ki kis stage par kitne orders hain.
const PIPELINE_STAGES = ["New", "Accepted", "Preparing", "Ready", "Out for Delivery", "Delivered"];

// Order-type ke hisaab se next status aur uska label alag hota hai —
// isliye ab yeh function hai, plain object nahi.
function getNextStatus(order) {
  const isPickup = order.order_type === "Pickup";
  const map = { New: "Accepted", Accepted: "Preparing", Preparing: "Ready", Ready: isPickup ? "Delivered" : "Out for Delivery", "Out for Delivery": "Delivered", Delivered: null };
  return map[order.status] ?? null;
}
function getNextLabel(order) {
  const isPickup = order.order_type === "Pickup";
  const map = {
    New: "Order Accept karein",
    Accepted: "Packing Shuru Karein",
    Preparing: "Ready Mark Karein",
    Ready: isPickup ? "Pickup Ho Gaya — Mark Karein" : "Out for Delivery Mark Karein",
    "Out for Delivery": "Delivered Mark Karein",
    Delivered: null,
  };
  return map[order.status] ?? null;
}

// Payment Status badge colors (payment_status order_status se alag track hota hai)
const paymentStatusMeta = {
  "Cash on Delivery": { color: "#5C5747", bg: "#F0EEE6" },
  "Pending Verification": { color: "#9A6B00", bg: "#FFF4DB" },
  "Payment Confirmed": { color: "#1B4332", bg: "#E7F0EA" },
};

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function DashboardView({ store, products, orders, deliveryBoys, onRefresh }) {
  const [tab, setTab] = useState("orders");
  const [statusFilter, setStatusFilter] = useState(null);
  const [khataCollection, setKhataCollection] = useState(0);

  // "Aaj ka Khata Collection" — orders refresh hote hi yeh bhi dobara
  // fetch ho jaata hai (dono ek doosre se related hain, ek hi refresh
  // cycle mein up-to-date rehte hain).
  useEffect(() => {
    fetchTodaysKhataCollection(store.id).then(setKhataCollection).catch(() => {});
  }, [store.id, orders]);

  const todaysOrders = orders.filter((o) => isToday(o.created_at));
  // Sirf AAJ ke Delivered orders ki sale count hoti hai — pehle yeh
  // galti se saare (kabhi bhi delivered) orders jod deta tha.
  const todaysSales = todaysOrders.filter((o) => o.status === "Delivered").reduce((s, o) => s + Number(o.total), 0);
  const allVariants = products.flatMap((p) => p.variants);
  const lowStock = allVariants.filter((v) => v.stock > 0 && v.stock <= 10).length;
  const outOfStock = allVariants.filter((v) => v.stock === 0).length;

  const pipelineCounts = PIPELINE_STAGES.reduce((acc, s) => {
    acc[s] = todaysOrders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  const visibleOrders = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;

  const handleAdvance = async (order) => {
    const next = getNextStatus(order);
    if (!next) return;
    // Delivery order ko "Out for Delivery" mark karne se pehle delivery
    // boy assign hona zaroori hai — warna customer ko pata hi nahi
    // chalega kaun saaman le kar aa raha hai.
    if (order.status === "Ready" && order.order_type !== "Pickup" && !order.delivery_boy_id) {
      alert("Pehle Delivery Boy assign karein, phir 'Out for Delivery' mark karein.");
      return;
    }
    try {
      await updateOrderStatus(order.id, next);
      onRefresh();
    } catch (e) {
      alert("Status update nahi ho paaya: " + e.message);
    }
  };

  const handleAssignDeliveryBoy = async (order, deliveryBoyId) => {
    try {
      await assignDeliveryBoy(order.id, deliveryBoyId || null);
      onRefresh();
    } catch (e) {
      alert("Delivery boy assign nahi ho paaya: " + e.message);
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
      {/* Hero numbers — sabse zaroori 2 cheezein, sabse bada/prominent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "16px 18px 0" }}>
        <HeroCard icon={<TrendingUp size={18} />} label="Aaj ki Sale" value={`₹${todaysSales.toLocaleString("en-IN")}`} accent="#1B4332" />
        <HeroCard icon={<BookText size={18} />} label="Aaj ka Khata Collection" value={`₹${khataCollection.toLocaleString("en-IN")}`} accent="#9A6B00" />
      </div>

      {/* Order pipeline strip — "Control Center" ka core: ek nazar mein
          pata chal jaaye har stage par kitne (AAJ ke) orders hain. Tap
          karke us stage ke orders (sab dates ke) filter ho jaate hain
          neeche ki list mein — dobara tap karke filter hat jaata hai. */}
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#8B8576", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Aaj ke Orders — Stage Se Dekhein</div>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {PIPELINE_STAGES.map((stage) => {
            const meta = statusMeta[stage];
            const count = pipelineCounts[stage];
            const active = statusFilter === stage;
            return (
              <button
                key={stage}
                onClick={() => setStatusFilter(active ? null : stage)}
                className="ddemo-btn"
                style={{
                  flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                  padding: "9px 14px", borderRadius: "11px", cursor: "pointer", minWidth: "72px",
                  border: active ? `1.5px solid ${meta.color}` : "1px solid #E3DECF",
                  background: active ? meta.bg : "white",
                }}
              >
                <span style={{ fontSize: "17px", fontWeight: 800, color: meta.color, fontFamily: "'Fraunces', serif" }}>{count}</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#5C5747", whiteSpace: "nowrap" }}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(lowStock + outOfStock) > 0 && (
        <div style={{ margin: "12px 18px 0", background: "#FDECEA", border: "1px solid #F3C6C1", borderRadius: "10px", padding: "9px 13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={14} color="#B3261E" />
          <span style={{ fontSize: "11.5px", color: "#B3261E", fontWeight: 600 }}>{lowStock + outOfStock} product{lowStock + outOfStock > 1 ? "s" : ""} ka stock kam/khatam hai — "Products & Stock" tab dekhein</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "3px", padding: "16px 18px 0" }}>
        {[{ id: "orders", label: "Orders", icon: <Receipt size={14} /> }, { id: "products", label: "Products & Stock", icon: <Package size={14} /> }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="ddemo-btn" style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 15px", fontSize: "12.5px", fontWeight: 700,
            border: "none", cursor: "pointer", borderRadius: "9px 9px 0 0",
            color: tab === t.id ? "#1B4332" : "#8B8576",
            background: tab === t.id ? "#EFE9D8" : "transparent",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ borderBottom: "1px solid #E3DECF", padding: "0 18px" }} />

      <div style={{ padding: "14px 18px 18px" }}>
        {tab === "orders" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {statusFilter && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F0EEE6", borderRadius: "9px", padding: "8px 12px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747" }}>Filter: <b>{statusMeta[statusFilter]?.label}</b> ({visibleOrders.length})</span>
                <button onClick={() => setStatusFilter(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747", display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: 700 }}>
                  <X size={12} /> Hatayein
                </button>
              </div>
            )}
            {visibleOrders.length === 0 && <EmptyState text={statusFilter ? "Is stage mein koi order nahi hai." : "Abhi koi order nahi aaya hai."} />}
            {visibleOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                deliveryBoys={deliveryBoys || []}
                onAdvance={() => handleAdvance(o)}
                onPaymentConfirm={() => handlePaymentConfirm(o)}
                onAssignDeliveryBoy={(id) => handleAssignDeliveryBoy(o, id)}
              />
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
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#8B8576" }}>
      <div style={{ fontSize: "30px", marginBottom: "8px" }}>🧾</div>
      <div style={{ fontSize: "13px" }}>{text}</div>
    </div>
  );
}

function HeroCard({ icon, label, value, accent }) {
  return (
    <div className="ddemo-card" style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "14px", padding: "16px 16px 14px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -14, right: -14, width: 60, height: 60, borderRadius: "50%", background: accent, opacity: 0.08 }} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "9px",
        background: `${accent}18`, color: accent, marginBottom: "10px",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#8B8576", marginBottom: "3px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "#1A1A1A", fontFamily: "'Fraunces', serif" }}>{value}</div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className="ddemo-card" style={{ background: highlight ? "#FDECEA" : "white", border: `1px solid ${highlight ? "#F3C6C1" : "#E3DECF"}`, borderRadius: "12px", padding: "12px 13px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "8px",
        background: highlight ? "#F3C6C1" : "#EFE9D8", color: highlight ? "#B3261E" : "#1B4332", marginBottom: "8px",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: "10.5px", fontWeight: 600, color: highlight ? "#B3261E" : "#8B8576", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "19px", fontWeight: 800, color: highlight ? "#B3261E" : "#1A1A1A", fontFamily: "'Fraunces', serif" }}>{value}</div>
    </div>
  );
}

function OrderCard({ order, deliveryBoys, onAdvance, onPaymentConfirm, onAssignDeliveryBoy }) {
  const meta = statusMeta[order.status] || statusMeta.New;
  const payMeta = paymentStatusMeta[order.payment_status] || paymentStatusMeta["Cash on Delivery"];
  const needsPaymentVerification = order.payment_method === "UPI" && order.payment_status === "Pending Verification";
  const isPickup = order.order_type === "Pickup";
  const nextLabel = getNextLabel(order);

  const isNew = order.status === "New";

  // Delivery order jab "Ready" ho jaaye, tabhi delivery boy assign karne
  // ka option dikhta hai (Pickup orders ko delivery boy ki zaroorat nahi).
  const showAssignDeliveryBoy = !isPickup && order.status === "Ready";
  const assignedBoy = order.delivery_boy_id ? (deliveryBoys || []).find((b) => b.id === order.delivery_boy_id) : null;

  return (
    <div className="ddemo-card" style={{
      background: isNew ? "#FFFBF6" : "white",
      border: "1px solid #E3DECF", borderLeft: `5px solid ${meta.color}`,
      borderRadius: "13px", padding: "14px 15px 13px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "9px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "14.5px", fontFamily: "'Fraunces', serif" }}>{order.customer_name}</div>
          <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "2px" }}>{order.order_number} · {new Date(order.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ background: meta.bg, color: meta.color, fontSize: "10.5px", fontWeight: 700, padding: "4px 9px", borderRadius: "999px", whiteSpace: "nowrap" }}>{meta.label}</span>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "#1A1A1A", fontFamily: "'Fraunces', serif", marginTop: "5px" }}>₹{order.total}</div>
        </div>
      </div>

      <div style={{ fontSize: "12px", color: "#5C5747", marginBottom: "6px", lineHeight: 1.5 }}>
        {order.items.map((it, i) => (
          <span key={i}>{it.name}{it.variant ? ` (${it.variant})` : ""} – {it.qty}{it.unit}{i < order.items.length - 1 ? ", " : ""}</span>
        ))}
      </div>

      {/* Pickup/Delivery badge — customer ne checkout par jo chuna tha */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
        <InfoPill label="Type" value={isPickup ? "Pickup se Milega" : "Delivery"} color={isPickup ? "#9A6B00" : "#1B4332"} bg={isPickup ? "#FFF4DB" : "#E7F0EA"} />
        {assignedBoy && <InfoPill label="Delivery Boy" value={assignedBoy.name} color="#1B4332" bg="#E7F0EA" />}
      </div>

      {!isPickup && (
        <div style={{ fontSize: "11.5px", color: "#8B8576", marginBottom: "10px" }}>
          📍 {order.address}{order.landmark ? ` (${order.landmark})` : ""} – {order.pincode}
        </div>
      )}

      {/* Payment mode + status ek pill mein combine, Order Status upar badge mein already dikh raha hai — dohrana nahi */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
        <InfoPill label={order.payment_method} value={order.payment_status} color={payMeta.color} bg={payMeta.bg} />
      </div>

      {showAssignDeliveryBoy && (
        <div style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#5C5747", marginBottom: "5px" }}>Delivery Boy Assign Karein</div>
          <select
            value={order.delivery_boy_id || ""}
            onChange={(e) => onAssignDeliveryBoy(e.target.value || null)}
            style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 10px", fontSize: "12.5px", fontFamily: "inherit", background: "white" }}
          >
            <option value="">— Chunein —</option>
            {(deliveryBoys || []).filter((b) => b.is_active).map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.phone})</option>
            ))}
          </select>
          {(deliveryBoys || []).filter((b) => b.is_active).length === 0 && (
            <div style={{ fontSize: "10.5px", color: "#B3261E", marginTop: "4px" }}>Koi active delivery boy nahi hai — Admin → Delivery Staff mein add karein.</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <a href={`https://wa.me/91${order.customer_phone}`} target="_blank" rel="noreferrer" className="ddemo-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", border: "1.5px solid #25D366", color: "#178C42", textDecoration: "none", fontSize: "12.5px", fontWeight: 700, borderRadius: "9px", padding: "10px 0" }}>
          <MessageCircle size={15} /> WhatsApp
        </a>
        {needsPaymentVerification ? (
          <button onClick={onPaymentConfirm} className="ddemo-btn" style={{ flex: 1.5, background: "#9A6B00", color: "white", border: "none", fontSize: "12.5px", fontWeight: 700, borderRadius: "9px", padding: "10px 0", cursor: "pointer" }}>
            Payment Confirm Karein
          </button>
        ) : nextLabel ? (
          <button onClick={onAdvance} className="ddemo-btn" style={{ flex: 1.5, background: "#1B4332", color: "white", border: "none", fontSize: "12.5px", fontWeight: 700, borderRadius: "9px", padding: "10px 0", cursor: "pointer" }}>
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InfoPill({ label, value, color = "#5C5747", bg = "#F0EEE6" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: bg, color, fontSize: "10.5px", fontWeight: 700, padding: "4px 9px", borderRadius: "999px" }}>
      <span style={{ opacity: 0.7, fontWeight: 600 }}>{label}:</span> {value}
    </span>
  );
}

function ProductVariantsCard({ product, onChange }) {
  return (
    <div className="ddemo-card" style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "13px", padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "9px" }}>
        <span style={{ fontSize: "20px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", borderRadius: "9px", flexShrink: 0 }}>{product.emoji}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "13.5px", fontFamily: "'Fraunces', serif" }}>{product.name}</div>
          <div style={{ fontSize: "10.5px", color: "#8B8576" }}>{product.category}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {product.variants.map((v) => {
          const low = v.stock > 0 && v.stock <= 10;
          const out = v.stock === 0;
          return (
            <div key={v.id} style={{
              display: "flex", alignItems: "center", gap: "10px", background: out ? "#FDECEA" : "#F7F5F0",
              border: out ? "1px solid #F3C6C1" : "1px solid transparent", borderRadius: "9px", padding: "9px 11px",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{v.label}</div>
                <div style={{ fontSize: "10.5px", color: "#8B8576" }}>₹{v.price} / {v.unit}</div>
              </div>
              {(low || out) && (
                <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 700, color: out ? "#B3261E" : "#9A6B00", background: out ? "#F3C6C1" : "#FFF4DB", padding: "3px 7px", borderRadius: "999px", whiteSpace: "nowrap" }}>
                  <AlertCircle size={11} /> {out ? "Khatam" : "Kam"}
                </span>
              )}
              <button onClick={() => onChange(v, -1)} className="ddemo-btn ddemo-stepper-btn" style={stockBtn}><Minus size={13} /></button>
              <span style={{ fontWeight: 700, fontSize: "13px", minWidth: "26px", textAlign: "center" }}>{v.stock}</span>
              <button onClick={() => onChange(v, 1)} className="ddemo-btn ddemo-stepper-btn" style={stockBtn}><Plus size={13} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const stockBtn = { width: 30, height: 30, borderRadius: "8px", border: "1px solid #E3DECF", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
