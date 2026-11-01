import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { summarizeOffers } from "../src/lib/offers";
import OfferStrip from "../src/components/OfferStrip";

const now = new Date("2026-11-01T10:00:00Z");
const v = (o = {}) => ({ id: "v", price: 100, ...o });
const P = (...vs) => [{ id: "p", variants: vs }];

describe("summarizeOffers", () => {
  it("nothing running -> null", () => expect(summarizeOffers(P(v()), [], now)).toBeNull());
  it("combo only", () => expect(summarizeOffers(P(v()), [{ id: 1 }], now).comboCount).toBe(1));
  it("active limited-time offer + pct + end", () => {
    const s = summarizeOffers(P(v({ offer_enabled: true, offer_price: 70, offer_ends_at: "2026-11-02T10:00:00Z" })), [], now);
    expect(s.limited).toBe(1); expect(s.maxPct).toBe(30); expect(s.soonestEnd).toBeTruthy();
  });
  it("expired offer ignored", () => {
    expect(summarizeOffers(P(v({ offer_enabled: true, offer_price: 70, offer_ends_at: "2026-10-31T10:00:00Z" })), [], now)).toBeNull();
  });
  it("buy more save more counts", () => {
    expect(summarizeOffers(P(v({ qty_deal_tiers: [{ qty: 3, price: 270 }] })), [], now).qtyDeals).toBe(1);
  });
});
describe("OfferStrip", () => {
  it("renders text when offer exists", () => {
    const h = renderToStaticMarkup(<OfferStrip products={P(v())} combos={[{ id: 1 }]} onTap={() => {}} />);
    expect(h).toContain("SALE LIVE"); expect(h).toContain("Combo Offers");
  });
  it("renders nothing otherwise", () => {
    expect(renderToStaticMarkup(<OfferStrip products={P(v())} combos={[]} />)).toBe("");
  });
});
