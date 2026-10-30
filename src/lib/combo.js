// Combo ka poora hisaab (customer detail view ke liye): kaun-kaun si cheez, kitni, normal price kitna,
// aur combo le kar kitni bachat. Sirf padhta hai, cart/order logic ko nahi chhuta.
// Paise ke floating-point jhanjhat se bachne ke liye (jaise 134.67000000000002)
const round2 = (n) => Math.round(n * 100) / 100;

export function comboSummary(combo) {
  const items = (combo?.combo_items || []).map((ci) => {
    const v = ci.variants || {};
    const p = v.products || {};
    const qty = Number(ci.qty) || 1;
    const unitPrice = Number(v.price) || 0;
    const label = String(v.label || "").trim();
    return {
      id: ci.id,
      name: p.name || "",
      emoji: p.emoji || "",
      image: p.image_url || "",
      variantLabel: label && !/^(standard|default)$/i.test(label) ? label : "",
      qty,
      unitPrice,
      lineTotal: round2(unitPrice * qty),
    };
  }).filter((it) => it.name);
  const normalTotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
  const comboPrice = Number(combo?.combo_price) || 0;
  const savings = Math.max(0, round2(normalTotal - comboPrice));
  return { items, normalTotal, comboPrice, savings };
}
