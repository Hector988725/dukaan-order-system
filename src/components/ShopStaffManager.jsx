import React, { useState, useEffect, useCallback } from "react";
import { Users, Plus, X, KeyRound, Trash2, Copy } from "lucide-react";
import { addShopStaff, fetchShopStaff, updateShopStaff, removeShopStaff, generateShopStaffInvite } from "../lib/api";

// ============================================================
// SHOP STAFF (Admin → Staff) — dukaandar apne staff ko limited access deta hai.
// Permissions ek list se aate hain: naya option jodna ho to sirf PERMS me ek
// line badhao (aur DB function me whitelist).
// ============================================================
const PERMS = [
  { key: "orders_status", label: "Orders dekhna + status badalna", hint: "Naya → Accepted → … → Delivered (peeche nahi)" },
  { key: "stock_update", label: "Stock + Available/Unavailable badalna", hint: "Product add/delete nahi kar sakta" },
  { key: "price_update", label: "Price badalna", hint: "Sirf selling price" },
  { key: "payment_verify", label: "UPI payment verify karna", hint: "Sirf 'Pending Verification' → 'Confirmed'" },
];
const border = "#E3DECF";

export default function ShopStaffManager({ store }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const [codeInfo, setCodeInfo] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setRows(await fetchShopStaff(store.id)); setErr(""); }
    catch (e) { setErr(e.message || "Load nahi ho paaya"); setRows([]); }
  }, [store.id]);
  useEffect(() => { load(); }, [load]);

  const makeCode = async (s, reset) => {
    try {
      const code = await generateShopStaffInvite(s.id, reset);
      setCodeInfo({ name: s.name, code });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: "#8B8576" }}>{rows ? rows.length : 0} staff (max 10)</div>
        <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1B4332", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Naya Staff
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "#8B8576", marginBottom: 12, lineHeight: 1.5 }}>
        Staff sirf wahi kaam kar sakta hai jo aap yahan allow karein. Khata, Quick Bill, products add/delete, subscription aur settings sirf aapke paas rehte hain.
      </div>
      {err && <div style={{ background: "#FDECEA", color: "#B3261E", borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 10 }}>{err}</div>}

      {adding && <AddForm store={store} onCancel={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}

      {rows === null ? <div style={{ textAlign: "center", padding: 30, color: "#8B8576" }}>Load ho raha hai...</div>
        : rows.length === 0 && !adding ? (
          <div style={{ textAlign: "center", padding: "36px 20px", color: "#8B8576" }}>
            <Users size={28} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Abhi koi staff nahi. "Naya Staff" se shuru karein.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(rows || []).map((s) => <StaffCard key={s.id} s={s} onChanged={load} onCode={makeCode} />)}
          </div>
        )}
      {codeInfo && <InviteModal info={codeInfo} onClose={() => setCodeInfo(null)} />}
    </div>
  );
}

