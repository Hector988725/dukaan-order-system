// ============================================================
// Standard password policy (jaisa Google / Microsoft / Apple / banks maangte hain)
//   - kam se kam 8 characters (12+ ho to "Strong")
//   - 1 bada akshar (A-Z), 1 chhota (a-z), 1 number, 1 symbol (! @ # $ ...)
//   - aam / easily-guessable password nahi (123456, password, qwerty...)
//   - email ka naam ya dukaan ka naam jaisa nahi
// Sirf NAYA password banate / badalte waqt lagta hai. Purane users ka login nahi rukta.
// Real enforcement Supabase Auth settings me bhi lagao (Authentication -> Policies).
// ============================================================
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd", "p@ssword", "pass@123", "admin123", "admin@123", "welcome123", "welcome@123",
  "qwerty", "qwerty123", "qwertyuiop", "asdfghjkl", "zxcvbnm", "abc123", "abcd1234", "abc@123", "iloveyou", "letmein", "monkey", "dragon",
  "india123", "india@123", "indian123", "dukaan", "dukaan123", "dukaan@123", "dukan123", "verilo", "verilo123", "verilo@123", "shop123", "shop@123",
  "changeme", "test1234", "test@123", "user1234", "login123", "master123", "sunshine", "football", "cricket", "cricket123", "krishna", "krishna123",
  "bharat123", "mumbai123", "delhi123", "ramram", "jaishreeram", "omnamah", "iloveindia", "gaurav123", "rahul123", "amit123", "123456789", "1234567890",
]);

function hasSequence(p) {
  const s = p.toLowerCase();
  const runs = ["0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for (const r of runs) for (let i = 0; i + 5 <= r.length; i++) if (s.includes(r.slice(i, i + 5))) return true;
  return /(.)\1{3,}/.test(p); // aaaa, 1111
}

export function checkPassword(pw, { email = "", extra = [] } = {}) {
  const p = String(pw || "");
  const low = p.toLowerCase();
  const local = String(email).split("@")[0].toLowerCase();
  const bad = [local.length >= 4 ? local : "", ...extra.map((x) => String(x || "").toLowerCase()).filter((x) => x.length >= 4)].filter(Boolean);
  const stripped = low.replace(/[^a-z0-9]/g, "");
  const checks = [
    { id: "len", label: "At least 8 characters", ok: p.length >= 8 },
    { id: "upper", label: "One capital letter (A-Z)", ok: /[A-Z]/.test(p) },
    { id: "lower", label: "One small letter (a-z)", ok: /[a-z]/.test(p) },
    { id: "num", label: "One number (0-9)", ok: /[0-9]/.test(p) },
    { id: "sym", label: "One symbol (! @ # $ % & *)", ok: /[^A-Za-z0-9]/.test(p) },
    { id: "common", label: "Not an easy or common password", ok: p.length > 0 && !COMMON.has(low) && !COMMON.has(stripped) && !/^(password|passw0rd|qwerty|admin|welcome|letmein)/.test(stripped) && !hasSequence(p) },
    { id: "own", label: "Does not contain your email or shop name", ok: p.length > 0 && !bad.some((b) => low.includes(b)) },
  ];
  const ok = checks.every((c) => c.ok);
  const passed = checks.filter((c) => c.ok).length;
  const level = !p ? 0 : !ok ? (passed >= 5 ? 1 : 1) : p.length >= 12 ? 3 : 2; // 1 weak, 2 good, 3 strong
  const first = checks.find((c) => !c.ok);
  return { ok, checks, level, label: ["", "Weak", "Good", "Strong"][level], problem: first ? first.label : "" };
}

// Submit par dikhane wala ek-line error (khali string = theek hai)
export function passwordError(pw, opts) {
  const r = checkPassword(pw, opts);
  return r.ok ? "" : `Password is not strong enough: ${r.problem.charAt(0).toLowerCase()}${r.problem.slice(1)}.`;
}
