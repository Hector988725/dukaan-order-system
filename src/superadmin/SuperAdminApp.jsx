import React, { useState, useEffect } from "react";
import { Loader2, ShieldCheck, LogOut, Mail, Lock, Store, Package, TrendingUp, Users, CreditCard, X, Eye, EyeOff } from "lucide-react";
import { signIn, signOut, onAuthChange } from "../lib/api";
import {
  checkIsSuperAdmin, fetchDashboardStats, fetchAllStoresAdmin, fetchStoreOrders,
  adminActivateStore, adminDeactivateStore, adminExtendSubscription, adminDeleteStore,
  fetchAllOrdersAdmin, fetchAllPaymentsAdmin, fetchAnalytics,
} from "./api";

// ============================================================
// ROOT — login gate, phir authorization check, phir dashboard
// ============================================================
export default function SuperAdminApp() {
  const [user, setUser] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null); // null = checking, true/false = result

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => setUser(u));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setIsAdmin(null); return; }
    checkIsSuperAdmin(user.email).then(setIsAdmin);
  }, [user]);

  if (user === undefined) return <CenterMsg text="Check ho raha hai..." />;
  if (!user) return <SuperAdminLogin onAuthed={setUser} />;
  if (isAdmin === null) return <CenterMsg text="Verify ho raha hai..." />;
  if (isAdmin === false) {
    return (
      <CenterMsg>
        <ShieldCheck size={32} color="#B3261E" style={{ marginBottom: "10px" }} />
        <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>Access Nahi Hai</div>
        <div style={{ fontSize: "12.5px", color: "#8B8576", marginBottom: "16px" }}>Yeh email ({user.email}) super admin list mein nahi hai.</div>
        <button onClick={() => signOut()} style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 20px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>Logout</button>
      </CenterMsg>
    );
  }

  return <SuperAdminDashboard user={user} />;
}

function CenterMsg({ text, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px" }}>
      {text ? <div style={{ fontSize: "13px", color: "#5C5747" }}>{text}</div> : children}
    </div>
  );
}

