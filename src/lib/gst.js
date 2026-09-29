// ============================================================
// GST / TAX — poori calculation isi ek jagah hai. Cart, Checkout,
// Order confirmation, Admin order-details — sab isi file ke functions
// use karte hain, taaki kahin bhi hardcoded/alag calculation na ho aur
// number kabhi mismatch na ho.
//
// GST optional hai (store.gst_enabled) — jab OFF hai, yeh functions
// bhi automatically "no-tax" values return kar dete hain (taxableAmount
// = amount, gst = 0), isliye caller ko har jagah alag se if/else nahi
// likhna padta.
// ============================================================

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Ek item ka GST nikalna. `amount` hamesha us item ki EFFECTIVE
// (discount/offer ke baad wali) kimat × qty honi chahiye — GST hamesha
// asal transaction value par lagta hai, MRP par nahi.
export function calculateItemGST({ amount, gstRate, priceType }) {
  const rate = Number(gstRate) || 0;
  const amt = Number(amount) || 0;
  if (rate <= 0) return { taxableAmount: round2(amt), gstAmount: 0 };

  if (priceType === "inclusive") {
    const taxable = amt / (1 + rate / 100);
    return { taxableAmount: round2(taxable), gstAmount: round2(amt - taxable) };
  }
  // exclusive (default) — price ke upar GST alag se judta hai
  return { taxableAmount: round2(amt), gstAmount: round2(amt * (rate / 100)) };
}

// Poore cart/order ka tax-breakdown — CGST+SGST (same state) ya IGST
// (different state), jo bhi lagu ho.
//
// items: [{ amount, gstRate }] — amount = effectivePrice × qty (per line)
// sellerState / buyerState: state-name strings, case-insensitive compare
export function calculateOrderGST({ items, priceType = "exclusive", gstEnabled, sellerState, buyerState }) {
  if (!gstEnabled) {
    const taxableAmount = round2((items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0));
    return { taxableAmount, gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, finalAmount: taxableAmount };
  }

  let taxableAmount = 0;
  let gstAmount = 0;
  for (const it of items || []) {
    const r = calculateItemGST({ amount: it.amount, gstRate: it.gstRate, priceType });
    taxableAmount += r.taxableAmount;
    gstAmount += r.gstAmount;
  }

  const sameState = !sellerState || !buyerState || String(sellerState).trim().toLowerCase() === String(buyerState).trim().toLowerCase();
  const cgstAmount = sameState ? round2(gstAmount / 2) : 0;
  const sgstAmount = sameState ? round2(gstAmount / 2) : 0;
  const igstAmount = sameState ? 0 : round2(gstAmount);

  return {
    taxableAmount: round2(taxableAmount),
    gstAmount: round2(gstAmount),
    cgstAmount,
    sgstAmount,
    igstAmount,
    finalAmount: round2(taxableAmount + gstAmount),
  };
}

// Discount line-item ke liye — MRP/original price aur effective price
// ka fark, poore cart ke liye jama karke.
export function calculateCartDiscount(items) {
  return round2((items || []).reduce((s, it) => s + (Number(it.strikeAmount || it.amount) - Number(it.amount)), 0));
}

// Reference list — checkout mein State dropdown ke liye
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
