import { useCallback, useEffect, useRef, useState } from "react";

// Hector365 office mascot: sirf saaf-safai aur kaam karta dikhta hai (entertainment).
// Na bolta hai, na beech screen me aata hai. Hamesha logo ke paas apne chhote office me rehta hai.
// Kisi click ko rokta ya badalta nahi (pointer-events band).

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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isShown(el) {
  if (!el || el.closest("[data-mascot]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = window.getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none";
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
// safai ke liye upar ke 3 button/tab (logo ke alawa)
function tourTargets(logo) {
  const out = [];
  for (const e of document.querySelectorAll("header button, header a, nav button, nav a, [role=tab]")) {
    if (!isShown(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.top < 0 || r.bottom > 150 || r.width < 24 || r.height < 20 || r.right > window.innerWidth - 8) continue;
    if (logo && Math.abs(r.left - logo.left) < 6 && Math.abs(r.top - logo.top) < 6) continue;
    if (out.some((o) => Math.abs(o.left - r.left) < 8 && Math.abs(o.top - r.top) < 8)) continue;
    out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, el: e });
  }
  const step = Math.max(1, Math.floor(out.length / 3));
  return out.filter((_, i) => i % step === 0).slice(0, 3);
}

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

const COLORS = ["#F28A1E", "#F6C21B", "#3D7FD9", "#E4572E", "#2FA36B", "#9B5DE5"];
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  dx: Math.round(Math.cos((i / 18) * Math.PI * 2) * (24 + (i % 4) * 9)),
  dy: Math.round(-14 - Math.abs(Math.sin((i / 18) * Math.PI * 2)) * (26 + (i % 3) * 10)),
  c: COLORS[i % COLORS.length], r: (i * 47) % 360,
}));
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


const MASCOT_CSS = `
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
        `;

const DUST_BG = [
  "radial-gradient(circle at 20% 30%, rgba(110,92,70,.65) 0 .9px, transparent 1.4px)",
  "radial-gradient(circle at 70% 60%, rgba(110,92,70,.55) 0 .8px, transparent 1.3px)",
  "radial-gradient(circle at 45% 85%, rgba(110,92,70,.5) 0 1px, transparent 1.5px)",
  "linear-gradient(rgba(150,132,108,.14), rgba(150,132,108,.14))",
].join(",");

