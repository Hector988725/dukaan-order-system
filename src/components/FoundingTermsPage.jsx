import React, { useState } from "react";
import { Star, Check, Loader2, AlertCircle, Languages } from "lucide-react";
import { acceptFoundingTerms } from "../lib/api";

// ============================================================
// FOUNDING SHOP TERMS & PRICING LOCK — Bilingual (English default,
// Hindi toggle). Sirf founding members ko payment se pehle ek baar
// dikhta hai.
// ============================================================

const CONTENT = {
  en: {
    badge: "FOUNDING SHOP OFFER",
    numberPrefix: "You are Founding Shop",
    slotsNote: (n) => `🔥 Only 1,000 total — ${n} slots remaining after you`,
    title: "Founding Shop Terms & Pricing Lock",
    subtitle: "Please read this once before proceeding",
    sections: [
      {
        title: "1. Your Lifetime-Locked Price",
        body: (n) => `You are one of the first 1,000 Founding Shops on Dukaan Order System${n ? ` (#${n})` : ""}. Your price is locked at ₹49/month for as long as your subscription stays active.`,
      },
      {
        title: "2. How Long This Price Stays Valid",
        body: "The ₹49/month price remains valid as long as you make payments on time and your subscription stays active. This is not a time-limited trial — you can use the service for as long as you like at this price (subject to the condition below).",
      },
      {
        title: "3. Payment Due Date & 7-Day Grace Period",
        body: "If a payment due date passes, there's no need to worry — you get a 7-day grace period. If you renew within these 7 days, your ₹49/month lock remains completely unaffected.",
      },
      {
        title: "4. What Happens After 7 Days",
        body: "If your subscription remains inactive even after the 7-day grace period (payment not received), your ₹49/month lifetime-lock benefit is permanently forfeited. Reactivating your subscription afterward will apply the regular price (₹299/month Basic) — the ₹49 rate will not be reinstated.",
        highlight: true,
      },
      {
        title: "5. Regular & Premium Pricing (For Reference)",
        body: "Once the first 1,000 shops are filled, new customers will be charged ₹299/month for Regular Basic. If you ever want Premium features, it is available as an optional upgrade at ₹499/month for Founding Shops (₹999/month for new customers) — this does not affect your ₹49 Basic lock unless you choose to upgrade yourself.",
      },
      {
        title: "6. Infrastructure & Third-Party Costs",
        body: "The ₹49/month price is for the Dukaan Order System SaaS subscription itself, and includes normal hosting/database infrastructure costs wherever commercially feasible. Third-party costs — such as custom domain registration, payment gateway (Razorpay) fees, or SMS/WhatsApp charges — may be billed separately, or may change according to that provider's own pricing. These are not part of your ₹49/month SaaS price.",
      },
    ],
    checkboxLabel: "I have read and understood all the terms above — especially the 7-day grace period and the condition under which the ₹49 lifetime-lock expires. I agree to these terms.",
    acceptButton: "I Have Read This, I Agree — Continue",
    saving: "Saving...",
  },
  hi: {
    badge: "फाउंडिंग शॉप ऑफर",
    numberPrefix: "आप फाउंडिंग शॉप",
    slotsNote: (n) => `🔥 कुल केवल 1,000 — आपके बाद ${n} स्थान शेष`,
    title: "फाउंडिंग शॉप शर्तें और मूल्य लॉक",
    subtitle: "आगे बढ़ने से पहले कृपया इसे एक बार पढ़ लें",
    sections: [
      {
        title: "1. आपका जीवनभर लॉक किया गया मूल्य",
        body: (n) => `आप दुकान ऑर्डर सिस्टम की पहली 1,000 फाउंडिंग शॉप्स में से एक हैं${n ? ` (#${n})` : ""}। जब तक आपकी सदस्यता सक्रिय रहती है, तब तक आपका मूल्य ₹49/माह पर हमेशा के लिए लॉक रहेगा।`,
      },
      {
        title: "2. यह मूल्य कब तक मान्य रहेगा",
        body: "₹49/माह का मूल्य तब तक मान्य रहेगा जब तक आप समय पर भुगतान करते रहेंगे और आपकी सदस्यता सक्रिय रहेगी। यह कोई समय-सीमित परीक्षण नहीं है — आप जब तक चाहें इसी मूल्य पर सेवा का उपयोग कर सकते हैं (नीचे दी गई शर्त के अधीन)।",
      },
      {
        title: "3. भुगतान की नियत तारीख और 7-दिन की छूट अवधि",
        body: "यदि भुगतान की नियत तारीख निकल जाए, तो चिंता करने की आवश्यकता नहीं है — आपको 7 दिन की छूट अवधि (ग्रेस पीरियड) मिलती है। यदि आप इन 7 दिनों के भीतर नवीनीकरण (रिन्यू) कर देते हैं, तो आपका ₹49/माह लॉक पूरी तरह सुरक्षित रहता है।",
      },
      {
        title: "4. 7 दिन के बाद क्या होता है",
        body: "यदि 7-दिन की छूट अवधि के बाद भी आपकी सदस्यता निष्क्रिय रहती है (भुगतान प्राप्त नहीं होता), तो आपका ₹49/माह वाला जीवनभर-लॉक लाभ हमेशा के लिए समाप्त हो जाता है। इसके बाद सदस्यता को दोबारा सक्रिय करने पर नियमित मूल्य (₹299/माह बेसिक) लागू होगा — ₹49 वाला मूल्य वापस नहीं मिलेगा।",
        highlight: true,
      },
      {
        title: "5. नियमित और प्रीमियम मूल्य (संदर्भ हेतु)",
        body: "पहली 1,000 दुकानें पूरी होने के बाद, नए ग्राहकों के लिए रेगुलर बेसिक मूल्य ₹299/माह होगा। यदि आप कभी प्रीमियम सुविधाएं चाहें, तो यह फाउंडिंग शॉप्स के लिए ₹499/माह (नए ग्राहकों के लिए ₹999/माह) पर एक वैकल्पिक अपग्रेड के रूप में उपलब्ध है — जब तक आप स्वयं अपग्रेड न करें, यह आपके ₹49 बेसिक लॉक को प्रभावित नहीं करता।",
      },
      {
        title: "6. इंफ्रास्ट्रक्चर और थर्ड-पार्टी लागतें",
        body: "₹49/माह का मूल्य दुकान ऑर्डर सिस्टम की SaaS सदस्यता के लिए है, और जहां तक व्यावसायिक रूप से संभव हो, इसमें सामान्य होस्टिंग/डेटाबेस इंफ्रास्ट्रक्चर लागत शामिल है। थर्ड-पार्टी लागतें — जैसे कस्टम डोमेन पंजीकरण, पेमेंट गेटवे (Razorpay) शुल्क, या SMS/WhatsApp शुल्क — अलग से लगाई जा सकती हैं, या संबंधित प्रदाता की अपनी मूल्य-निर्धारण नीति के अनुसार बदल सकती हैं। ये आपके ₹49/माह वाले SaaS मूल्य का हिस्सा नहीं हैं।",
      },
    ],
    checkboxLabel: "मैंने ऊपर दी गई सभी शर्तें पढ़ ली हैं और समझ ली हैं — विशेष रूप से 7-दिन की छूट अवधि और वह शर्त जिसके तहत ₹49 वाला जीवनभर-लॉक समाप्त होता है। मैं इन शर्तों से सहमत हूं।",
    acceptButton: "मैंने पढ़ लिया है, मैं सहमत हूं — आगे बढ़ें",
    saving: "सेव हो रहा है...",
  },
};

export default function FoundingTermsPage({ store, onAccept, onSignOut }) {
  const [lang, setLang] = useState("en"); // default English, toggle se Hindi
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const t = CONTENT[lang];
  const remaining = store.founding_number ? Math.max(0, 1000 - store.founding_number) : null;

  const handleAccept = async () => {
    setSubmitting(true);
    setError("");
    try {
      await acceptFoundingTerms(store.id);
      onAccept();
    } catch (e) {
      setError((lang === "hi" ? "कुछ गड़बड़ हो गई: " : "Something went wrong: ") + e.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0" }}>
      <div style={{ background: "#1B4332", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "15px" }}>{store.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.14)", border: "none", borderRadius: "8px", padding: "6px 12px", color: "white", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
          >
            <Languages size={13} /> {lang === "en" ? "हिन्दी में पढ़ें" : "Read in English"}
          </button>
          <button onClick={onSignOut} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "8px", padding: "6px 12px", color: "white", fontSize: "11.5px", fontWeight: 600, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "28px 20px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FFF4DB", color: "#8A6A0F", fontSize: "11.5px", fontWeight: 800, padding: "6px 14px", borderRadius: "999px", marginBottom: "10px" }}>
            <Star size={13} fill="#8A6A0F" /> {t.badge}
          </div>
          {store.founding_number && (
            <div style={{ margin: "6px 0 4px", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "26px", color: "#1B4332" }}>
              {t.numberPrefix} <span style={{ color: "#B3261E" }}>#{store.founding_number}</span>
            </div>
          )}
          {remaining !== null && (
            <div style={{ fontSize: "12px", color: "#8A6A0F", fontWeight: 700, marginBottom: "4px" }}>
              {t.slotsNote(remaining)}
            </div>
          )}
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "20px", color: "#1A1A1A" }}>{t.title}</div>
          <div style={{ fontSize: "12.5px", color: "#8B8576", marginTop: "4px" }}>{t.subtitle}</div>
        </div>

        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {t.sections.map((section, i) => (
            <TermBlock
              key={i}
              title={section.title}
              body={typeof section.body === "function" ? section.body(store.founding_number) : section.body}
              highlight={section.highlight}
              lang={lang}
            />
          ))}
        </div>

        {error && (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#FDECEA", borderRadius: "9px", padding: "10px 12px", marginTop: "14px" }}>
            <AlertCircle size={16} color="#B3261E" style={{ flexShrink: 0, marginTop: "1px" }} />
            <div style={{ fontSize: "12px", color: "#B3261E" }}>{error}</div>
          </div>
        )}

        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "18px", cursor: "pointer" }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: "18px", height: "18px", marginTop: "1px", flexShrink: 0 }} />
          <span style={{ fontSize: "12.5px", color: "#5C5747", lineHeight: 1.5 }}>{t.checkboxLabel}</span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          style={{
            width: "100%", marginTop: "16px", padding: "14px 0", borderRadius: "11px", border: "none",
            background: checked && !submitting ? "#1B4332" : "#D8D2BF", color: "white",
            fontWeight: 800, fontSize: "14.5px", cursor: checked && !submitting ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {submitting ? (<><Loader2 size={16} className="spin" /> {t.saving}</>) : (<><Check size={16} /> {t.acceptButton}</>)}
        </button>
      </div>
    </div>
  );
}

function TermBlock({ title, body, highlight, lang }) {
  return (
    <div style={highlight ? { background: "#FDECEA", borderRadius: "9px", padding: "12px 14px", margin: "-4px -6px" } : undefined}>
      <div style={{ fontWeight: 700, fontSize: "13px", color: highlight ? "#B3261E" : "#1B4332", marginBottom: "4px" }}>{title}</div>
      <div style={{ fontSize: "12.5px", color: "#5C5747", lineHeight: lang === "hi" ? 1.9 : 1.6 }}>{body}</div>
    </div>
  );
}
