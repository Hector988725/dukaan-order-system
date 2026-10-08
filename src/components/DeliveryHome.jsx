import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Package, CheckCircle2, Clock, MapPin, Phone, ChevronDown, ChevronUp, Navigation } from "lucide-react";
import {
  fetchMyDeliveries,
  fetchMyDeliveryNotifications, markDeliveryNotificationsRead, subscribeToMyDeliveryNotifications,
  updateDeliveryStatus,
} from "../lib/api";
import { DELIVERY_STATUS_META, NEXT_DELIVERY_ACTION, mapsUrl } from "../lib/deliveryMethods";

// ============================================================
// DELIVERY HOME — Staff app (/staff) ke "Delivery" tab ke andar chalta hai.
// Alag /delivery app ab nahi hai: delivery karne wale ab "Staff" hain
// (Admin → Staff → permission "Delivery karna"). Data sab security-definer
// RPCs se aata hai jo sirf is staff ki apni assignments dete hain.
// ============================================================
const G = "#1B4332", BORDER = "#E3DECF", MUTED = "#8B8576";
const btn = (primary, disabled) => ({
  width: "100%", border: primary ? "none" : `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700,
  background: primary ? (disabled ? "#D8D2BF" : G) : "white", color: primary ? "white" : "#5C5747", cursor: disabled ? "not-allowed" : "pointer",
});

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function rangeFor(key) {
  const today = startOfDay(), day = 86400000;
  if (key === "today") return [today, new Date(today.getTime() + day)];
  if (key === "yesterday") return [new Date(today.getTime() - day), today];
  if (key === "week") { const w = new Date(today); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return [w, new Date(today.getTime() + day)]; }
  return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getTime() + day)];
}
const FILTERS = [["today", "Aaj"], ["yesterday", "Kal"], ["week", "Is Hafte"], ["month", "Is Mahine"]];

export function DeliveryHome({ profile }) {
  const [tab, setTab] = useState("today");
  const [active, setActive] = useState([]);
  const [deliveredToday, setDeliveredToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [t0, t1] = rangeFor("today");
      const [a, d, n] = await Promise.all([
        fetchMyDeliveries("active"),
        fetchMyDeliveries("history", t0.toISOString(), t1.toISOString()),
        fetchMyDeliveryNotifications(),
      ]);
      setActive(a); setDeliveredToday(d); setNotifs(n); setErr("");
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    refresh();
    const timer = setInterval(() => refreshRef.current(), 20000);   // polling fallback
    const unsub = subscribeToMyDeliveryNotifications(profile.id, (n) => {
      setToast(n.title + (n.body ? " — " + n.body : ""));
      refreshRef.current();
      setTimeout(() => setToast(""), 6000);
    });
    return () => { clearInterval(timer); unsub(); };
  }, [profile.id, refresh]);

  const unread = notifs.filter((n) => !n.read_at).length;
  const openNotifs = async () => {
    setShowNotifs((s) => !s);
    if (unread > 0) { try { await markDeliveryNotificationsRead(); } catch {} setTimeout(refresh, 1500); }
  };

  const fresh = active.filter((d) => d.status === "ASSIGNED" || d.status === "ACCEPTED" || d.status === "PICKED_UP");
  const out = active.filter((d) => d.status === "OUT_FOR_DELIVERY");

  return (
    <div>
      {(
        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
          {[["today", "Deliveries"], ["history", "History"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ border: `1px solid ${tab === k ? G : BORDER}`, background: tab === k ? G : "white", color: tab === k ? "white" : "#5C5747", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={openNotifs} aria-label="Notifications" style={{ position: "relative", background: "white", border: `1px solid ${BORDER}`, borderRadius: 8, width: 34, height: 34, color: G, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={15} />
            {unread > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#E5484D", color: "white", borderRadius: 999, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
          </button>
        </div>
      )}

      {toast && <div style={{ background: "#FFF4DB", color: "#7A5400", padding: "10px 16px", fontSize: 12.5, fontWeight: 600 }}>🔔 {toast}</div>}
      {showNotifs && (
        <div style={{ background: "white", borderBottom: `1px solid ${BORDER}`, maxHeight: 260, overflowY: "auto" }}>
          {notifs.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Koi notification nahi</div> : notifs.map((n) => (
            <div key={n.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, background: n.read_at ? "white" : "#FFFBF0" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{n.title}</div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{n.body} · {new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))}
        </div>
      )}
      {err && <div style={{ background: "#FDECEA", color: "#B3261E", padding: "10px 16px", fontSize: 12.5 }}>{err}</div>}

      <div>
        {tab === "today" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
              <Stat label="New / Assigned" value={fresh.length} color="#9A6B00" bg="#FFF4DB" />
              <Stat label="Out for Delivery" value={out.length} color={G} bg="#E7F0EA" />
              <Stat label="Delivered Aaj" value={deliveredToday.length} color="#1F5FA8" bg="#E4EEF9" />
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Aaj ki Deliveries</div>
            {loading ? <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div> :
              active.length === 0 && deliveredToday.length === 0 ? <Empty text="Abhi koi delivery assign nahi hai" /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {active.map((d) => <DeliveryCard key={d.assignment_id} d={d} onChanged={refresh} />)}
                  {deliveredToday.map((d) => <DeliveryCard key={d.assignment_id} d={d} onChanged={refresh} />)}
                </div>
              )}
          </>
        )}
        {tab === "history" && <HistoryTab />}
              </div>

    </div>
  );
}

function Stat({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "11px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 22, color }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color, opacity: 0.85 }}>{label}</div>
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ textAlign: "center", padding: "36px 16px", color: MUTED, fontSize: 13 }}><div style={{ fontSize: 30, marginBottom: 6 }}>🏍️</div>{text}</div>;
}

function DeliveryCard({ d, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = DELIVERY_STATUS_META[d.status];
  const next = NEXT_DELIVERY_ACTION[d.status];
  const cod = Number(d.amount_to_collect) > 0;
  const act = async () => {
    if (d.status === "OUT_FOR_DELIVERY" && cod && !confirm(`Kya aapne ₹${d.amount_to_collect} customer se le liye? Delivered mark karein?`)) return;
    setBusy(true);
    try { await updateDeliveryStatus(d.assignment_id, next.to); await onChanged(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderLeft: `5px solid ${meta.color}`, borderRadius: 13, padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{d.customer_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{d.order_number} · Assigned {new Date(d.assigned_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <span style={{ alignSelf: "flex-start", background: meta.bg, color: meta.color, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{meta.label}</span>
      </div>
      <div style={{ fontSize: 12, color: "#5C5747", margin: "8px 0", display: "flex", gap: 5 }}><MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />{d.address}{d.landmark ? ` (${d.landmark})` : ""} – {d.pincode}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cod ? "#FFF4DB" : "#E7F0EA", borderRadius: 9, padding: "8px 11px", marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: cod ? "#7A5400" : G }}>{cod ? "Amount to Collect (COD)" : "PAID ONLINE"}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 16, color: cod ? "#7A5400" : G }}>₹{cod ? d.amount_to_collect : 0}</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <a href={`tel:${d.customer_phone}`} style={linkBtn}><Phone size={14} /> Call</a>
        <a href={mapsUrl(d)} target="_blank" rel="noreferrer" style={linkBtn}><Navigation size={14} /> Navigate</a>
        <button onClick={() => setOpen((o) => !o)} style={{ ...linkBtn, background: "white", cursor: "pointer" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detail</button>
      </div>
      {open && (
        <div style={{ background: "#F7F5F0", borderRadius: 9, padding: "9px 11px", marginBottom: 8, fontSize: 12 }}>
          {(d.items || []).map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span>{it.name}{it.variant ? ` (${it.variant})` : ""}</span><span>{it.qty}{it.unit}</span></div>)}
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Total · {d.payment_method}</span><span>₹{d.total}</span></div>
          <div style={{ color: MUTED, marginTop: 4 }}>Phone: {d.customer_phone}</div>
        </div>
      )}
      {d.status === "DELIVERED"
        ? <div style={{ fontSize: 11.5, color: G, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={14} /> Delivered {new Date(d.delivered_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
        : next && <button disabled={busy} onClick={act} style={btn(true, busy)}>{busy ? "Ruko..." : next.label}</button>}
    </div>
  );
}
const linkBtn = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 0", fontSize: 12.5, fontWeight: 700, color: G, textDecoration: "none", background: "#F7F5F0" };

function HistoryTab() {
  const [f, setF] = useState("today");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    const [a, b] = rangeFor(f);
    fetchMyDeliveries("history", a.toISOString(), b.toISOString()).then(setRows).catch(() => setRows([]));
  }, [f]);
  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} style={{ border: `1px solid ${f === k ? G : BORDER}`, background: f === k ? G : "white", color: f === k ? "white" : "#5C5747", borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {rows === null ? <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div> : rows.length === 0 ? <Empty text="Is period mein koi delivery nahi" /> : (
        <>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}><Clock size={12} style={{ verticalAlign: "-2px" }} /> {rows.length} deliveries</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((d) => (
              <div key={d.assignment_id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 11, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>{d.customer_name}</span><span>₹{d.total}</span></div>
                <div style={{ fontSize: 11, color: MUTED }}>{d.order_number} · {new Date(d.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {d.payment_method}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

