import { describe, it, expect } from "vitest";
import { comboSummary } from "../src/lib/combo.js";
import { tr, HI } from "../src/lib/i18n";

const combo = {
  combo_price: 99,
  combo_items: [
    { id: "a", qty: 1, variants: { label: "Standard", price: 40, products: { name: "Dozo Bartan Bar 4N×95gm", emoji: "🧽", image_url: "https://x/y.png" } } },
    { id: "b", qty: 2, variants: { label: "200ml", price: 45, products: { name: "Himalaya Turmeric FaceWash", image_url: null } } },
    { id: "c", qty: 1, variants: null },
  ],
};

describe("comboSummary", () => {
  it("lists every item with qty and line total, skipping broken rows", () => {
    const s = comboSummary(combo);
    expect(s.items.map((i) => i.name)).toEqual(["Dozo Bartan Bar 4N×95gm", "Himalaya Turmeric FaceWash"]);
    expect(s.items[1]).toMatchObject({ qty: 2, unitPrice: 45, lineTotal: 90, variantLabel: "200ml" });
    expect(s.items[0].variantLabel).toBe(""); // "Standard" dikhane ki zarurat nahi
  });
  it("normal total, combo price and savings", () => {
    const s = comboSummary(combo);
    expect(s.normalTotal).toBe(130);
    expect(s.comboPrice).toBe(99);
    expect(s.savings).toBe(31);
  });
  it("no floating-point noise in totals", () => {
    const s = comboSummary({ combo_price: 99, combo_items: [
      { id: "1", qty: 1, variants: { price: 40, products: { name: "A" } } },
      { id: "2", qty: 1, variants: { price: 94.67, products: { name: "B" } } } ] });
    expect(s.normalTotal).toBe(134.67);
    expect(s.savings).toBe(35.67);
  });
  it("savings never negative", () => {
    expect(comboSummary({ ...combo, combo_price: 500 }).savings).toBe(0);
  });
  it("empty / missing combo is safe", () => {
    expect(comboSummary(undefined)).toEqual({ items: [], normalTotal: 0, comboPrice: 0, savings: 0 });
  });
});

describe("combo i18n", () => {
  it("has Hindi for new strings", () => {
    for (const k of ["You save", "What's in this combo", "View Cart", "See all items ›"]) expect(tr("hi", k)).not.toBe(k);
  });
});
