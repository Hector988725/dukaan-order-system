import React, { useState } from "react";

// ============================================================
// "Ye app kisi dusre dukaandar ko bhejein" — dukaandar aur customer dono ke liye.
// Ek saaf card: upar kya hai, beech mein asli link, neeche seedhe bade buttons
// (WhatsApp / Email / Link copy / Aur apps). Koi chhupa hua sheet nahi.
// Link hamesha app ka homepage hota hai (jahan naya dukaandar signup kar sake).
// Props: audience "owner" | "customer", lang "hi" | "en"
// ============================================================
const TEXT = {
  owner: {
    title: "📣 Dusre dukaandar ko ye app bhejein",
    sub: "Kisi bhi dukaandar dost ko ye link bhejein. Is link se wo apni dukaan ka online order link, khata aur bill bana sakta hai.",
    linkLabel: "Bhejne wala link",
    whatsapp: "WhatsApp par bhejein", email: "Email se bhejein", copy: "📋 Link copy karein", copied: "✓ Link copy ho gayi", more: "Aur apps se bhejein",
    message: "Apni dukaan ka online order link banayein! Dukaan Order System mein orders, khata, bill aur stock ek hi app mein. Yahan dekhein:",
    emailSubject: "Dukaan Order System — apni dukaan online layein",
    appTitle: "Dukaan Order System",
  },
  en: {
    title: "🏪 Know a shopkeeper? Share this app",
    sub: "Send this link to a shopkeeper you know. With it they can get their own online order link, khata and billing.",
    linkLabel: "Link to send",
    whatsapp: "Send on WhatsApp", email: "Send by Email", copy: "📋 Copy link", copied: "✓ Link copied", more: "Send with other apps",
    message: "Do you run a shop? Get your own online ordering link, plus orders, khata and billing in one app — Dukaan Order System:",
    emailSubject: "Dukaan Order System — put your shop online",
    appTitle: "Dukaan Order System",
  },
  hi: {
    title: "🏪 किसी दुकानदार को जानते हैं? ये ऐप भेजें",
    sub: "अपने किसी दुकानदार जानकार को ये लिंक भेजें। इससे वो अपनी दुकान का ऑनलाइन ऑर्डर लिंक, खाता और बिल बना सकता है।",
    linkLabel: "भेजने वाला लिंक",
    whatsapp: "WhatsApp पर भेजें", email: "Email से भेजें", copy: "📋 लिंक कॉपी करें", copied: "✓ लिंक कॉपी हो गई", more: "दूसरे ऐप से भेजें",
    message: "क्या आपकी दुकान है? अपना ऑनलाइन ऑर्डर लिंक बनाएँ, और ऑर्डर, खाता व बिल एक ही ऐप में पाएँ — Dukaan Order System:",
    emailSubject: "Dukaan Order System — अपनी दुकान ऑनलाइन लाएँ",
    appTitle: "Dukaan Order System",
  },
};

export default function ShareAppButton({ audience = "owner", lang = "en" }) {
  const [copied, setCopied] = useState(false);
  const c = audience === "owner" ? TEXT.owner : (lang === "hi" ? TEXT.hi : TEXT.en);
  const url = `${window.location.origin}/`;
  const fullText = `${c.message} ${url}`;
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(c.copy, fullText);
    }
  };

  const nativeShare = async () => {
    try { await navigator.share({ title: c.appTitle, text: c.message, url }); }
    catch { /* share cancel kiya — koi error nahi */ }
  };

  const btn = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box",
    flex: "1 1 150px", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, fontWeight: 800,
    textDecoration: "none", cursor: "pointer", fontFamily: "inherit", minHeight: 44,
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "10px 18px 0" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E3DECF", borderRadius: 14, padding: "14px 14px 14px", textAlign: "left" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#1B4332", marginBottom: 4 }}>{c.title}</div>
        <div style={{ fontSize: 12.5, color: "#5C5747", lineHeight: 1.55, marginBottom: 10 }}>{c.sub}</div>

        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8B8576", letterSpacing: 0.4, marginBottom: 4 }}>{c.linkLabel}</div>
        <div style={{ background: "#F7F5F0", border: "1px dashed #CFC8B3", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "#1A1A1A", fontWeight: 700, wordBreak: "break-all", marginBottom: 12 }}>
          {url}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={`https://wa.me/?text=${encodeURIComponent(fullText)}`} target="_blank" rel="noreferrer" style={{ ...btn, background: "#25D366", color: "#FFFFFF", border: "none" }}>
            {c.whatsapp}
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(c.emailSubject)}&body=${encodeURIComponent(fullText)}`} style={{ ...btn, background: "#FFFFFF", color: "#1B4332", border: "1.5px solid #1B4332" }}>
            {c.email}
          </a>
          <button type="button" onClick={copy} style={{ ...btn, background: copied ? "#E7F4EC" : "#FFFFFF", color: "#1B4332", border: "1.5px solid #1B4332" }}>
            {copied ? c.copied : c.copy}
          </button>
          {canNativeShare && (
            <button type="button" onClick={nativeShare} style={{ ...btn, background: "#FFFFFF", color: "#1B4332", border: "1.5px solid #1B4332" }}>
              {c.more}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
