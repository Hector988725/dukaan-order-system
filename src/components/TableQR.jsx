import React, { useState } from "react";
import { Printer, Copy, Check } from "lucide-react";
import { printHtml } from "../lib/print";

// ============================================================
// TABLE QR — restaurant ki har table ke liye alag QR. Customer scan kare to
// dukaan khulti hai aur table number apne aap bhar jaata hai (Dine In).
// QR image api.qrserver.com se aati hai (UPI QR bhi wahin se banta hai); link mein
// sirf dukaan ka public address + table number hota hai, koi private data nahi.
// ============================================================

const qrSrc = (url, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`;

export default function TableQR({ store }) {
  const [count, setCount] = useState(10);
  const [copied, setCopied] = useState(null);
  const base = `${window.location.origin}/${store.slug}`;
  const n = Math.min(60, Math.max(1, Number(count) || 1));
  const tables = Array.from({ length: n }, (_, i) => String(i + 1));
  const link = (t) => `${base}?table=${encodeURIComponent(t)}`;

  const copy = async (t) => {
    try { await navigator.clipboard.writeText(link(t)); setCopied(t); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  const printAll = () => {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const cards = tables.map((t) => `<div class="c"><div class="s">${esc(store.name)}</div><img src="${qrSrc(link(t), 300)}" /><div class="t">Table ${esc(t)}</div><div class="h">Scan karke order karein · Scan to order</div></div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Table QR</title><style>
@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;margin:0}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:8mm}
.c{border:2px solid #1B4332;border-radius:12px;padding:10px;text-align:center;page-break-inside:avoid}.c img{width:62mm;height:62mm}
.s{font-weight:800;font-size:16px}.t{font-size:28px;font-weight:800;color:#1B4332}.h{font-size:12px;color:#555}</style></head><body><div class="g">${cards}</div></body></html>`;
    printHtml(html);
  };

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🍽️ Table QR Codes</div>
      <div style={{ fontSize: 12, color: "#5C5747", lineHeight: 1.5, marginBottom: 12 }}>
        Har table ke liye ek QR print karke table par laga dein. Customer scan karega to aapki dukaan khulegi aur uska table number apne aap bhar jayega — galti ki gunjaish nahi.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#5C5747", marginBottom: 4 }}>Kitni tables hain? (max 60)</div>
          <input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        </div>
        <button onClick={printAll} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1B4332", color: "white", border: "none", borderRadius: 9, padding: "11px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Printer size={14} /> Sab Print Karein
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {tables.map((t) => (
          <div key={t} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: 12, padding: 10, textAlign: "center" }}>
            <img src={qrSrc(link(t), 220)} alt={`Table ${t} QR`} loading="lazy" style={{ width: "100%", maxWidth: 140, aspectRatio: "1 / 1" }} />
            <div style={{ fontWeight: 800, fontSize: 14, margin: "4px 0" }}>Table {t}</div>
            <button onClick={() => copy(t)} style={{ border: "1px solid #E3DECF", background: "white", borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {copied === t ? <><Check size={11} /> Copy hua</> : <><Copy size={11} /> Link</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
