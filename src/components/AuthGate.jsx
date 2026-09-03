import React, { useState } from "react";
import { Store, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { signUp, signIn, createStore, checkSlugAvailable, resetPasswordForEmail, updatePassword } from "../lib/api";
import { BUSINESS_TYPE_LIST } from "../lib/theme";

const BUSINESS_TYPES = BUSINESS_TYPE_LIST;

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ============================================================
// LOGIN / SIGNUP CHOOSER
// ============================================================
export function AuthGate({ onAuthed }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'forgot'

  return (
    <div style={{ maxWidth: "380px", margin: "60px auto", padding: "0 18px" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ width: 50, height: 50, borderRadius: "12px", background: "#D4A24C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Store size={24} color="#123026" />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "19px" }}>Dukaan Order System</div>
        <div style={{ fontSize: "12.5px", color: "#8B8576", marginTop: "4px" }}>Apni dukaan online le jaayein</div>
      </div>

      {mode !== "forgot" && (
        <div style={{ display: "flex", background: "white", borderRadius: "10px", border: "1px solid #E3DECF", padding: "4px", marginBottom: "18px" }}>
          <button onClick={() => setMode("login")} style={{ flex: 1, padding: "9px 0", borderRadius: "7px", border: "none", fontWeight: 700, fontSize: "12.5px", cursor: "pointer", background: mode === "login" ? "#1B4332" : "transparent", color: mode === "login" ? "white" : "#5C5747" }}>
            Login
          </button>
          <button onClick={() => setMode("signup")} style={{ flex: 1, padding: "9px 0", borderRadius: "7px", border: "none", fontWeight: 700, fontSize: "12.5px", cursor: "pointer", background: mode === "signup" ? "#1B4332" : "transparent", color: mode === "signup" ? "white" : "#5C5747" }}>
            Naya Account
          </button>
        </div>
      )}

      {mode === "login" && <LoginForm onAuthed={onAuthed} onForgotPassword={() => setMode("forgot")} />}
      {mode === "signup" && <SignupForm onAuthed={onAuthed} />}
      {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
    </div>
  );
}

function LoginForm({ onAuthed, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await signIn(email, password);
      // Supabase ka onAuthStateChange listener khud user state update karega.
      // Hum bas safety ke liye yahan se bhi trigger karte hain, thodi der baad,
      // taaki agar listener slow ho toh bhi UI turant switch ho jaaye.
      onAuthed(data.user);
    } catch (e) {
      setError(e.message === "Invalid login credentials" ? "Email ya password galat hai." : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <IconField icon={<Mail size={15} />} type="email" value={email} onChange={setEmail} placeholder="Email" />
      <IconField icon={<Lock size={15} />} type="password" value={password} onChange={setPassword} placeholder="Password" />
      <button onClick={onForgotPassword} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#1B4332", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", padding: 0, marginTop: "-4px" }}>
        Password bhool gaye?
      </button>
      {error && <div style={{ color: "#B3261E", fontSize: "12px" }}>{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={!email || !password || loading}
        className="ddemo-btn"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: email && password ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "12px 0", cursor: email && password ? "pointer" : "not-allowed", marginTop: "4px" }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : <>Login Karein <ArrowRight size={15} /></>}
      </button>
    </div>
  );
}

// Forgot-password: email daalte hi ek reset-link bhej deta hai.
function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setError("");
    setLoading(true);
    try {
      await resetPasswordForEmail(email);
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "22px 18px", textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E7F0EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Mail size={20} color="#1B4332" />
        </div>
        <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>Email bhej diya gaya hai</div>
        <div style={{ fontSize: "12px", color: "#5C5747", lineHeight: 1.5, marginBottom: "16px" }}>
          <b>{email}</b> pe ek reset-link bheja hai. Apna inbox (aur Spam folder bhi) check karein.
        </div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#1B4332", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>← Login pe wapas jayein</button>
      </div>
    );
  }

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontWeight: 700, fontSize: "14px" }}>Password Reset Karein</div>
      <div style={{ fontSize: "11.5px", color: "#8B8576", marginTop: "-6px" }}>Apna account wala email daalein, hum aapko reset-link bhej denge.</div>
      <IconField icon={<Mail size={15} />} type="email" value={email} onChange={setEmail} placeholder="Email" />
      {error && <div style={{ color: "#B3261E", fontSize: "12px" }}>{error}</div>}
      <button
        onClick={handleSend}
        disabled={!email || loading}
        className="ddemo-btn"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: email ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "12px 0", cursor: email ? "pointer" : "not-allowed" }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : "Reset Link Bhejein"}
      </button>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#5C5747", fontSize: "12px", cursor: "pointer" }}>← Login pe wapas jayein</button>
    </div>
  );
}

