import { useCallback, useEffect, useRef, useState } from "react";

// Mascot saathi (Hector365): screen par ghoomta hai, jahan dabao wahan aakar chhota sa guide likhta hai.
// Band karne par logo ke paas chhota hokar baith jata hai; usse dabao to wapas chalu.
// Kisi bhi click ko rokta ya badalta nahi (sirf sunta hai).

const NO_RULES = [];
const KEY = "mascot_guide_on";
const SCALE = 0.85; // mascot ka size: chhota/bada karna ho to sirf ye number badlo
const VB_W = 40;
const VB_H = 74;
const W = Math.round(VB_W * SCALE);
const H = Math.round(VB_H * SCALE);

const MOVE_MS = 900;
const LAST_CLEAN = "mascot_last_clean";
const CLEAN_EVERY = 60 * 60 * 1000; // har 1 ghante baad safai
const rand = (a, b) => a + Math.random() * (b - a);
const isSit = (p) => p === "work" || p === "sleep";

const RULES = [
  [/add to cart|cart me|\bjodo\b|\badd\b/, "Ye cheez cart me jud jayegi. Aage cart kholkar order bhej sakte ho."],
  [/place order|order kar|checkout|\border\b/, "Order bhejne se pehle cart aur address dekh lo. Uske baad confirm ya payment ka option aayega."],
  [/pay|upi|razorpay|subscribe|upgrade|\bplan\b/, "Payment Razorpay ke surakshit page par hoti hai. Payment ke baad plan turant chalu ho jayega. PIN ya OTP kisi ko mat batana."],
  [/log ?in|sign ?in/, "Email aur password daalo, phir Login dabao. Password yaad na ho to 'Password bhool gaye' dabao."],
  [/sign ?up|register|create|banao|naya|\bnew\b/, "Naya account banane ke liye email aur password daalo. Uske baad apni dukaan ki jaankari bharni hogi."],
  [/log ?out|sign ?out/, "Isse aap is device par logout ho jaoge."],
  [/delete|remove|hatao|hata do|cancel/, "Dhyan se! Ye hatane ke baad wapas nahi aayega."],
  [/save|update|submit|confirm|\bdone\b|bhej/, "Ye jaankari save kar dega. Uske baad pichhli screen par wapas ja sakte ho."],
  [/search|khoj|dhoond/, "Yaha naam likho, matching items turant dikh jayenge. Phir item chunkar cart me jodo."],
  [/dismiss|not now|later|abhi nahi/, "Ye is message ko abhi ke liye hata dega."],
  [/back|close|wapas|✕|×/, "Ye pichhli screen par wapas le jayega."],
  [/install/, "Ye app ko phone ki home screen par laga dega. Uske baad ise normal app ki tarah kholo."],
  [/whatsapp|share/, "Isse aap link ya jaankari dost ya customer ko bhej sakte ho."],
  [/\bcall\b|phone|dial/, "Ye seedha phone dialer kholega."],
  [/bill|khata|ledger|udhaar/, "Yaha bill aur udhaar (khata) ka hisaab rehta hai."],
  [/stock|inventory|product|\bitem|saman/, "Yaha apne saman aur stock ki list sambhalo. Naya item jodne ke liye Add dabao."],
  [/deliver|rider|track/, "Yaha order ki delivery ka status aur rider ki jaankari milti hai."],
  [/offer|discount|coupon/, "Yaha chal rahe offer aur discount dikhte hain."],
  [/^(en|हि|हिं|hi)$|language|hindi|english|bhasha|\blang\b/, "Yaha se bhasha badal sakte ho."],
];

function labelOf(el) {
  const raw = el.getAttribute("data-guide-label") || el.getAttribute("aria-label") || el.getAttribute("title") ||
    el.getAttribute("placeholder") || el.getAttribute("alt") || (el.innerText || "") || "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 30);
}

function guideFor(el) {
  const custom = el.getAttribute("data-guide");
  if (custom) return custom;
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute("type") || "").toLowerCase();
  const label = labelOf(el);
  if (type === "password") return "Password kam se kam 8 akshar ka rakho aur kisi ko mat batana.";
  const low = label.toLowerCase();
  for (const [re, text] of RULES) if (re.test(low)) return text;
  if (tag === "select") return "List me se ek option chuno.";
  if (type === "checkbox" || type === "radio") return "Ye option chunne ya hatane ke liye dabao.";
  if (tag === "input" || tag === "textarea") return label ? `Yaha ${label} likho.` : "Yaha jaankari likho.";
  if (tag === "a") return label ? `"${label}" khulega.` : "Ye link naya page kholega.";
  return label ? `"${label}" dabane par aage ka step khulega.` : "Ye dabane par aage ka step khulega.";
}

function findLogo() {
  const sels = ["[data-mascot-logo]", "header img", 'img[alt*="logo" i]', "header a", 'a[href="/"]', "header h1", "h1"];
  for (const s of sels) {
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 8 && r.top >= -5 && r.top < 180 && r.left < window.innerWidth * 0.7) return r;
    }
  }
  return null;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const home = () => ({ x: window.innerWidth - W - 14, y: window.innerHeight - H - 90 });

const SKIN = "#F4B88A";
const ORANGE = "#F28A1E";
const ORANGE_D = "#D97706";
const NAVY = "#1B2A5C";
const PANTS = "#243B6B";
const COAT = "#F6C21B";

/* ---------- mausam ---------- */
const isDayNow = () => { const h = new Date().getHours(); return h >= 6 && h < 18; };

// Mausam: koi bahari API nahi. Din/raat ghadi se; test ke liye ?wx=rain | cloud | part | clear | night
function useWeather() {
  const [w, setW] = useState({ kind: "clear", day: isDayNow() });
  useEffect(() => {
    let forced = null;
    try { forced = new URLSearchParams(window.location.search).get("wx"); } catch (e) { /* ignore */ }
    if (forced) {
      setW({ kind: forced === "night" ? "clear" : forced, day: forced !== "night" });
      return undefined;
    }
    const id = setInterval(() => setW((p) => (p.day === isDayNow() ? p : { ...p, day: isDayNow() })), 60000);
    return () => clearInterval(id);
  }, []);
  return w;
}

