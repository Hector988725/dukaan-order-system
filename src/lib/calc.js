// Dukaan ke liye naap-tol / rate calculator ka hisaab (UI se alag, taaki test ho sake).
// Sab kuch "base" unit me: weight = gram, liquid = ml, gintee = piece.

export const FAMILIES = {
  weight: {
    label: "⚖️ Tol (kg/g)",
    rateUnits: [["kg", 1000], ["500 g", 500], ["250 g", 250], ["100 g", 100], ["quintal", 100000]],
    qtyUnits: [["g", 1], ["kg", 1000]],
    chips: [["10 g", 10], ["50 g", 50], ["100 g", 100], ["250 g", 250], ["500 g", 500], ["750 g", 750]],
  },
  liquid: {
    label: "🥛 Liquid (L/ml)",
    rateUnits: [["litre", 1000], ["500 ml", 500], ["250 ml", 250], ["100 ml", 100]],
    qtyUnits: [["ml", 1], ["litre", 1000]],
    chips: [["50 ml", 50], ["100 ml", 100], ["250 ml", 250], ["500 ml", 500], ["750 ml", 750]],
  },
  count: {
    label: "🔢 Gintee (piece/dozen)",
    rateUnits: [["piece", 1], ["dozen", 12], ["100 pcs", 100]],
    qtyUnits: [["piece", 1], ["dozen", 12]],
    chips: [["1", 1], ["2", 2], ["3", 3], ["6", 6], ["1 dozen", 12]],
  },
};

export const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ".").trim());
  return Number.isFinite(n) ? n : NaN;
};
export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export const inr = (x) => (Number.isFinite(x) ? "₹" + (Number.isInteger(round2(x)) ? String(round2(x)) : round2(x).toFixed(2)) : "—");

// rate = ₹ per (ratePer base-units). qtyBase = kitna maal (base unit me). Return price in ₹.
export function priceFor(rate, ratePer, qtyBase) {
  if (!(rate >= 0) || !(ratePer > 0) || !(qtyBase >= 0)) return NaN;
  return round2((rate * qtyBase) / ratePer);
}
// ₹ amount me kitna maal milega (base unit me)
export function qtyForAmount(rate, ratePer, amount) {
  if (!(rate > 0) || !(ratePer > 0) || !(amount >= 0)) return NaN;
  return (amount * ratePer) / rate;
}
// base qty ko dukaandar ki bhasha me
export function showQty(family, qtyBase) {
  if (!Number.isFinite(qtyBase)) return "—";
  const r = (x) => String(round2(x));
  if (family === "weight") {
    if (qtyBase >= 1000) { const kg = Math.floor(qtyBase / 1000); const g = round2(qtyBase - kg * 1000); return g ? `${kg} kg ${r(g)} g` : `${kg} kg`; }
    return `${r(qtyBase)} g`;
  }
  if (family === "liquid") {
    if (qtyBase >= 1000) { const l = Math.floor(qtyBase / 1000); const m = round2(qtyBase - l * 1000); return m ? `${l} L ${r(m)} ml` : `${l} L`; }
    return `${r(qtyBase)} ml`;
  }
  if (qtyBase >= 12) { const d = Math.floor(qtyBase / 12); const p = round2(qtyBase - d * 12); return p ? `${d} dozen ${r(p)} piece` : `${d} dozen`; }
  return `${r(qtyBase)} piece`;
}

export const discount = (price, pct) => {
  if (!(price >= 0) || !(pct >= 0)) return null;
  const saving = round2((price * pct) / 100);
  return { saving, final: round2(price - saving) };
};
// mode "add": amount GST ke bina hai; "remove": amount me GST shaamil hai
export function gstCalc(amount, pct, mode) {
  if (!(amount >= 0) || !(pct >= 0)) return null;
  if (mode === "remove") { const base = round2((amount * 100) / (100 + pct)); return { base, gst: round2(amount - base), total: round2(amount) }; }
  const gst = round2((amount * pct) / 100);
  return { base: round2(amount), gst, total: round2(amount + gst) };
}
export function profitCalc(cost, sell) {
  if (!(cost > 0) || !(sell >= 0)) return null;
  const profit = round2(sell - cost);
  return { profit, onCost: round2((profit / cost) * 100), onSell: sell > 0 ? round2((profit / sell) * 100) : 0 };
}
export const sellFromMargin = (cost, pct) => (cost > 0 && pct >= 0 ? round2(cost * (1 + pct / 100)) : NaN);
