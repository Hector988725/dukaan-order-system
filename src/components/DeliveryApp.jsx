import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bike, Phone, MapPin, LogOut, Bell, Package, CheckCircle2, Clock, History, User, ChevronDown, ChevronUp, Navigation } from "lucide-react";
import {
  signIn, signUp, signOut, onAuthChange,
  claimDeliveryInvite, fetchMyDeliveryProfile, fetchMyDeliveries, updateDeliveryStatus,
  fetchMyDeliveryNotifications, markDeliveryNotificationsRead, subscribeToMyDeliveryNotifications,
} from "../lib/api";
import { DELIVERY_STATUS_META, NEXT_DELIVERY_ACTION, mapsUrl } from "../lib/deliveryMethods";

// ============================================================
// DELIVERY BOY APP (/delivery) — mobile-first. Existing Supabase auth
// use hota hai (naya auth system nahi). Sab data security-definer RPCs
// se aata hai jo sirf is boy ki apni assignments dete hain.
// ============================================================
const G = "#1B4332", GOLD = "#D4A24C", BORDER = "#E3DECF", MUTED = "#8B8576";

export default function DeliveryApp() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => onAuthChange((u) => setUser(u || null)), []);

  const loadProfile = useCallback(async () => {
    try { setProfile(await fetchMyDeliveryProfile()); setError(""); }
    catch (e) { setError(e.message); setProfile(null); }
  }, []);

  useEffect(() => {
    if (user) { setProfile(undefined); loadProfile(); } else setProfile(undefined);
  }, [user, loadProfile]);

  if (user === undefined || (user && profile === undefined)) return <Centered><div style={{ color: MUTED }}>Load ho raha hai...</div></Centered>;
  if (!user) return <LoginCard />;
  if (!profile) return <ClaimCard error={error} onDone={loadProfile} />;
  if (!profile.login_enabled || !profile.is_active) {
    return (
      <Centered>
        <Logo />
        <div style={{ fontWeight: 700, marginTop: 14 }}>Aapka account abhi band hai</div>
        <div style={{ fontSize: 12.5, color: MUTED, margin: "6px 0 16px" }}>Dukaandar ({profile.store_name}) se baat karein.</div>
        <button onClick={() => signOut()} style={btn(false)}>Logout</button>
      </Centered>
    );
  }
  return <Home profile={profile} />;
}

function Centered({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>{children}</div>;
}
function Logo() {
  return <div style={{ width: 54, height: 54, borderRadius: 14, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}><Bike size={26} color="#123026" /></div>;
}
const btn = (primary, disabled) => ({
  width: "100%", border: primary ? "none" : `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700,
  background: primary ? (disabled ? "#D8D2BF" : G) : "white", color: primary ? "white" : "#5C5747", cursor: disabled ? "not-allowed" : "pointer",
});
const input = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

function LoginCard() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      if (mode === "login") await signIn(email.trim(), password);
      else {
        const r = await signUp(email.trim(), password);
        if (!r.session) setMsg("Email par confirmation link bheja gaya hai. Confirm karke login karein.");
      }
    } catch (e) { setMsg(e.message || "Kuch gadbad hui"); }
    setBusy(false);
  };
  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Logo />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, margin: "12px 0 2px" }}>Delivery Partner Login</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 18 }}>{mode === "login" ? "Apne email aur password se login karein" : "Naya account banayein, phir dukaandar ka code daalein"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input style={input} type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {msg && <div style={{ fontSize: 12, color: "#B3261E" }}>{msg}</div>}
          <button disabled={busy || !email || password.length < 6} onClick={submit} style={btn(true, busy || !email || password.length < 6)}>{busy ? "Ruko..." : mode === "login" ? "Login" : "Account Banayein"}</button>
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }} style={{ background: "none", border: "none", color: G, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {mode === "login" ? "Pehli baar? Naya account banayein" : "Account hai? Login karein"}
          </button>
        </div>
      </div>
    </Centered>
  );
}

function ClaimCard({ error, onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = async () => {
    setBusy(true); setMsg("");
    try { await claimDeliveryInvite(code); await onDone(); }
    catch (e) { setMsg(e.message || "Code sahi nahi hai"); }
    setBusy(false);
  };
  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Logo />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, margin: "12px 0 4px" }}>Dukaan Code Daalein</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Dukaandar ne jo 8-akshar ka code diya hai wo yahan daalein</div>
        <input style={{ ...input, textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase" }} maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" />
        {(msg || error) && <div style={{ fontSize: 12, color: "#B3261E", marginTop: 8 }}>{msg || error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          <button disabled={busy || code.length < 8} onClick={submit} style={btn(true, busy || code.length < 8)}>{busy ? "Ruko..." : "Link Karein"}</button>
          <button onClick={() => signOut()} style={btn(false)}>Logout</button>
        </div>
      </div>
    </Centered>
  );
}

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function rangeFor(key) {
  const today = startOfDay(), day = 86400000;
  if (key === "today") return [today, new Date(today.getTime() + day)];
  if (key === "yesterday") return [new Date(today.getTime() - day), today];
  if (key === "week") { const w = new Date(today); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return [w, new Date(today.getTime() + day)]; }
  return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getTime() + day)];
}
const FILTERS = [["today", "Aaj"], ["yesterday", "Kal"], ["week", "Is Hafte"], ["month", "Is Mahine"]];

function Home({ profile }) {
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
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#FAF8F2", paddingBottom: 76 }}>
      <div style={{ background: G, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, color: "white", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}><Bike size={18} color="#123026" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.name}</div>
          <div style={{ fontSize: 11, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.store_name}</div>
        </div>
        <button onClick={openNotifs} aria-label="Notifications" style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 36, height: 36, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={16} />
          {unread > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#E5484D", borderRadius: 999, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
        </button>
      </div>

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

      <div style={{ padding: "14px 14px 0" }}>
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
        {tab === "profile" && <ProfileTab profile={profile} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "center", zIndex: 6 }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 480 }}>
          {[["today", "Deliveries", <Package size={18} key="p" />], ["history", "History", <History size={18} key="h" />], ["profile", "Profile", <User size={18} key="u" />]].map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0 12px", border: "none", background: "none", color: tab === id ? G : MUTED, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>{icon}{label}</button>
          ))}
        </div>
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

function ProfileTab({ profile }) {
  const row = (l, v) => v ? <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}><span style={{ color: MUTED }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div> : null;
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 13, padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        {profile.photo_url ? <img src={profile.photo_url} alt="" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover" }} /> : <Logo />}
        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>{profile.name}</div>
      </div>
      {row("Dukaan", profile.store_name)}{row("Mobile", profile.phone)}{row("Vehicle", profile.vehicle_type)}{row("Vehicle No.", profile.vehicle_number)}
      <button onClick={() => signOut()} style={{ ...btn(false), marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><LogOut size={14} /> Logout</button>
    </div>
  );
}
