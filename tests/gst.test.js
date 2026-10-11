import { describe, it, expect } from "vitest";
import { calculateItemGST, calculateOrderGST, calculateCartDiscount } from "../src/lib/gst.js";

describe("calculateItemGST", () => {
  it("rate 0 -> no tax", () => {
    expect(calculateItemGST({ amount: 100, gstRate: 0 })).toEqual({ taxableAmount: 100, gstAmount: 0 });
  });
  it("exclusive: tax added on top", () => {
    expect(calculateItemGST({ amount: 100, gstRate: 18, priceType: "exclusive" })).toEqual({ taxableAmount: 100, gstAmount: 18 });
  });
  it("inclusive: tax extracted", () => {
    const r = calculateItemGST({ amount: 118, gstRate: 18, priceType: "inclusive" });
    expect(r.taxableAmount).toBe(100);
    expect(r.gstAmount).toBe(18);
  });
  it("garbage input -> zeros", () => {
    expect(calculateItemGST({ amount: "abc", gstRate: "x" })).toEqual({ taxableAmount: 0, gstAmount: 0 });
  });
});

describe("calculateOrderGST", () => {
  const items = [{ amount: 100, gstRate: 18 }, { amount: 200, gstRate: 5 }];
  it("GST off -> sum only", () => {
    const r = calculateOrderGST({ items, gstEnabled: false });
    expect(r.finalAmount).toBe(300);
    expect(r.gstAmount).toBe(0);
  });
  it("same state -> CGST+SGST split", () => {
    const r = calculateOrderGST({ items, gstEnabled: true, sellerState: "Madhya Pradesh", buyerState: " madhya pradesh " });
    expect(r.gstAmount).toBe(28);
    expect(r.cgstAmount).toBe(14);
    expect(r.sgstAmount).toBe(14);
    expect(r.igstAmount).toBe(0);
    expect(r.finalAmount).toBe(328);
  });
  it("different state -> IGST", () => {
    const r = calculateOrderGST({ items, gstEnabled: true, sellerState: "Madhya Pradesh", buyerState: "Delhi" });
    expect(r.igstAmount).toBe(28);
    expect(r.cgstAmount + r.sgstAmount).toBe(0);
  });
  it("empty cart", () => {
    expect(calculateOrderGST({ items: [], gstEnabled: true }).finalAmount).toBe(0);
  });
});

describe("calculateCartDiscount", () => {
  it("sums MRP minus price", () => {
    expect(calculateCartDiscount([{ strikeAmount: 120, amount: 100 }, { amount: 50 }])).toBe(20);
  });
});
