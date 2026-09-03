import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Check, AlertCircle, Loader2 } from "lucide-react";
import { verifyCurrentPassword, changeEmail, changePassword } from "../lib/api";

// ============================================================
// ACCOUNT SETTINGS — dukaandar ka login email/password badalna.
// Existing Supabase auth system (signIn/signUp/updatePassword) ko
// bilkul nahi badla — sirf uske upar do naye, security-conscious
// flows add kiye hain (current-password verify karke hi change hota
// hai, jaisa har professional app mein hota hai).
// ============================================================
export default function AccountSettings({ user }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <ChangeEmailCard user={user} />
      <ChangePasswordCard user={user} />
    </div>
  );
}

function ChangeEmailCard({ user }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const valid = currentPassword.trim() && newEmail.trim().includes("@") && newEmail.trim() !== user.email;

  const handleSave = async () => {
    setError("");
    setSuccess(false);
    if (!valid) {
      setError(newEmail.trim() === user.email ? "Naya email purane se alag hona chahiye." : "Current password aur ek valid naya email daalein.");
      return;
    }
    setLoading(true);
    try {
      // Security: pehle current password se dobara verify karte hain —
      // taaki koi bhi jo bhoole hue logged-in session par haath laga le,
      // email badal na sake bina asli password jaane.
      await verifyCurrentPassword(user.email, currentPassword);
      await changeEmail(newEmail.trim());
      setSuccess(true);
      setCurrentPassword("");
      setNewEmail("");
    } catch (e) {
      setError(
        e.message === "Invalid login credentials"
          ? "Current password galat hai."
          : e.message || "Email badalte waqt error aaya."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <Mail size={16} color="#1B4332" />
        <div style={{ fontWeight: 700, fontSize: "13.5px" }}>Email Badlein</div>
      </div>
      <div style={{ fontSize: "11.5px", color: "#8B8576", marginBottom: "12px" }}>Abhi ka email: <b>{user.email}</b></div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} show={showPw} onToggleShow={() => setShowPw(!showPw)} />
        <Field label="Naya Email" type="email" value={newEmail} onChange={setNewEmail} placeholder="naya@email.com" />
      </div>

      {error && <Message type="error" text={error} />}
      {success && <Message type="success" text="Confirmation link naye email par bhej diya gaya hai — wahan jaakar confirm karein, tabhi email badlega." />}

      <button
        onClick={handleSave}
        disabled={!valid || loading}
        className="ddemo-btn"
        style={{ marginTop: "12px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: valid ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13px", border: "none", borderRadius: "9px", padding: "11px 0", cursor: valid && !loading ? "pointer" : "not-allowed" }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : "Email Badlein"}
      </button>
    </div>
  );
}

function ChangePasswordCard({ user }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const valid = currentPassword.trim() && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSave = async () => {
    setError("");
    setSuccess(false);
    if (!currentPassword.trim()) { setError("Current password daalein."); return; }
    if (newPassword.length < 6) { setError("Naya password kam se kam 6 characters ka hona chahiye."); return; }
    if (newPassword !== confirmPassword) { setError("Naya password aur confirm password match nahi kar rahe."); return; }
    setLoading(true);
    try {
      await verifyCurrentPassword(user.email, currentPassword);
      await changePassword(newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(
        e.message === "Invalid login credentials"
          ? "Current password galat hai."
          : e.message || "Password badalte waqt error aaya."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <Lock size={16} color="#1B4332" />
        <div style={{ fontWeight: 700, fontSize: "13.5px" }}>Password Badlein</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} show={showPw} onToggleShow={() => setShowPw(!showPw)} />
        <PasswordField label="Naya Password (kam se kam 6 characters)" value={newPassword} onChange={setNewPassword} show={showPw} />
        <PasswordField label="Naya Password Dobara Likhein" value={confirmPassword} onChange={setConfirmPassword} show={showPw} />
      </div>

      {error && <Message type="error" text={error} />}
      {success && <Message type="success" text="Password safaltapoorvak badal diya gaya hai." />}

      <button
        onClick={handleSave}
        disabled={!valid || loading}
        className="ddemo-btn"
        style={{ marginTop: "12px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: valid ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 700, fontSize: "13px", border: "none", borderRadius: "9px", padding: "11px 0", cursor: valid && !loading ? "pointer" : "not-allowed" }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : "Password Badlein"}
      </button>
    </div>
  );
}

function Message({ type, text }) {
  const isError = type === "error";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "7px", marginTop: "10px", background: isError ? "#FDECEA" : "#E7F0EA", borderRadius: "8px", padding: "9px 11px" }}>
      {isError ? <AlertCircle size={14} color="#B3261E" style={{ flexShrink: 0, marginTop: "1px" }} /> : <Check size={14} color="#1B4332" style={{ flexShrink: 0, marginTop: "1px" }} />}
      <span style={{ fontSize: "11.5px", color: isError ? "#B3261E" : "#1B4332", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={inputStyle} />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggleShow }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} type={show ? "text" : "password"} style={{ ...inputStyle, paddingRight: onToggleShow ? "36px" : "10px" }} />
        {onToggleShow && (
          <button onClick={onToggleShow} type="button" style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#8B8576", padding: "2px" }}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 10px", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
