import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StoreGate, { ClosedShopScreen } from "../src/components/ClosedShopScreen";
import { isStoreOpen, formatTime12, phoneDigits } from "../src/lib/shopHours";

const base = { name: "Rich Mart", whatsapp_number: "919876543210", timings: "9 AM - 9 PM" };
describe("closed shop", () => {
  it("manual closed hides children, shows call+wa", () => {
    const h = renderToStaticMarkup(<StoreGate store={{ ...base, is_open: false }}><div id="menu">MENU</div></StoreGate>);
    expect(h).not.toContain("MENU");
    expect(h).toContain("tel:+919876543210");
    expect(h).toContain("wa.me/919876543210");
    expect(h).toContain("9 AM - 9 PM");
  });
  it("open shows children", () => {
    const h = renderToStaticMarkup(<StoreGate store={{ ...base, is_open: true }}><div>MENU</div></StoreGate>);
    expect(h).toContain("MENU"); expect(h).not.toContain("closed-screen");
  });
  it("auto hours show formatted times", () => {
    const h = renderToStaticMarkup(<ClosedShopScreen store={{ ...base, auto_hours_enabled: true, opens_at: "09:00:00", closes_at: "21:30:00" }} />);
    expect(h).toContain("9:00 AM"); expect(h).toContain("9:30 PM");
  });
  it("auto-hours logic incl overnight", () => {
    const s = { auto_hours_enabled: true, opens_at: "18:00:00", closes_at: "02:00:00" };
    expect(isStoreOpen(s, new Date(2026,0,1,23,0))).toBe(true);
    expect(isStoreOpen(s, new Date(2026,0,1,10,0))).toBe(false);
  });
  it("helpers", () => { expect(formatTime12("00:05:00")).toBe("12:05 AM"); expect(phoneDigits("98765 43210")).toBe("919876543210"); });
});
