import React, { useState } from "react";
import ShareAppButton from "./ShareAppButton";

// ============================================================
// Orders page ke upar EK patti: 3 chhote buttons. Dabane par hi neeche ka card khulta hai,
// warna sirf ek patti dikhti hai, taaki orders turant dikhein.
//  1. Dukaan ka link (apne customers ko bhejne ke liye)
//  2. Ye app dusre dukaandar ko bhejein
//  3. Staff ko app dein
// ============================================================
export default function OwnerToolsBar({ store, onGoStaff }) {
  const [open, setOpen] = useState(null); // null | "store" | "app" | "staff"
  const toggle = (k) => setOpen((cur) => (cur === k ? null : k));

  const chip = (key, label) => {
    const on = open === key;
    return (
      <button
        key={key} type="button" onClick={() => toggle(key)} aria-expanded={on}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "inherit",
          borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 800,
          border: "1.5px solid #1B4332", background: on ? "#1B4332" : "#FFFFFF", color: on ? "#FFFFFF" : "#1B4332",
        }}
      >
        {label} <span style={{ fontSize: 9 }}>{on ? "▲" : "▼"}</span>
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "10px 18px 0" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {chip("store", "🔗 Dukaan link")}
        {chip("app", "📣 App share")}
        {chip("staff", "👥 Staff app")}
      </div>

      {open === "store" && <div style={{ marginTop: 10 }}><ShareAppButton audience="store" store={store} bare /></div>}
      {open === "app" && <div style={{ marginTop: 10 }}><ShareAppButton audience="owner" bare /></div>}
      {open === "staff" && (
        <div style={{ marginTop: 10, background: "#F1F6F3", border: "1px solid #CFE0D5", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#1B4332", marginBottom: 4 }}>👥 Apne staff ko app dein</div>
          <div style={{ fontSize: 12, color: "#3F4A44", lineHeight: 1.55, marginBottom: 10 }}>
            Aapke <b>staff</b> ka bhi apna alag app hai — unki ID banayein, unhe link bhejein, wo khud app install karke apne mobile + password se login karenge.
          </div>
          <button onClick={onGoStaff} style={{ width: "100%", border: "1.5px solid #1F4E8C", background: "white", color: "#1F4E8C", borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            👥 Staff ki ID banayein
          </button>
        </div>
      )}
    </div>
  );
}
