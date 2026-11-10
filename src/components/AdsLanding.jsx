import React, { useEffect } from "react";
import { Store, Smartphone, Wallet, BookOpen, Receipt, Package, Bike, Users, Tag, ShieldCheck, ArrowRight } from "lucide-react";

// Ads ke liye landing page (/aao). Optional ?c=anuppur se heading me sheher ka naam aata hai.
// WhatsApp button tabhi dikhta hai jab number set ho (VITE_CONTACT_WHATSAPP, 91 ke saath).
const CONTACT_WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP || "").replace(/\D/g, "");

const G = "#1B4332", GOLD = "#D4A24C", INK = "#1A1A1A", MUTED = "#5C5747", LINE = "#E3DECF";

function cityFromUrl() {
  try {
    const c = new URLSearchParams(window.location.search).get("c") || "";
    const clean = c.replace(/[^\p{L} ]/gu, "").trim().slice(0, 30);
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
  } catch { return ""; }
}

const FEATURES = [
  { icon: Smartphone, t: "Customer ka online order", d: "Aapka apna link. Customer ko login nahi chahiye, seedha order de deta hai." },
  { icon: Wallet, t: "UPI ya Cash on Delivery", d: "Customer UPI se pay kare ya COD, dono chalte hain." },
  { icon: BookOpen, t: "Digital khata", d: "Udhaar ka hisaab mobile par, PIN se surakshit." },
  { icon: Receipt, t: "Quick bill", d: "Counter par turant bill banayein." },
  { icon: Package, t: "Stock aur purchase", d: "Maal kitna bacha, supplier ko kitna dena hai, sab ek jagah." },
  { icon: Bike, t: "Delivery boy aur tracking", d: "Apne delivery boy ko order assign karein, status dekhein." },
  { icon: Users, t: "Staff ka alag app", d: "Staff sirf order aur stock dekhe, baaki sab surakshit." },
  { icon: Tag, t: "Offer aur combo", d: "Sale ya combo chalayein, customer ko screen par dikhta hai." },
];

const STEPS = [
  { n: "1", t: "Account banayein", d: "Email se naya account aur dukaan ka naam. 2 minute." },
  { n: "2", t: "Products daalein", d: "Ready catalog se chunein ya apne products khud jodein." },
  { n: "3", t: "Link share karein", d: "WhatsApp group aur status par apna link bhejein. Orders aane lagenge." },
];

const PLANS = [
  { t: "1 Mahina", p: "₹199", s: "₹199/mahine" },
  { t: "3 Mahine", p: "₹549", s: "₹183/mahine" },
  { t: "6 Mahine", p: "₹999", s: "₹167/mahine", hot: true },
  { t: "1 Saal", p: "₹1799", s: "₹150/mahine" },
];

const TYPES = ["Kirana", "Medical", "Hardware", "Mobile", "Kapde", "Stationery", "Bakery / Mithai", "Salon", "Restaurant / Dhaba", "Footwear", "Cosmetics", "Gift / Toys"];

const FAQ = [
  ["Kya customer ko login ya app download karna padega?", "Nahi. Customer aapka link kholkar seedha order de sakta hai."],
  ["Kitna kharcha hai?", "Sirf ₹199 mahina, saare features ke saath. Koi alag charge ya commission nahi. 3, 6 ya 12 mahine ka plan lene par sasta padta hai."],
  ["Payment kaise hota hai?", "Subscription UPI se hota hai (PhonePe, GPay, Paytm). Customer ka payment aap par seedha aata hai."],
  ["Kya mobile par chalta hai?", "Haan, poora mobile ke hisaab se bana hai. Phone mein install bhi kar sakte hain."],
  ["Pehle dekh sakte hain?", "Haan, neeche Demo button se apni type ki sample dukaan dekhein."],
];

