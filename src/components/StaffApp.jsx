import React, { useState, useEffect, useCallback, useRef } from "react";
import { Users, LogOut, Package, ShoppingBag, Phone, MapPin, Bike } from "lucide-react";
import { DeliveryHome } from "./DeliveryHome";
import {
  signIn, signUp, signOut, onAuthChange, staffEmailFromPhone,
  claimShopStaffInvite, fetchMyStaffContext, staffFetchOrders, setOrderStatusRpc, confirmOrderPaymentRpc,
  fetchMyDeliveryProfile, fetchProducts, updateVariantStock, setVariantPriceRpc, setProductAvailabilityRpc,
} from "../lib/api";

// ============================================================
// SHOP STAFF APP (/staff) — mobile-first, limited. Sab kuch RPC se; server
// har action par permission check karta hai. Yahan ke buttons sirf UI hain.
// ============================================================
const G = "#1B4332", GOLD = "#D4A24C", BORDER = "#E3DECF", MUTED = "#8B8576";
const input = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const btn = (primary, disabled) => ({ width: "100%", border: primary ? "none" : `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, background: primary ? (disabled ? "#D8D2BF" : G) : "white", color: primary ? "white" : "#5C5747", cursor: disabled ? "not-allowed" : "pointer" });

const STAGES = ["New", "Accepted", "Preparing", "Ready", "Out for Delivery", "Delivered"];
const LABEL = { New: "Naya Order", Accepted: "Accepted", Preparing: "Packing", Ready: "Ready", "Out for Delivery": "Out for Delivery", Delivered: "Delivered" };
const COLOR = { New: ["#B3261E", "#FDECEA"], Accepted: ["#9A6B00", "#FFF4DB"], Preparing: ["#9A6B00", "#FFF4DB"], Ready: [G, "#E7F0EA"], "Out for Delivery": [G, "#E7F0EA"], Delivered: [G, "#E7F0EA"] };
const noDelivery = (o) => o.order_type === "Pickup" || o.order_type === "Appointment" || o.order_type === "Dine In";
function nextStatus(o) {
  const map = { New: "Accepted", Accepted: "Preparing", Preparing: "Ready", Ready: noDelivery(o) ? "Delivered" : "Out for Delivery", "Out for Delivery": "Delivered" };
  return map[o.status] || null;
}
const NEXT_LABEL = { Accepted: "Order Accept karein", Preparing: "Packing Shuru Karein", Ready: "Ready Mark Karein", "Out for Delivery": "Out for Delivery Mark Karein", Delivered: "Delivered Mark Karein" };

export default function StaffApp() {
  const [user, setUser] = useState(undefined);
  const [ctx, setCtx] = useState(undefined);
  useEffect(() => onAuthChange((u) => setUser(u || null)), []);
  const loadCtx = useCallback(async () => {
    try { setCtx(await fetchMyStaffContext()); } catch { setCtx(null); }
  }, []);
  useEffect(() => { if (user) { setCtx(undefined); loadCtx(); } else setCtx(undefined); }, [user, loadCtx]);

  if (user === undefined || (user && ctx === undefined)) return <Centered><div style={{ color: MUTED }}>Load ho raha hai...</div></Centered>;
  if (!user) return <LoginCard />;
  if (!ctx) return <ClaimCard onDone={loadCtx} />;
  if (!ctx.is_active) return <Blocked title="Aapka account band hai" text={`Dukaandar (${ctx.store_name}) se baat karein.`} />;
  if (!ctx.store_active) return <Blocked title="Dukaan ka plan expire ho gaya hai" text={`Dukaandar (${ctx.store_name}) plan renew karenge tab staff app chalu hoga.`} />;
  return <Home ctx={ctx} />;
}

function Centered({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>{children}</div>;
}
function Logo() {
  return <div style={{ width: 54, height: 54, borderRadius: 14, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Users size={26} color="#123026" /></div>;
}
function Blocked({ title, text }) {
  return <Centered><Logo /><div style={{ fontWeight: 700, marginTop: 14 }}>{title}</div><div style={{ fontSize: 12.5, color: MUTED, margin: "6px 0 16px" }}>{text}</div><div style={{ width: 200 }}><button onClick={() => signOut()} style={btn(false)}>Logout</button></div></Centered>;
}

function LoginCard() {
  // Default: mobile + password (dukaandar ne diya). Email wala tareeka neeche se.
  const [method, setMethod] = useState("mobile"); // mobile | email
  const [mode, setMode] = useState("login");      // email method me: login | signup
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const isMobile = method === "mobile";
  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      if (isMobile) {
        // dukaandar ka diya password hamesha bade akshar + bina dash ke hota hai
        await signIn(staffEmailFromPhone(phone), password.replace(/[\s-]/g, "").toUpperCase());
      } else if (mode === "login") await signIn(email.trim(), password);
      else { const r = await signUp(email.trim(), password, "/staff"); if (!r.session) setMsg("Email par confirmation link bheja gaya hai. Confirm karke login karein."); }
    } catch (e) {
      const m = String(e.message || "");
      setMsg(isMobile && /invalid login/i.test(m) ? "Mobile number ya password galat hai. Dukaandar se poochein." : m || "Kuch gadbad hui");
    }
    setBusy(false);
  };
  const off = busy || (isMobile ? phone.length !== 10 || password.replace(/[\s-]/g, "").length < 6 : !email || password.length < 6);
  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Logo />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, margin: "12px 0 2px" }}>Staff Login</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 18 }}>
          {isMobile ? "Dukaandar ne jo mobile number aur password diya hai wo daalein" : mode === "login" ? "Apne email aur password se login karein" : "Naya account banayein, phir dukaandar ka code daalein"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          {isMobile ? (
            <>
              <input style={input} type="tel" inputMode="numeric" placeholder="Mobile number (10 digit)" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="username" />
              <input style={{ ...input, textTransform: "uppercase", letterSpacing: 1 }} type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="Password (jaise K7M2-9QXP)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </>
          ) : (
            <>
              <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <input style={input} type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </>
          )}
          {msg && <div style={{ fontSize: 12, color: "#B3261E" }}>{msg}</div>}
          <button disabled={off} onClick={submit} style={btn(true, off)}>{busy ? "Ruko..." : !isMobile && mode === "signup" ? "Account Banayein" : "Login"}</button>
          {!isMobile && (
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }} style={{ background: "none", border: "none", color: G, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              {mode === "login" ? "Pehli baar? Naya account banayein" : "Account hai? Login karein"}
            </button>
          )}
          <button onClick={() => { setMethod(isMobile ? "email" : "mobile"); setMsg(""); setPassword(""); setMode("login"); }} style={{ background: "none", border: "none", color: MUTED, fontSize: 12, cursor: "pointer" }}>
            {isMobile ? "Email se login karna hai?" : "Mobile + password se login karein"}
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
    try { await claimShopStaffInvite(clean); await onDone(); }
    catch (e) { setMsg(e.message || "Code sahi nahi hai"); }
    setBusy(false);
  };
  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Logo />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, margin: "12px 0 4px" }}>Dukaan Code Daalein</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Dukaandar ne jo 8-akshar ka code diya hai wo yahan daalein</div>
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

function Home({ ctx }) {
  const perms = ctx.permissions || {};
  const canOrders = !!perms.orders_status;
  const canProducts = !!(perms.stock_update || perms.price_update);
  const canDelivery = !!perms.delivery;
  const [tab, setTab] = useState(canOrders ? "orders" : canProducts ? "products" : "delivery");
  const tabs = [
    canOrders && ["orders", "Orders", <ShoppingBag size={18} key="o" />],
    canProducts && ["products", "Products", <Package size={18} key="p" />],
    canDelivery && ["delivery", "Delivery", <Bike size={18} key="d" />],
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#FAF8F2", paddingBottom: 76 }}>
      <div style={{ background: G, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, color: "white", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={18} color="#123026" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{ctx.staff_name}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{ctx.store_name}</div>
        </div>
        <button onClick={() => signOut()} aria-label="Logout" style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 36, height: 36, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><LogOut size={16} /></button>
      </div>
      <div style={{ padding: "14px 14px 0" }}>
        {tabs.length === 0 && <div style={{ textAlign: "center", padding: 40, color: MUTED, fontSize: 13 }}>Abhi aapko koi kaam allow nahi hai. Dukaandar se baat karein.</div>}
        {tab === "orders" && canOrders && <OrdersTab ctx={ctx} canPay={!!perms.payment_verify} />}
        {tab === "delivery" && canDelivery && <DeliveryTab />}
        {tab === "products" && canProducts && <ProductsTab ctx={ctx} canStock={!!perms.stock_update} canPrice={!!perms.price_update} />}
      </div>
      {tabs.length > 1 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "center", zIndex: 6 }}>
          <div style={{ display: "flex", width: "100%", maxWidth: 480 }}>
            {tabs.map(([id, label, icon]) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0 12px", border: "none", background: "none", color: tab === id ? G : MUTED, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>{icon}{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ ctx, canPay }) {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("active");
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setOrders(await staffFetchOrders(ctx.store_id, 60)); setErr(""); }
    catch (e) { setErr(e.message || "Orders load nahi hue"); setOrders((o) => o || []); }
  }, [ctx.store_id]);
  const ref = useRef(load); ref.current = load;
  useEffect(() => { load(); const t = setInterval(() => ref.current(), 15000); return () => clearInterval(t); }, [load]);

  const list = (orders || []).filter((o) => (filter === "active" ? o.status !== "Delivered" : o.status === "Delivered"));
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["active", "Chalu Orders"], ["done", "Delivered"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ border: `1px solid ${filter === k ? G : BORDER}`, background: filter === k ? G : "white", color: filter === k ? "white" : "#5C5747", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {err && <div style={{ background: "#FDECEA", color: "#B3261E", borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 10 }}>{err}</div>}
      {orders === null ? <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div>
        : list.length === 0 ? <div style={{ textAlign: "center", padding: "36px 16px", color: MUTED, fontSize: 13 }}>Koi order nahi</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{list.map((o) => <OrderCard key={o.id} o={o} canPay={canPay} onChanged={load} />)}</div>}
    </>
  );
}

function OrderCard({ o, canPay, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [c, bg] = COLOR[o.status] || COLOR.New;
  const next = nextStatus(o);
  const needsPay = canPay && o.payment_method === "UPI" && o.payment_status === "Pending Verification";
  const run = async (fn) => { setBusy(true); try { await fn(); await onChanged(); } catch (e) { alert(e.message); } setBusy(false); };
  const items = Array.isArray(o.items) ? o.items : [];
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderLeft: `5px solid ${c}`, borderRadius: 13, padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{o.customer_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{o.order_number} · {new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <span style={{ alignSelf: "flex-start", background: bg, color: c, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{LABEL[o.status] || o.status}</span>
      </div>
      <div style={{ fontSize: 12.5, margin: "8px 0", color: "#5C5747" }}>
        {items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><span>{it.name}{it.variant ? ` (${it.variant})` : ""}</span><span>{it.qty}{it.unit}</span></div>)}
        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 5, paddingTop: 5, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{o.order_type} · {o.payment_method}</span><span>₹{o.total}</span></div>
      </div>
      {o.order_type === "Delivery" && o.address && <div style={{ fontSize: 11.5, color: "#5C5747", display: "flex", gap: 5, marginBottom: 6 }}><MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />{o.address}</div>}
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Payment: {o.payment_status}</div>
      {o.customer_phone && <a href={`tel:${o.customer_phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: G, textDecoration: "none", marginBottom: 8 }}><Phone size={14} /> {o.customer_phone}</a>}
      {needsPay && <button disabled={busy} onClick={() => run(() => confirmOrderPaymentRpc(o.id))} style={{ ...btn(false), marginBottom: 8, borderColor: GOLD, color: "#7A5400", background: "#FFF4DB" }}>UPI Payment Aa Gaya — Confirm Karein</button>}
      {next && <button disabled={busy} onClick={() => run(() => setOrderStatusRpc(o.id, next))} style={btn(true, busy)}>{busy ? "Ruko..." : NEXT_LABEL[next]}</button>}
    </div>
  );
}

