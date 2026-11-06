import React, { useEffect, useState } from "react";

// App khulte waqt 3D "H" (Hector365) ghoomta hai: 0 -> 180 par "D" (Dukaan) dikhta hai,
// 360 par phir H, aur 540 par D par ruk kar app dikhne lagta hai. Sirf CSS, koi library nahi.
// Har session me ek baar. Customer ke shop-link par nahi (wahan order jaldi hona chahiye),
// par installed app (standalone) me hamesha.
export function shouldShowSplash({ path, standalone, seen, reducedMotion }) {
  if (reducedMotion || seen) return false;
  if (standalone) return true;
  const p = String(path || "").replace(/^\/+|\/+$/g, "");
  return ["", "staff", "distributor", "rider", "superadmin"].includes(p);
}

const LAYERS = 40;     // jitni zyada layers, utna thos 3D dikhta hai
const STEP = 0.7;      // px, har layer ke beech ki doori
const KEY = "brand_splash_seen";

function shade(i) {
  // peeche ki layers gehri, aage ki sunehri
  const t = i / (LAYERS - 1);
  const c = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${c(88, 224)}, ${c(64, 184)}, ${c(20, 100)})`;
}

export default function BrandSplash({
  letter = "D",
  name = "Dukaan Order System",
  bg = "radial-gradient(circle at 50% 40%, #1B4332 0%, #0B1F18 100%)",
  accent = "#E0B864",
}) {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false, reduced = false, standalone = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch {}
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}
    try { standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch {}
    if (!shouldShowSplash({ path: window.location.pathname, standalone, seen, reducedMotion: reduced })) return;
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setShow(true);
    const t1 = setTimeout(() => setLeaving(true), 2700);
    const t2 = setTimeout(() => setShow(false), 3150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;
  const close = () => { setLeaving(true); setTimeout(() => setShow(false), 300); };
  const layers = Array.from({ length: LAYERS }, (_, i) => i);
  const z = (i) => (i - (LAYERS - 1) / 2) * STEP;
  const glyph = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 900, fontSize: 120, lineHeight: 1 };

  return (
    <div
      onClick={close}
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 99999, background: bg, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 26,
        opacity: leaving ? 0 : 1, transition: "opacity 0.45s ease", cursor: "pointer",
      }}
    >
      <style>{`
        @keyframes bsSpin { 0% { transform: rotateY(0deg) rotateX(-8deg); } 100% { transform: rotateY(540deg) rotateX(-8deg); } }
        @keyframes bsIn { 0% { opacity: 0; transform: scale(.7); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes bsText { 0%, 70% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ perspective: 700, width: 130, height: 130, animation: "bsIn .35s ease-out both" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", animation: "bsSpin 2s cubic-bezier(.45,.05,.25,1) .25s both" }}>
          {layers.map((i) => (
            <div key={"h" + i} style={{ ...glyph, color: shade(i), transform: `translateZ(${z(i)}px)` }}>H</div>
          ))}
          {layers.map((i) => (
            <div key={"b" + i} style={{ ...glyph, color: shade(i), transform: `rotateY(180deg) translateZ(${z(i)}px)` }}>{letter}</div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", animation: "bsText 2.3s ease-out both" }}>
        <div style={{ color: "white", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 22 }}>{name}</div>
        <div style={{ color: accent, fontSize: 12, letterSpacing: 1.2, marginTop: 5, fontWeight: 700 }}>BY HECTOR365</div>
      </div>
    </div>
  );
}
