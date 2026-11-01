import { getVariantPricing, getBestQuantityDealBadge } from "./theme";

// Dukaan mein abhi kya-kya offer chal raha hai — customer screen ki "SALE" patti ke liye.
// Sab kuch live nikalta hai (koi alag switch nahi): Limited-Time Deal, Buy More Save More,
// MRP discount aur Combo. Kuch bhi na ho to null (patti dikhti hi nahi).
export function summarizeOffers(products, combos, now = new Date()) {
  let limited = 0, maxPct = 0, qtyDeals = 0, discounted = 0;
  let soonestEnd = null;
  for (const p of products || []) {
    for (const v of p.variants || []) {
      const pr = getVariantPricing(v, now);
      if (pr.isLimitedTimeOffer) {
        limited++;
        if (v.offer_ends_at) {
          const e = new Date(v.offer_ends_at);
          if (e > now && (!soonestEnd || e < soonestEnd)) soonestEnd = e;
        }
      } else if (pr.pct) discounted++;
      if (pr.pct && pr.pct > maxPct) maxPct = pr.pct;
      if (getBestQuantityDealBadge(v)) qtyDeals++;
    }
  }
  const comboCount = (combos || []).length;
  if (!limited && !qtyDeals && !discounted && !comboCount) return null;
  return { limited, maxPct, qtyDeals, discounted, comboCount, soonestEnd };
}
