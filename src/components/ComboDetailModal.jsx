import React from "react";
import { X, Minus, Plus } from "lucide-react";
import { useLang } from "../lib/i18n";
import { comboSummary } from "../lib/combo";

// ============================================================
// COMBO DETAIL — combo card par tap karne par khulta hai: combo me kaun-kaun si cheez hai,
// normal price vs combo price, bachat, aur wahin se Add / quantity.
// Props: combo, qty (cart me kitne), maxQty (stock ki limit), onAdd, onDec, onClose, onGoToCart, theme
// ============================================================
export default function ComboDetailModal({ combo, qty, maxQty, onAdd, onDec, onClose, onGoToCart, theme }) {
  const { t } = useLang();
  const { items, normalTotal, comboPrice, savings } = comboSummary(combo);
  const soldOut = maxQty <= 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={combo.name}
        style={{ background: "white", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: "480px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <div style={{ position: "relative", background: "#F3ECDC" }}>
            {combo.image_url
              ? <img src={combo.image_url} alt={combo.name} style={{ width: "100%", maxHeight: "260px", objectFit: "contain", display: "block", margin: "0 auto" }} />
              : <div style={{ height: "130px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "56px" }}>🎁</span></div>}
            <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: "14px 16px 6px" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>{combo.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: "20px", color: theme.primary }}>₹{comboPrice}</span>
              {savings > 0 && <span style={{ fontSize: "12.5px", color: "#8B8576", textDecoration: "line-through" }}>₹{normalTotal}</span>}
              {savings > 0 && <span style={{ fontSize: "11px", fontWeight: 800, color: "#1B7A3E", background: "#E7F4EC", borderRadius: "999px", padding: "2px 9px" }}>{t("You save")} ₹{savings}</span>}
            </div>
          </div>

          <div style={{ padding: "8px 16px 14px" }}>
            <div style={{ fontSize: "12.5px", fontWeight: 800, marginBottom: "8px" }}>{t("What's in this combo")} ({items.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} data-testid="combo-items">
              {items.map((it) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "10px", border: "1px solid #E3DECF", borderRadius: "10px", padding: "8px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "8px", background: "#F3ECDC", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {it.image ? <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "22px" }}>{it.emoji || "📦"}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>{it.name}</div>
                    {it.variantLabel && <div style={{ fontSize: "11px", color: "#8B8576" }}>{it.variantLabel}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 800 }}>× {it.qty}</div>
                    <div style={{ fontSize: "10.5px", color: "#8B8576" }}>₹{it.lineTotal}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Neeche chipka hua: Add / quantity / cart */}
        <div style={{ borderTop: "1px solid #E3DECF", padding: "10px 16px", display: "flex", gap: "10px", alignItems: "center", background: "white" }}>
          {soldOut ? (
            <div style={{ flex: 1, textAlign: "center", fontWeight: 800, color: "#B3261E", fontSize: "13.5px", padding: "10px 0" }}>{t("Sold Out")}</div>
          ) : qty === 0 ? (
            <button onClick={onAdd} style={{ flex: 1, minHeight: 44, background: theme.primary, color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {t("Add")} · ₹{comboPrice}
            </button>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", background: theme.primary, borderRadius: "10px", padding: "6px 12px", minHeight: 44, boxSizing: "border-box" }}>
                <button onClick={onDec} aria-label="Decrease" style={{ background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", padding: 4 }}><Minus size={16} /></button>
                <span style={{ color: "white", fontWeight: 800, fontSize: "14px", minWidth: "16px", textAlign: "center" }}>{qty}</span>
                <button onClick={onAdd} disabled={qty >= maxQty} aria-label="Increase" style={{ background: "none", border: "none", color: "white", cursor: qty >= maxQty ? "not-allowed" : "pointer", opacity: qty >= maxQty ? 0.5 : 1, display: "flex", padding: 4 }}><Plus size={16} /></button>
              </div>
              <button onClick={onGoToCart} style={{ flex: 1, minHeight: 44, background: "white", color: theme.primary, border: `1.5px solid ${theme.primary}`, borderRadius: "10px", fontSize: "13.5px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {t("View Cart")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
