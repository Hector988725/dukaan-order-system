import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isStandalone, isIOS, canPromptInstall, promptInstall, subscribeInstall } from "../lib/installApp";

// ============================================================
// "App install karein" button. Agar app pehle se install (standalone) hai to
// kuch nahi dikhata. Browser seedha install popup de sake to wahi kholta hai,
// warna chhote steps wali window dikhata hai.
// Props: label, color (button rang), outline (halka style), helpTitle
// ============================================================
export default function InstallAppButton({ label = "App install karein", color = "#1B4332", outline = false, helpTitle = "App kaise install karein", lang = "hi" }) {
  const en = lang === "en";
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => subscribeInstall(() => force((n) => n + 1)), []);

  if (isStandalone()) return null;
  if (done) return <div style={{ fontSize: 12, color: "#1B4332", fontWeight: 700 }}>{en ? "✓ Installing — look for the icon on your home screen" : "✓ Install ho raha hai — home screen par icon dekhein"}</div>;

  const onClick = async () => {
    if (canPromptInstall()) {
      const r = await promptInstall();
      if (r === "accepted") setDone(true);
      else if (r === "unavailable") setHelp(true);
      return;
    }
    setHelp(true);
  };

  const ios = isIOS();
  return (
    <>
      <button
        onClick={onClick}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
          border: outline ? `1.5px solid ${color}` : "none", background: outline ? "white" : color, color: outline ? color : "white",
          borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer",
        }}
      >
        <Download size={15} /> {label}
      </button>
      {help && (
        <div onClick={() => setHelp(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 460, borderRadius: "16px 16px 0 0", padding: "18px 18px 24px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{helpTitle}</div>
              <button onClick={() => setHelp(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} /></button>
            </div>
            {ios ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8, color: "#2B2A24" }}>
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
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8, color: "#2B2A24" }}>
                {en ? (<>
                  <li>In Chrome, tap the <b>⋮ (three dots)</b> at the top right.</li>
                  <li>Choose <b>"Install app"</b> or <b>"Add to Home screen"</b>.</li>
                  <li>Tap <b>Install</b> — the icon appears on your home screen.</li>
                </>) : (<>
                  <li>Chrome mein upar daayein <b>⋮ (teen dot)</b> dabayein.</li>
                  <li><b>"Install app"</b> ya <b>"Add to Home screen"</b> chunein.</li>
                  <li><b>Install</b> dabayein — icon home screen par aa jayega.</li>
                </>)}
              </ol>
            )}
            <div style={{ fontSize: 11.5, color: "#8B8576", marginTop: 12, lineHeight: 1.5 }}>
              {en ? "After installing, tapping the icon opens the app directly, without the browser address bar." : "Install ke baad icon dabane se seedha app khulta hai, browser ki address bar ke bina."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
