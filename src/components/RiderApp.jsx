import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bike, LogOut, MapPin, Phone, Navigation, Store, ChevronDown, ChevronUp, CheckCircle2, Inbox, ListChecks, History } from "lucide-react";
import { friendlyError } from "../lib/errors";
import {
  signIn, signUp, signOut, onAuthChange,
  claimCentralRiderInvite, fetchMyCentralRiderProfile, fetchCentralPool, centralAccept, centralRelease,
  fetchMyCentralDeliveries, centralUpdateStatus,
} from "../lib/api";
import InstallAppButton from "./InstallAppButton";
import { DELIVERY_STATUS_META, NEXT_DELIVERY_ACTION, mapsUrl } from "../lib/deliveryMethods";

// ============================================================
// CENTRAL RIDER APP (/rider) — mobile-first.
// Rider ko sirf pool dikhta hai (dukaan + pickup + paisa; customer ka naam,
// phone, poora address NAHI). Accept karne ke baad hi customer details
// milti hain. Sab kuch RPC se; server har action par check karta hai.
// ============================================================
const G = "#D9650B", GOLD = "#D4A24C", BORDER = "#E3DECF", MUTED = "#8B8576";
const input = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const btn = (primary, disabled) => ({
  width: "100%", border: primary ? "none" : `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700,
  background: primary ? (disabled ? "#D8D2BF" : G) : "white", color: primary ? "white" : "#5C5747", cursor: disabled ? "not-allowed" : "pointer",
});
const linkBtn = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 0", fontSize: 12.5, fontWeight: 700, color: G, textDecoration: "none", background: "white" };

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const timeOf = (t) => (t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");

export default function RiderApp() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  useEffect(() => onAuthChange((u) => setUser(u || null)), []);
  const loadProfile = useCallback(async () => {
    try { setProfile(await fetchMyCentralRiderProfile()); } catch { setProfile(null); }
  }, []);
  useEffect(() => { if (user) { setProfile(undefined); loadProfile(); } else setProfile(undefined); }, [user, loadProfile]);

  if (user === undefined || (user && profile === undefined)) return <Centered><div style={{ color: MUTED }}>Load ho raha hai...</div></Centered>;
  if (!user) return <LoginCard />;
  if (!profile) return <ClaimCard onDone={loadProfile} />;
  if (!profile.login_enabled || !profile.is_active) {
    return (
      <Centered>
        <Logo />
        <div style={{ fontWeight: 700, marginTop: 14 }}>Aapka rider account band hai</div>
        <div style={{ fontSize: 12.5, color: MUTED, margin: "6px 0 16px" }}>Support se baat karein.</div>
        <div style={{ width: 200 }}><button onClick={() => signOut()} style={btn(false)}>Logout</button></div>
      </Centered>
    );
  }
  return <Home profile={profile} />;
}

function Centered({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>{children}</div>;
}
function Logo() {
  return <div style={{ width: 54, height: 54, borderRadius: 14, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Bike size={26} color="#123026" /></div>;
}

function LoginCard() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      if (mode === "login") await signIn(email.trim(), password);
      else { const r = await signUp(email.trim(), password, "/rider"); if (!r.session) setSent(true); }
    } catch (e) { setMsg(friendlyError(e)); }
    setBusy(false);
  };
  const off = busy || !email || password.length < 6;
  if (sent) {
    return (
      <Centered>
        <div style={{ width: "100%", maxWidth: 340 }}>
          <Logo />
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, margin: "12px 0 6px" }}>Email Verify Karein</div>
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}><b>{email.trim()}</b> pe confirmation link bheja hai. Inbox ke saath Spam folder bhi dekhein, phir login karein.</div>
          <div style={{ marginTop: 16 }}><button onClick={() => { setSent(false); setMode("login"); setPassword(""); }} style={btn(true, false)}>Maine confirm kar liya — Login</button></div>
        </div>
      </Centered>
    );
  }
  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Logo />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, margin: "12px 0 2px" }}>Delivery Rider Login</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 18 }}>{mode === "login" ? "Apne email aur password se login karein" : "Naya account banayein, phir support ka diya code daalein"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input style={input} type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {msg && <div style={{ fontSize: 12, color: "#B3261E" }}>{msg}</div>}
          <button disabled={off} onClick={submit} style={btn(true, off)}>{busy ? "Ruko..." : mode === "signup" ? "Account Banayein" : "Login"}</button>
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }} style={{ background: "none", border: "none", color: G, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {mode === "login" ? "Pehli baar? Naya account banayein" : "Account hai? Login karein"}
          </button>
        </div>
      </div>
    </Centered>
  );
}

function ClaimCard({ onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const submit = async () => {
    setBusy(true); setMsg("");
    try { await claimCentralRiderInvite(clean); await onDone(); }
    catch (e) { setMsg(friendlyError(e) || "Code sahi nahi hai"); }
    setBusy(false);
  };
  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Logo />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, margin: "12px 0 4px" }}>Rider Code Daalein</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Support ne jo 8-akshar ka code diya hai wo yahan daalein</div>
        <input style={{ ...input, textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase" }} maxLength={9} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" />
        {msg && <div style={{ fontSize: 12, color: "#B3261E", marginTop: 8 }}>{msg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          <button disabled={busy || clean.length < 8} onClick={submit} style={btn(true, busy || clean.length < 8)}>{busy ? "Ruko..." : "Link Karein"}</button>
          <button onClick={() => signOut()} style={btn(false)}>Logout</button>
        </div>
      </div>
    </Centered>
  );
}

function Home({ profile }) {
  const [tab, setTab] = useState("pool");
  const [pool, setPool] = useState([]);
  const [active, setActive] = useState([]);
  const [today, setToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const t0 = startOfDay(), t1 = new Date(t0.getTime() + 86400000);
      const [p, a, d] = await Promise.all([fetchCentralPool(), fetchMyCentralDeliveries("active"), fetchMyCentralDeliveries("history", t0.toISOString(), t1.toISOString())]);
      setPool(p); setActive(a); setToday(d); setErr("");
    } catch (e) { setErr(friendlyError(e)); }
    setLoading(false);
  }, []);
  const ref = useRef(refresh);
  ref.current = refresh;
  useEffect(() => {
    refresh();
    const id = setInterval(() => ref.current(), 15000);   // naya pool order jaldi dikhe
    return () => clearInterval(id);
  }, [refresh]);

  const tabs = [["pool", "Naye Orders", Inbox, pool.length], ["mine", "Meri Deliveries", ListChecks, active.length], ["history", "History", History, 0]];
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", background: "#F7F5F0" }}>
      <div style={{ background: G, color: "white", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Bike size={20} color={GOLD} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15 }}>Central Delivery</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{profile.name}</div>
        </div>
        <button onClick={() => signOut()} aria-label="Logout" style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, color: "white", padding: "7px 9px", cursor: "pointer", display: "flex" }}><LogOut size={15} /></button>
      </div>
      <div style={{ padding: "10px 14px 0" }}>
        <InstallAppButton role="rider" appName="Dukaan Rider" label="Install Rider App" helpTitle="Install Rider App" color={G} compact />
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 14px 0" }}>
        {tabs.map(([k, label, Icon, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: `1px solid ${tab === k ? G : BORDER}`, background: tab === k ? G : "white", color: tab === k ? "white" : "#5C5747", borderRadius: 10, padding: "9px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Icon size={14} /> {label}{n > 0 && <span style={{ background: tab === k ? "rgba(255,255,255,0.25)" : "#FFF4DB", color: tab === k ? "white" : "#9A6B00", borderRadius: 999, fontSize: 10.5, padding: "1px 7px" }}>{n}</span>}
          </button>
        ))}
      </div>
      {err && <div style={{ background: "#FDECEA", color: "#B3261E", padding: "10px 16px", fontSize: 12.5, margin: "10px 14px 0", borderRadius: 8 }}>{err}</div>}
      <div style={{ padding: 14 }}>
        {loading ? <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div> : (
          <>
            {tab === "pool" && (pool.length === 0 ? <Empty text="Abhi koi naya order nahi hai. Yeh screen apne aap refresh hoti rehti hai." /> :
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{pool.map((p) => <PoolCard key={p.assignment_id} p={p} onChanged={refresh} onAccepted={() => setTab("mine")} />)}</div>)}
            {tab === "mine" && (
              <>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Aaj delivered: <b>{today.length}</b></div>
                {active.length === 0 ? <Empty text="Aapke paas abhi koi delivery nahi hai" /> :
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{active.map((d) => <DeliveryCard key={d.assignment_id} d={d} onChanged={refresh} />)}</div>}
              </>
            )}
            {tab === "history" && <HistoryTab />}
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ textAlign: "center", padding: "36px 16px", color: MUTED, fontSize: 13 }}><div style={{ fontSize: 30, marginBottom: 6 }}>🏍️</div>{text}</div>;
}

export function PoolCard({ p, onChanged, onAccepted }) {
  const [busy, setBusy] = useState(false);
  const cod = Number(p.amount_to_collect) > 0;
  const ready = p.order_status === "Ready" || p.order_status === "Out for Delivery";
  const accept = async () => {
    setBusy(true);
    try { await centralAccept(p.assignment_id); await onChanged(); onAccepted(); }
    catch (e) { alert(friendlyError(e)); await onChanged(); }
    setBusy(false);
  };
  return (
    <div data-testid="pool-card" style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 13, padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}><Store size={14} /> {p.store_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{p.order_number} · {timeOf(p.requested_at)} · {p.item_count} items</div>
        </div>
        <span style={{ background: ready ? "#D5EBDD" : "#FFF4DB", color: ready ? "#1B4332" : "#9A6B00", fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{ready ? "Ready" : "Taiyaar ho raha hai"}</span>
      </div>
      <div style={{ fontSize: 12, color: "#5C5747", margin: "8px 0", display: "flex", gap: 5 }}><MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />Pickup: {p.store_address || "—"}{p.store_city ? `, ${p.store_city}` : ""}</div>
      <div style={{ fontSize: 12, color: "#5C5747", marginBottom: 8 }}>Drop ilaka (pincode): <b>{p.drop_pincode || "—"}</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cod ? "#FFF4DB" : "#E6F2E9", borderRadius: 9, padding: "8px 11px", marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: cod ? "#7A5400" : "#1B4332" }}>{cod ? "COD — Customer se lena hai" : "PAID ONLINE"}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 16, color: cod ? "#7A5400" : "#1B4332" }}>₹{cod ? p.amount_to_collect : 0}</div>
      </div>
      <button disabled={busy} onClick={accept} style={btn(true, busy)}>{busy ? "Ruko..." : "Yeh Delivery Lein (Accept)"}</button>
    </div>
  );
}

export function DeliveryCard({ d, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = DELIVERY_STATUS_META[d.status] || DELIVERY_STATUS_META.ACCEPTED;
  const next = NEXT_DELIVERY_ACTION[d.status === "ACCEPTED" ? "ACCEPTED" : d.status];
  const cod = Number(d.amount_to_collect) > 0;
  const act = async () => {
    if (d.status === "OUT_FOR_DELIVERY" && cod && !confirm(`Kya aapne ₹${d.amount_to_collect} customer se le liye? Delivered mark karein?`)) return;
    setBusy(true);
    try { await centralUpdateStatus(d.assignment_id, next.to); await onChanged(); }
    catch (e) { alert(friendlyError(e)); }
    setBusy(false);
  };
  const release = async () => {
    if (!confirm("Yeh delivery wapas pool mein bhej dein?")) return;
    setBusy(true);
    try { await centralRelease(d.assignment_id); await onChanged(); }
    catch (e) { alert(friendlyError(e)); }
    setBusy(false);
  };
  const beforePickup = d.status === "ACCEPTED";
  return (
    <div data-testid="my-card" style={{ background: "white", border: `1px solid ${BORDER}`, borderLeft: `5px solid ${meta.color}`, borderRadius: 13, padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{beforePickup ? d.store_name : d.customer_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{d.order_number} · {d.store_name}</div>
        </div>
        <span style={{ alignSelf: "flex-start", background: meta.bg, color: meta.color, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{meta.label}</span>
      </div>

      {beforePickup ? (
        <>
          <div style={{ fontSize: 12, color: "#5C5747", margin: "8px 0", display: "flex", gap: 5 }}><MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />Pehle dukaan se saman uthayein: {d.store_address || "—"}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {d.store_phone && <a href={`tel:${d.store_phone}`} style={linkBtn}><Phone size={14} /> Dukaan Call</a>}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.store_address || d.store_name)}`} target="_blank" rel="noreferrer" style={linkBtn}><Navigation size={14} /> Navigate</a>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#5C5747", margin: "8px 0", display: "flex", gap: 5 }}><MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />{d.address}{d.landmark && String(d.landmark).trim().toLowerCase() !== String(d.address || "").trim().toLowerCase() ? ` (${d.landmark})` : ""} – {d.pincode}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cod ? "#FFF4DB" : "#E6F2E9", borderRadius: 9, padding: "8px 11px", marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: cod ? "#7A5400" : "#1B4332" }}>{cod ? "Amount to Collect (COD)" : "PAID ONLINE"}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 16, color: cod ? "#7A5400" : "#1B4332" }}>₹{cod ? d.amount_to_collect : 0}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <a href={`tel:${d.customer_phone}`} style={linkBtn}><Phone size={14} /> Call</a>
            <a href={mapsUrl(d)} target="_blank" rel="noreferrer" style={linkBtn}><Navigation size={14} /> Navigate</a>
            <button onClick={() => setOpen((o) => !o)} style={{ ...linkBtn, cursor: "pointer" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detail</button>
          </div>
          {open && (
            <div style={{ background: "#F7F5F0", borderRadius: 9, padding: "9px 11px", marginBottom: 8, fontSize: 12 }}>
              {(d.items || []).map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span>{it.name}{it.variant ? ` (${it.variant})` : ""}</span><span>{it.qty}{it.unit}</span></div>)}
              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Total · {d.payment_method}</span><span>₹{d.total}</span></div>
            </div>
          )}
        </>
      )}
      {next && <button disabled={busy} onClick={act} style={btn(true, busy)}>{busy ? "Ruko..." : next.label}</button>}
      {beforePickup && <button disabled={busy} onClick={release} style={{ ...btn(false), marginTop: 8 }}>Wapas Pool Mein Bhejein</button>}
    </div>
  );
}

