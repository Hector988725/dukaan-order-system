import React, { useState, useEffect, useCallback } from "react";
import {
  fetchDeliveryBoys,
  fetchDeliveryDashboard, fetchStoreDeliveryAssignments, fetchStoreDeliveryMethods, setStoreDeliveryMethod,
} from "../lib/api";
import { DELIVERY_METHODS, DELIVERY_STATUS_META } from "../lib/deliveryMethods";

// ------------------------------------------------------------
// Delivery Dashboard + History + Methods
// ------------------------------------------------------------
function DeliveryDashboard({ store }) {
  const [d, setD] = useState(null);
  const [methods, setMethods] = useState([]);
  const load = useCallback(async () => {
    try { setD(await fetchDeliveryDashboard(store.id)); setMethods(await fetchStoreDeliveryMethods(store.id)); } catch (e) { console.error(e); }
  }, [store.id]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  if (!d) return <div style={{ textAlign: "center", padding: "30px", color: "#8B8576" }}>Load ho raha hai...</div>;
  const cards = [["Total Staff", d.total_staff, "#1B4332", "#E7F0EA"], ["Active Staff", d.active_staff, "#1B4332", "#E7F0EA"], ["Pending", d.pending, "#9A6B00", "#FFF4DB"], ["Out for Delivery", d.out_for_delivery, "#1F5FA8", "#E4EEF9"], ["Delivered Aaj", d.delivered_today, "#1B4332", "#D5EBDD"]];
  const available = methods.filter((m) => DELIVERY_METHODS[m.method]?.implemented);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "8px", marginBottom: "14px" }}>
        {cards.map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: "12px", padding: "11px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: "21px", color: c }}>{v}</div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: c }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>Delivery Boy-wise</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
        {(d.per_boy || []).length === 0 && <div style={{ fontSize: "12px", color: "#8B8576" }}>Abhi koi delivery staff nahi — Admin → Staff me "Delivery karna" permission ke saath staff add karein</div>}
        {(d.per_boy || []).map((b) => (
          <div key={b.delivery_boy_id} style={{ display: "flex", justifyContent: "space-between", background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "9px 12px", fontSize: "12.5px" }}>
            <b>{b.name}</b>
            <span style={{ color: "#5C5747" }}>Assigned {b.assigned} · Aaj {b.completed_today} · Total {b.completed_total}</span>
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>Delivery Method</div>
      {available.map((m) => (
        <label key={m.method} style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "10px 12px", fontSize: "12.5px" }}>
          <input type="checkbox" checked={m.enabled} onChange={async (e) => { try { await setStoreDeliveryMethod(store.id, m.method, e.target.checked); load(); } catch (err) { alert(err.message); } }} />
          <span><b>{DELIVERY_METHODS[m.method].label}</b><br /><span style={{ color: "#8B8576", fontSize: "11px" }}>{DELIVERY_METHODS[m.method].description}</span></span>
        </label>
      ))}
    </div>
  );
}

function DeliveryHistory({ store }) {
  const [boys, setBoys] = useState([]);
  const [boyId, setBoyId] = useState("");
  const [range, setRange] = useState("today");
  const [rows, setRows] = useState(null);
  useEffect(() => { fetchDeliveryBoys(store.id).then(setBoys).catch(() => {}); }, [store.id]);
  useEffect(() => {
    setRows(null);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const day = 86400000;
    let from = t0, to = new Date(t0.getTime() + day);
    if (range === "yesterday") { from = new Date(t0.getTime() - day); to = t0; }
    if (range === "week") { from = new Date(t0); from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); }
    if (range === "month") from = new Date(t0.getFullYear(), t0.getMonth(), 1);
    fetchStoreDeliveryAssignments(store.id, { boyId: boyId || null, from: from.toISOString(), to: to.toISOString() })
      .then(setRows).catch(() => setRows([]));
  }, [store.id, boyId, range]);
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <select value={boyId} onChange={(e) => setBoyId(e.target.value)} style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "7px 9px", fontSize: "12px", background: "white" }}>
          <option value="">Sabhi Delivery Boys</option>
          {boys.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {[["today", "Aaj"], ["yesterday", "Kal"], ["week", "Is Hafte"], ["month", "Is Mahine"]].map(([k, l]) => (
          <button key={k} onClick={() => setRange(k)} style={{ border: "1px solid #E3DECF", background: range === k ? "#1B4332" : "white", color: range === k ? "white" : "#5C5747", borderRadius: "999px", padding: "6px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {rows === null ? <div style={{ color: "#8B8576", fontSize: "12.5px" }}>Load ho raha hai...</div> : rows.length === 0 ? <div style={{ color: "#8B8576", fontSize: "12.5px", padding: "20px", textAlign: "center" }}>Koi delivery nahi mili</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {rows.map((r) => {
            const m = DELIVERY_STATUS_META[r.status];
            return (
              <div key={r.assignment_id} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "9px 12px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{r.order_number} · {r.customer_name}</b><span>₹{r.total}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", fontSize: "11px", color: "#8B8576" }}>
                  <span>{r.delivery_boy_name} · {new Date(r.delivered_at || r.assigned_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ background: m.bg, color: m.color, fontWeight: 700, padding: "1px 8px", borderRadius: "999px" }}>{m.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Delivery karne wale ab "Staff" hain (Admin → Staff → permission "Delivery karna").
// Yeh tab sirf delivery ka dashboard, history aur delivery method dikhata hai.
export default function DeliveryBoyManager({ store }) {
  const [sub, setSub] = useState("dashboard");
  const subs = [["dashboard", "Dashboard"], ["history", "History"]];
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {subs.map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, border: "1px solid #E3DECF", background: sub === id ? "#1B4332" : "white", color: sub === id ? "white" : "#5C5747", borderRadius: "8px", padding: "8px 0", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {sub === "dashboard" && <DeliveryDashboard store={store} />}
      {sub === "history" && <DeliveryHistory store={store} />}
    </div>
  );
}
