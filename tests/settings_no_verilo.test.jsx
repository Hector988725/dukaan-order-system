import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

const calls = [];
vi.mock("../src/lib/supabase", () => ({
  supabase: { from: (t) => ({ update: (payload) => ({ eq: async () => { calls.push({ t, payload: JSON.parse(JSON.stringify(payload)) }); return { error: null }; } }) }) },
}));

import AdminPanel from "../src/components/AdminPanel.jsx";
import { updateStoreSettings } from "../src/lib/api.js";

const store = {
  id: "s1", name: "RICH MART", whatsapp_number: "919999999999", address: "Main Road", tagline: "Sabse sasta",
  subscription_expires_at: new Date(Date.now() + 864e5).toISOString(),
  verilo_opt_in: true, city: "Anuppur", state: "Madhya Pradesh", pincode: "484224",
};
const settingsHtml = renderToStaticMarkup(<AdminPanel store={store} products={[]} user={{ id: "u" }} onRefresh={() => {}} initialTab="settings" />);

describe("Store Settings after Verilo move", () => {
  it("no Verilo controls remain", () => {
    expect(settingsHtml).not.toContain("Verilo par apni dukaan dikhayein");
    expect(settingsHtml).not.toContain("Haan, meri dukaan Verilo par dikhayein");
    expect(settingsHtml).not.toContain("Pincode (6 digits)");
  });
  it("general shop fields are still there", () => {
    expect(settingsHtml).toContain("Dukaan ka Naam");
    expect(settingsHtml).toContain("WhatsApp Number");
    expect(settingsHtml).toContain("Address");
    expect(settingsHtml).toContain("Tagline");
    expect(settingsHtml).toContain("Facebook Page Link");
    expect(settingsHtml).toContain("Changes Save Karein");
  });
  it("AdminPanel source no longer touches verilo fields at all", () => {
    const src = readFileSync(new URL("../src/components/AdminPanel.jsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/verilo/i);
  });
});

describe("Settings save cannot overwrite Verilo data", () => {
  beforeEach(() => { calls.length = 0; });
  it("a normal settings save sends no verilo/city/state/pincode keys", async () => {
    await updateStoreSettings("s1", { name: "RICH MART", whatsapp_number: "919999999999", address: "Main Road" });
    const keys = Object.keys(calls[0].payload);
    for (const k of ["verilo_opt_in", "verilo_opt_in_at", "city", "state", "pincode"]) expect(keys).not.toContain(k);
    expect(keys).toEqual(expect.arrayContaining(["name", "whatsapp_number", "address"]));
  });
});
