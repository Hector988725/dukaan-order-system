import { useCallback, useEffect, useRef, useState } from "react";

// Mascot saathi: screen par ghoomta hai, jahan dabao wahan aakar chhota sa guide likhta hai.
// Band karne par logo ke paas chhota hokar baith jata hai; usse dabao to wapas chalu.
// Kisi bhi click ko rokta ya badalta nahi (sirf sunta hai).

const NO_RULES = [];
const KEY = "mascot_guide_on";
const SCALE = 0.85; // mascot ka size: chhota/bada karna ho to sirf ye number badlo
const VB_W = 40;
const VB_H = 74;
const W = Math.round(VB_W * SCALE);
const H = Math.round(VB_H * SCALE);
const DOCK_SCALE = 0.85;
const MOVE_MS = 900;
const ACTIVITIES = ["wipe", "sweep", "polish", "wave"];

const RULES = [
  [/add to cart|cart me|\bjodo\b|\badd\b/, "Ye cheez aapki cart me jud jayegi. Quantity baad me badal sakte ho."],
  [/place order|order kar|checkout|\border\b/, "Order bhejne se pehle cart aur delivery address ek baar check kar lo."],
  [/pay|upi|razorpay|subscribe|upgrade|\bplan\b/, "Payment Razorpay ke surakshit page par hoti hai. Kisi ko apna PIN ya OTP mat batana."],
  [/log ?in|sign ?in/, "Apna email aur password daalo. Password yaad na ho to 'Forgot password' dabao."],
  [/sign ?up|register|create|banao|naya|\bnew\b/, "Naya account ya dukaan banane ke liye jaankari bharo. Email sahi daalna, usi par link aayega."],
  [/log ?out|sign ?out/, "Isse aap is device par logout ho jaoge."],
  [/delete|remove|hatao|hata do|cancel/, "Dhyan se! Ye hatane ke baad wapas nahi aayega."],
  [/save|update|submit|confirm|\bdone\b|bhej/, "Ye aapki bhari hui jaankari save kar dega."],
  [/search|khoj|dhoond/, "Yaha naam likho, matching items turant dikh jayenge."],
  [/dismiss|not now|later|abhi nahi/, "Ye is message ko abhi ke liye hata dega."],
  [/back|close|wapas|✕|×/, "Ye pichhli screen par wapas le jayega."],
  [/install/, "Ye app ko aapke phone ki home screen par laga dega, bilkul normal app ki tarah."],
  [/whatsapp|share/, "Isse aap link ya jaankari dost ya customer ko bhej sakte ho."],
  [/\bcall\b|phone|dial/, "Ye seedha phone dialer kholega."],
  [/bill|khata|ledger|udhaar/, "Yaha bill aur udhaar (khata) ka hisaab rehta hai."],
  [/stock|inventory|product|\bitem|saman/, "Yaha apne saman aur stock ki list sambhalo."],
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
const NAVY = "#243B6B";

// Patla lamba mascot: chehra (tumhari image se) + SVG body. Kapde par sirf "Hector365".
function Character({ pose, flip }) {
  return (
    <svg className={`mc mc-${pose}${flip ? " mc-flip" : ""}`} viewBox={`0 0 ${VB_W} ${VB_H}`} width={W} height={H}
      style={{ display: "block", overflow: "visible", transform: flip ? "scaleX(-1)" : "none" }} aria-hidden="true">
      <ellipse cx="20" cy="70.8" rx="10" ry="1.7" fill="rgba(30,30,60,.2)" />
      <g className="mc-bob">
        <g className="mc-l-leg"><rect x="14.1" y="45.5" width="5.4" height="21" rx="2.5" fill={NAVY} /><rect x="12.6" y="64.2" width="8" height="4.2" rx="2.1" fill="#F6F6FA" stroke="#D6D6E2" strokeWidth=".3" /><rect x="12.6" y="66.2" width="8" height=".8" fill={ORANGE} /></g>
        <g className="mc-r-leg"><rect x="20.5" y="45.5" width="5.4" height="21" rx="2.5" fill={NAVY} /><rect x="19.4" y="64.2" width="8" height="4.2" rx="2.1" fill="#F6F6FA" stroke="#D6D6E2" strokeWidth=".3" /><rect x="19.4" y="66.2" width="8" height=".8" fill={ORANGE} /></g>
        {/* polo shirt */}
        <path d="M11.5 31.5 Q11.5 28 15.5 28 H24.5 Q28.5 28 28.5 31.5 L27.6 46.5 H12.4Z" fill="#FBFAFF" stroke="#E7E4F0" strokeWidth=".3" />
        <path d="M15.6 27.6 L20 33.8 L24.4 27.6 L22.8 27.1 L20 30.9 L17.2 27.1Z" fill={ORANGE} />
        <text className="mc-tx" x="20" y="39.6" fontSize="4.1" fontWeight="800" fontStyle="italic" fill={NAVY} textAnchor="middle"
          textLength="13.5" lengthAdjust="spacingAndGlyphs" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>Hector365</text>
        <path d="M14 41.3 Q20 43.2 26 40.6" stroke={ORANGE} strokeWidth=".8" fill="none" strokeLinecap="round" />
        {/* neck + head */}
        <rect x="17.4" y="23" width="5.2" height="7" rx="2" fill={SKIN} />
        <g className="mc-head"><image href="/mascot.png" x="7.5" y="-1.5" width="25" height="26.3" /></g>
        {/* left arm */}
        <g className="mc-l-arm">
          <rect x="7.8" y="35.6" width="3.4" height="7.4" rx="1.7" fill={SKIN} /><circle cx="9.5" cy="43.4" r="2.1" fill={SKIN} />
          <rect x="7" y="28.4" width="5" height="7.4" rx="2.4" fill="#FBFAFF" stroke="#E7E4F0" strokeWidth=".3" /><rect x="7" y="34.2" width="5" height="1.8" rx=".9" fill={ORANGE} />
        </g>
        {/* broom (sweep) */}
        <g className="mc-broom"><rect x="33.6" y="30" width="1.3" height="39" rx=".6" fill="#A9743D" /><path d="M31.4 67.5 h6.1 l1.2 4 h-8.5z" fill="#E0B84A" /></g>
        {/* right arm */}
        <g className="mc-r-arm">
          <rect className="mc-cloth" x="27.4" y="41.4" width="6.4" height="5.2" rx="1.6" fill="#F6D56A" stroke="#E0B84A" strokeWidth=".4" />
          <rect x="28.6" y="35.6" width="3.4" height="7.4" rx="1.7" fill={SKIN} /><circle cx="30.3" cy="43.4" r="2.1" fill={SKIN} />
          <rect x="28" y="28.4" width="5" height="7.4" rx="2.4" fill="#FBFAFF" stroke="#E7E4F0" strokeWidth=".3" /><rect x="28" y="34.2" width="5" height="1.8" rx=".9" fill={ORANGE} />
        </g>
      </g>
    </svg>
  );
}

export default function MascotGuide({ name = "Saathi", accent = "#F28A1E", rules = NO_RULES }) {
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [left, setLeft] = useState(false);
  const [moving, setMoving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [bubble, setBubble] = useState(null); // { text, kind: tip | ask | note }
  const [typed, setTyped] = useState("");
  const [act, setAct] = useState(0);
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
    if (!isOn) return;
    let greeted = false;
    try { greeted = sessionStorage.getItem("mascot_greeted") === "1"; } catch (e) { /* ignore */ }
    const t1 = setTimeout(() => moveTo(home().x, home().y), 2600);
    const t2 = setTimeout(() => {
      if (greeted || !onRef.current) return;
      try { sessionStorage.setItem("mascot_greeted", "1"); } catch (e) { /* ignore */ }
      say(`Namaste! Main ${name} hoon. Kahin bhi dabao, main wahan aakar samjha dunga.`, 6500);
    }, 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bubble) { setTyped(""); return; }
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
    function onClick(e) {
      if (!onRef.current) return;
      const t = e.target;
      if (!(t instanceof Element) || t.closest("[data-mascot]")) return;
      const el = t.closest("button,a,input,select,textarea,label,summary,[role=button],[data-guide]");
      if (!el) return;
      const now = Date.now();
      if (now - lastClick.current < 350) return;
      lastClick.current = now;
      let text = guideFor(el);
      const lab = labelOf(el).toLowerCase();
      for (const [re, msg] of rules) { if (re.test(lab)) { text = msg; break; } }
      const vw = window.innerWidth, vh = window.innerHeight;
      const px = e.clientX || vw / 2, py = e.clientY || vh / 2;
      const x = px + W + 20 > vw ? clamp(px - W - 12, 4, vw - W - 4) : clamp(px + 10, 4, vw - W - 4);
      const y = py < 120 ? clamp(py + 16, 4, vh - H - 4) : clamp(py - H - 2, 4, vh - H - 4);
      moveTo(x, y);
      setBubble(null);
      setTimeout(() => { if (onRef.current) say(text); }, reduce ? 0 : MOVE_MS - 100);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [moveTo, say, reduce, rules]);

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

  // off: logo ke paas khada hokar alag alag kaam karta hai
  useEffect(() => {
    if (on) { setHidden(false); return; }
    function place() {
      const r = findLogo();
      if (r) {
        setHidden(false);
        const x = clamp(r.right - 4, 0, window.innerWidth - W);
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
    const tl = setTimeout(() => setLeft(true), reduce ? 0 : MOVE_MS + 80); // logo ki taraf muh
    const id = setInterval(place, 500);
    const id2 = setInterval(() => setAct((a) => (a + 1) % ACTIVITIES.length), 5000);
    window.addEventListener("resize", place);
    return () => { clearTimeout(tl); clearInterval(id); clearInterval(id2); window.removeEventListener("resize", place); };
  }, [on, moveTo, reduce]);

  function turnOff() {
    setOn(false); persist(false);
    setLeft(true);
    say("Theek hai! Main logo ke paas ja raha hoon. Mujhe dabaoge to wapas guide karunga.", 3800, "note");
  }

  function turnOn() {
    setOn(true); persist(true);
    setLeft(false);
    setBubble(null);
    const h = home();
    moveTo(h.x, h.y);
    setTimeout(() => say("Main wapas aa gaya! Kahin bhi dabao, main wahan aakar samjha dunga."), reduce ? 0 : MOVE_MS - 100);
  }

  function onMascotClick() {
    if (!on) {
      if (bubble && bubble.kind === "ask") { setBubble(null); return; }
      say("Kya main aapko guide karun?", 9000, "ask");
      return;
    }
    if (bubble) { setBubble(null); return; }
    say("Kisi bhi button ya link ko dabao, main wahan aakar batata hoon ki wo kya karta hai.");
  }

  if (!mounted) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const bw = Math.min(205, vw - 20);
  const bx = clamp(pos.x + W / 2 - bw / 2, 10, vw - bw - 10) - pos.x;
  const above = pos.y > 110;
  const tail = clamp(W / 2 - bx - 5, 12, bw - 22);
  const activity = ACTIVITIES[act];
  const pose = on ? (moving ? "walk" : bubble ? "talk" : "idle") : (moving ? "walk" : bubble ? "talk" : activity);
  const showSparks = !on && !bubble && (activity === "wipe" || activity === "polish");
  const btn = { whiteSpace: "nowrap", border: "none", borderRadius: 999, padding: "4px 11px", fontWeight: 700, fontSize: 11, cursor: "pointer" };

  return (
    <div data-mascot="1" aria-live="polite" style={{
      position: "fixed", left: 0, top: 0, zIndex: 9000, pointerEvents: "none",
      transform: `translate(${pos.x}px, ${pos.y}px)`,
      transition: reduce ? "none" : `transform ${MOVE_MS}ms cubic-bezier(.45,.05,.3,1), opacity .3s`,
      opacity: hidden ? 0 : 1, width: W, height: H,
    }}>
      <style>{`
        .mc *{transform-box:view-box}
        .mc-l-leg{transform-origin:16.8px 46px}.mc-r-leg{transform-origin:23.2px 46px}
        .mc-l-arm{transform-origin:10.6px 30px}.mc-r-arm{transform-origin:29.4px 30px}
        .mc-head{transform-origin:20px 24px}.mc-bob{transform-origin:20px 70px}
        .mc-broom{transform-origin:34.2px 31px;display:none}.mc-cloth{display:none}
        .mc-flip .mc-tx{transform:scaleX(-1);transform-origin:20px 38.5px}
        .mc-l-leg,.mc-r-leg,.mc-l-arm,.mc-r-arm,.mc-head,.mc-bob,.mc-broom{transition:transform .5s ease}
        @keyframes mcSwing{from{transform:rotate(-17deg)}to{transform:rotate(17deg)}}
        @keyframes mcSwingArm{from{transform:rotate(-13deg)}to{transform:rotate(13deg)}}
        @keyframes mcBob{from{transform:translateY(0)}to{transform:translateY(-.9px)}}
        @keyframes mcBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-.5px)}}
        @keyframes mcTalkArm{from{transform:rotate(-38deg)}to{transform:rotate(-72deg)}}
        @keyframes mcWave{from{transform:rotate(-146deg)}to{transform:rotate(-170deg)}}
        @keyframes mcRub{from{transform:rotate(-84deg)}to{transform:rotate(-112deg)}}
        @keyframes mcPolish{from{transform:rotate(-104deg)}to{transform:rotate(-126deg)}}
        @keyframes mcNod{from{transform:rotate(-2deg)}to{transform:rotate(2.5deg)}}
        @keyframes mcSwish{from{transform:rotate(-8deg)}to{transform:rotate(7deg)}}
        @keyframes mcTwinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(35deg)}}
        .mc-walk .mc-bob{animation:mcBob .31s ease-in-out infinite alternate}
        .mc-walk .mc-l-leg,.mc-walk .mc-r-arm{animation:mcSwing .62s ease-in-out infinite alternate}
        .mc-walk .mc-r-leg,.mc-walk .mc-l-arm{animation:mcSwing .62s ease-in-out infinite alternate-reverse}
        .mc-walk .mc-r-arm,.mc-walk .mc-l-arm{animation-name:mcSwingArm}
        .mc-idle .mc-bob,.mc-talk .mc-bob,.mc-wave .mc-bob,.mc-wipe .mc-bob,.mc-polish .mc-bob,.mc-sweep .mc-bob{animation:mcBreath 3.2s ease-in-out infinite}
        .mc-talk .mc-r-arm{animation:mcTalkArm 1s ease-in-out infinite alternate}
        .mc-talk .mc-head,.mc-wave .mc-head{animation:mcNod 1.3s ease-in-out infinite alternate}
        .mc-wave .mc-r-arm{animation:mcWave .8s ease-in-out infinite alternate}
        .mc-wipe .mc-r-arm{animation:mcRub .65s ease-in-out infinite alternate}
        .mc-polish .mc-r-arm{animation:mcPolish .5s ease-in-out infinite alternate}
        .mc-wipe .mc-cloth,.mc-polish .mc-cloth{display:block}
        .mc-sweep .mc-broom{display:block;animation:mcSwish 1.1s ease-in-out infinite alternate}
        .mc-sweep .mc-r-arm{transform:rotate(-20deg)}.mc-sweep .mc-l-arm{transform:rotate(-14deg)}
        .mg-spark{position:absolute;color:#F2B83C;font-size:11px;line-height:1;animation:mcTwinkle 1.4s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.mc *,.mg-spark{animation:none!important}}
      `}</style>
      {bubble && (
        <div data-mascot="1" style={{
          position: "absolute", left: bx, width: bw, pointerEvents: "auto",
          ...(above ? { bottom: H + 6 } : { top: H + 6 }),
          background: "#fff", color: "#241F16", border: `1.5px solid ${accent}`, borderRadius: 14,
          padding: "8px 10px", boxShadow: "0 8px 22px rgba(40,30,20,.2)", fontSize: 12, lineHeight: 1.4,
          fontFamily: "inherit",
        }}>
          <span style={{
            position: "absolute", left: tail, width: 10, height: 10, background: "#fff", transform: "rotate(45deg)",
            ...(above ? { bottom: -6.5, borderRight: `1.5px solid ${accent}`, borderBottom: `1.5px solid ${accent}` }
              : { top: -6.5, borderLeft: `1.5px solid ${accent}`, borderTop: `1.5px solid ${accent}` }),
          }} />
          <div style={{ fontWeight: 700, color: accent, fontSize: 11, marginBottom: 2 }}>{name}</div>
          <div style={{ position: "relative" }}>
            <span style={{ visibility: "hidden" }}>{bubble.text}</span>
            <span style={{ position: "absolute", left: 0, top: 0 }}>{typed}</span>
          </div>
          {bubble.kind === "tip" && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 7 }}>
              <button data-mascot="1" onClick={() => setBubble(null)} style={{ ...btn, background: accent, color: "#fff" }}>Samajh gaya</button>
              <button data-mascot="1" onClick={turnOff} style={{ ...btn, background: "none", color: "#6B6259", padding: "4px 2px" }}>Guide band karo</button>
            </div>
          )}
          {bubble.kind === "ask" && (
            <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
              <button data-mascot="1" onClick={turnOn} style={{ ...btn, background: accent, color: "#fff" }}>Haan</button>
              <button data-mascot="1" onClick={() => setBubble(null)} style={{ ...btn, background: "none", color: "#6B6259" }}>Abhi nahi</button>
            </div>
          )}
        </div>
      )}
      {showSparks && (
        <>
          <span className="mg-spark" style={{ left: -12, top: 18 }}>✦</span>
          <span className="mg-spark" style={{ left: -22, top: 30, animationDelay: ".5s", fontSize: 9 }}>✦</span>
          <span className="mg-spark" style={{ left: -6, top: 36, animationDelay: "1s", fontSize: 8 }}>✦</span>
        </>
      )}
      <div style={{ transform: on ? "none" : `scale(${DOCK_SCALE})`, transformOrigin: "50% 100%", transition: reduce ? "none" : "transform .5s", filter: "drop-shadow(0 3px 4px rgba(30,30,60,.2))" }}>
        <Character pose={pose} flip={left} />
      </div>
      <button data-mascot="1" onClick={onMascotClick} aria-label={on ? `${name} guide` : `${name} guide chalu karo`}
        style={{
          position: "absolute", left: 2, top: 2, width: W - 4, height: H - 4, padding: 0, border: "none", background: "transparent",
          cursor: "pointer", pointerEvents: "auto", WebkitTapHighlightColor: "transparent",
        }} />
    </div>
  );
}
