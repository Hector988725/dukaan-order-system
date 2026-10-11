// ============================================================
// "App install karein" ki logic — ek hi jagah.
// Chrome/Edge (Android + desktop): beforeinstallprompt event milta hai, uske
//   zariye seedha install popup khulta hai.
// iPhone Safari: aisa event hota hi nahi — wahan steps dikhaye jaate hain.
// Kuch bhi na mile (ya purana browser): Chrome menu ⋮ → "Install app" ke steps.
// Event page load ke turant baad aa sakta hai (component se pehle), isliye
// listener module load par hi laga dete hain aur event yaad rakhte hain.
// ============================================================
let deferred = null;
const subs = new Set();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* ignore */ } });

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    return !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  } catch { return false; }
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function canPromptInstall() { return !!deferred; }

export async function promptInstall() {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null;
  notify();
  try {
    e.prompt();
    const choice = await e.userChoice;
    return choice && choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch { return "unavailable"; }
}

export function subscribeInstall(fn) { subs.add(fn); return () => subs.delete(fn); }
