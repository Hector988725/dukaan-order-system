// Build ke baad chalta hai: staff, distributor aur superadmin ke liye alag HTML pages banata hai
// jinme unka apna manifest hota hai. Isse "Install app" karne par icon seedha
// /staff ya /distributor khole (dukaandar wale app par nahi).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const src = "dist/index.html";
if (!existsSync(src)) { console.error("dist/index.html nahi mila"); process.exit(1); }
const base = readFileSync(src, "utf8");

const pages = [
  { file: "dist/staff.html", manifest: "/manifest-staff.json", title: "Dukaan Staff", short: "Dukaan Staff", color: "#1F4E8C" },
  { file: "dist/distributor.html", manifest: "/manifest-distributor.json", title: "Dukaan Partner", short: "Dukaan Partner", color: "#6B2D5C" },
  { file: "dist/superadmin.html", manifest: "/manifest-superadmin.json", title: "Dukaan Super Admin", short: "Super Admin", color: "#9B1C31", icon: "/icon-superadmin-192.png", apple: "/apple-touch-icon-superadmin.png" },
];
for (const p of pages) {
  let html = base
    .replace('href="/manifest.json"', `href="${p.manifest}"`)
    .replace(/<title>.*?<\/title>/, `<title>${p.title}</title>`)
    .replace('content="Dukaan" />', `content="${p.short}" />`)
    .replace('<meta name="theme-color" content="#1B4332" />', `<meta name="theme-color" content="${p.color}" />`);
  if (p.icon) html = html.replace('href="/icon-192.png"', `href="${p.icon}"`);
  if (p.apple) html = html.replace('href="/apple-touch-icon.png"', `href="${p.apple}"`);
  if (!html.includes(p.manifest)) throw new Error("manifest link replace nahi hua: " + p.file);
  writeFileSync(p.file, html);
  console.log("bana:", p.file);
}

// Har manifest mein "related_applications" bharte hain (apna hi web-app) taaki Chrome
// browser ke andar se bata sake ki ye app is phone par pehle se install hai
// (navigator.getInstalledRelatedApps). Domain Vercel se milta hai; na mile to chhod dete hain.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (host) {
  for (const m of ["manifest.json", "manifest-staff.json", "manifest-distributor.json", "manifest-superadmin.json"]) {
    const f = "dist/" + m;
    if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, "utf8"));
    j.related_applications = [{ platform: "webapp", url: `https://${host}/${m}` }];
    writeFileSync(f, JSON.stringify(j, null, 2));
    console.log("related_applications:", m, "->", host);
  }
} else {
  console.log("VERCEL_PROJECT_PRODUCTION_URL nahi mila — related_applications skip.");
}