// Reset-link click karne ke baad yeh screen khulti hai (App.jsx isse
// PASSWORD_RECOVERY auth-event detect karke dikhata hai).
export function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) { setError("Password kam se kam 6 letters ka hona chahiye."); return; }
    if (password !== confirm) { setError("Dono password match nahi kar rahe."); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "380px", margin: "60px auto", padding: "0 18px" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ width: 50, height: 50, borderRadius: "12px", background: "#D4A24C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Lock size={22} color="#123026" />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "18px" }}>Naya Password Set Karein</div>
      </div>
      <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {done ? (
          <>
            <div style={{ fontSize: "13px", color: "#1B4332", fontWeight: 600, textAlign: "center" }}>✓ Password badal diya gaya hai!</div>
            <button onClick={onDone} className="ddemo-btn" style={{ background: "#1B4332", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "12px 0", cursor: "pointer" }}>
              Aage Badhein
            </button>
          </>
        ) : (
          <>
            <IconField icon={<Lock size={15} />} type="password" value={password} onChange={setPassword} placeholder="Naya Password (kam se kam 6 letters)" />
            <IconField icon={<Lock size={15} />} type="password" value={confirm} onChange={setConfirm} placeholder="Naya Password Dobara Likhein" />
            {error && <div style={{ color: "#B3261E", fontSize: "12px" }}>{error}</div>}
            <button
              onClick={handleSubmit}
              disabled={!password || !confirm || loading}
              className="ddemo-btn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: password && confirm ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "12px 0", cursor: password && confirm ? "pointer" : "not-allowed" }}
            >
              {loading ? <Loader2 size={15} className="spin" /> : "Password Set Karein"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SignupForm({ onAuthed }) {
  const [step, setStep] = useState(1); // 1: account, 2: store details
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleCreateAccount = async () => {
    setError("");
    if (password.length < 6) { setError("Password kam se kam 6 letters ka hona chahiye."); return; }
    setLoading(true);
    try {
      const data = await signUp(email, password);
      // Agar Supabase project mein "Confirm email" ON hai, to yahan
      // session nahi milta jab tak user apna email verify na kar le —
      // isi wajah se fake/galat email se turant aage nahi badha ja sakta.
      if (!data.session) {
        setNeedsConfirmation(true);
        return;
      }
      setUser(data.user);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "22px 18px", textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E7F0EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Mail size={20} color="#1B4332" />
        </div>
        <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>Email Verify Karein</div>
        <div style={{ fontSize: "12px", color: "#5C5747", lineHeight: 1.5 }}>
          <b>{email}</b> pe ek confirmation link bheja hai. Link pe click karke apna account verify karein, phir login kar sakte hain.
        </div>
      </div>
    );
  }

  if (step === 2 && user) {
    return <StoreDetailsForm user={user} onDone={onAuthed} />;
  }

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <IconField icon={<Mail size={15} />} type="email" value={email} onChange={setEmail} placeholder="Email" />
      <IconField icon={<Lock size={15} />} type="password" value={password} onChange={setPassword} placeholder="Password (kam se kam 6 letters)" />
      {error && <div style={{ color: "#B3261E", fontSize: "12px" }}>{error}</div>}
      <button
        onClick={handleCreateAccount}
        disabled={!email || !password || loading}
        className="ddemo-btn"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: email && password ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "12px 0", cursor: email && password ? "pointer" : "not-allowed", marginTop: "4px" }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : <>Aage Badhein <ArrowRight size={15} /></>}
      </button>
    </div>
  );
}

export function StoreDetailsForm({ user, onDone }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [businessType, setBusinessType] = useState("kirana");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'available' | 'taken'

  const handleNameChange = (v) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const RESERVED_SLUGS = new Set(["superadmin", "signup", "login", "create-store", "admin", "api", "order"]);

  const handleSlugBlur = async () => {
    if (!slug) return;
    if (RESERVED_SLUGS.has(slug)) {
      setSlugStatus("taken");
      return;
    }
    setSlugStatus("checking");
    try {
      const available = await checkSlugAvailable(slug);
      setSlugStatus(available ? "available" : "taken");
    } catch {
      setSlugStatus(null);
    }
  };

  const valid = name.trim() && slug.trim() && whatsapp.trim().length >= 10 && slugStatus !== "taken" && !RESERVED_SLUGS.has(slug);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (RESERVED_SLUGS.has(slug)) {
        setSlugStatus("taken");
        setError("Yeh link naam use nahi kar sakte, doosra try karein.");
        setLoading(false);
        return;
      }
      const available = await checkSlugAvailable(slug);
      if (!available) {
        setSlugStatus("taken");
        setError("Yeh link naam already liya hua hai, doosra try karein.");
        setLoading(false);
        return;
      }
      const store = await createStore(user.id, {
        slug,
        name,
        business_type: businessType,
        whatsapp_number: whatsapp,
        upi_id: null,
        address,
      });
      onDone(user, store);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontWeight: 700, fontSize: "14px", fontFamily: "'Fraunces', serif", marginBottom: "2px" }}>Apni Dukaan Banayein</div>

      <Field label="Dukaan ka Naam" value={name} onChange={handleNameChange} placeholder="jaise Sharma Kirana Store" />

      <div>
        <Field
          label="Aapka Website Link"
          value={slug}
          onChange={(v) => { setSlugTouched(true); setSlug(slugify(v)); setSlugStatus(null); }}
          onBlur={handleSlugBlur}
          placeholder="sharma-kirana"
        />
        <div style={{ fontSize: "10.5px", color: "#8B8576", marginTop: "3px" }}>
          aapkilink.com/<b>{slug || "..."}</b>
          {slugStatus === "checking" && <span style={{ color: "#9A6B00" }}> · check ho raha hai...</span>}
          {slugStatus === "available" && <span style={{ color: "#1B4332" }}> · ✓ available hai</span>}
          {slugStatus === "taken" && <span style={{ color: "#B3261E" }}> · yeh naam pehle se liya hua hai</span>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Business Type</div>
        <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "7px", padding: "9px 10px", fontSize: "12.5px", fontFamily: "inherit", outline: "none", background: "white" }}>
          {BUSINESS_TYPES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </div>

      <Field label="WhatsApp Number (91 ke saath)" value={whatsapp} onChange={setWhatsapp} placeholder="919876543210" />
      <Field label="Address" value={address} onChange={setAddress} placeholder="Dukaan ka pata" textarea />

      {error && <div style={{ color: "#B3261E", fontSize: "12px" }}>{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={!valid || loading}
        className="ddemo-btn"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: valid ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "12px 0", cursor: valid ? "pointer" : "not-allowed", marginTop: "4px" }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : <>Dukaan Banayein <ArrowRight size={15} /></>}
      </button>
    </div>
  );
}

function IconField({ icon, type = "text", value, onChange, placeholder }) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px" }}>
      <span style={{ color: "#8B8576" }}>{icon}</span>
      <input type={isPassword && show ? "text" : type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ border: "none", outline: "none", fontSize: "13px", width: "100%", fontFamily: "inherit" }} />
      {isPassword && (
        <button type="button" onClick={() => setShow((s) => !s)} style={{ border: "none", background: "none", cursor: "pointer", color: "#8B8576", display: "flex", padding: 0 }} tabIndex={-1}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  );
}

function Field({ label, value, onChange, onBlur, placeholder, textarea }) {
  return (
    <div>
      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} rows={2} style={inputStyle} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "7px", padding: "9px 10px", fontSize: "12.5px", fontFamily: "inherit", outline: "none" };
