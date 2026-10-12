import React, { useEffect, useState } from "react";
import { Download, X, CheckCircle2 } from "lucide-react";
import { isStandalone, isIOS, canPromptInstall, promptInstall, subscribeInstall, waitForPrompt, roleFromPath, wasInstalled, clearInstalled, markInstalled, detectInstalled } from "../lib/installApp";

// ============================================================
// "App install karein" button.
// - App pehle se khula hua (standalone) hai → kuch nahi dikhata.
// - Browser seedha install popup de sake to wahi kholta hai, warna steps.
// - Install ho jaane ke baad (is browser mein) button ki jagah saaf message:
//   "app ka icon app drawer / home screen mein hai, wahin se kholein".
// Props: label, color, outline, helpTitle, lang ("hi"/"en"),
//   role ("owner"/"staff"/"distributor"), appName (icon ka naam),
//   compact (chhoti pill — header ke neeche patti mein)
// ============================================================
export default function InstallAppButton({
  label = "App install karein", color = "#1B4332", outline = false, helpTitle = "App install",
  lang = "hi", role, appName = "Dukaan", compact = false,
}) {
  const en = lang === "en";
  const myRole = role || roleFromPath();
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  const [showInstalled, setShowInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeInstall(() => force((n) => n + 1)), []);
  // Chrome se pooch lete hain: kya ye app is phone par pehle se install hai?
  useEffect(() => {
    let alive = true;
    if (!wasInstalled(myRole)) detectInstalled().then((yes) => { if (alive && yes) { markInstalled(myRole); force((n) => n + 1); } });
    return () => { alive = false; };
  }, [myRole]);

  if (isStandalone()) return null;
  const installed = wasInstalled(myRole);

  const onClick = async () => {
    if (busy) return;
    if (installed) { setShowInstalled(true); return; }
    setBusy(true);
    try {
      // Browser ka asli install popup mil sake to wahi kholte hain (thoda ruk kar bhi dekhte hain).
      if (!isIOS() && (canPromptInstall() || (await waitForPrompt(1200)))) {
        const r = await promptInstall();
        if (r === "accepted") setShowInstalled(true);
        else if (r === "unavailable") setHelp(true);
        return;
      }
      setHelp(true);
    } finally { setBusy(false); }
  };

  const ios = isIOS();
  const sheetWrap = (children) => (
    <div onClick={() => { setHelp(false); setShowInstalled(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", textAlign: "left" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 460, borderRadius: "16px 16px 0 0", padding: "18px 18px 24px", fontFamily: "'Inter', sans-serif", color: "#2B2A24" }}>
        {children}
      </div>
    </div>
  );
  const sheetHead = (title) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
      <button onClick={() => { setHelp(false); setShowInstalled(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} /></button>
    </div>
  );

  // ---- Install ho chuka: icon kahan milega ----
  const installedSheet = showInstalled && sheetWrap(<>
    {sheetHead(en ? "✅ App installed" : "✅ App install ho gaya")}
    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8 }}>
      {en ? (<>
        <li>Open your phone's <b>app list (app drawer)</b> — swipe up on the home screen.</li>
        <li>Find <b>"{appName}"</b> and tap it. It opens like a normal app, without the browser bar.</li>
        <li>Want it on the home screen? Press and hold the icon → <b>Add to Home screen</b>.</li>
      </>) : (<>
        <li>Phone ka <b>app drawer</b> (saare apps ki list) kholein — home screen par upar swipe karein.</li>
        <li><b>"{appName}"</b> dhoondhkar dabayein. Ye normal app ki tarah, browser ki bar ke bina khulega.</li>
        <li>Home screen par chahiye? Icon ko dabakar rakhein → <b>Home screen par jodein</b>.</li>
      </>)}
    </ol>
    <div style={{ fontSize: 11.5, color: "#8B8576", marginTop: 12, lineHeight: 1.5 }}>
      {en ? "From now on open the app from its icon, not from the browser." : "Ab se browser nahi, isi icon se app kholein."}
    </div>
    <button onClick={() => { clearInstalled(myRole); setShowInstalled(false); force((n) => n + 1); }} style={{ marginTop: 10, background: "none", border: "none", padding: 0, color, fontWeight: 700, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
      {en ? "Can't find the icon? Install again" : "Icon nahi mila? Dobara install karein"}
    </button>
  </>);

  // ---- Install ke steps (browser popup na mile to) ----
  const helpSheet = help && sheetWrap(<>
    {sheetHead(helpTitle)}
    {ios ? (
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8 }}>
        {en ? (<>
          <li>Open this page in Safari (not Chrome).</li>
          <li>Tap the <b>Share</b> (□↑) button at the bottom.</li>
          <li>Choose <b>"Add to Home Screen"</b>.</li>
          <li>Tap <b>Add</b> — the icon appears on your home screen.</li>
        </>) : (<>
          <li>Safari mein ye page kholein (Chrome se nahi).</li>
          <li>Neeche <b>Share</b> (□↑) button dabayein.</li>
          <li><b>"Add to Home Screen"</b> chunein.</li>
          <li><b>Add</b> dabayein — icon home screen par aa jayega.</li>
        </>)}
      </ol>
    ) : (
      <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
        {en ? (<>
          Chrome is not offering a direct install right now. This usually means <b>the app is already installed on this phone</b> — open <b>"{appName}"</b> from your app list (swipe up on the home screen).
          <div style={{ marginTop: 8 }}>Not there? Chrome menu <b>⋮</b> → <b>Install app</b>.</div>
        </>) : (<>
          Chrome abhi seedha install nahi de raha. Aksar iska matlab hota hai ki <b>ye app is phone par pehle se install hai</b> — app drawer (home screen par upar swipe) me <b>"{appName}"</b> icon dhoondhkar kholein.
          <div style={{ marginTop: 8 }}>Wahan na mile to Chrome menu <b>⋮</b> → <b>Install app</b>.</div>
        </>)}
      </div>
    )}
    <div style={{ fontSize: 11.5, color: "#8B8576", marginTop: 12, lineHeight: 1.5 }}>
      {en ? "After installing, tapping the icon opens the app directly, without the browser address bar." : "Install ke baad icon dabane se seedha app khulta hai, browser ki address bar ke bina."}
    </div>
  </>);

  // ---- Chhoti pill (header ke neeche patti) ----
  if (compact) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 14px 0", maxWidth: 900, margin: "0 auto" }}>
          <button
            onClick={onClick}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, border: `1.5px solid ${installed ? "#2E7D4F" : color}`,
              background: installed ? "#E7F5EA" : "white", color: installed ? "#1B5E3A" : color, borderRadius: 999,
              padding: "5px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {installed ? <CheckCircle2 size={13} /> : <Download size={13} />}
            {busy ? (en ? "Please wait…" : "Ruko…") : installed ? (en ? "Installed — open from icon" : "Install hai — icon se kholein") : label}
          </button>
        </div>
        {helpSheet}{installedSheet}
      </>
    );
  }

  // ---- Poora button / ya "install ho chuka" card ----
  if (installed) {
    return (
      <>
        <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: "#E7F5EA", border: "1px solid #BFE0C8", color: "#1B5E3A", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4 }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{en ? <>App is installed. Open <b>"{appName}"</b> from your app list. <u>Where?</u></> : <>App install ho chuka hai. App drawer mein <b>"{appName}"</b> icon se kholein. <u>Kahan?</u></>}</span>
        </button>
        {installedSheet}
      </>
    );
  }
  return (
    <>
      <button
        onClick={onClick}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
          border: outline ? `1.5px solid ${color}` : "none", background: outline ? "white" : color, color: outline ? color : "white",
          borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Download size={15} /> {busy ? (en ? "Please wait…" : "Ruko…") : label}
      </button>
      {helpSheet}{installedSheet}
    </>
  );
}
