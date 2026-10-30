// Dukaan khuli hai ya band, aur uska time dikhane ke helpers.
export function parseHM(v) {
  if (!v || typeof v !== "string") return null;
  const [h, m] = v.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return { h, m: Number.isFinite(m) ? m : 0 };
}

export function formatTime12(v) {
  const p = parseHM(v);
  if (!p) return "";
  const ap = p.h >= 12 ? "PM" : "AM";
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${String(p.m).padStart(2, "0")} ${ap}`;
}

export function computeAutoOpen(opensAt, closesAt, now = new Date()) {
  const o = parseHM(opensAt), c = parseHM(closesAt);
  if (!o || !c) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = o.h * 60 + o.m, closeMin = c.h * 60 + c.m;
  if (closeMin > openMin) return nowMin >= openMin && nowMin < closeMin;
  return nowMin >= openMin || nowMin < closeMin;
}

export function isStoreOpen(store, now = new Date()) {
  if (store.auto_hours_enabled) return computeAutoOpen(store.opens_at, store.closes_at, now);
  return store.is_open !== false;
}

// Customer ko dikhane ke liye khulne/band hone ka time.
export function hoursInfo(store) {
  const o = store.opens_at, c = store.closes_at;
  if (store.auto_hours_enabled && parseHM(o) && parseHM(c)) {
    return { opens: formatTime12(o), closes: formatTime12(c), text: store.timings || "" };
  }
  return { opens: "", closes: "", text: store.timings || "" };
}

export function phoneDigits(n) {
  const d = String(n || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 10 ? "91" + d : d;
}