function AddForm({ store, onCancel, onAdded }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await addShopStaff(store.id, name.trim(), phone.trim()); onAdded(); }
    catch (e) { alert(e.message); setBusy(false); }
  };
  const inp = { width: "100%", border: `1px solid ${border}`, borderRadius: 7, padding: "8px 10px", fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ background: "#F7F5F0", border: `1px solid ${border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input style={inp} placeholder="Staff ka naam" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={inp} placeholder="Mobile (optional)" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: `1px solid ${border}`, borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button disabled={!name.trim() || busy} onClick={save} style={{ flex: 1, background: name.trim() ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed" }}>{busy ? "Ruko..." : "Add Karein"}</button>
      </div>
    </div>
  );
}

function StaffCard({ s, onChanged, onCode }) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState(s.permissions || {});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPerms(s.permissions || {}); }, [s.permissions]);
  const small = { fontSize: 10.5, fontWeight: 700, border: `1px solid ${border}`, background: "white", borderRadius: 6, padding: "4px 9px", cursor: "pointer", color: "#1B4332" };

  const run = async (fn) => { setBusy(true); try { await fn(); await onChanged(); } catch (e) { alert(e.message); } setBusy(false); };
  const savePerms = (next) => run(() => updateShopStaff(s.id, s.name, next, s.is_active));
  const toggle = (k) => { const next = { ...perms, [k]: !perms[k] }; setPerms(next); savePerms(next); };

  const loginBadge = s.linked
    ? { t: "Login Linked", c: "#1B4332", bg: "#E7F0EA" }
    : s.invite_active ? { t: "Code Pending", c: "#9A6B00", bg: "#FFF4DB" } : { t: "Login Nahi Hai", c: "#B3261E", bg: "#FDECEA" };

  return (
    <div style={{ background: "white", border: `1px solid ${border}`, borderRadius: 12, padding: "11px 13px", opacity: s.is_active ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name} {s.phone && <span style={{ fontWeight: 400, fontSize: 11, color: "#8B8576" }}>· {s.phone}</span>}</div>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: loginBadge.c, background: loginBadge.bg, padding: "2px 7px", borderRadius: 5 }}>{loginBadge.t}</span>
        </div>
        <button disabled={busy} onClick={() => run(() => updateShopStaff(s.id, s.name, perms, !s.is_active))} style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, border: "none", cursor: "pointer", background: s.is_active ? "#E7F0EA" : "#F0EEE6", color: s.is_active ? "#1B4332" : "#8B8576" }}>
          {s.is_active ? "Active" : "Band"}
        </button>
        <button disabled={busy} onClick={() => confirm(`"${s.name}" ko staff se hatayein?`) && run(() => removeShopStaff(s.id))} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${border}`, background: "white", cursor: "pointer", color: "#B3261E", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <button style={small} onClick={() => setOpen((o) => !o)}>{open ? "Permissions chhupayein" : "Permissions"}</button>
        {!s.linked && <button disabled={busy} style={small} onClick={() => onCode(s, false)}><KeyRound size={10} /> Login Code Banayein</button>}
        {s.linked && <button disabled={busy} style={{ ...small, color: "#B3261E" }} onClick={() => confirm("Purana login hata kar naya code banayein? Staff ko dobara code se judna padega.") && onCode(s, true)}>Login Reset</button>}
      </div>
      {open && (
        <div style={{ marginTop: 8, background: "#F7F5F0", borderRadius: 9, padding: "6px 10px" }}>
          {PERMS.map((p) => (
            <label key={p.key} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 0", borderBottom: `1px solid ${border}`, cursor: "pointer" }}>
              <input type="checkbox" disabled={busy} checked={!!perms[p.key]} onChange={() => toggle(p.key)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.label}<br /><span style={{ fontWeight: 400, fontSize: 11, color: "#8B8576" }}>{p.hint}</span></span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function InviteModal({ info, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/staff`;
  const text = `Staff app: ${link}\n1) Apna email + password se account banayein\n2) Ye code daalein: ${info.code}\nCode 7 din valid hai aur sirf ek baar chalta hai. Kisi ko share na karein.`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } };
  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 400, padding: 20, margin: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Staff Login Code — {info.name}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#8B8576" }}><X size={16} /></button>
        </div>
        <div style={{ background: "#F7F5F0", borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#8B8576", fontWeight: 600, marginBottom: 4 }}>7 din valid, sirf ek baar</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: "#1B4332" }}>{info.code}</div>
        </div>
        <div style={{ fontSize: 11.5, color: "#B3261E", marginBottom: 10 }}>Ye code dobara nahi dikhega. Abhi copy karke staff ko bhej dein.</div>
        <textarea readOnly value={text} style={{ width: "100%", height: 110, border: `1px solid ${border}`, borderRadius: 8, padding: 9, fontSize: 11.5, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={copy} style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: 9, padding: "10px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}><Copy size={12} style={{ verticalAlign: "-2px" }} /> {copied ? "Copy ho gaya" : "Copy"}</button>
          <button onClick={wa} style={{ flex: 1, background: "#25D366", color: "white", border: "none", borderRadius: 9, padding: "10px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>WhatsApp</button>
        </div>
      </div>
    </div>
  );
}
