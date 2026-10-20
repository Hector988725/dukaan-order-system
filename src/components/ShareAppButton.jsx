import React, { useState } from "react";

// ============================================================
// "Ye app kisi dusre dukaandar ko bhejein" — dukaandar aur customer dono ke liye.
// - Phone par seedha native Share sheet (WhatsApp, Gmail, SMS, Telegram... jo bhi phone mein ho).
// - Jahan native share nahi hota (computer), wahan chhota sheet: WhatsApp / Email / Copy link.
// - Link hamesha app ka homepage hota hai (jahan naya dukaandar signup kar sakta hai),
//   kisi ek dukaan ka link nahi.
// Props: audience "owner" | "customer", lang "hi" | "en", variant "pill" | "link"
// ============================================================
const TEXT = {
  owner: {
    label: "📣 Ye app dusre dukaandar ko bhejein",
    title: "Dukaan Order System",
    message: "Apni dukaan ka online order link banayein! Dukaan Order System mein orders, khata, bill aur stock ek hi app mein. Yahan dekhein:",
    sheetTitle: "Dusre dukaandar ko bhejein",
    whatsapp: "WhatsApp", email: "Email", copy: "Link copy karein", copied: "✓ Link copy ho gayi", close: "Band karein",
    emailSubject: "Dukaan Order System — apni dukaan online layein",
  },
  customerEn: {
    label: "🏪 Know a shopkeeper? Share this app",
    title: "Dukaan Order System",
    message: "Do you run a shop? Get your own online ordering link, plus orders, khata and billing in one app — Dukaan Order System:",
    sheetTitle: "Share with a shopkeeper",
    whatsapp: "WhatsApp", email: "Email", copy: "Copy link", copied: "✓ Link copied", close: "Close",
    emailSubject: "Dukaan Order System — put your shop online",
  },
  customerHi: {
    label: "🏪 किसी दुकानदार को जानते हैं? ये ऐप भेजें",
    title: "Dukaan Order System",
    message: "क्या आपकी दुकान है? अपना ऑनलाइन ऑर्डर लिंक बनाएँ, और ऑर्डर, खाता व बिल एक ही ऐप में पाएँ — Dukaan Order System:",
    sheetTitle: "दुकानदार को भेजें",
    whatsapp: "WhatsApp", email: "Email", copy: "लिंक कॉपी करें", copied: "✓ लिंक कॉपी हो गई", close: "बंद करें",
    emailSubject: "Dukaan Order System — अपनी दुकान ऑनलाइन लाएँ",
  },
};

export default function ShareAppButton({ audience = "owner", lang = "en", variant = "pill" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const c = audience === "owner" ? TEXT.owner : (lang === "hi" ? TEXT.customerHi : TEXT.customerEn);
  const url = `${window.location.origin}/`;
  const fullText = `${c.message} ${url}`;

  const onClick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: c.title, text: c.message, url }); }
      catch { /* share cancel kiya — koi error nahi */ }
      return;
    }
    setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(c.copy, fullText);
    }
  };

  const optStyle = {
    display: "flex", alignItems: "center", justifyContent: "center", width: "100%", boxSizing: "border-box",
    border: "1px solid #E3DECF", background: "white", color: "#1B4332", borderRadius: 10, padding: "12px 14px",
    fontSize: 14, fontWeight: 700, textDecoration: "none", cursor: "pointer", fontFamily: "inherit",
  };

  const trigger = variant === "link" ? (
    <button
      type="button" onClick={onClick}
      style={{ background: "none", border: "none", padding: "6px 4px", fontSize: 12.5, fontWeight: 700, color: "#6F6A5A", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
    >
      {c.label}
    </button>
  ) : (
    <button
      type="button" onClick={onClick} className="ddemo-btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: "1px solid #E3DECF", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1B4332", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
    >
      {c.label}
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 16, padding: 20, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1A1A1A" }}>{c.sheetTitle}</div>
            <div style={{ fontSize: 12.5, color: "#5C5747", lineHeight: 1.5, wordBreak: "break-word" }}>{c.message} {url}</div>
            <a href={`https://wa.me/?text=${encodeURIComponent(fullText)}`} target="_blank" rel="noreferrer" style={optStyle}>{c.whatsapp}</a>
            <a href={`mailto:?subject=${encodeURIComponent(c.emailSubject)}&body=${encodeURIComponent(fullText)}`} style={optStyle}>{c.email}</a>
            <button type="button" onClick={copy} style={optStyle}>{copied ? c.copied : c.copy}</button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#6B6259", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "8px 0 0", fontFamily: "inherit" }}>{c.close}</button>
          </div>
        </div>
      )}
    </>
  );
}
