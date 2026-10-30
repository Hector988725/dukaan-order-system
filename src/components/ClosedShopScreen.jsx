import { useEffect, useState } from "react";
import { Phone, MessageCircle, Clock, Moon } from "lucide-react";
import { useLang } from "../lib/i18n";
import { hoursInfo, isStoreOpen, phoneDigits } from "../lib/shopHours";

// Dukaan band hone par poori storefront ki jagah yeh dikhta hai (ordering band).
export function ClosedShopScreen({ store, primary = "#1B4332" }) {
  const { t } = useLang();
  const info = hoursInfo(store);
  const digits = phoneDigits(store.whatsapp_number);
  const msg = encodeURIComponent(`Hi ${store.name}, ${t("I wanted to ask about an order.")}`);
  const hasTimes = info.opens && info.closes;
  return (
    <div data-testid="closed-screen" style={{ padding: "28px 20px 40px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#FFFDF8", border: "1px solid #E8E0CC", borderRadius: 22, boxShadow: "0 8px 28px rgba(27,67,50,0.10)", overflow: "hidden", textAlign: "center" }}>
        <div style={{ background: `linear-gradient(160deg, ${primary} 0%, #0F2A20 100%)`, padding: "26px 20px 22px", position: "relative" }}>
          <div style={{ position: "absolute", top: 14, right: 18, fontSize: 14, opacity: 0.5, color: "#fff" }}>✦ ✧</div>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Moon size={28} color="#F3D98B" />
          </div>
          <div style={{ display: "inline-block", background: "#D32F2F", color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, padding: "4px 14px", borderRadius: 999 }}>{t("CLOSED")}</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, color: "#fff", marginTop: 10 }}>{t("Dukaan abhi band hai")}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{store.name}</div>
        </div>
        <div style={{ padding: "20px 20px 22px" }}>
          <div style={{ fontSize: 13.5, color: "#5C5747", marginBottom: 14 }}>{t("Sorry, we're closed right now. Please come back during our opening hours.")}</div>
          {(hasTimes || info.text) && (
            <div style={{ background: "#F6F1E3", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#8B8576", letterSpacing: 1 }}>
                <Clock size={13} /> {t("SHOP TIMINGS")}
              </div>
              {hasTimes ? (
                <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 8 }}>
                  <div><div style={{ fontSize: 11, color: "#8B8576" }}>{t("Opens")}</div><div data-testid="opens-time" style={{ fontWeight: 800, fontSize: 17, color: "#1A1A1A" }}>{info.opens}</div></div>
                  <div style={{ width: 1, background: "#DDD3B8" }} />
                  <div><div style={{ fontSize: 11, color: "#8B8576" }}>{t("Closes")}</div><div data-testid="closes-time" style={{ fontWeight: 800, fontSize: 17, color: "#1A1A1A" }}>{info.closes}</div></div>
                </div>
              ) : (
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1A1A1A", marginTop: 6 }}>{info.text}</div>
              )}
            </div>
          )}
          {digits ? (
            <div style={{ display: "flex", gap: 10 }}>
              <a href={`tel:+${digits}`} data-testid="call-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 0", borderRadius: 12, background: primary, color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
                <Phone size={16} /> {t("Call")}
              </a>
              <a href={`https://wa.me/${digits}?text=${msg}`} target="_blank" rel="noopener noreferrer" data-testid="wa-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 0", borderRadius: 12, background: "#25D366", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
                <MessageCircle size={16} /> WhatsApp
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Open hone par children (CustomerView), band hone par ClosedShopScreen.
export default function StoreGate({ store, primary, children }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!store.auto_hours_enabled) return;
    const id = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, [store.auto_hours_enabled]);
  return isStoreOpen(store) ? children : <ClosedShopScreen store={store} primary={primary} />;
}
