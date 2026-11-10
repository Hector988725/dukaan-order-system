import { describe, it, expect } from "vitest";
import { priceFor, qtyForAmount, showQty, discount, gstCalc, profitCalc, inr, num } from "../src/lib/calc.js";

describe("calc", () => {
  it("10 gram @ 260/kg = 2.60", () => { expect(priceFor(260, 1000, 10)).toBe(2.6); expect(inr(2.6)).toBe("₹2.60"); });
  it("250 g @ 260/kg = 65", () => { expect(priceFor(260, 1000, 250)).toBe(65); expect(inr(65)).toBe("₹65"); });
  it("rate per 100 g", () => { expect(priceFor(40, 100, 350)).toBe(140); });
  it("dozen: 5 piece @ 60/dozen = 25", () => { expect(priceFor(60, 12, 5)).toBe(25); });
  it("1/3 rounding", () => { expect(priceFor(100, 1000, 333)).toBe(33.3); });
  it("rupees to weight", () => { expect(qtyForAmount(260, 1000, 50)).toBeCloseTo(192.307, 2); expect(showQty("weight", 1250)).toBe("1 kg 250 g"); expect(showQty("weight", 192.31)).toBe("192.31 g"); });
  it("liquid + count display", () => { expect(showQty("liquid", 1500)).toBe("1 L 500 ml"); expect(showQty("count", 14)).toBe("1 dozen 2 piece"); });
  it("invalid input gives NaN", () => { expect(priceFor(NaN, 1000, 10)).toBeNaN(); expect(priceFor(260, 0, 10)).toBeNaN(); expect(inr(NaN)).toBe("—"); expect(num("2,5")).toBe(2.5); expect(num("")).toBe(0); });
  it("discount / gst / profit", () => {
    expect(discount(500, 10)).toEqual({ saving: 50, final: 450 });
    expect(gstCalc(1000, 18, "add")).toEqual({ base: 1000, gst: 180, total: 1180 });
    expect(gstCalc(1180, 18, "remove")).toEqual({ base: 1000, gst: 180, total: 1180 });
    expect(profitCalc(200, 240)).toEqual({ profit: 40, onCost: 20, onSell: 16.67 });
  });
});