export default function AdsLanding() {
  const city = cityFromUrl();
  useEffect(() => { document.title = "Apni Dukaan Online Karein — Dukaan Order System"; }, []);
  const start = "/?signup=1";
  const wa = CONTACT_WHATSAPP
    ? `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent("Namaste, mujhe Dukaan Order System ke baare mein jaanna hai.")}`
    : "";

  const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 22px", borderRadius: 12, fontWeight: 800, fontSize: 15, textDecoration: "none" };
  const sec = { maxWidth: 760, margin: "0 auto", padding: "30px 18px" };
  const h2 = { fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 21, margin: "0 0 14px", color: INK };

  return (
    <div style={{ background: "#FBF8F0", color: INK, minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(135deg, ${G} 0%, #123026 100%)`, padding: "34px 18px 38px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Store size={26} color="#123026" />
        </div>
        {city && <div style={{ color: GOLD, fontWeight: 800, fontSize: 13, letterSpacing: 0.4, marginBottom: 8 }}>{city.toUpperCase()} KE DUKANDARON KE LIYE</div>}
        <h1 style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 27, lineHeight: 1.25, margin: "0 auto 10px", maxWidth: 520 }}>
          Apni dukaan online karein, orders seedha phone par
        </h1>
        <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 1.55, margin: "0 auto 22px", maxWidth: 480 }}>
          Link banayein, WhatsApp par bhejein, customer order de. Khata, bill, stock aur delivery bhi ek hi app mein. Sirf <b>₹199/mahina</b>.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <a href={start} style={{ ...btn, background: GOLD, color: "#123026" }}>Apni Dukaan Banayein <ArrowRight size={17} /></a>
          <a href="/demo" style={{ ...btn, background: "rgba(255,255,255,0.14)", color: "white" }}>Demo Dekhein</a>
        </div>
        {wa && <div style={{ marginTop: 14 }}><a href={wa} style={{ color: "white", fontSize: 13.5, fontWeight: 700 }}>Ya WhatsApp par poochhein</a></div>}
      </div>

      <div style={sec}>
        <h2 style={h2}>Aapko kya milega</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {FEATURES.map(({ icon: Icon, t, d }) => (
            <div key={t} style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 14px 15px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E8F0EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Icon size={18} color={G} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "white", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={sec}>
          <h2 style={h2}>Shuru karna aasan hai</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flex: "0 0 34px", height: 34, borderRadius: "50%", background: G, color: "white", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</div>
                <div><div style={{ fontWeight: 800, fontSize: 14.5 }}>{s.t}</div><div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{s.d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={sec}>
        <h2 style={h2}>Har tarah ki dukaan ke liye</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((t) => <span key={t} style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 600 }}>{t}</span>)}
        </div>
      </div>

      <div style={{ ...sec, paddingTop: 6 }}>
        <h2 style={h2}>Ek hi plan, saare features</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {PLANS.map((p) => (
            <div key={p.t} style={{ background: p.hot ? "#E8F0EB" : "white", border: `${p.hot ? 2 : 1}px solid ${p.hot ? G : LINE}`, borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
              {p.hot && <div style={{ fontSize: 10.5, fontWeight: 800, color: G, marginBottom: 2 }}>SABSE POPULAR</div>}
              <div style={{ fontWeight: 700, fontSize: 13, color: MUTED }}>{p.t}</div>
              <div style={{ fontWeight: 800, fontSize: 24, margin: "2px 0" }}>{p.p}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{p.s}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>UPI se pay karein. Koi commission ya chhupa hua charge nahi.</div>
      </div>

      <div style={{ background: "white", borderTop: `1px solid ${LINE}` }}>
        <div style={sec}>
          <h2 style={h2}>Aksar poochhe jaane wale sawal</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {FAQ.map(([q, a]) => (
              <div key={q} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{q}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...sec, textAlign: "center" }}>
        <ShieldCheck size={26} color={G} />
        <h2 style={{ ...h2, margin: "8px 0 6px" }}>Aaj hi apni dukaan online karein</h2>
        <a href={start} style={{ ...btn, background: G, color: "white" }}>Apni Dukaan Banayein <ArrowRight size={17} /></a>
        <div style={{ fontSize: 11.5, color: "#8B8576", marginTop: 18 }}>
          <a href="/terms" style={{ color: "#8B8576" }}>Terms</a> · <a href="/privacy" style={{ color: "#8B8576" }}>Privacy</a> · <a href="/refund-policy" style={{ color: "#8B8576" }}>Refund Policy</a> · <a href="/contact" style={{ color: "#8B8576" }}>Contact</a>
        </div>
      </div>
    </div>
  );
}
