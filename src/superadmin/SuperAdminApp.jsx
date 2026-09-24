import React, { useState, useEffect } from "react";
import { Loader2, ShieldCheck, LogOut, Mail, Lock, Store, Package, TrendingUp, Users, CreditCard, X, Eye, EyeOff, Plus, Copy, Check } from "lucide-react";
import { signIn, signOut, onAuthChange } from "../lib/api";
import {
  checkIsSuperAdmin, fetchDashboardStats, fetchAllStoresAdmin, fetchStoreOrders,
  adminActivateStore, adminDeactivateStore, adminExtendSubscription, adminDeleteStore,
  fetchAllOrdersAdmin, fetchAllPaymentsAdmin, fetchAnalytics,
  fetchDistributorsOverview, createDistributor, runMonthlyCommission, markCommissionPaid,
  fetchCommissionTiers, updateCommissionTier, setDistributorType,
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
          { id: "distributors", label: "Distributors", icon: <Users size={14} /> },
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
        {tab === "distributors" && <DistributorsTab />}
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

// ---- DISTRIBUTORS ----
function DistributorsTab() {
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [editingType, setEditingType] = useState(null); // distributor_id jiska Special-toggle khula hai

  const handleMarkPaid = async (d) => {
    if (!confirm(`Confirm karein: ${d.name} ko ₹${d.pending_payout} UPI se bhej diya hai?`)) return;
    setMarkingPaid(d.distributor_id);
    try {
      await markCommissionPaid(d.distributor_id);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setMarkingPaid(null);
    }
  };

  const load = () => { setLoading(true); fetchDistributorsOverview().then(setDistributors).catch((e) => alert(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleRunCommission = async () => {
    if (!confirm("Is mahine ka commission calculate karein? Sirf ek baar mahine mein chalayein.")) return;
    setRunning(true);
    setRunMsg("");
    try {
      const count = await runMonthlyCommission();
      setRunMsg(`✓ ${count} shop(s) ke liye commission calculate ho gaya.`);
      load();
    } catch (e) {
      setRunMsg("Error: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const referralLink = (code) => `${window.location.origin}/dop-partner/${code}`;
  const handleCopy = (code) => {
    navigator.clipboard.writeText(referralLink(code));
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: "#8B8576", fontSize: "13px" }}>Load ho raha hai...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShowAddForm((s) => !s)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "9px 14px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
            <Plus size={14} /> Naya Distributor Add Karein
          </button>
          <button onClick={() => setShowTiers((s) => !s)} style={smallBtnStyle}>
            {showTiers ? "Tiers Band Karein" : "Commission Tiers Dekhein"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {runMsg && <span style={{ fontSize: "11px", color: runMsg.startsWith("Error") ? "#B3261E" : "#1B4332", fontWeight: 600 }}>{runMsg}</span>}
          <button onClick={handleRunCommission} disabled={running} style={smallBtnStyle}>
            {running ? "Calculate ho raha hai..." : "Is Mahine Ka Commission Run Karein"}
          </button>
        </div>
      </div>

      {showTiers && <CommissionTiersPanel />}
      {showAddForm && <AddDistributorForm onDone={() => { setShowAddForm(false); load(); }} onCancel={() => setShowAddForm(false)} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {distributors.map((d) => (
          <div key={d.distributor_id} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "13px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {d.name} <span style={{ fontWeight: 400, fontSize: "11px", color: "#8B8576" }}>· {d.phone}</span>
                  {d.distributor_type === "special" && (
                    <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#9A6B00", background: "#FFF4DB", padding: "2px 7px", borderRadius: "5px" }}>SPECIAL</span>
                  )}
                  {d.nominee_eligible && (
                    <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1B4332", background: "#E7F0EA", padding: "2px 7px", borderRadius: "5px" }} title="500+ active-paid shops — nominee register kar sakte hain">Nominee Eligible</span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "2px" }}>
                  ₹{d.current_rate}/month per shop {d.distributor_type === "normal" ? "(current tier)" : "(fixed rate)"} · {d.status}
                </div>
                <div style={{ fontSize: "11px", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <code style={{ background: "#F7F5F0", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>{d.referral_code}</code>
                  <button onClick={() => handleCopy(d.referral_code)} style={{ display: "flex", alignItems: "center", gap: "4px", border: "1px solid #E3DECF", background: "white", borderRadius: "6px", padding: "3px 8px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", color: "#5C5747" }}>
                    {copiedCode === d.referral_code ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Link Copy Karein</>}
                  </button>
                  <button onClick={() => setEditingType(editingType === d.distributor_id ? null : d.distributor_id)} style={{ border: "1px solid #E3DECF", background: "white", borderRadius: "6px", padding: "3px 8px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", color: "#5C5747" }}>
                    {d.distributor_type === "special" ? "Rate Badlein" : "Special Mark Karein"}
                  </button>
                </div>
                {editingType === d.distributor_id && (
                  <SpecialTypeEditor distributor={d} onDone={() => { setEditingType(null); load(); }} onCancel={() => setEditingType(null)} />
                )}
              </div>
              <div style={{ display: "flex", gap: "16px", textAlign: "center", alignItems: "center" }}>
                <Stat label="Referred" value={d.total_referred} />
                <Stat label="Active" value={d.active_paid} color="#1B4332" />
                <Stat label="Is Mahine" value={`₹${d.this_month_commission}`} />
                <Stat label="Pending" value={`₹${d.pending_payout}`} color="#B3261E" />
                {Number(d.pending_payout) > 0 && (
                  <button onClick={() => handleMarkPaid(d)} disabled={markingPaid === d.distributor_id} style={{ ...smallBtnStyle, whiteSpace: "nowrap" }}>
                    {markingPaid === d.distributor_id ? "..." : "UPI se Bhej Diya — Mark Paid"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {distributors.length === 0 && <div style={{ textAlign: "center", padding: "30px", color: "#8B8576", fontSize: "12.5px" }}>Koi distributor nahi hai abhi.</div>}
      </div>
    </div>
  );
}

// Normal ↔ Special toggle karna, aur Special ho to custom rate set karna
function SpecialTypeEditor({ distributor, onDone, onCancel }) {
  const [type, setType] = useState(distributor.distributor_type);
  const [rate, setRate] = useState(distributor.distributor_type === "special" ? String(distributor.commission_rate) : "100");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (type === "special" && !rate) { setError("Rate daalein."); return; }
    setError("");
    setSaving(true);
    try {
      await setDistributorType(distributor.distributor_id, type, type === "special" ? Number(rate) : null);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: "10px", background: "#F7F5F0", borderRadius: "9px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => setType("normal")} style={{ flex: 1, padding: "7px 0", borderRadius: "7px", border: type === "normal" ? "1.5px solid #1B4332" : "1px solid #E3DECF", background: type === "normal" ? "white" : "transparent", fontWeight: 700, fontSize: "11.5px", cursor: "pointer" }}>Normal (Tier-based)</button>
        <button onClick={() => setType("special")} style={{ flex: 1, padding: "7px 0", borderRadius: "7px", border: type === "special" ? "1.5px solid #9A6B00" : "1px solid #E3DECF", background: type === "special" ? "white" : "transparent", fontWeight: 700, fontSize: "11.5px", cursor: "pointer" }}>Special (Fixed rate)</button>
      </div>
      {type === "special" && (
        <input value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))} placeholder="₹/shop/month" style={{ border: "1px solid #E3DECF", borderRadius: "7px", padding: "7px 10px", fontSize: "12px", outline: "none" }} />
      )}
      {error && <div style={{ color: "#B3261E", fontSize: "11px" }}>{error}</div>}
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, cursor: "pointer", color: "#5C5747" }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>{saving ? "..." : "Save"}</button>
      </div>
    </div>
  );
}

// Commission tiers ki current list — rate editable (min/max shops fixed
// hain jaisa decide hua tha, sirf rate admin badal sakta hai)
function CommissionTiersPanel() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editRate, setEditRate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); fetchCommissionTiers().then(setTiers).catch((e) => alert(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleSave = async (id) => {
    setSaving(true);
    try {
      await updateCommissionTier(id, Number(editRate));
      setEditingId(null);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px 16px", marginBottom: "14px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>Commission Tiers (Normal Distributors)</div>
      <div style={{ fontSize: "10.5px", color: "#8B8576", marginBottom: "10px" }}>
        Jab distributor ki total active-paid shops kisi tier mein aati hain, WAHI rate SAARI shops par lagu hoti hai (sirf upar wali shops par nahi).
      </div>
      {tiers.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #F0EBDC" }}>
          <div style={{ fontSize: "12.5px" }}>{t.min_shops} – {t.max_shops ?? "∞"} shops</div>
          {editingId === t.id ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input value={editRate} onChange={(e) => setEditRate(e.target.value.replace(/\D/g, ""))} style={{ width: "70px", border: "1px solid #E3DECF", borderRadius: "6px", padding: "5px 8px", fontSize: "12px" }} />
              <button onClick={() => handleSave(t.id)} disabled={saving} style={{ ...smallBtnStyle, padding: "5px 10px" }}>{saving ? "..." : "Save"}</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "12.5px" }}>₹{t.rate}/shop</span>
              <button onClick={() => { setEditingId(t.id); setEditRate(String(t.rate)); }} style={{ border: "none", background: "transparent", color: "#5C5747", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: "14px", fontWeight: 800, color: color || "#1A1A1A" }}>{value}</div>
      <div style={{ fontSize: "9.5px", color: "#8B8576", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function AddDistributorForm({ onDone, onCancel }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [rate, setRate] = useState("50");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Naam ke saath 4 random characters bhi jodte hain (jaise DIST-RAM7X2Q)
  // — taaki koi "DIST-1, DIST-2" jaisा guess karke kisi aur distributor
  // ke naam se galat signup na kar sake. Admin chahe to save karne se
  // pehle edit bhi kar sakta hai.
  const suggestCode = (n) => {
    const base = n.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `DIST-${base}${rand}`;
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || !code.trim() || !rate) { setError("Sab fields bharein."); return; }
    setError("");
    setSaving(true);
    try {
      await createDistributor(name.trim(), phone.trim(), code.trim(), Number(rate));
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "16px", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: "13.5px" }}>Naya Distributor</div>
        <button onClick={onCancel} style={{ border: "none", background: "none", cursor: "pointer", color: "#8B8576" }}><X size={16} /></button>
      </div>
      <FormField label="Naam" value={name} onChange={(v) => { setName(v); if (!code) setCode(suggestCode(v)); }} placeholder="jaise Ramesh Sharma" />
      <FormField label="Phone" value={phone} onChange={setPhone} placeholder="10-digit mobile number" />
      <FormField label="Referral Code" value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="jaise DIST-RAMESH" />
      <FormField label="Commission Rate (₹/month per active shop)" value={rate} onChange={(v) => setRate(v.replace(/\D/g, ""))} placeholder="100" />
      {error && <div style={{ color: "#B3261E", fontSize: "11.5px" }}>{error}</div>}
      <button onClick={handleSave} disabled={saving} style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "10px 0", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
        {saving ? "Save ho raha hai..." : "Distributor Add Karein"}
      </button>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", outline: "none" }} />
    </div>
  );
}