const DROPS = Array.from({ length: 38 }, (_, i) => ({ l: (i * 97) % 100, d: ((i * 37) % 100) / 100 * 1.4, t: 0.8 + ((i * 53) % 60) / 100 }));

function Cloud({ top, dur, delay, size, tone }) {
  return (
    <svg className="mg-cloud" width={size} height={size * 0.6} viewBox="0 0 60 36" style={{ top, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
      <path d="M14 30 Q3 30 4 21 Q5 13 14 14 Q16 4 28 5 Q38 5 40 14 Q52 12 54 22 Q55 30 46 30Z" fill={tone} />
    </svg>
  );
}

function WeatherSky({ kind, day }) {
  const rain = kind === "rain";
  const cloudy = kind !== "clear";
  const tone = day ? (rain ? "#B9C3D6" : "#FFFFFF") : "#8E97B5";
  return (
    <div data-mascot="1" aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden" }}>
      <style>{`
        .mg-cloud{position:absolute;left:-80px;opacity:.9;animation:mgDrift linear infinite}
        @keyframes mgDrift{to{transform:translateX(calc(100vw + 160px))}}
        .mg-drop{position:absolute;top:-20px;width:1.5px;height:15px;border-radius:1px;background:linear-gradient(rgba(110,150,220,0),rgba(90,130,210,.65));animation:mgFall linear infinite}
        @keyframes mgFall{from{transform:translateY(-20px) rotate(9deg)}to{transform:translateY(108vh) rotate(9deg)}}
        .mg-rays{transform-origin:15px 15px;animation:mgSpin 26s linear infinite}
        @keyframes mgSpin{to{transform:rotate(360deg)}}
        .mg-star{animation:mgTw 2.2s ease-in-out infinite}
        @keyframes mgTw{0%,100%{opacity:.2}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){.mg-cloud,.mg-drop,.mg-rays,.mg-star{animation:none!important}.mg-cloud{left:20px}}
      `}</style>
      {!rain && day && (
        <svg className="mg-sun" width="30" height="30" viewBox="0 0 30 30" style={{ position: "absolute", top: 8, right: 12 }}>
          <g className="mg-rays" stroke="#F5B731" strokeWidth="2" strokeLinecap="round">
            {Array.from({ length: 8 }).map((_, i) => <line key={i} x1="15" y1="2" x2="15" y2="5.5" transform={`rotate(${i * 45} 15 15)`} />)}
          </g>
          <circle cx="15" cy="15" r="6.5" fill="#FFD54A" stroke="#F5B731" strokeWidth="1" />
        </svg>
      )}
      {!day && (
        <svg width="30" height="30" viewBox="0 0 30 30" style={{ position: "absolute", top: 8, right: 12 }}>
          <path d="M20 4 A11 11 0 1 0 26 20 A9 9 0 1 1 20 4Z" fill="#F4E6A6" stroke="#E2CE78" strokeWidth=".8" />
          <circle className="mg-star" cx="5" cy="7" r="1.1" fill="#F4E6A6" /><circle className="mg-star" style={{ animationDelay: ".7s" }} cx="11" cy="24" r="1" fill="#F4E6A6" />
        </svg>
      )}
      {cloudy && <Cloud top={10} dur={70} delay={0} size={56} tone={tone} />}
      {(kind === "cloud" || rain) && <Cloud top={34} dur={95} delay={-40} size={44} tone={tone} />}
      {rain && <Cloud top={4} dur={80} delay={-20} size={62} tone={tone} />}
      {rain && DROPS.map((d, i) => (
        <span key={i} className="mg-drop" style={{ left: `${d.l}%`, animationDelay: `-${d.d}s`, animationDuration: `${d.t}s` }} />
      ))}
    </div>
  );
}

/* ---------- screen samajhna ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tidy = (t) => String(t || "").replace(/\s+/g, " ").trim();
function isShown(el) {
  if (!el || el.closest("[data-mascot]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = window.getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none";
}
function screenTitle() {
  const h = Array.from(document.querySelectorAll("h1,h2,[role=heading]")).find((e) => isShown(e) && tidy(e.innerText).length > 1);
  return h ? tidy(h.innerText).slice(0, 40) : "";
}
function screenOptions() {
  const pick = (sel) => {
    const seen = new Set();
    const out = [];
    for (const e of document.querySelectorAll(sel)) {
      if (!isShown(e)) continue;
      const t = tidy(e.getAttribute("aria-label") || e.innerText);
      const k = t.toLowerCase();
      if (t.length < 2 || t.length > 24 || seen.has(k) || /^(×|✕|x|close|menu|back|dismiss)$/i.test(t)) continue;
      seen.add(k); out.push(t);
      if (out.length >= 6) break;
    }
    return out;
  };
  const nav = pick("nav a, nav button, [role=tab], aside a, aside button, header button, header a");
  return nav.length >= 2 ? nav : pick("main button, main a, button");
}
function snapshot() {
  const title = screenTitle();
  const opts = screenOptions();
  return { path: window.location.pathname, title, opts, pw: !!Array.from(document.querySelectorAll("input[type=password]")).find(isShown), sig: `${window.location.pathname}|${title}|${opts.join(",")}` };
}
function describeScreen(before, after, screens) {
  const welcome = before.pw && !after.pw ? "Welcome! Aap login ho gaye. " : "";
  const hay = `${after.path} ${after.title}`.toLowerCase();
  for (const [re, msg] of screens) if (re.test(hay)) return welcome + msg;
  const head = after.title ? `Ab aap "${after.title}" me ho.` : "Ab aap naye screen par ho.";
  const list = after.opts.length ? ` Yaha ye options milenge: ${after.opts.join(", ")}.` : "";
  return (welcome + head + list).slice(0, 190);
}

const OK_RE = /(success|successful|safal|placed|confirmed|ho gaya|ho gayi|hogaya|dhanyavaad|thank you|badhai|saved|submitted)/i;
const BAD_RE = /(error|failed|failure|galat|nahi ho|nahi mil|invalid|wrong|try again|not found)/i;
const TOAST_SEL = '[role=alert],[role=status],[class*="toast" i],[class*="snack" i],[class*="notif" i],[class*="alert" i]';
function looksLikeToast(el) {
  try {
    if (el.matches(TOAST_SEL) || el.querySelector(TOAST_SEL)) return true;
    return window.getComputedStyle(el).position === "fixed";
  } catch (e) { return false; }
}
const COLORS = ["#F28A1E", "#F6C21B", "#3D7FD9", "#E4572E", "#2FA36B", "#9B5DE5"];
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  dx: Math.round(Math.cos((i / 18) * Math.PI * 2) * (24 + (i % 4) * 9)),
  dy: Math.round(-14 - Math.abs(Math.sin((i / 18) * Math.PI * 2)) * (26 + (i % 3) * 10)),
  c: COLORS[i % COLORS.length], r: (i * 47) % 360,
}));
function compactScreen(screens) {
  const a = snapshot();
  const hay = `${a.path} ${a.title}`.toLowerCase();
  for (const [re, msg] of screens) if (re.test(hay)) return msg;
  const head = a.title || "Ye screen";
  const list = a.opts.slice(0, 4).join(" · ");
  return (list ? `${head} — ${list}` : head).slice(0, 90);
}

/* ---------- mascot ---------- */
function Character({ pose, flip, rainy, brand }) {
  return (
    <svg className={`mc mc-${pose}${flip ? " mc-flip" : ""}${rainy ? " mc-rain" : ""}`} viewBox={`0 0 ${VB_W} ${VB_H}`} width={W} height={H}
      style={{ display: "block", overflow: "visible", transform: flip ? "scaleX(-1)" : "none" }} aria-hidden="true">
      <ellipse className="mc-shadow" cx="20" cy="70.8" rx="10" ry="1.7" fill="rgba(30,30,60,.2)" />
      <g className="mc-bob">
        {/* barsaati hood (peeche) */}
        <path className="mc-hood" d="M8.6 15 Q8.6 -3 20 -3 Q31.4 -3 31.4 15 L31.4 27 H8.6Z" fill={COAT} stroke="#D9A400" strokeWidth=".4" />
        {/* legs: jaangh + pindli */}
        <g className="mc-l-leg">
          <rect x="14.1" y="45.5" width="5.4" height="11.5" rx="2.5" fill={PANTS} />
          <g className="mc-l-knee"><rect x="14.1" y="55" width="5.4" height="11.5" rx="2.5" fill={PANTS} /><rect className="mc-shoe" x="12.6" y="64.2" width="8" height="4.2" rx="2.1" fill="#F6F6FA" stroke="#D6D6E2" strokeWidth=".3" /></g>
        </g>
        <g className="mc-r-leg">
          <rect x="20.5" y="45.5" width="5.4" height="11.5" rx="2.5" fill={PANTS} />
          <g className="mc-r-knee"><rect x="20.5" y="55" width="5.4" height="11.5" rx="2.5" fill={PANTS} /><rect className="mc-shoe" x="19.4" y="64.2" width="8" height="4.2" rx="2.1" fill="#F6F6FA" stroke="#D6D6E2" strokeWidth=".3" /></g>
        </g>
        {/* t-shirt */}
        <path d="M11.5 31.5 Q11.5 28 15.5 28 H24.5 Q28.5 28 28.5 31.5 L27.6 46.5 H12.4Z" fill="#FBFAFF" stroke="#E7E4F0" strokeWidth=".3" />
        {/* narangi apron */}
        <g className="mc-apron">
          <path d="M15.2 31 L17.8 27.3 M24.8 31 L22.2 27.3" stroke={ORANGE} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M13.4 31 H26.6 L27.6 52 Q20 53.6 12.4 52Z" fill={ORANGE} stroke={ORANGE_D} strokeWidth=".4" />
          <text className="mc-tx" x="20" y="35.6" fontSize="3.5" fontWeight="800" fill={NAVY} textAnchor="middle" textLength="11" lengthAdjust="spacingAndGlyphs" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>Hector365</text>
          <text className="mc-tx" x="20" y="40.6" fontSize="3.4" fontWeight="800" fill="#111" textAnchor="middle" textLength={brand.length * 1.75} lengthAdjust="spacingAndGlyphs" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>{brand}</text>
        </g>
        {/* barsaati coat */}
        <g className="mc-coat">
          <path d="M10.6 29 Q10.6 27 15 27 H25 Q29.4 27 29.4 29 L30.6 54 H9.4Z" fill={COAT} stroke="#D9A400" strokeWidth=".4" />
          <path d="M20 29 V53" stroke="#D9A400" strokeWidth=".5" /><circle cx="20" cy="36" r=".7" fill="#D9A400" /><circle cx="20" cy="42" r=".7" fill="#D9A400" /><circle cx="20" cy="48" r=".7" fill="#D9A400" />
        </g>
        {/* gardan + chehra */}
        <rect x="17.4" y="23" width="5.2" height="7" rx="2" fill={SKIN} />
        <g className="mc-head">
          <image href="/mascot.png" x="7.5" y="-1.5" width="25" height="26.3" />
          <g className="mc-cap">
            <path d="M9.6 6.6 Q9.6 -4 20.4 -4 Q31 -4 31 6.6 Z" fill="#FBFAFF" stroke="#E0DCEC" strokeWidth=".4" />
            <path d="M9.6 6.6 Q9.6 -1.2 15 -3.2 L15 6.6Z" fill={ORANGE} />
            <path d="M24 6.2 Q34.5 4.4 36.4 8.2 Q30.5 9 24 7.4Z" fill={ORANGE} stroke={ORANGE_D} strokeWidth=".3" />
            <text className="mc-tx" x="21" y="3.4" fontSize="5.2" fontWeight="900" fill={NAVY} textAnchor="middle" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>H</text>
          </g>
        </g>
        {/* left arm */}
        <g className="mc-l-arm">
          <rect x="7.8" y="35.6" width="3.4" height="7.4" rx="1.7" fill={SKIN} /><circle cx="9.5" cy="43.4" r="2.1" fill={SKIN} />
          <rect className="mc-sleeve" x="7" y="28.4" width="5" height="7.6" rx="2.4" fill="#FBFAFF" stroke="#E7E4F0" strokeWidth=".3" />
        </g>
        {/* jhadu / pocha */}
        <g className="mc-prop-broom"><rect x="33.6" y="30" width="1.3" height="39" rx=".6" fill="#A9743D" /><path d="M31.4 67.5 h6.1 l1.2 4 h-8.5z" fill="#E0B84A" /></g>
        <g className="mc-prop-mop"><rect x="33.6" y="30" width="1.3" height="38" rx=".6" fill="#B58A55" /><path d="M30.4 67 h7.6 l1.8 4.4 h-1.4 l-.6-1.8 l-.8 1.8 l-.8-1.8 l-.8 1.8 l-.8-1.8 l-.8 1.8 l-.8-1.8 l-.8 1.8 h-1.4z" fill="#ECECF3" stroke="#C9C9D8" strokeWidth=".3" /></g>
        {/* right arm */}
        <g className="mc-r-arm">
          <rect className="mc-cloth" x="27.4" y="41.4" width="6.4" height="5.2" rx="1.6" fill="#F6D56A" stroke="#E0B84A" strokeWidth=".4" />
          <rect x="28.6" y="35.6" width="3.4" height="7.4" rx="1.7" fill={SKIN} /><circle cx="30.3" cy="43.4" r="2.1" fill={SKIN} />
          <rect className="mc-sleeve" x="28" y="28.4" width="5" height="7.6" rx="2.4" fill="#FBFAFF" stroke="#E7E4F0" strokeWidth=".3" />
        </g>
        {/* chhatri */}
        <g className="mc-umb">
          <rect x="29.8" y="-4" width="1" height="48" rx=".5" fill="#6B5B4A" />
          <circle cx="30.3" cy="43.6" r="2.2" fill={SKIN} />
          <path d="M5 -3 Q6 -15 22 -16 Q38 -15 40 -3 Q35.5 -6.5 31 -3 Q26.5 -6.5 22 -3 Q17.5 -6.5 13 -3 Q8.5 -6.5 5 -3Z" fill={ORANGE} stroke={ORANGE_D} strokeWidth=".5" />
          <path d="M22 -16 L13 -3 M22 -16 L31 -3" stroke={ORANGE_D} strokeWidth=".4" fill="none" />
        </g>
      </g>
    </svg>
  );
}

function OfficeBack({ show, bucket }) {
  return (
    <svg width="100" height="64" viewBox="0 0 100 64" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", opacity: show ? 1 : 0, transition: "opacity .5s" }} aria-hidden="true">
      <ellipse cx="54" cy="60.5" rx="40" ry="2" fill="rgba(30,30,60,.12)" />
      {/* chair */}
      <rect x="25" y="31" width="3.2" height="19" rx="1.6" fill="#3D3A52" />
      <rect x="27" y="47.6" width="23" height="3.4" rx="1.7" fill="#4A4666" />
      <rect x="37.4" y="50.6" width="1.8" height="7.6" fill="#2E2B40" />
      <path d="M30 59 H46" stroke="#2E2B40" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="31" cy="59.6" r="1.4" fill="#2E2B40" /><circle cx="45" cy="59.6" r="1.4" fill="#2E2B40" />
      {/* bucket (pocha ke time) */}
      <g style={{ opacity: bucket ? 1 : 0, transition: "opacity .4s" }}>
        <ellipse cx="-6.5" cy="59.4" rx="8" ry="1.6" fill="rgba(80,140,220,.25)" />
        <path d="M-12 50.5 H-1 L-2.4 59 H-10.6Z" fill="#3D7FD9" stroke="#2C62AE" strokeWidth=".5" />
        <ellipse cx="-6.5" cy="50.5" rx="5.5" ry="1.3" fill="#8DBDF2" />
        <path d="M-11.6 51 Q-6.5 44 -1.4 51" fill="none" stroke="#2C62AE" strokeWidth=".7" />
      </g>
    </svg>
  );
}

function OfficeFront({ show, working, brand }) {
  return (
    <svg width="100" height="64" viewBox="0 0 100 64" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", opacity: show ? 1 : 0, transition: "opacity .5s" }} aria-hidden="true">
      {/* desk */}
      <rect x="54" y="40.4" width="36" height="3" rx="1.2" fill="#B98350" stroke="#9A6A3A" strokeWidth=".4" />
      <rect x="56.4" y="43.4" width="2.2" height="16.6" fill="#9A6A3A" /><rect x="85.4" y="43.4" width="2.2" height="16.6" fill="#9A6A3A" />
      {/* laptop */}
      <rect x="60" y="38.4" width="17" height="2.2" rx="1" fill="#5A5F7A" />
      <rect x="61.4" y="26" width="14.2" height="12.6" rx="1.4" fill="#2C3150" />
      <rect x="62.6" y="27.4" width="11.8" height="9.8" rx=".8" fill={working ? "#CFE9FF" : "#6E7596"} style={{ transition: "fill .5s" }} />
      {working && (<g className="mg-screen"><rect x="64" y="29" width="6" height="1" rx=".5" fill={ORANGE} /><rect x="64" y="31.4" width="8.6" height=".9" rx=".4" fill="#8FA6C8" /><rect x="64" y="33.4" width="7" height=".9" rx=".4" fill="#8FA6C8" /></g>)}
      <text x="68.5" y="36.4" fontSize="2.6" fontWeight="800" fill={NAVY} textAnchor="middle" opacity={working ? 0 : 0} style={{ fontFamily: "Arial" }}>{brand}</text>
      {/* chai ka mug */}
      <rect x="80" y="36.6" width="4.4" height="3.8" rx=".8" fill="#FBFAFF" stroke="#D6D2E4" strokeWidth=".3" /><path d="M84.4 37.6 q1.6 0 1.6 1.1 t-1.6 1.1" fill="none" stroke="#D6D2E4" strokeWidth=".5" />
    </svg>
  );
}

export default function MascotGuide({ name = "Saathi", brand = "Dukaan", accent = "#F28A1E", rules = NO_RULES, screens = NO_RULES, autoGuide = false, whatsapp = "" }) {
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [left, setLeft] = useState(false);
  const [moving, setMoving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [bubble, setBubble] = useState(null); // { text, kind: tip | ask | note }
  const [typed, setTyped] = useState("");
  const [act, setAct] = useState("sweep");
  const [stepping, setStepping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [react, setReact] = useState(null); // { kind: cheer | sad, id }
  const mountAt = useRef(Date.now());
  const lastReact = useRef(0);
  const wx = useWeather();
  const lastMut = useRef(0);
  const clickId = useRef(0);
  const posRef = useRef(pos);
  const onRef = useRef(on);
  const bubbleRef = useRef(null);
  const moveTimer = useRef(null);
  const hideTimer = useRef(null);
  const lastClick = useRef(0);
  posRef.current = pos;
  onRef.current = on;
  bubbleRef.current = bubble;
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const moveTo = useCallback((x, y) => {
    const cur = posRef.current;
    if (x !== cur.x) setLeft(x < cur.x);
    setPos({ x, y });
    setMoving(true);
    clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => setMoving(false), reduce ? 0 : MOVE_MS);
  }, [reduce]);

  const say = useCallback((text, ms, kind = "tip") => {
    setBubble({ text, kind });
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBubble(null), ms || Math.max(5200, text.length * 75));
  }, []);

  function persist(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) { /* ignore */ } }

  useEffect(() => {
    let isOn = true;
    try { isOn = localStorage.getItem(KEY) !== "0"; } catch (e) { /* ignore */ }
    setOn(isOn);
    setPos(isOn ? { x: window.innerWidth + 10, y: window.innerHeight - H - 90 } : { x: 8, y: 2 });
    setMounted(true);
    if (!isOn) return undefined;
    let greeted = false;
    try { greeted = sessionStorage.getItem("mascot_greeted") === "1"; } catch (e) { /* ignore */ }
    const t1 = setTimeout(() => moveTo(home().x, home().y), 2600);
    const t2 = setTimeout(() => {
      if (!onRef.current) return;
      const today = new Date().toDateString();
      let seen = false;
      try { seen = localStorage.getItem("mascot_hello_day") === today; localStorage.setItem("mascot_hello_day", today); } catch (e) { /* ignore */ }
      if (!seen && !greeted) say("Namaste 👋", 3200, "chip");
      try { sessionStorage.setItem("mascot_greeted", "1"); } catch (e) { /* ignore */ }
    }, 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bubble) { setTyped(""); return undefined; }
    let i = 0;
    setTyped("");
    const id = setInterval(() => {
      i += 1;
      setTyped(bubble.text.slice(0, i));
      if (i >= bubble.text.length) clearInterval(id);
    }, reduce ? 0 : 24);
    return () => clearInterval(id);
  }, [bubble, reduce]);

  useEffect(() => {
    if (!autoGuide) return undefined;
    async function onClick(e) {
      if (!onRef.current) return;
      const t = e.target;
      if (!(t instanceof Element) || t.closest("[data-mascot]")) return;
      const el = t.closest("button,a,input,select,textarea,label,summary,[role=button],[data-guide]");
      if (!el) return;
      const now = Date.now();
      if (now - lastClick.current < 350) return;
      lastClick.current = now;
      const id = ++clickId.current;
      const type = (el.getAttribute("type") || "").toLowerCase();
      const immediate = /^(input|textarea|select)$/i.test(el.tagName) || type === "checkbox" || type === "radio";
      let actionText = guideFor(el);
      const lab = labelOf(el).toLowerCase();
      for (const [re, msg] of rules) { if (re.test(lab)) { actionText = msg; break; } }
      const before = immediate ? null : snapshot();
      const vw = window.innerWidth, vh = window.innerHeight;
      const px = e.clientX || vw / 2, py = e.clientY || vh / 2;
      const x = px + W + 20 > vw ? clamp(px - W - 12, 4, vw - W - 4) : clamp(px + 10, 4, vw - W - 4);
      const y = py < 120 ? clamp(py + 16, 4, vh - H - 4) : clamp(py - H - 2, 4, vh - H - 4);
      moveTo(x, y);
      setBubble(null);
      await sleep(reduce ? 0 : MOVE_MS - 100);
      if (id !== clickId.current || !onRef.current) return;
      if (immediate) { say(actionText); return; }
      // naya screen khulne ka intezaar, phir us screen ke baare me batao
      const t0 = Date.now();
      await sleep(500);
      while (Date.now() - lastMut.current < 450 && Date.now() - t0 < 3500) await sleep(150);
      if (id !== clickId.current || !onRef.current) return;
      const after = snapshot();
      say(after.sig !== before.sig ? describeScreen(before, after, screens) : actionText);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [moveTo, say, reduce, rules, screens, autoGuide]);

  useEffect(() => {
    const mo = new MutationObserver((list) => {
      for (const m of list) { const n = m.target; if (!(n.nodeType === 1 && n.closest && n.closest("[data-mascot]")) && !(n.parentElement && n.parentElement.closest && n.parentElement.closest("[data-mascot]"))) { lastMut.current = Date.now(); return; } }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    // toast/message dikhe to mascot khush ya udaas hota hai
    const ro = new MutationObserver((list) => {
      if (!onRef.current || Date.now() - mountAt.current < 3500 || Date.now() - lastReact.current < 6000) return;
      for (const m of list) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1 || n.closest("[data-mascot]") || !looksLikeToast(n)) continue;
          const txt = tidy(n.innerText);
          if (txt.length < 4 || txt.length > 140) continue;
          const kind = BAD_RE.test(txt) ? "sad" : OK_RE.test(txt) ? "cheer" : null;
          if (!kind) continue;
          lastReact.current = Date.now();
          setReact({ kind, id: Date.now() });
          setMenu(false);
          setBubble({ text: kind === "cheer" ? "🎉" : "😟", kind: "emoji" });
          clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setBubble(null), 2400);
          setTimeout(() => setReact((r) => (r && r.kind === kind ? null : r)), 2400);
          return;
        }
      }
    });
    ro.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); ro.disconnect(); };
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!(e.target instanceof Element) || !e.target.closest("[data-mascot]")) setMenu(false); };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [menu]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!onRef.current || bubbleRef.current || document.visibilityState !== "visible") return;
      const a = document.activeElement;
      if (a && /^(input|textarea|select)$/i.test(a.tagName)) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      moveTo(clamp(Math.random() * (vw - W - 20) + 6, 6, vw - W - 6), vh - H - 90);
    }, 17000);
    return () => clearInterval(id);
  }, [moveTo]);

  // off: logo ke paas khada hokar jhadu, pocha, laptop par kaam, safai
  useEffect(() => {
    if (on) { setHidden(false); return undefined; }
    function place() {
      const r = findLogo();
      if (r) {
        setHidden(false);
        const x = clamp(r.right - 4, 0, Math.max(0, window.innerWidth - 98));
        const y = Math.max(2, r.bottom + 3 - H);
        const cur = posRef.current;
        if (Math.abs(cur.x - x) > 1 || Math.abs(cur.y - y) > 1) moveTo(x, y);
      } else if (window.scrollY < 60) {
        setHidden(false);
        setPos({ x: 8, y: 2 });
      } else {
        setHidden(true);
      }
    }
    place();
    const id = setInterval(place, 500);
    window.addEventListener("resize", place);
    // safai (jhadu, pocha, ponchna) -> office me kaam / kabhi neend; 1 ghante baad phir safai
    const demo = /[?&]mascot=demo/.test(window.location.search);
    const every = demo ? 70000 : CLEAN_EVERY;
    let alive = true;
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (alive) fn(); }, ms)); };
    let cur = "sweep";
    const setPhase = (ph) => {
      if (isSit(cur) !== isSit(ph)) { setStepping(true); later(() => setStepping(false), reduce ? 0 : 950); }
      cur = ph; setAct(ph);
    };
    const lastClean = () => { try { return Number(localStorage.getItem(LAST_CLEAN) || 0); } catch (e) { return 0; } };
    const markClean = () => { try { localStorage.setItem(LAST_CLEAN, String(Date.now())); } catch (e) { /* ignore */ } };
    function work() {
      setPhase("work");
      later(() => {
        if (Date.now() - lastClean() >= every) { clean(); return; }
        if (Math.random() < 0.3) { setPhase("sleep"); later(work, demo ? rand(9000, 12000) : rand(40000, 75000)); } else work();
      }, demo ? rand(7000, 10000) : rand(45000, 90000));
    }
    function clean() {
      setPhase("sweep");
      later(() => setPhase("mop"), 6500);
      later(() => setPhase("wipe"), 13000);
      later(() => { markClean(); work(); }, 18500);
    }
    if (Date.now() - lastClean() >= every) clean(); else work();
    return () => { alive = false; timers.forEach(clearTimeout); clearInterval(id); window.removeEventListener("resize", place); };
  }, [on, moveTo, reduce]);

  function turnOff() {
    setOn(false); persist(false); setMenu(false);
    say("👍", 1800, "emoji");
  }

  function turnOn() {
    setOn(true); persist(true);
    setLeft(false);
    setBubble(null);
    const h = home();
    moveTo(h.x, h.y);
    setTimeout(() => say("👋", 1800, "emoji"), reduce ? 0 : MOVE_MS - 100);
  }

  function onMascotClick() {
    if (!on) {
      if (bubble && bubble.kind === "ask") { setBubble(null); return; }
      say("Guide karun?", 8000, "ask");
      return;
    }
    setBubble(null);
    setMenu((m) => !m);
  }

  function explain() { setMenu(false); say(compactScreen(screens), 6500, "chip"); }
  async function share() {
    setMenu(false);
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      say("Link copy ho gaya ✓", 2400, "chip");
    } catch (e) { /* user ne cancel kiya */ }
  }
  function help() {
    setMenu(false);
    const num = String(whatsapp).replace(/\D/g, "");
    if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent("Namaste, mujhe madad chahiye: " + window.location.href)}`, "_blank", "noopener");
  }

  if (!mounted) return null;

  const rainy = on && wx.kind === "rain";
  const activity = act;
  const sitting = !on && isSit(activity) && !moving;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const bw = Math.min(170, vw - 20);
  const bx = clamp(pos.x + W / 2 - bw / 2, 10, vw - bw - 10) - pos.x;
  const above = pos.y > 110;
  const reactKind = on && react ? react.kind : null;
  const pose = (moving || stepping) ? "walk" : reactKind ? reactKind : on ? (bubble && bubble.kind !== "emoji" ? "talk" : "idle") : (bubble && bubble.kind !== "emoji" ? "talk" : activity);
  const flip = on ? left : (moving || stepping ? left : !isSit(activity));
  const showSparks = !on && !bubble && activity === "wipe";
  const items = [
    { ic: "💡", lb: "Samjhao", fn: explain },
    { ic: "📤", lb: "Share", fn: share },
    ...(String(whatsapp).replace(/\D/g, "") ? [{ ic: "💬", lb: "Madad", fn: help }] : []),
    { ic: "😴", lb: "Chhutti", fn: turnOff },
  ];
  const mw = items.length * 42;
  const mx = clamp(pos.x + W / 2 - mw / 2, 8, vw - mw - 8) - pos.x;
  const chip = { whiteSpace: "nowrap", border: "none", borderRadius: 999, padding: "3px 10px", fontWeight: 700, fontSize: 11, cursor: "pointer" };
  const halo = "0 0 2px #fff,0 0 2px #fff,0 0 4px #fff,0 0 6px #fff,0 0 9px rgba(255,255,255,.9)";

  return (
    <>
      <WeatherSky kind={wx.kind} day={wx.day} />
      <div data-mascot="1" aria-live="polite" style={{
        position: "fixed", left: 0, top: 0, zIndex: 9000, pointerEvents: "none",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: reduce ? "none" : `transform ${MOVE_MS}ms cubic-bezier(.45,.05,.3,1), opacity .3s`,
        opacity: hidden ? 0 : 1, width: W, height: H,
      }}>
        <style>{`
          .mc *{transform-box:view-box}
          .mc-l-leg{transform-origin:16.8px 46px}.mc-r-leg{transform-origin:23.2px 46px}
          .mc-l-knee{transform-origin:16.8px 56px}.mc-r-knee{transform-origin:23.2px 56px}
          .mc-l-arm{transform-origin:10.6px 30px}.mc-r-arm{transform-origin:29.4px 30px}
          .mc-head{transform-origin:20px 24px}.mc-bob{transform-origin:20px 70px}
          .mc-prop-broom,.mc-prop-mop{transform-origin:34.2px 31px;display:none}
          .mc-cloth,.mc-hood,.mc-coat,.mc-umb{display:none}
          .mc-flip .mc-tx{transform-box:fill-box;transform-origin:center;transform:scaleX(-1)}
          .mc-l-leg,.mc-r-leg,.mc-l-knee,.mc-r-knee,.mc-l-arm,.mc-r-arm,.mc-head,.mc-prop-broom,.mc-prop-mop{transition:transform .6s ease}
          .mc-rain .mc-apron,.mc-rain .mc-cap{display:none}
          .mc-rain .mc-hood,.mc-rain .mc-coat,.mc-rain .mc-umb{display:block}
          .mc-rain .mc-sleeve{fill:${COAT}}.mc-rain .mc-shoe{fill:${COAT};stroke:#D9A400}
          .mc-rain .mc-r-arm,.mc-rain.mc-walk .mc-r-arm,.mc-rain.mc-talk .mc-r-arm,.mc-rain.mc-idle .mc-r-arm{animation:none!important;transform:rotate(0)}
          .mc-work .mc-shadow,.mc-sleep .mc-shadow{opacity:0}
          @keyframes mcSwing{from{transform:rotate(-17deg)}to{transform:rotate(17deg)}}
          @keyframes mcSwingArm{from{transform:rotate(-13deg)}to{transform:rotate(13deg)}}
          @keyframes mcBob{from{transform:translateY(0)}to{transform:translateY(-.9px)}}
          @keyframes mcBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-.5px)}}
          @keyframes mcTalkArm{from{transform:rotate(-38deg)}to{transform:rotate(-72deg)}}
          @keyframes mcRub{from{transform:rotate(-84deg)}to{transform:rotate(-112deg)}}
          @keyframes mcNod{from{transform:rotate(-2deg)}to{transform:rotate(2.5deg)}}
          @keyframes mcSwish{from{transform:rotate(-8deg)}to{transform:rotate(7deg)}}
          @keyframes mcMop{from{transform:rotate(-14deg)}to{transform:rotate(13deg)}}
          @keyframes mcTypeA{from{transform:rotate(-60deg)}to{transform:rotate(-67deg)}}
          @keyframes mcTypeB{from{transform:rotate(-66deg)}to{transform:rotate(-58deg)}}
          @keyframes mcTwinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(35deg)}}
          .mc-walk .mc-bob{animation:mcBob .31s ease-in-out infinite alternate}
          .mc-walk .mc-l-leg,.mc-walk .mc-r-arm{animation:mcSwing .62s ease-in-out infinite alternate}
          .mc-walk .mc-r-leg,.mc-walk .mc-l-arm{animation:mcSwing .62s ease-in-out infinite alternate-reverse}
          .mc-walk .mc-r-arm,.mc-walk .mc-l-arm{animation-name:mcSwingArm}
          .mc-idle .mc-bob,.mc-talk .mc-bob,.mc-wipe .mc-bob,.mc-sweep .mc-bob,.mc-mop .mc-bob{animation:mcBreath 3.2s ease-in-out infinite}
          .mc-talk .mc-r-arm{animation:mcTalkArm 1s ease-in-out infinite alternate}
          .mc-talk .mc-head{animation:mcNod 1.3s ease-in-out infinite alternate}
          .mc-wipe .mc-r-arm{animation:mcRub .65s ease-in-out infinite alternate}
          .mc-wipe .mc-cloth{display:block}
          .mc-sweep .mc-prop-broom{display:block;animation:mcSwish 1.1s ease-in-out infinite alternate}
          .mc-sweep .mc-r-arm{transform:rotate(-20deg)}.mc-sweep .mc-l-arm{transform:rotate(-14deg)}
          .mc-mop .mc-prop-mop{display:block;animation:mcMop .95s ease-in-out infinite alternate}
          .mc-mop .mc-r-arm{transform:rotate(-22deg)}.mc-mop .mc-l-arm{transform:rotate(-16deg)}
          .mc-work .mc-bob{animation:none}
          .mc-work .mc-l-leg{transform:rotate(-88deg)}.mc-work .mc-l-knee{transform:rotate(90deg)}
          .mc-work .mc-r-leg{transform:rotate(-84deg)}.mc-work .mc-r-knee{transform:rotate(86deg)}
          .mc-work .mc-l-arm{animation:mcTypeA .36s ease-in-out infinite alternate}
          .mc-work .mc-r-arm{animation:mcTypeB .4s ease-in-out infinite alternate}
          .mc-work .mc-head{transform:rotate(3deg)}
          .mc-sleep .mc-bob{animation:mcBreath 3.6s ease-in-out infinite}
          .mc-sleep .mc-l-leg{transform:rotate(-88deg)}.mc-sleep .mc-l-knee{transform:rotate(90deg)}
          .mc-sleep .mc-r-leg{transform:rotate(-84deg)}.mc-sleep .mc-r-knee{transform:rotate(86deg)}
          .mc-sleep .mc-l-arm{transform:rotate(-74deg)}.mc-sleep .mc-r-arm{transform:rotate(-80deg)}
          .mc-sleep .mc-head{transform:rotate(34deg) translate(1px,1.5px)}
          @keyframes mgZ{0%{opacity:0;transform:translateY(4px)}30%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
          .mg-z{position:absolute;font-weight:800;font-size:10px;color:#6B7FB0;text-shadow:0 0 3px #fff;animation:mgZ 2.4s ease-in-out infinite}
          .mg-spark{position:absolute;color:#F2B83C;font-size:11px;line-height:1;animation:mcTwinkle 1.4s ease-in-out infinite}
          .mg-chip{position:absolute;pointer-events:auto;cursor:pointer;background:rgba(255,255,255,.95);color:#2A241B;font-size:11px;line-height:1.3;font-weight:600;font-family:inherit;padding:6px 10px;border-radius:12px;box-shadow:0 3px 12px rgba(40,30,20,.18);animation:mgPop .25s ease-out}
          .mg-emoji{position:absolute;left:50%;margin-left:-14px;width:28px;text-align:center;font-size:22px;line-height:1;animation:mgBounce .7s ease-out}
          .mg-menu{position:absolute;display:flex;justify-content:center;gap:6px;pointer-events:auto;animation:mgPop .2s ease-out}
          .mg-menu button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:36px}
          .mg-ic{width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 3px 10px rgba(40,30,20,.22);display:flex;align-items:center;justify-content:center;font-size:15px}
          .mg-lb{font-size:8.5px;font-weight:700;color:#2A241B;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff}
          .mg-conf{position:absolute;left:50%;top:30%;width:5px;height:8px;border-radius:1px;opacity:0;pointer-events:none;animation:mgConf 1.3s ease-out forwards}
          @keyframes mgPop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
          @keyframes mgBounce{0%{opacity:0;transform:translateY(8px) scale(.6)}60%{opacity:1;transform:translateY(-4px) scale(1.15)}100%{opacity:1;transform:translateY(0) scale(1)}}
          @keyframes mgConf{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--dx),calc(var(--dy) + 46px)) rotate(var(--r))}}
          @keyframes mcJump{0%,100%{transform:translateY(0)}45%{transform:translateY(-7px)}}
          @keyframes mcShake{0%,100%{transform:rotate(14deg)}25%{transform:rotate(7deg)}75%{transform:rotate(20deg)}}
          .mc-cheer .mc-bob{animation:mcJump .5s ease-out 4}
          .mc-cheer .mc-r-arm{transform:rotate(-152deg)}.mc-cheer .mc-l-arm{transform:rotate(152deg)}
          .mc-cheer .mc-head{animation:mcNod .3s ease-in-out infinite alternate}
          .mc-sad .mc-head{animation:mcShake .5s ease-in-out 3}
          @media (prefers-reduced-motion: reduce){.mc *,.mg-spark{animation:none!important}}
        `}</style>
        <OfficeBack show={!on} bucket={!on && activity === "mop"} />
        {bubble && bubble.kind === "emoji" && (
          <div className="mg-emoji" style={above ? { bottom: H + 2 + (rainy ? 16 : 0) } : { top: H + 2 }}>{bubble.text}</div>
        )}
        {bubble && bubble.kind !== "emoji" && (
          <div data-mascot="1" className="mg-chip" onClick={() => bubble.kind !== "ask" && setBubble(null)} style={{
            left: bx, width: bw, ...(above ? { bottom: H + 6 + (rainy ? 16 : 0) } : { top: H + 6 }),
          }}>
            <span style={{ visibility: "hidden" }}>{bubble.text}</span>
            <span style={{ position: "absolute", left: 10, top: 6, right: 10 }}>{typed}</span>
            {bubble.kind === "ask" && (
              <button data-mascot="1" onClick={turnOn} style={{ ...chip, marginLeft: 8, background: accent, color: "#fff" }}>Haan</button>
            )}
          </div>
        )}
        {menu && on && (
          <div data-mascot="1" className="mg-menu" style={{ left: mx, width: mw, ...(above ? { bottom: H + 6 + (rainy ? 16 : 0) } : { top: H + 6 }) }}>
            {items.map((it) => (
              <button key={it.lb} data-mascot="1" onClick={it.fn} aria-label={it.lb}>
                <span className="mg-ic">{it.ic}</span><span className="mg-lb">{it.lb}</span>
              </button>
            ))}
          </div>
        )}
        {reactKind === "cheer" && CONFETTI.map((c, i) => (
          <span key={`${react.id}-${i}`} className="mg-conf" style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--r": `${c.r}deg`, background: c.c, animationDelay: `${(i % 5) * 40}ms` }} />
        ))}
        {showSparks && (
          <>
            <span className="mg-spark" style={{ left: -12, top: 18 }}>✦</span>
            <span className="mg-spark" style={{ left: -22, top: 30, animationDelay: ".5s", fontSize: 9 }}>✦</span>
            <span className="mg-spark" style={{ left: -6, top: 36, animationDelay: "1s", fontSize: 8 }}>✦</span>
          </>
        )}
        <div style={{
          transform: sitting ? "translate(22px, 8.5px)" : "translate(0,0)", transition: reduce ? "none" : "transform .9s ease",
          filter: "drop-shadow(0 3px 4px rgba(30,30,60,.2))",
        }}>
          <Character pose={sitting ? activity : pose} flip={sitting ? false : flip} rainy={rainy} brand={brand} />
        </div>
        <OfficeFront show={!on} working={sitting && activity === "work"} brand={brand} />
        {sitting && activity === "sleep" && (<>
          <span className="mg-z" style={{ left: 44, top: 0 }}>z</span>
          <span className="mg-z" style={{ left: 52, top: -8, animationDelay: ".8s", fontSize: 12 }}>z</span>
          <span className="mg-z" style={{ left: 61, top: -17, animationDelay: "1.6s", fontSize: 14 }}>Z</span>
        </>)}
        <button data-mascot="1" onClick={onMascotClick} aria-label={on ? `${name} guide` : `${name} guide chalu karo`}
          style={{
            position: "absolute", left: sitting ? 22 : 2, top: sitting ? 12 : 2, width: W - 4, height: H - 4, padding: 0, border: "none", background: "transparent",
            cursor: "pointer", pointerEvents: "auto", WebkitTapHighlightColor: "transparent",
          }} />
      </div>
    </>
  );
}