export default function MascotGuide({ name = "Hector", brand = "Dukaan" }) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [left, setLeft] = useState(true);
  const [moving, setMoving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [office, setOffice] = useState(null); // { x, y } office ka kona
  const [logoBox, setLogoBox] = useState(null);
  const [act, setAct] = useState("work");
  const [tourBox, setTourBox] = useState(null);
  const [dust, setDust] = useState({ op: 0, wipe: false });
  const [react, setReact] = useState(null); // { kind: cheer | sad, id }
  const [emoji, setEmoji] = useState(null);
  const wx = useWeather();
  const posRef = useRef(pos);
  const moveTimer = useRef(null);
  const mountAt = useRef(Date.now());
  const lastReact = useRef(0);
  posRef.current = pos;
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const moveTo = useCallback((x, y) => {
    const cur = posRef.current;
    if (Math.abs(x - cur.x) < 0.5 && Math.abs(y - cur.y) < 0.5) return;
    if (x !== cur.x) setLeft(x < cur.x);
    setPos({ x, y });
    setMoving(true);
    clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => setMoving(false), reduce ? 0 : MOVE_MS);
  }, [reduce]);

  useEffect(() => { setMounted(true); }, []);

  // logo ke paas office ki jagah ka pata rakho (scroll/resize/late load)
  useEffect(() => {
    function place() {
      if (document.visibilityState !== "visible") return;
      const r = findLogo();
      if (r) {
        setHidden(false);
        setLogoBox({ left: r.left, top: r.top, width: r.width, height: r.height });
        setOffice({ x: clamp(r.right - 4, 0, Math.max(0, window.innerWidth - 98)), y: Math.max(2, r.bottom + 3 - H) });
      } else if (window.scrollY < 60) {
        setHidden(false); setLogoBox(null); setOffice({ x: 8, y: 2 });
      } else {
        setHidden(true);
      }
    }
    place();
    const id = setInterval(place, 500);
    window.addEventListener("resize", place);
    return () => { clearInterval(id); window.removeEventListener("resize", place); };
  }, []);

  // kahan khada hona hai: chair par, logo ke paas, ya kisi button ke paas safai ke liye
  useEffect(() => {
    if (!office) return;
    let t;
    if (act === "tour" && tourBox) t = { x: clamp(tourBox.right - 4, 0, window.innerWidth - W), y: Math.max(2, tourBox.bottom + 3 - H) };
    else if (isSit(act)) t = { x: office.x + 22, y: office.y + 8.5 };
    else t = { x: office.x, y: office.y };
    if (posRef.current.x === 0 && posRef.current.y === 0) { setPos(t); posRef.current = t; setLeft(!isSit(act)); return; }
    moveTo(t.x, t.y);
  }, [office, act, tourBox, moveTo]);

  // dhool: waqt ke saath halki badhti hai
  useEffect(() => {
    function level() {
      let last = 0;
      try { last = Number(localStorage.getItem(LAST_CLEAN) || 0); } catch (e) { /* ignore */ }
      const hrs = last ? (Date.now() - last) / 3600000 : 3;
      return clamp(hrs * 0.08, 0.04, 0.22);
    }
    setDust((d) => (d.wipe ? d : { op: level(), wipe: false }));
    const id = setInterval(() => setDust((d) => (d.wipe ? d : { op: level(), wipe: false })), 60000);
    return () => clearInterval(id);
  }, []);

  // routine: safai (jhadu, pocha, logo ponchna, upar ke buttons ponchna) -> office me kaam / kabhi neend; 1 ghante baad phir safai
  useEffect(() => {
    const demo = /[?&]mascot=demo/.test(window.location.search);
    const every = demo ? 70000 : CLEAN_EVERY;
    let alive = true;
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (alive) fn(); }, ms)); };
    const lastClean = () => { try { return Number(localStorage.getItem(LAST_CLEAN) || 0); } catch (e) { return 0; } };
    const markClean = () => { try { localStorage.setItem(LAST_CLEAN, String(Date.now())); } catch (e) { /* ignore */ } };
    function work() {
      setAct("work");
      later(() => {
        if (Date.now() - lastClean() >= every) { clean(); return; }
        if (Math.random() < 0.3) { setAct("sleep"); later(work, demo ? rand(9000, 12000) : rand(40000, 75000)); } else work();
      }, demo ? rand(7000, 10000) : rand(45000, 90000));
    }
    function tour(list, i) {
      if (i >= list.length) { setTourBox(null); work(); return; }
      setTourBox(list[i]); setAct("tour");
      later(() => tour(list, i + 1), 4800);
    }
    function clean() {
      setAct("sweep");
      later(() => setAct("mop"), 6500);
      later(() => { setAct("wipe"); setDust((d) => ({ ...d, wipe: true })); }, 13000);
      later(() => {
        markClean();
        setDust({ op: 0, wipe: false });
        const targets = tourTargets(findLogo());
        if (targets.length) tour(targets, 0); else work();
      }, 18500);
    }
    later(() => { if (Date.now() - lastClean() >= every) clean(); else work(); }, 1200);
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  // mascot par dabao: bas khush hokar haath hilata hai (entertainment)
  function onTap() {
    if (isSit(act)) return;
    setReact({ kind: "cheer", id: Date.now() });
    setEmoji("👋");
    setTimeout(() => { setReact(null); setEmoji(null); }, 1800);
  }

  // toast message par khush/udaas (sirf jahan khada hai wahin, kahin jaata nahi)
  useEffect(() => {
    const OK = /(success|successful|safal|placed|confirmed|ho gaya|ho gayi|dhanyavaad|thank you|badhai|saved|submitted)/i;
    const BAD = /(error|failed|failure|galat|nahi ho|invalid|wrong|try again)/i;
    const SEL = '[role=alert],[role=status],[class*="toast" i],[class*="snack" i],[class*="notif" i]';
    const ro = new MutationObserver((list) => {
      if (Date.now() - mountAt.current < 3500 || Date.now() - lastReact.current < 6000) return;
      for (const m of list) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1 || n.closest("[data-mascot]")) continue;
          let isToast = false;
          try { isToast = n.matches(SEL) || !!n.querySelector(SEL) || window.getComputedStyle(n).position === "fixed"; } catch (e) { /* ignore */ }
          if (!isToast) continue;
          const txt = String(n.innerText || "").replace(/\s+/g, " ").trim();
          if (txt.length < 4 || txt.length > 140) continue;
          const kind = BAD.test(txt) ? "sad" : OK.test(txt) ? "cheer" : null;
          if (!kind) continue;
          lastReact.current = Date.now();
          setReact({ kind, id: Date.now() });
          setEmoji(kind === "cheer" ? "🎉" : "😟");
          setTimeout(() => { setReact(null); setEmoji(null); }, 2400);
          return;
        }
      }
    });
    ro.observe(document.body, { childList: true, subtree: true });
    return () => ro.disconnect();
  }, []);

  if (!mounted) return null;

  const standing = !isSit(act);
  const rainy = wx.kind === "rain" && standing;
  const sitting = isSit(act) && !moving;
  const reactKind = standing && react ? react.kind : null;
  const pose = moving ? "walk" : reactKind || act === "tour" ? (reactKind || "wipe") : act;
  const flip = moving ? left : !isSit(act);
  const showSparks = !moving && (act === "wipe" || act === "tour");
  const above = pos.y > 70;

  return (
    <>
      <WeatherSky kind={wx.kind} day={wx.day} />
      <style>{MASCOT_CSS}</style>
      {/* logo par dhool: Hector ke ponchne par haath ki taraf se saaf hoti hai */}
      {logoBox && dust.op > 0 && (
        <div aria-hidden="true" style={{
          position: "fixed", left: logoBox.left, top: logoBox.top, width: logoBox.width, height: logoBox.height, pointerEvents: "none", zIndex: 8000,
          backgroundImage: DUST_BG, backgroundSize: "9px 9px, 13px 13px, 7px 7px, auto", opacity: dust.op,
          clipPath: dust.wipe ? "inset(0 100% 0 0)" : "inset(0 0 0 0)", transition: dust.wipe && !reduce ? "clip-path 5s linear" : "none",
        }} />
      )}
      {/* office: logo ke paas */}
      {office && !hidden && (
        <>
          <div aria-hidden="true" style={{ position: "fixed", left: office.x, top: office.y, width: W, height: H, zIndex: 8998, pointerEvents: "none" }}>
            <OfficeBack show bucket={act === "mop"} />
          </div>
          <div aria-hidden="true" style={{ position: "fixed", left: office.x, top: office.y, width: W, height: H, zIndex: 9001, pointerEvents: "none" }}>
            <OfficeFront show working={sitting && act === "work"} brand={brand} />
          </div>
        </>
      )}
      <div data-mascot="1" style={{
        position: "fixed", left: 0, top: 0, zIndex: 9000, pointerEvents: "none",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: reduce ? "none" : `transform ${MOVE_MS}ms cubic-bezier(.45,.05,.3,1), opacity .3s`,
        opacity: hidden ? 0 : 1, width: W, height: H,
      }}>
        {emoji && <div className="mg-emoji" style={above ? { bottom: H + 2 + (rainy ? 16 : 0) } : { top: H + 2 }}>{emoji}</div>}
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
        {sitting && act === "sleep" && (
          <>
            <span className="mg-z" style={{ left: 22, top: -2 }}>z</span>
            <span className="mg-z" style={{ left: 30, top: -10, animationDelay: ".8s", fontSize: 12 }}>z</span>
            <span className="mg-z" style={{ left: 39, top: -19, animationDelay: "1.6s", fontSize: 14 }}>Z</span>
          </>
        )}
        <div style={{ filter: "drop-shadow(0 3px 4px rgba(30,30,60,.2))" }}>
          <Character pose={sitting ? act : pose} flip={sitting ? false : flip} rainy={rainy} brand={brand} />
        </div>
        <button data-mascot="1" onClick={onTap} aria-label={name}
          style={{ position: "absolute", left: 2, top: 2, width: W - 4, height: H - 4, padding: 0, border: "none", background: "transparent", cursor: "pointer", pointerEvents: "auto", WebkitTapHighlightColor: "transparent" }} />
      </div>
    </>
  );
}
