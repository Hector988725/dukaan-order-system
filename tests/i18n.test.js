import { describe, it, expect } from "vitest";
import { tr, HI } from "../src/lib/i18n";

describe("i18n (customer storefront)", () => {
  it("English par text jaisa tha waisa hi rehta hai", () => {
    expect(tr("en", "Your Cart")).toBe("Your Cart");
  });
  it("Hindi mein translation milta hai", () => {
    expect(tr("hi", "Your Cart")).toBe("आपका कार्ट");
  });
  it("translation na ho to English dikhta hai (screen kabhi khaali nahi)", () => {
    expect(tr("hi", "Some new text")).toBe("Some new text");
  });
  it("koi Hindi value khaali nahi", () => {
    for (const [k, v] of Object.entries(HI)) expect(v && v.trim().length > 0, k).toBe(true);
  });
});