function ProductsTab({ ctx, canStock, canPrice }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    try { setProducts(await fetchProducts(ctx.store_id)); } catch { setProducts((p) => p || []); }
  }, [ctx.store_id]);
  useEffect(() => { load(); }, [load]);
  const list = (products || []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <input style={{ ...input, marginBottom: 12 }} placeholder="Product dhundhein..." value={q} onChange={(e) => setQ(e.target.value)} />
      {products === null ? <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div>
        : list.length === 0 ? <div style={{ textAlign: "center", padding: 30, color: MUTED, fontSize: 13 }}>Koi product nahi</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{list.map((p) => <ProductRow key={p.id} p={p} canStock={canStock} canPrice={canPrice} onChanged={load} />)}</div>}
    </>
  );
}

function ProductRow({ p, canStock, canPrice, onChanged }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); await onChanged(); } catch (e) { alert(e.message); } setBusy(false); };
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 13, padding: "12px 13px", opacity: p.is_available ? 1 : 0.7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
        {canStock && (
          <button disabled={busy} onClick={() => run(() => setProductAvailabilityRpc(p.id, !p.is_available))} style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, border: "none", cursor: "pointer", background: p.is_available ? "#E7F0EA" : "#F0EEE6", color: p.is_available ? G : MUTED }}>
            {p.is_available ? "Available" : "Unavailable"}
          </button>
        )}
      </div>
      {(p.variants || []).map((v) => <VariantRow key={v.id} v={v} canStock={canStock} canPrice={canPrice} onChanged={onChanged} />)}
    </div>
  );
}

