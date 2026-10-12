import React from "react";
import { useLang } from "../lib/i18n";

// Chhota "EN | हिं" switch — customer apni bhasha chun sake.
export default function LangToggle() {
  const { lang, setLang } = useLang();
  const btn = (code, label) => (
    <button
      key={code}
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
      style={{
        border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 10px",
        background: lang === code ? "#1B4332" : "transparent", color: lang === code ? "white" : "#5C5747",
        fontFamily: "inherit",
      }}
    >{label}</button>
  );
  return (
    <div role="group" aria-label="Language" style={{ display: "inline-flex", flexShrink: 0, border: "1px solid #E3DECF", borderRadius: 10, overflow: "hidden", background: "white" }}>
      {btn("en", "EN")}
      {btn("hi", "हिं")}
    </div>
  );
}
