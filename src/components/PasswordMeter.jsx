import React from "react";
import { checkPassword } from "../lib/password";

// Live strength bar + checklist. Naya password banate waqt password field ke neeche lagao.
export default function PasswordMeter({ password, email, extra }) {
  if (!password) {
    return <div style={{ fontSize: 11.5, color: "#8B8576", lineHeight: 1.5 }}>Use 8+ characters with a capital letter, small letter, number and symbol.</div>;
  }
  const r = checkPassword(password, { email, extra });
  const color = ["#E3DECF", "#B3261E", "#D98E04", "#1B7F3B"][r.level];
  return (
    <div data-testid="pw-meter" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 5, flex: 1, borderRadius: 3, background: i <= r.level ? color : "#E3DECF" }} />)}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color }}>{r.label}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {r.checks.map((c) => (
          <div key={c.id} style={{ fontSize: 11.5, color: c.ok ? "#1B7F3B" : "#8B8576" }}>{c.ok ? "✓" : "○"} {c.label}</div>
        ))}
      </div>
    </div>
  );
}