function VariantRow({ v, canStock, canPrice, onChanged }) {
  const [stock, setStock] = useState(String(v.stock ?? ""));
  const [price, setPrice] = useState(String(v.price ?? ""));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setStock(String(v.stock ?? "")); setPrice(String(v.price ?? "")); }, [v.stock, v.price]);
  const save = async () => {
    setBusy(true);
    try {
      if (canStock && Number(stock) !== Number(v.stock)) await updateVariantStock(v.id, Number(stock));
      if (canPrice && Number(price) !== Number(v.price)) await setVariantPriceRpc(v.id, Number(price));
      await onChanged();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };
  const dirty = (canStock && Number(stock) !== Number(v.stock)) || (canPrice && Number(price) !== Number(v.price));
  const small = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 9px", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 0", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1.2, minWidth: 0, fontSize: 12, fontWeight: 600 }}>{v.label || v.name || v.unit || "Default"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: MUTED }}>Price ₹</div>
        <input style={small} inputMode="decimal" disabled={!canPrice} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: MUTED }}>Stock</div>
        <input style={small} inputMode="numeric" disabled={!canStock} value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} />
      </div>
      <button disabled={!dirty || busy} onClick={save} style={{ border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, background: dirty ? G : "#D8D2BF", color: "white", cursor: dirty ? "pointer" : "not-allowed" }}>{busy ? "..." : "Save"}</button>
    </div>
  );
}

function DeliveryTab() {
  const [profile, setProfile] = useState(undefined);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetchMyDeliveryProfile().then((p) => setProfile(p || null)).catch((e) => { setErr(e.message || ""); setProfile(null); });
  }, []);
  if (profile === undefined) return <div style={{ color: MUTED, fontSize: 13 }}>Load ho raha hai...</div>;
  if (!profile || !profile.login_enabled || !profile.is_active) {
    return <div style={{ textAlign: "center", padding: "36px 16px", color: MUTED, fontSize: 13 }}>Delivery abhi chalu nahi hui. {err || "Thodi der baad dobara kholein ya dukaandar se baat karein."}</div>;
  }
  return <DeliveryHome profile={profile} />;
}
