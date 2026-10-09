// Build ke baad chalta hai: staff aur distributor ke liye alag HTML pages banata hai
// jinme unka apna manifest hota hai. Isse "Install app" karne par icon seedha
// /staff ya /distributor khole (dukaandar wale app par nahi).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const src = "dist/index.html";
if (!existsSync(src)) { console.error("dist/index.html nahi mila"); process.exit(1); }
const base = readFileSync(src, "utf8");

const pages = [
  { file: "dist/staff.html", manifest: "/manifest-staff.json", title: "Dukaan Staff", short: "Dukaan Staff", color: "#1F4E8C" },
  { file: "dist/distributor.html", manifest: "/manifest-distributor.json", title: "Dukaan Partner", short: "Dukaan Partner", color: "#6B2D5C" },
];
for (const p of pages) {
  let html = base
    .replace('href="/manifest.json"', `href="${p.manifest}"`)
    .replace(/<title>.*?<\/title>/, `<title>${p.title}</title>`)
    .replace('content="Dukaan" />', `content="${p.short}" />`)
    .replace('<meta name="theme-color" content="#1B4332" />', `<meta name="theme-color" content="${p.color}" />`);
  if (!html.includes(p.manifest)) throw new Error("manifest link replace nahi hua: " + p.file);
  writeFileSync(p.file, html);
  console.log("bana:", p.file);
}