function HistoryTab() {
  const [f, setF] = useState("today");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    const t0 = startOfDay(), day = 86400000;
    let a, b = new Date(t0.getTime() + day);
    if (f === "today") a = t0;
    else if (f === "yesterday") { a = new Date(t0.getTime() - day); b = t0; }
    else if (f === "week") { a = new Date(t0); a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); }
    else a = new Date(t0.getFullYear(), t0.getMonth(), 1);
    fetchMyCentralDeliveries("history", a.toISOString(), b.toISOString()).then(setRows).catch(() => setRows([]));
  }, [f]);
  const cod = (rows || []).reduce((s, r) => s + Number(r.cod_collected || 0), 0);
  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {[["today", "Aaj"], ["yesterday", "Kal"], ["week", "Is Hafte"], ["month", "Is Mahine"]].map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} style={{ border: `1px solid ${f === k ? G : BORDER}`, background: f === k ? G : "white", color: f === k ? "white" : "#5C5747", borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {rows === null ? <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div> : rows.length === 0 ? <Empty text="Is period mein koi delivery nahi" /> : (
        <>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{rows.length} deliveries · COD collected ₹{cod}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((d) => (
              <div key={d.assignment_id} style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 11, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>{d.store_name}</span><span>₹{d.total}</span></div>
                <div style={{ fontSize: 11, color: MUTED }}>{d.order_number} · {new Date(d.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {d.payment_method}{Number(d.cod_collected) > 0 ? ` · COD ₹${d.cod_collected}` : ""}</div>
                <div style={{ fontSize: 11, color: "#1B4332", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12} /> Delivered</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
