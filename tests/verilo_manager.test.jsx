import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Save ka asli payload pakadne ke liye supabase client mock.
const calls = [];
vi.mock("../src/lib/supabase", () => ({
  supabase: { from: (t) => ({
    update: (payload) => ({ eq: async (c, v) => { calls.push({ t, payload: JSON.parse(JSON.stringify(payload)), c, v }); return { error: null }; } }),
    select: (cols) => ({ eq: () => ({ single: async () => { calls.push({ t, select: cols }); return { data: globalThis.__stored, error: null }; } }) }),
  }) },
}));

import VeriloManager from "../src/components/VeriloManager.jsx";
import { updateStoreSettings, fetchStoreVeriloSettings } from "../src/lib/api.js";
import { validateVeriloSettings } from "../src/lib/verilo.js";

const future = new Date(Date.now() + 864e5).toISOString();
const base = { id: "s1", name: "RICH MART", upi_id: "secret@upi", gstin: "SECRETGSTIN", subscription_expires_at: future, verilo_opt_in: true, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224" };
const html = (store) => renderToStaticMarkup(<VeriloManager store={store} onRefresh={() => {}} onBack={() => {}} onGoSubscription={() => {}} />);

describe("VeriloManager page states", () => {
  it("live: LIVE badge + View on Verilo link with city & state params", () => {
    const h = html(base);
    expect(h).toContain("LIVE");
    expect(h).toContain('href="https://verilo-seven.vercel.app/city/Anuppur/shops?state=Madhya%20Pradesh"');
    expect(h).toContain("View on Verilo");
    expect(h).not.toContain("Paused kyun hai");
    expect(h).toContain("484224"); // location fields prefilled
  });
  it("disabled: DISABLED badge, link not clickable, no fields", () => {
    const h = html({ ...base, verilo_opt_in: false });
    expect(h).toContain("DISABLED");
    expect(h).not.toContain("<a href=\"https://verilo-seven");
    expect(h).toContain('aria-disabled="true"');
    expect(h).not.toContain("Pincode (6 digits)");
  });
  it("paused (subscription): reason + subscription button, link not clickable", () => {
    const h = html({ ...base, subscription_expires_at: null });
    expect(h).toContain("PAUSED");
    expect(h).toContain("Paused kyun hai");
    expect(h).toContain("subscription active nahi hai");
    expect(h).toContain("Subscription dekhein");
    expect(h).not.toContain("<a href=\"https://verilo-seven");
  });
  it("paused (missing location): lists the missing items", () => {
    const h = html({ ...base, pincode: "", city: "" });
    expect(h).toContain("City bhari nahi hai");
    expect(h).toContain("Pincode 6 digits");
  });
  it("never renders private fields", () => {
    const h = html(base);
    expect(h).not.toContain("secret@upi");
    expect(h).not.toContain("SECRETGSTIN");
  });
});

describe("Save only touches Verilo fields", () => {
  beforeEach(() => { calls.length = 0; });
  it("payload has exactly the 5 verilo columns, nothing else", async () => {
    const v = validateVeriloSettings({ optIn: true, city: "Shahdol", state: "Madhya Pradesh", pincode: "484001", wasOptIn: false, existingAt: null });
    await updateStoreSettings("s1", v.values);
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0].payload).sort()).toEqual(["city", "pincode", "state", "verilo_opt_in", "verilo_opt_in_at"]);
    expect(calls[0]).toMatchObject({ t: "stores", c: "id", v: "s1" });
  });
  it("turning OFF keeps city/state/pincode, clears opt_in_at", async () => {
    const v = validateVeriloSettings({ optIn: false, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224", wasOptIn: true, existingAt: "2026-10-15T00:00:00.000Z" });
    await updateStoreSettings("s1", v.values);
    expect(calls[0].payload).toEqual({ verilo_opt_in: false, verilo_opt_in_at: null, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224" });
  });
});

describe("read-back of stored Verilo settings", () => {
  beforeEach(() => { calls.length = 0; });
  it("reads exactly the 5 verilo columns from stores", async () => {
    globalThis.__stored = { verilo_opt_in: false, verilo_opt_in_at: null, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224" };
    const r = await fetchStoreVeriloSettings("s1");
    expect(r.verilo_opt_in).toBe(false);
    expect(calls[0]).toMatchObject({ t: "stores", select: "verilo_opt_in, verilo_opt_in_at, city, state, pincode" });
  });
});