function SuperAdminLogin({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await signIn(email, password);
      onAuthed(data.user);
    } catch (e) {
      setError("Email ya password galat hai.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "360px", margin: "80px auto", padding: "0 18px" }}>
      <div style={{ textAlign: "center", marginBottom: "22px" }}>
        <div style={{ width: 50, height: 50, borderRadius: "12px", background: "#1B4332", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <ShieldCheck size={24} color="white" />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "18px" }}>Super Admin</div>
      </div>
      <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px" }}>
          <Mail size={15} color="#8B8576" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ border: "none", outline: "none", fontSize: "13px", width: "100%" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px" }}>
          <Lock size={15} color="#8B8576" />
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={{ border: "none", outline: "none", fontSize: "13px", width: "100%" }} />
          <button onClick={() => setShow((s) => !s)} style={{ border: "none", background: "none", cursor: "pointer", color: "#8B8576", display: "flex" }}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
        {error && <div style={{ color: "#B3261E", fontSize: "12px" }}>{error}</div>}
        <button onClick={handleLogin} disabled={!email || !password || loading} style={{ background: email && password ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontWeight: 700, fontSize: "13px", cursor: email && password ? "pointer" : "not-allowed" }}>
          {loading ? "..." : "Login"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function SuperAdminDashboard({ user }) {
  const [tab, setTab] = useState("overview");

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0" }}>
      <div style={{ background: "#1B4332", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldCheck size={20} color="#D4A24C" />
          <div style={{ color: "white", fontWeight: 700, fontSize: "14.5px", fontFamily: "'Fraunces', serif" }}>Super Admin</div>
        </div>
        <button onClick={() => signOut()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", padding: "6px 12px", color: "white", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
          <LogOut size={13} /> Logout
        </button>
      </div>

      <div style={{ display: "flex", gap: "4px", padding: "12px 20px 0", overflowX: "auto" }}>
        {[
          { id: "overview", label: "Overview", icon: <TrendingUp size={14} /> },
          { id: "stores", label: "Stores", icon: <Store size={14} /> },
          { id: "orders", label: "Orders", icon: <Package size={14} /> },
          { id: "payments", label: "Payments", icon: <CreditCard size={14} /> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", fontSize: "12.5px", fontWeight: 700,
            border: "none", cursor: "pointer", borderRadius: "9px 9px 0 0", flexShrink: 0,
            color: tab === t.id ? "#1B4332" : "#8B8576", background: tab === t.id ? "white" : "transparent",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 20px 40px", maxWidth: "1000px", margin: "0 auto" }}>
        {tab === "overview" && <OverviewTab />}
        {tab === "stores" && <StoresTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "payments" && <PaymentsTab />}
      </div>
    </div>
  );
}

// ---- OVERVIEW ----
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboardStats(), fetchAnalytics()])
      .then(([s, a]) => { setStats(s); setAnalytics(a); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: "#8B8576", fontSize: "13px" }}>Load ho raha hai...</div>;

  const cards = [
    { label: "Total Stores", value: stats.totalStores, color: "#1B4332" },
    { label: "Active Stores", value: stats.activeStores, color: "#1B4332" },
    { label: "Expired/Unpaid", value: stats.expiredStores, color: "#B3261E" },
    { label: "Naye Aaj", value: stats.newStoresToday, color: "#8A6A0F" },
    { label: "Total Orders", value: stats.totalOrders, color: "#22314F" },
    { label: "Total Revenue", value: `₹${stats.totalRevenue}`, color: "#1B4332" },
  ];

  const maxReg = Math.max(1, ...analytics.dailyRegistrations.map((d) => d.count));
  const maxRev = Math.max(1, ...analytics.dailyRevenue.map((d) => d.amount));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: 600, color: "#8B8576", marginBottom: "6px" }}>{c.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: c.color, fontFamily: "'Fraunces', serif" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <MiniBarChart title="Pichle 30 din — Naye Signups" data={analytics.dailyRegistrations.map((d) => d.count)} max={maxReg} color="#1B4332" />
        <MiniBarChart title="Pichle 30 din — Revenue (₹)" data={analytics.dailyRevenue.map((d) => d.amount)} max={maxRev} color="#D4A24C" />
      </div>
    </div>
  );
}

function MiniBarChart({ title, data, max, color }) {
  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px" }}>
      <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#5C5747", marginBottom: "10px" }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "60px" }}>
        {data.map((v, i) => (
          <div key={i} title={String(v)} style={{ flex: 1, height: `${Math.max(2, (v / max) * 100)}%`, background: color, borderRadius: "2px 2px 0 0", opacity: v === 0 ? 0.15 : 1 }} />
        ))}
      </div>
    </div>
  );
}

// ---- STORES ----
function StoresTab() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedOrders, setExpandedOrders] = useState(null);
  const [ordersForStore, setOrdersForStore] = useState([]);

  const load = () => { setLoading(true); fetchAllStoresAdmin().then(setStores).finally(() => setLoading(false)); };
  useEffect(load, []);

  const filtered = stores.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.slug?.toLowerCase().includes(search.toLowerCase()));

  const handleActivate = async (id) => { await adminActivateStore(id); load(); };
  const handleDeactivate = async (id) => { if (confirm("Is dukaan ko deactivate karein?")) { await adminDeactivateStore(id); load(); } };
  const handleExtend = async (id, months) => { await adminExtendSubscription(id, months); load(); };
  const handleDelete = async (id, name) => { if (confirm(`"${name}" ko HAMESHA ke liye delete karein? Yeh wapas nahi hoga.`)) { await adminDeleteStore(id); load(); } };
  const toggleOrders = async (id) => {
    if (expandedOrders === id) { setExpandedOrders(null); return; }
    const orders = await fetchStoreOrders(id);
    setOrdersForStore(orders);
    setExpandedOrders(id);
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: "#8B8576", fontSize: "13px" }}>Load ho raha hai...</div>;

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Naam ya link se dhoondein..." style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid #E3DECF", fontSize: "13px", marginBottom: "14px" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map((s) => {
          const isActive = s.is_active && s.subscription_expires_at && new Date(s.subscription_expires_at) > new Date();
          return (
            <div key={s.id} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "13px 15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{s.name} <span style={{ fontWeight: 400, fontSize: "11px", color: "#8B8576" }}>/{s.slug}</span></div>
                  <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "2px" }}>
                    {s.owner_email || "—"} · {s.business_type} · {s.total_orders ?? "?"} orders · ₹{s.total_revenue ?? "?"} revenue
                  </div>
                  <div style={{ fontSize: "10.5px", color: isActive ? "#1B4332" : "#B3261E", fontWeight: 700, marginTop: "4px" }}>
                    {isActive ? `✓ Active — ${new Date(s.subscription_expires_at).toLocaleDateString("en-IN")} tak` : "✕ Inactive / Unpaid"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button onClick={() => toggleOrders(s.id)} style={smallBtnStyle}>Orders</button>
                  {isActive ? (
                    <button onClick={() => handleDeactivate(s.id)} style={{ ...smallBtnStyle, color: "#B3261E", borderColor: "#F3C6C1" }}>Deactivate</button>
                  ) : (
                    <button onClick={() => handleActivate(s.id)} style={{ ...smallBtnStyle, background: "#1B4332", color: "white" }}>Activate (1 mahina)</button>
                  )}
                  <button onClick={() => handleExtend(s.id, 1)} style={smallBtnStyle}>+1 mahina</button>
                  <button onClick={() => handleDelete(s.id, s.name)} style={{ ...smallBtnStyle, color: "#B3261E", borderColor: "#F3C6C1" }}>Delete</button>
                </div>
              </div>
              {expandedOrders === s.id && (
                <div style={{ marginTop: "10px", borderTop: "1px solid #E3DECF", paddingTop: "10px" }}>
                  {ordersForStore.length === 0 ? (
                    <div style={{ fontSize: "11.5px", color: "#8B8576" }}>Koi order nahi.</div>
                  ) : ordersForStore.map((o) => (
                    <div key={o.id} style={{ fontSize: "11.5px", color: "#5C5747", padding: "4px 0" }}>
                      {o.order_number} — {o.customer_name} — ₹{o.total} — {o.status}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "30px", color: "#8B8576", fontSize: "12.5px" }}>Koi dukaan nahi mili.</div>}
      </div>
    </div>
  );
}

const smallBtnStyle = { padding: "6px 11px", borderRadius: "7px", border: "1px solid #E3DECF", background: "white", color: "#5C5747", fontSize: "11px", fontWeight: 700, cursor: "pointer" };

// ---- ORDERS ----
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAllOrdersAdmin().then(setOrders).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: "#8B8576", fontSize: "13px" }}>Load ho raha hai...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {orders.map((o) => (
        <div key={o.id} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "11px 14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "12.5px" }}>{o.order_number} — {o.customer_name}</div>
            <div style={{ fontSize: "11px", color: "#8B8576" }}>{o.stores?.name || "—"} ({o.stores?.slug}) · {new Date(o.created_at).toLocaleString("en-IN")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>₹{o.total}</div>
            <div style={{ fontSize: "10.5px", color: "#8B8576" }}>{o.status} · {o.payment_method}</div>
          </div>
        </div>
      ))}
      {orders.length === 0 && <div style={{ textAlign: "center", padding: "30px", color: "#8B8576", fontSize: "12.5px" }}>Koi order nahi.</div>}
    </div>
  );
}

// ---- PAYMENTS ----
function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAllPaymentsAdmin().then(setPayments).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: "#8B8576", fontSize: "13px" }}>Load ho raha hai...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {payments.map((p) => (
        <div key={p.id} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "11px 14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "12.5px" }}>{p.stores?.name || "—"} <span style={{ fontWeight: 400, color: "#8B8576" }}>/{p.stores?.slug}</span></div>
            <div style={{ fontSize: "11px", color: "#8B8576" }}>{p.months} mahina · {new Date(p.created_at).toLocaleString("en-IN")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>₹{p.amount}</div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: p.status === "paid" ? "#1B4332" : "#B3261E" }}>{p.status}</div>
          </div>
        </div>
      ))}
      {payments.length === 0 && <div style={{ textAlign: "center", padding: "30px", color: "#8B8576", fontSize: "12.5px" }}>Koi payment record nahi (payment_logs table shayad khaali hai).</div>}
    </div>
  );
}
