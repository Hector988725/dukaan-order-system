import React, { useState, useEffect } from "react";
import { Users, Mail, Lock, Eye, EyeOff, LogOut, Copy, Check, TrendingUp, Loader2 } from "lucide-react";
import { signUp, signIn, signOut, onAuthChange, claimDistributorAccount, fetchDistributorDashboard } from "../lib/api";

// ============================================================
// ROOT — /distributor route. Login/signup gate, phir apna dashboard.
// Store-owner ke AuthGate se bilkul alag flow hai (alag role, alag
// tables) isliye ek chhota standalone component rakha, poore AuthGate
// mein condition ghusane ke bajaye.
// ============================================================
export default function DistributorApp() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => setUser(u));
    return unsubscribe;
  }, []);

  if (user === undefined) return <CenterMsg text="Checking..." />;
  if (!user) return <DistributorAuthGate onAuthed={setUser} />;
  return <DistributorDashboard user={user} />;
}

function CenterMsg({ text }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#5C5747" }}>
      {text}
    </div>
  );
}

// ============================================================
// LOGIN / FIRST-TIME CLAIM
// ============================================================
function DistributorAuthGate({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "claim"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
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
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  // Pehli baar: naya login account banao, phir turant apne referral
  // code se us account ko apne distributor record se jodo. Dono steps
  // ek hi button mein — agar step 2 fail ho (galat code), account phir
  // bhi ban chuka hota hai, agli baar seedha "Login" se aa sakte hain
  // aur dashboard khud claim-form dikha dega.
  const handleClaim = async () => {
    if (!referralCode.trim()) { setError("Please enter your Referral Code."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await signUp(email, password);
      await claimDistributorAccount(referralCode.trim());
      onAuthed(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "360px", margin: "60px auto", padding: "0 18px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "22px" }}>
        <div style={{ width: 50, height: 50, borderRadius: "12px", background: "#1B4332", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Users size={24} color="white" />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "18px" }}>Distributor Portal</div>
      </div>

      <div style={{ display: "flex", background: "#F0EBDC", borderRadius: "10px", padding: "3px", marginBottom: "14px" }}>
        <button onClick={() => { setMode("login"); setError(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: "8px", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", background: mode === "login" ? "white" : "transparent", color: mode === "login" ? "#1B4332" : "#8B8576" }}>Login</button>
        <button onClick={() => { setMode("claim"); setError(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: "8px", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", background: mode === "claim" ? "white" : "transparent", color: mode === "claim" ? "#1B4332" : "#8B8576" }}>First Time</button>
      </div>

      <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {mode === "claim" && (
          <div style={{ fontSize: "11.5px", color: "#8B8576", marginBottom: "-2px" }}>
            Enter the Referral Code you were given (e.g. DIST-RAMESH), then set your email/password.
          </div>
        )}
        {mode === "claim" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px" }}>
            <input value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="Referral Code" style={{ border: "none", outline: "none", fontSize: "13px", width: "100%", fontWeight: 700 }} />
          </div>
        )}
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
        <button
          onClick={mode === "login" ? handleLogin : handleClaim}
          disabled={!email || !password || loading}
          style={{ background: email && password ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontWeight: 700, fontSize: "13px", cursor: email && password ? "pointer" : "not-allowed" }}
        >
          {loading ? "..." : mode === "login" ? "Login" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function DistributorDashboard({ user }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = needs claim, object = loaded
  const [claimCode, setClaimCode] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setData(undefined);
    fetchDistributorDashboard()
      .then(setData)
      .catch(() => setData(null)); // "Not a registered distributor" — claim form dikhao
  };
  useEffect(load, []);

  const handleClaim = async () => {
    if (!claimCode.trim()) { setClaimError("Please enter your Referral Code."); return; }
    setClaimError("");
    setClaiming(true);
    try {
      await claimDistributorAccount(claimCode.trim());
      load();
    } catch (e) {
      setClaimError(e.message);
    } finally {
      setClaiming(false);
    }
  };

  if (data === undefined) return <CenterMsg text="Loading..." />;

  if (data === null) {
    // Login to hai, lekin abhi tak apna referral code claim nahi kiya
    return (
      <div style={{ maxWidth: "360px", margin: "80px auto", padding: "0 18px" }}>
        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px" }}>Enter Your Referral Code</div>
          <div style={{ fontSize: "11.5px", color: "#8B8576" }}>This account isn't linked to a distributor record yet.</div>
          <input value={claimCode} onChange={(e) => setClaimCode(e.target.value.toUpperCase())} placeholder="e.g. DIST-RAMESH" style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", fontWeight: 700, outline: "none" }} />
          {claimError && <div style={{ color: "#B3261E", fontSize: "12px" }}>{claimError}</div>}
          <button onClick={handleClaim} disabled={claiming} style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "10px 0", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
            {claiming ? "..." : "Link Account"}
          </button>
          <button onClick={() => signOut()} style={{ background: "transparent", border: "none", color: "#8B8576", fontSize: "11.5px", cursor: "pointer" }}>Logout</button>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/?ref=${data.referral_code}`;
  const handleCopy = () => { navigator.clipboard.writeText(referralLink); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0" }}>
      <div style={{ background: "#1B4332", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Users size={20} color="#D4A24C" />
          <div style={{ color: "white", fontWeight: 700, fontSize: "14.5px", fontFamily: "'Fraunces', serif" }}>{data.name}</div>
        </div>
        <button onClick={() => signOut()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", padding: "6px 12px", color: "white", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
          <LogOut size={13} /> Logout
        </button>
      </div>

      <div style={{ padding: "18px 20px 40px", maxWidth: "600px", margin: "0 auto" }}>
        {/* Referral link — sabse zaroori cheez, sabse upar */}
        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#5C5747", marginBottom: "8px" }}>YOUR REFERRAL LINK — share this with new shopkeepers</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <code style={{ flex: 1, minWidth: "180px", background: "#F7F5F0", padding: "9px 12px", borderRadius: "8px", fontSize: "12px", wordBreak: "break-all" }}>{referralLink}</code>
            <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <div style={{ fontSize: "10.5px", color: "#8B8576", marginTop: "8px" }}>
            Any shop that signs up using this link gets permanently linked to you — you'll earn ₹{data.commission_rate}/month as long as that shop stays active-paid.
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
          <StatCard label="Total Referred" value={data.total_referred} />
          <StatCard label="Active & Paid" value={data.active_paid} color="#1B4332" />
          <StatCard label="Inactive" value={data.inactive} color="#B3261E" />
          <StatCard label="This Month's Commission" value={`₹${data.this_month_commission}`} />
          <StatCard label="Lifetime Commission" value={`₹${data.lifetime_commission}`} />
          <StatCard label="Pending Payout" value={`₹${data.pending_payout}`} color="#B3261E" />
        </div>

        <div style={{ fontSize: "10.5px", color: "#8B8576", textAlign: "center" }}>
          Commission is calculated every month — "Active & Paid" means the shop's subscription is currently active.
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px" }}>
      <div style={{ fontSize: "20px", fontWeight: 800, color: color || "#1A1A1A", fontFamily: "'Fraunces', serif" }}>{value}</div>
      <div style={{ fontSize: "10.5px", color: "#8B8576", fontWeight: 600, marginTop: "2px" }}>{label}</div>
    </div>
  );
}
