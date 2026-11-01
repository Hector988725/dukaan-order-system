import React from "react";
import { summarizeOffers } from "../lib/offers";
import { formatOfferExpiry } from "../lib/theme";
import { useLang } from "../lib/i18n";

// Dukaan ke upar chalti hui "SALE" patti — jab bhi koi offer / combo chal raha ho.
// Tap karne par combo section (ya product list) tak scroll hota hai.
export default function OfferStrip({ products, combos, onTap }) {
  const { t } = useLang();
  const s = summarizeOffers(products, combos);
  if (!s) return null;
  const items = [];
  items.push(`🔥 ${t("SALE LIVE")}`);
  if (s.maxPct >= 5) items.push(`💥 ${t("Up to")} ${s.maxPct}% ${t("OFF")}`);
  if (s.limited) items.push(`⏳ ${s.limited} ${t("Limited Time Deals")}${s.soonestEnd ? ` — ${t("ends")} ${formatOfferExpiry(s.soonestEnd.toISOString())}` : ""}`);
  if (s.comboCount) items.push(`🎁 ${s.comboCount} ${t("Combo Offers")}`);
  if (s.qtyDeals) items.push(`📦 ${t("Buy More, Save More")}`);
  const row = items.map((x, i) => <span key={i} style={{ padding: "0 26px", whiteSpace: "nowrap" }}>{x}</span>);
  return (
    <div role="button" tabIndex={0} aria-label={items.join(", ")} onClick={onTap} onKeyDown={(e) => { if (e.key === "Enter") onTap && onTap(); }}
      data-testid="offer-strip"
      style={{ background: "linear-gradient(90deg,#B3261E,#E8590C)", color: "white", fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2, overflow: "hidden", cursor: "pointer", padding: "8px 0" }}>
      <style>{`
        @keyframes ddemoOfferMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ddemo-offer-track { display: inline-flex; width: max-content; animation: ddemoOfferMarquee 22s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ddemo-offer-track { animation: none; } }
      `}</style>
      <div className="ddemo-offer-track">{row}{row}</div>
    </div>
  );
}
