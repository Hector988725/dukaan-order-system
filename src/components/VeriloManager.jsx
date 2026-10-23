import React, { useState } from "react";
import { ArrowLeft, Check, Save } from "lucide-react";
import { updateStoreSettings } from "../lib/api";
import { INDIAN_STATES } from "../lib/gst";
import { validateVeriloSettings, veriloButtonState } from "../lib/verilo";

// ============================================================
// "Manage Verilo Listing" — Verilo ka poora control ek alag page par.
// Wahi maujooda fields (verilo_opt_in, verilo_opt_in_at, city, state, pincode), wahi validation
// (validateVeriloSettings) aur wahi save (updateStoreSettings) — koi naya field/table nahi.
// Save sirf Verilo ke fields bhejta hai; baaki store settings par koi asar nahi.
// Props: store, onRefresh (store dobara load), onBack (dashboard par wapas), onGoSubscription
// ============================================================
const WARN = {
  subscription: "Aapka Dukaan subscription active nahi hai. Subscription chalu hote hi dukaan Verilo par wapas dikhne lagegi.",
  city: "City bhari nahi hai.",
  state: "State chuni nahi gayi hai.",
  pincode: "Pincode 6 digits ka bharna zaroori hai.",
};

const card = { background: "#FFFFFF", border: "1px solid #E3DECF", borderRadius: 14, padding: 16, marginBottom: 12 };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #E3DECF", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#FFFFFF" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 };

