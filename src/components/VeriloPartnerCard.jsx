import React from "react";

// ============================================================
// Dashboard par "Partner with Verilo" card.
// Naya setting nahi banata — Store Settings ka maujooda Verilo option (store.verilo_opt_in) hi dikhata hai,
// aur button seedha usi section par le jaata hai (onManage).
// ============================================================
export default function VeriloPartnerCard({ store, onManage }) {
  const enabled = !!store.verilo_opt_in;
  const subActive = !!(store.subscription_expires_at && new Date(store.subscription_expires_at) > new Date());
  const paused = enabled && !subActive; // opt-in ON hai par subscription band hone se Verilo par nahi dikh rahi

  const badge = enabled
    ? paused
      ? { text: "Enabled · paused", bg: "#FFF3D6", color: "#8A5A00" }
      : { text: "● Enabled", bg: "#E7F4EC", color: "#1B4332" }
    : { text: "Disabled", bg: "#F1EEE4", color: "#6B6555" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "10px 18px 0" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E3DECF", borderLeft: "4px solid #D4A24C", borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#1B4332" }}>📍 Partner with Verilo</div>
          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: badge.bg, color: badge.color }}>
            {badge.text}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "#5C5747", lineHeight: 1.55, marginBottom: 10 }}>
          {enabled
            ? paused
              ? "Aapki dukaan ka Verilo listing ON hai, par subscription active nahi hai, isliye abhi wahan nahi dikh rahi. Subscription chalu hote hi wapas dikhne lagegi."
              : "Aapki dukaan Verilo par dikh rahi hai — aas-paas ke log ise wahan se dhoondh sakte hain. City ya listing badalni ho to neeche se manage karein."
            : "Verilo par apni dukaan list karein aur apne shehar ke aur local customers tak pahunchein. Koi extra charge nahi — bas Store Settings me ek option ON karna hai."}
        </div>
        <button
          type="button" onClick={onManage}
          style={{ width: "100%", boxSizing: "border-box", minHeight: 44, border: "1.5px solid #1B4332", background: enabled ? "#FFFFFF" : "#1B4332", color: enabled ? "#1B4332" : "#FFFFFF", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
        >
          Manage Verilo Listing →
        </button>
      </div>
    </div>
  );
}
