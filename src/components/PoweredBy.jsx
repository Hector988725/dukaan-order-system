import React from "react";

// "Powered by Hector365" — header (patli patti) aur footer (chhoti pill) dono ke liye.
// Normal flow me hai (fixed nahi), to kisi button/text ko dhakta nahi. Print me chhup jaata hai.
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const NAVY = "#1B2A5C";
const ORANGE = "#F28A1E";

function Mark({ size }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 900, fontSize: Math.round(size * 0.62), lineHeight: 1, fontFamily: FONT,
      background: "linear-gradient(145deg,#FFB347,#F07A12)",
      boxShadow: `0 ${Math.max(1, Math.round(size * 0.08))}px 0 #B4530B, 0 2px 5px rgba(180,83,11,.35), inset 0 1px 0 rgba(255,255,255,.5)`,
      textShadow: "0 1px 1px rgba(120,50,0,.45)",
    }}>H</span>
  );
}

export default function PoweredBy({ variant = "footer" }) {
  const css = "@media print{.hc-powered{display:none!important}}";
  if (variant === "header") {
    return (
      <div className="hc-powered" role="note" style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 24, boxSizing: "border-box",
        background: "linear-gradient(#FFF9EF,#FCEFD9)", borderBottom: "1px solid rgba(242,138,30,.28)", fontFamily: FONT, userSelect: "none",
      }}>
        <style>{css}</style>
        <Mark size={14} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: "#9A8A76", textTransform: "uppercase" }}>Powered by</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: -0.1, textShadow: "0 1px 0 #fff" }}>Hector<span style={{ color: ORANGE }}>365</span></span>
      </div>
    );
  }
  return (
    <div className="hc-powered" role="note" style={{ display: "flex", justifyContent: "center", padding: "18px 12px 26px", fontFamily: FONT, userSelect: "none" }}>
      <style>{css}</style>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 16px 6px 7px", borderRadius: 999,
        background: "linear-gradient(#FFFFFF,#FCF1E2)", border: "1px solid rgba(242,138,30,.35)", boxShadow: "0 3px 0 #E6C48F, 0 8px 16px rgba(120,70,10,.16)",
      }}>
        <Mark size={24} />
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
          <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1.6, color: "#9A8A76", textTransform: "uppercase" }}>Powered by</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: NAVY, letterSpacing: -0.2, textShadow: "0 1px 0 #fff, 0 2px 3px rgba(27,42,92,.22)" }}>Hector<span style={{ color: ORANGE }}>365</span></span>
        </span>
      </div>
    </div>
  );
}