export default function VeriloManager({ store, onRefresh, onBack, onGoSubscription }) {
  const [optIn, setOptIn] = useState(!!store.verilo_opt_in);
  const [city, setCity] = useState(store.city || "");
  const [state, setState] = useState(store.state || "");
  const [pincode, setPincode] = useState(store.pincode || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Status HAMESHA save ki hui (store) values se — jo abhi Verilo par asli me chal raha hai.
  const vs = veriloButtonState(store);
  const dirty = optIn !== !!store.verilo_opt_in || city.trim() !== (store.city || "") || state !== (store.state || "") || pincode !== (store.pincode || "");

  const badge = vs.status === "live"
    ? { text: "● LIVE", bg: "#E7F4EC", color: "#1B4332", head: "Aapki dukaan Verilo par live hai", sub: "Aas-paas ke log aapki dukaan Verilo ke shops page par dekh sakte hain." }
    : vs.status === "paused"
      ? { text: "PAUSED", bg: "#FFF3D6", color: "#8A5A00", head: "Verilo listing paused hai", sub: "Option ON hai, par neeche likhi wajah se dukaan abhi Verilo par nahi dikh rahi." }
      : { text: "DISABLED", bg: "#F1EEE4", color: "#6B6555", head: "Verilo listing band hai", sub: "Dukaan Verilo par nahi dikh rahi. Neeche option ON karke Save karein." };

  const handleSave = async () => {
    setError("");
    setSaved(false);
    const verilo = validateVeriloSettings({
      optIn, city, state, pincode,
      wasOptIn: !!store.verilo_opt_in, existingAt: store.verilo_opt_in_at || null,
    });
    if (!verilo.ok) { setError(verilo.error); return; }
    setSaving(true);
    try {
      await updateStoreSettings(store.id, verilo.values); // sirf Verilo ke fields
      await onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError("Save nahi ho paaya. Internet check karke dobara koshish karein.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 18px 40px" }}>
      <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#1B4332", fontWeight: 800, fontSize: 13, cursor: "pointer", padding: "4px 0", marginBottom: 8, fontFamily: "inherit" }}>
        <ArrowLeft size={15} /> Dashboard
      </button>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "#1B4332", fontFamily: "'Fraunces', serif" }}>📍 Manage Verilo Listing</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#5C5747", lineHeight: 1.55 }}>
        Verilo ek local directory hai jahan aas-paas ke log dukaan aur services dhoondhte hain. Yahan se apni dukaan ki Verilo listing control karein. Koi extra charge nahi.
      </p>

      {/* STATUS */}
      <div data-testid="verilo-status" style={{ ...card, borderLeft: `4px solid ${vs.status === "live" ? "#2FBF71" : vs.status === "paused" ? "#E8B95A" : "#CFC8B3"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#1A1A1A" }}>{badge.head}</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "2px 9px", background: badge.bg, color: badge.color }}>{badge.text}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#5C5747", lineHeight: 1.55 }}>{badge.sub}</div>

        {vs.status === "paused" && (
          <div style={{ marginTop: 10, background: "#FFF8E6", border: "1px solid #F0D9A0", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#8A5A00", marginBottom: 4 }}>Paused kyun hai:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#5C4300", lineHeight: 1.6 }}>
              {vs.reasons.map((r) => <li key={r}>{WARN[r]}</li>)}
            </ul>
            {vs.reasons.includes("subscription") && onGoSubscription && (
              <button type="button" onClick={onGoSubscription} style={{ marginTop: 8, background: "#1B4332", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                Subscription dekhein
              </button>
            )}
          </div>
        )}

        {/* VIEW ON VERILO */}
        <div style={{ marginTop: 12 }}>
          {vs.status === "live" ? (
            <a href={vs.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", minHeight: 44, background: "#D4A24C", color: "#2B1D00", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 800, textDecoration: "none" }}>
              View on Verilo ↗
            </a>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", minHeight: 44, background: "#F1EEE4", color: "#8B8576", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 800 }} aria-disabled="true">
              View on Verilo ↗
            </div>
          )}
          <div style={{ fontSize: 11, color: "#8B8576", marginTop: 6, lineHeight: 1.5 }}>
            {vs.status === "live"
              ? "Ye link Verilo par aapke shehar ka Shops page kholta hai — wahan aapki dukaan wahi dikhti hai jo customer ko dikhti hai."
              : "Dukaan live hone ke baad ye link chalu ho jayega."}
          </div>
        </div>
      </div>

      {/* SETTINGS */}
      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Haan, meri dukaan Verilo par dikhayein</span>
        </label>

        {optIn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="verilo-city">City / Shehar</label>
              <input id="verilo-city" style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="jaise Anuppur" />
              <div style={{ fontSize: 10.5, color: "#8B8576", marginTop: 3 }}>Verilo me shehar ka matlab zila (district) hota hai. Mohalla/kasba address me rahega.</div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="verilo-state">State</label>
              <select id="verilo-state" style={inputStyle} value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">State chunein</option>
                {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="verilo-pin">Pincode (6 digits)</label>
              <input id="verilo-pin" style={inputStyle} inputMode="numeric" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="jaise 484224" />
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#8B8576", lineHeight: 1.55, marginTop: 12 }}>
          Verilo par yeh dikhega: dukaan ka naam, tagline, logo, address, city, WhatsApp number, timings, Maps link aur social media links.
          UPI ID, GSTIN aur billing ki jaankari kabhi nahi dikhegi. Jab tak Dukaan subscription active hai tabhi dukaan Verilo par dikhegi; subscription band hote hi apne aap hat jaayegi.
          Option OFF karke Save karte hi dukaan Verilo se hat jaati hai.
        </div>

        {dirty && <div style={{ fontSize: 11.5, color: "#8A5A00", marginTop: 8, fontWeight: 700 }}>Badlav abhi save nahi hue — upar ka status Save ke baad badlega.</div>}
        {error && <div role="alert" style={{ fontSize: 12.5, color: "#B3261E", background: "#FDECEA", borderRadius: 8, padding: "8px 10px", marginTop: 10 }}>{error}</div>}

        <button type="button" onClick={handleSave} disabled={saving} className="ddemo-btn"
          style={{ width: "100%", boxSizing: "border-box", minHeight: 46, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: saved ? "#1B4332" : "#D4A24C", color: saved ? "#FFFFFF" : "#123026", fontWeight: 800, fontSize: 14, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
          {saved ? <><Check size={16} /> Save Ho Gaya</> : <><Save size={16} /> {saving ? "Save ho raha hai..." : "Changes Save Karein"}</>}
        </button>
      </div>
    </div>
  );
}
