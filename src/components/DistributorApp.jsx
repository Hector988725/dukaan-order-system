import React, { useState, useEffect } from "react";
import { Users, Mail, Lock, Eye, EyeOff, LogOut, Copy, Check, TrendingUp, Loader2 } from "lucide-react";
import { signUp, signIn, signOut, onAuthChange, claimDistributorAccount, fetchDistributorDashboard, registerDistributorNominee, fetchDistributorProfile, fetchDistributorReferredShops, fetchDistributorCommissionHistory } from "../lib/api";

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
  const [claimCode, setClaimCode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      // Mobile keyboard email ke aage space laga deta hai — trim zaroori hai
      const data = await signIn(email.trim(), password);
      onAuthed(data.user);
    } catch (e) {
      const m = String(e?.message || "").toLowerCase();
      if (m.includes("not confirmed")) setError("Your email is not confirmed yet. Open the confirmation email we sent and tap the link, then try again.");
      else if (m.includes("invalid login")) setError("Incorrect email or password. (Check for extra spaces or capital letters.)");
      else setError(e?.message || "Could not log in. Please try again.");
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
    if (!referralCode.trim() || !claimCode.trim()) { setError("Please enter your Referral Code and Claim Code."); return; }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const data = await signUp(email.trim(), password);
      if (!data.session) {
        // Email confirmation ON hai: abhi login nahi hua, isliye claim abhi nahi ho sakta
        // (bina login ke server permission deny karta hai). Claim Code kharch nahi hota.
        setInfo(`Account created. We sent a confirmation email to ${email.trim()}. Open it and confirm, then come back here, tap "Login", and enter your Referral Code and Claim Code when asked.`);
        return;
      }
      await claimDistributorAccount(referralCode.trim(), claimCode.trim());
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
            Enter the Referral Code and the private Claim Code you were given, then set your email/password.
          </div>
        )}
        {mode === "claim" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px" }}>
            <input value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="Referral Code" style={{ border: "none", outline: "none", fontSize: "13px", width: "100%", fontWeight: 700 }} />
          </div>
        )}
        {mode === "claim" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px" }}>
            <input value={claimCode} onChange={(e) => setClaimCode(e.target.value.toUpperCase())} placeholder="Claim Code (e.g. K7M2-9QXP)" autoComplete="off" style={{ border: "none", outline: "none", fontSize: "13px", width: "100%", fontWeight: 700 }} />
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
        {info && <div style={{ color: "#1B4332", background: "#E7F0EA", borderRadius: "8px", padding: "9px 11px", fontSize: "12px", lineHeight: 1.5 }}>{info}</div>}
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
  const [claimRef, setClaimRef] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [profile, setProfile] = useState(null);
  const [shops, setShops] = useState(null);
  const [history, setHistory] = useState(null);

  const load = () => {
    setData(undefined);
    fetchDistributorDashboard()
      .then((d) => {
        setData(d);
        // extras — fail hone par bhi dashboard chalta rahe
        fetchDistributorProfile().then(setProfile).catch(() => {});
        fetchDistributorReferredShops(100, 0).then(setShops).catch(() => setShops([]));
        fetchDistributorCommissionHistory(12).then(setHistory).catch(() => setHistory([]));
      })
      .catch(() => setData(null)); // "Not a registered distributor" — claim form dikhao
  };
  useEffect(load, []);

  const handleClaim = async () => {
    if (!claimRef.trim() || !claimCode.trim()) { setClaimError("Please enter your Referral Code and Claim Code."); return; }
    setClaimError("");
    setClaiming(true);
    try {
      await claimDistributorAccount(claimRef.trim(), claimCode.trim());
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
          <div style={{ fontWeight: 700, fontSize: "14px" }}>Link Your Distributor Account</div>
          <div style={{ fontSize: "11.5px", color: "#8B8576" }}>This account isn't linked to a distributor record yet.</div>
          <input value={claimRef} onChange={(e) => setClaimRef(e.target.value.toUpperCase())} placeholder="Referral Code (e.g. DIST-RAMESH)" style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", fontWeight: 700, outline: "none" }} />
          <input value={claimCode} onChange={(e) => setClaimCode(e.target.value.toUpperCase())} placeholder="Claim Code (e.g. K7M2-9QXP)" autoComplete="off" style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", fontWeight: 700, outline: "none" }} />
          {claimError && <div style={{ color: "#B3261E", fontSize: "12px" }}>{claimError}</div>}
          <button onClick={handleClaim} disabled={claiming} style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "10px 0", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
            {claiming ? "..." : "Link Account"}
          </button>
          <button onClick={() => signOut()} style={{ background: "transparent", border: "none", color: "#8B8576", fontSize: "11.5px", cursor: "pointer" }}>Logout</button>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/dop-partner/${data.referral_code}`;
  const handleCopy = () => { navigator.clipboard.writeText(referralLink); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const handleCopyCode = () => { navigator.clipboard.writeText(data.referral_code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); };
  const money = (n) => `₹${Math.round(Number(n) || 0)}`;
  const monthLabel = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });

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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#5C5747" }}>YOUR REFERRAL LINK — share this with new shopkeepers</div>
            {data.distributor_type === "special" && (
              <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#9A6B00", background: "#FFF4DB", padding: "2px 7px", borderRadius: "5px" }}>SPECIAL</span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <code style={{ flex: 1, minWidth: "180px", background: "#F7F5F0", padding: "9px 12px", borderRadius: "8px", fontSize: "12px", wordBreak: "break-all" }}>{referralLink}</code>
            <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <div style={{ fontSize: "10.5px", color: "#8B8576", marginTop: "8px" }}>
            Any shop that signs up using this link gets permanently linked to you — you currently earn ₹{data.current_rate}/month per active-paid shop{data.distributor_type === "normal" ? " (based on your current tier)" : ""}.
          </div>
        </div>

        {/* Distributor Code */}
        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px 16px", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#5C5747" }}>DISTRIBUTOR CODE</div>
            <div style={{ fontSize: "17px", fontWeight: 800, fontFamily: "'Fraunces', serif", letterSpacing: "0.5px", marginTop: "2px" }}>{data.referral_code}</div>
            {profile && (
              <div style={{ fontSize: "10.5px", color: "#8B8576", marginTop: "4px" }}>
                {profile.phone ? `Phone: ${profile.phone}` : ""}{profile.phone && profile.login_email ? " · " : ""}{profile.login_email ? `Login: ${profile.login_email}` : ""}
              </div>
            )}
          </div>
          <button onClick={handleCopyCode} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            {copiedCode ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Code</>}
          </button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
          <StatCard label="Total Referred" value={data.total_referred} />
          <StatCard label="Active & Paid" value={data.active_paid} color="#1B4332" />
          <StatCard label="Inactive" value={data.inactive} color="#B3261E" />
          <StatCard label="This Month's Commission" value={`₹${data.this_month_commission}`} />
          <StatCard label="Total Paid" value={`₹${data.lifetime_commission}`} color="#1B4332" />
          <StatCard label="Pending Payout" value={`₹${data.pending_payout}`} color="#B3261E" />
        </div>

        {/* Monthly commission history */}
        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Monthly Commission History</div>
          {history === null ? (
            <div style={{ fontSize: "11.5px", color: "#8B8576" }}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: "11.5px", color: "#8B8576" }}>No commission calculated yet. It appears here after the monthly run.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.6fr 0.9fr 0.9fr", gap: "6px", fontSize: "10px", fontWeight: 700, color: "#8B8576" }}>
                <span>Month</span><span>Shops</span><span>Paid</span><span>Pending</span>
              </div>
              {history.map((h) => (
                <div key={h.billing_month} style={{ display: "grid", gridTemplateColumns: "1.1fr 0.6fr 0.9fr 0.9fr", gap: "6px", fontSize: "12px", padding: "6px 0", borderTop: "1px solid #F0ECE0" }}>
                  <b>{monthLabel(h.billing_month)}</b>
                  <span>{h.shops}</span>
                  <span style={{ color: "#1B4332", fontWeight: 700 }}>{money(h.paid_amount)}</span>
                  <span style={{ color: Number(h.pending_amount) > 0 ? "#B3261E" : "#8B8576", fontWeight: 700 }}>{money(h.pending_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referred shops */}
        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Your Referred Shops ({data.total_referred})</div>
          {shops === null ? (
            <div style={{ fontSize: "11.5px", color: "#8B8576" }}>Loading...</div>
          ) : shops.length === 0 ? (
            <div style={{ fontSize: "11.5px", color: "#8B8576" }}>No shops yet. Share your referral link to get started.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {shops.map((sh, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "7px 0", borderTop: i ? "1px solid #F0ECE0" : "none", fontSize: "12px" }}>
                  <div>
                    <b>{sh.shop_name}</b>
                    <div style={{ fontSize: "10.5px", color: "#8B8576" }}>Joined {new Date(sh.signed_up_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 9px", borderRadius: "999px", background: sh.is_active ? "#E7F0EA" : "#FBE9E7", color: sh.is_active ? "#1B4332" : "#B3261E" }}>
                    {sh.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
              {data.total_referred > shops.length && <div style={{ fontSize: "10.5px", color: "#8B8576", marginTop: "6px" }}>Showing latest {shops.length} shops.</div>}
            </div>
          )}
        </div>

        {/* Nominee — sirf 500+ active-paid shops wale distributors ke
            liye. Live check hai — shops kam ho jaayein to yeh section
            khud gayab ho jaata hai. */}
        {data.nominee_eligible ? (
          <NomineeSection distributorId={data.distributor_id} />
        ) : (
          <div style={{ fontSize: "10.5px", color: "#8B8576", textAlign: "center", background: "#F7F5F0", borderRadius: "10px", padding: "10px" }}>
            Nominee registration unlocks once you reach 500 active-paid referred shops (currently {data.active_paid}).
          </div>
        )}

        <div style={{ fontSize: "10.5px", color: "#8B8576", textAlign: "center", marginTop: "10px" }}>
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

// 500+ active-paid shops wale distributors apna nominee register kar
// sakte hain — unki mrityu ke baad (admin verification ke saath)
// commission isी nominee ko milta hai.
function NomineeSection({ distributorId, theme }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !relationship.trim() || phone.replace(/\D/g, "").length < 10) {
      setError("Sab fields sahi se bharein.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await registerDistributorNominee(distributorId, name.trim(), relationship.trim(), phone.trim());
      setDone(true);
      setShowForm(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div style={{ background: "#E7F0EA", borderRadius: "10px", padding: "12px", fontSize: "11.5px", color: "#1B4332", fontWeight: 600, marginBottom: "12px" }}>
        ✓ Nominee registered — pending admin verification.
      </div>
    );
  }

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "12px", fontWeight: 700 }}>Registered Nominee</div>
        <button onClick={() => setShowForm((s) => !s)} style={{ border: "none", background: "transparent", color: theme?.primary || "#1B4332", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>
          {showForm ? "Cancel" : "Register / Update"}
        </button>
      </div>
      {showForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nominee's Name" style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "12.5px", outline: "none" }} />
          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Relationship (e.g. Spouse, Son)" style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "12.5px", outline: "none" }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Mobile Number" type="tel" style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "12.5px", outline: "none" }} />
          {error && <div style={{ color: "#B3261E", fontSize: "11.5px" }}>{error}</div>}
          <button onClick={handleSave} disabled={saving} style={{ background: theme?.primary || "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
            {saving ? "..." : "Save Nominee"}
          </button>
        </div>
      )}
    </div>
  );
}
