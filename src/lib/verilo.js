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
