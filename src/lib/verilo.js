// Verilo opt-in: shop owner ki permission + city/state/pincode ki validation.
// Database mein bhi yehi rules lage hain (stores_pincode_6_digits, stores_city_len).
import { INDIAN_STATES } from "./gst.js";

const CITY_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,59}$/u;

export function cleanCity(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

// Naya opt-in time: OFF se ON karte hi abhi ka time; pehle se ON tha to purana time hi rahe; OFF par null.
export function nextOptInAt({ optIn, wasOptIn, existingAt, now = new Date() }) {
  if (!optIn) return null;
  if (wasOptIn && existingAt) return existingAt;
  return now.toISOString();
}

export function validateVeriloSettings({ optIn, city, state, pincode, wasOptIn = false, existingAt = null, now = new Date() }) {
  const c = cleanCity(city);
  const s = String(state ?? "").trim();
  const p = String(pincode ?? "").trim();

  if (c && !CITY_RE.test(c)) return { ok: false, error: "City ka naam sahi likhein (sirf akshar, 2 se 60 characters)." };
  if (s && !INDIAN_STATES.includes(s)) return { ok: false, error: "State list mein se chunein." };
  if (p && !/^[0-9]{6}$/.test(p)) return { ok: false, error: "Pincode 6 digits ka hona chahiye." };

  if (optIn) {
    if (!c) return { ok: false, error: "Verilo par dikhane ke liye City bharna zaroori hai." };
    if (!s) return { ok: false, error: "Verilo par dikhane ke liye State chunna zaroori hai." };
    if (!p) return { ok: false, error: "Verilo par dikhane ke liye Pincode bharna zaroori hai." };
  }

  return {
    ok: true,
    values: {
      verilo_opt_in: !!optIn,
      verilo_opt_in_at: nextOptInAt({ optIn: !!optIn, wasOptIn, existingAt, now }),
      city: c || null,
      state: s || null,
      pincode: p || null,
    },
  };
}

// Verilo ka public domain (ek jagah, taaki badalna ho to sirf yahan badle).
export const VERILO_ORIGIN = "https://verilo-seven.vercel.app";

// Dukaandar ke Verilo button + page ka status:
//  - "off"    : opt-in band
//  - "paused" : opt-in ON par subscription band, ya city/state/pincode adhoori (reasons me wajah)
//  - "live"   : sab theek -> Verilo par us shehar ki shops wali public page (url)
// reasons: "subscription" | "city" | "state" | "pincode"
export function veriloButtonState(store, now = new Date()) {
  if (!store || !store.verilo_opt_in) return { status: "off", url: null, reasons: [] };
  const reasons = [];
  const subActive = !!(store.subscription_expires_at && new Date(store.subscription_expires_at) > now);
  if (!subActive) reasons.push("subscription");
  const city = cleanCity(store.city);
  const state = String(store.state ?? "").trim();
  if (!city) reasons.push("city");
  if (!state) reasons.push("state");
  if (!/^[0-9]{6}$/.test(String(store.pincode ?? "").trim())) reasons.push("pincode");
  if (reasons.length) return { status: "paused", url: null, reasons };
  return { status: "live", url: veriloShopsUrl(city, state), reasons: [] };
}

// Verilo par us shehar ki shops wali page (location parameters ke saath).
export function veriloShopsUrl(city, state) {
  return `${VERILO_ORIGIN}/city/${encodeURIComponent(cleanCity(city))}/shops?state=${encodeURIComponent(String(state ?? "").trim())}`;
}
