// ============================================================
// "App install karein" ki logic — ek hi jagah.
// Chrome/Edge (Android + desktop): beforeinstallprompt event milta hai, uske
//   zariye seedha install popup khulta hai.
// iPhone Safari: aisa event hota hi nahi — wahan steps dikhaye jaate hain.
// Kuch bhi na mile (ya purana browser): Chrome menu ⋮ → "Install app" ke steps.
// Event page load ke turant baad aa sakta hai (component se pehle), isliye
// listener module load par hi laga dete hain aur event yaad rakhte hain.
// IMPORTANT: ye file main.jsx se sabse pehle import hoti hai — warna lazy
// screen load hone tak event nikal jata hai aur button sirf steps dikhata hai.
// ============================================================
let deferred = null;
const subs = new Set();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* ignore */ } });

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; markInstalled(roleFromPath()); notify(); });
}

// Kaun sa app (owner / staff / distributor) — page ke address se pata chalta hai.
export function roleFromPath() {
  if (typeof window === "undefined") return "owner";
  const p = window.location.pathname || "/";
  if (p.startsWith("/staff")) return "staff";
  if (p.startsWith("/rider")) return "rider";
  if (p.startsWith("/distributor")) return "distributor";
  return "owner";
}

// "Is browser se install ho chuka hai" — yaad rakhte hain taaki button ki jagah
// saaf message dikhe ("icon app drawer mein hai"), aur customer ko confusion na ho.
const flagKey = (role) => `dos_installed_${role}`;
export function markInstalled(role) { try { localStorage.setItem(flagKey(role), String(Date.now())); } catch { /* ignore */ } }
export function wasInstalled(role) { try { return !!localStorage.getItem(flagKey(role)); } catch { return false; } }
export function clearInstalled(role) { try { localStorage.removeItem(flagKey(role)); } catch { /* ignore */ } }

// Chrome batata hai ki ye app is phone par pehle se install hai ya nahi
// (getInstalledRelatedApps — manifest ki related_applications se match karta hai,
// jo build ke waqt apne aap bharti hai). Support na ho to false.
export async function detectInstalled() {
  try {
    if (typeof navigator === "undefined" || !navigator.getInstalledRelatedApps) return false;
    const apps = await navigator.getInstalledRelatedApps();
    return Array.isArray(apps) && apps.some((a) => a && a.platform === "webapp");
  } catch { return false; }
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

// Click par event abhi tak na aaya ho to thodi der (default 1.2 sec) intezaar —
// Chrome kabhi kabhi page khulne ke kuch second baad hi event bhejta hai.
export function waitForPrompt(ms = 1200) {
  if (deferred) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; unsub(); clearTimeout(timer); resolve(v); };
    const unsub = subscribeInstall(() => { if (deferred) finish(true); });
    const timer = setTimeout(() => finish(!!deferred), ms);
  });
}

export async function promptInstall() {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null;
  notify();
  try {
    e.prompt();
    const choice = await e.userChoice;
    if (choice && choice.outcome === "accepted") { markInstalled(roleFromPath()); return "accepted"; }
    return "dismissed";
  } catch { return "unavailable"; }
}

export function subscribeInstall(fn) { subs.add(fn); return () => subs.delete(fn); }
