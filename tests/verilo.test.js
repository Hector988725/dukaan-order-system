import { describe, it, expect } from "vitest";
import { validateVeriloSettings, nextOptInAt, cleanCity } from "../src/lib/verilo.js";
import { INDIAN_STATES } from "../src/lib/gst.js";

const NOW = new Date("2026-10-15T10:00:00.000Z");
const base = { optIn: true, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224", now: NOW };

describe("validateVeriloSettings", () => {
  it("valid opt-in -> values, opt_in_at = now", () => {
    const r = validateVeriloSettings(base);
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ verilo_opt_in: true, verilo_opt_in_at: NOW.toISOString(), city: "Anuppur", state: "Madhya Pradesh", pincode: "484224" });
  });
  it("opt-in needs city, state, pincode", () => {
    expect(validateVeriloSettings({ ...base, city: "" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, state: "" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, pincode: "" }).ok).toBe(false);
  });
  it("bad pincode / state / city rejected", () => {
    expect(validateVeriloSettings({ ...base, pincode: "12345" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, pincode: "12ab56" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, state: "Narnia" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, city: "A" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, city: "<script>" }).ok).toBe(false);
    expect(validateVeriloSettings({ ...base, city: "x".repeat(61) }).ok).toBe(false);
  });
  it("opt-out: empty fields fine, values null, opt_in_at null", () => {
    const r = validateVeriloSettings({ optIn: false, city: "", state: "", pincode: "", now: NOW });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ verilo_opt_in: false, verilo_opt_in_at: null, city: null, state: null, pincode: null });
  });
  it("opt-out still rejects a malformed pincode (DB constraint would fail)", () => {
    expect(validateVeriloSettings({ optIn: false, city: "", state: "", pincode: "99", now: NOW }).ok).toBe(false);
  });
  it("city whitespace collapsed; Hindi names allowed", () => {
    expect(cleanCity("  New   Delhi ")).toBe("New Delhi");
    expect(validateVeriloSettings({ ...base, city: "अनूपपुर" }).ok).toBe(true);
    expect(validateVeriloSettings({ ...base, city: "St. John's-Town" }).ok).toBe(true);
  });
});

describe("nextOptInAt", () => {
  it("OFF->ON sets now; staying ON keeps old time; ON->OFF clears", () => {
    expect(nextOptInAt({ optIn: true, wasOptIn: false, existingAt: null, now: NOW })).toBe(NOW.toISOString());
    expect(nextOptInAt({ optIn: true, wasOptIn: true, existingAt: "2026-01-01T00:00:00Z", now: NOW })).toBe("2026-01-01T00:00:00Z");
    expect(nextOptInAt({ optIn: true, wasOptIn: true, existingAt: null, now: NOW })).toBe(NOW.toISOString());
    expect(nextOptInAt({ optIn: false, wasOptIn: true, existingAt: "x", now: NOW })).toBe(null);
  });
});

describe("state list matches Verilo's list", () => {
  it("same 36 states/UTs", () => {
    const verilo = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];
    expect([...INDIAN_STATES].sort()).toEqual([...verilo].sort());
  });
});

import { veriloButtonState } from "../src/lib/verilo.js";
describe("veriloButtonState", () => {
  const future = new Date(Date.now() + 864e5).toISOString();
  it("off when opt-in is off", () => {
    expect(veriloButtonState({ verilo_opt_in: false, subscription_expires_at: future })).toEqual({ status: "off", url: null, reasons: [] });
  });
  it("live -> shops page url with encoded city/state", () => {
    const r = veriloButtonState({ verilo_opt_in: true, subscription_expires_at: future, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224" });
    expect(r.status).toBe("live");
    expect(r.url).toBe("https://verilo-seven.vercel.app/city/Anuppur/shops?state=Madhya%20Pradesh");
  });
  it("paused when subscription expired or location missing", () => {
    expect(veriloButtonState({ verilo_opt_in: true, subscription_expires_at: null, city: "A", state: "B", pincode: "484224" })).toMatchObject({ status: "paused", reasons: ["subscription"] });
    expect(veriloButtonState({ verilo_opt_in: true, subscription_expires_at: future, city: "", state: "B", pincode: "484224" })).toMatchObject({ status: "paused", reasons: ["city"] });
    expect(veriloButtonState({ verilo_opt_in: true, subscription_expires_at: future, city: "A", state: "B", pincode: "" }).reasons).toEqual(["pincode"]);
  });
});
