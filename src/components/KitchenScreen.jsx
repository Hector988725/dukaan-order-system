import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Printer, Maximize2 } from "lucide-react";
import { updateOrderStatus } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { printHtml } from "../lib/print";

// ============================================================
// KITCHEN SCREEN (KOT) — restaurant ke chef/counter ke liye.
// Sirf wo orders jinhe banana/serve karna baaki hai: Naye → Ban rahe hain → Ready.
// Bade akshar, table number saaf, kitni der se ruka hai (15 min se zyada = laal),
// naye order par awaaz, aur KOT (kitchen slip) print.
// ============================================================

const SOUND_KEY = "dos_kitchen_sound";
const WARN_MIN = 15;

function typeInfo(o) {
  if (o.order_type === "Dine In") return { label: `🍽️ Table ${o.landmark || "?"}`, bg: "#FBE9E7", color: "#8A1F1F" };
  if (o.order_type === "Pickup") return { label: "🏪 Pickup", bg: "#FFF4DB", color: "#9A6B00" };
  return { label: "🛵 Delivery", bg: "#E7F0EA", color: "#1B4332" };
}
const noDelivery = (o) => o.order_type === "Dine In" || o.order_type === "Pickup";

function nextStep(o) {
  if (o.status === "New") return { to: "Accepted", label: "✅ Accept karein" };
  if (o.status === "Accepted") return { to: "Preparing", label: "🔥 Banana shuru" };
  if (o.status === "Preparing") return { to: "Ready", label: "✔️ Ready hai" };
  if (o.status === "Ready" && noDelivery(o)) return { to: "Delivered", label: o.order_type === "Dine In" ? "🍽️ Serve ho gaya" : "🏪 Handover ho gaya" };
  return null;
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.22].forEach((delay) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = 880; osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.18);
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.2);
    });
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 800);
  } catch { /* ignore */ }
}

export function printKot(store, o) {
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const info = typeInfo(o);
  const time = new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const rows = (o.items || []).map((it) => `<tr><td class="q">${esc(it.qty)}</td><td>${esc(it.name)}${it.variant && it.variant !== "Standard" ? ` (${esc(it.variant)})` : ""}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>KOT ${esc(o.order_number)}</title>
<style>@page{size:80mm auto;margin:3mm}body{font-family:Arial,sans-serif;width:72mm;margin:0;font-size:13px}
h1{font-size:15px;text-align:center;margin:0 0 2px}.c{text-align:center}.big{font-size:22px;font-weight:800;text-align:center;margin:6px 0}
table{width:100%;border-collapse:collapse;margin-top:6px}td{padding:3px 0;border-bottom:1px dashed #999;font-size:14px}td.q{width:30px;font-weight:800}</style></head>
<body><h1>${esc(store.name)}</h1><div class="c">KOT · ${esc(o.order_number)} · ${esc(time)}</div>
<div class="big">${esc(info.label.replace(/^[^\w]+/, ""))}</div><table>${rows}</table></body></html>`;
  printHtml(html);
}

export default function KitchenScreen({ store, orders, onRefresh }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(null);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === "1"; } catch { return false; } });
  const rootRef = useRef(null);
  const prevNew = useRef(null);

  const list = (orders || []).filter((o) => ["New", "Accepted", "Preparing", "Ready"].includes(o.status));
  const newOnes = list.filter((o) => o.status === "New");
  const cooking = list.filter((o) => o.status === "Accepted" || o.status === "Preparing");
  const ready = list.filter((o) => o.status === "Ready");
  const byAge = (a, b) => new Date(a.created_at) - new Date(b.created_at);

  // Har 30 sec: timer + naya data
  useEffect(() => {
    const t1 = setInterval(() => setNow(Date.now()), 30000);
    const t2 = setInterval(() => { onRefresh?.(); }, 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [onRefresh]);

  // Naya order aaye to awaaz
  useEffect(() => {
    const ids = new Set(newOnes.map((o) => o.id));
    if (prevNew.current && sound) {
      for (const id of ids) if (!prevNew.current.has(id)) { beep(); break; }
    }
    prevNew.current = ids;
  }, [newOnes.map((o) => o.id).join(","), sound]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSound = () => {
    const v = !sound; setSound(v);
    try { localStorage.setItem(SOUND_KEY, v ? "1" : "0"); } catch { /* ignore */ }
    if (v) beep();
  };
  // Full screen: ON/OFF ek hi button se. Full screen mein bhi upar ka button dikhta rahta hai
  // ("Band karein"), aur phone ka Back bhi ise band kar deta hai.
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const fullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else rootRef.current?.requestFullscreen?.();
    } catch { /* ignore */ }
  };

  const advance = async (o) => {
    const step = nextStep(o); if (!step) return;
    setBusy(o.id);
    try { await updateOrderStatus(o.id, step.to); await onRefresh?.(); }
    catch (e) { alert("Status badal nahi paaya: " + friendlyError(e)); }
    finally { setBusy(null); }
  };

  const renderCard = (o) => {
    const info = typeInfo(o);
    const mins = Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60000));
    const late = o.status !== "Ready" && mins >= WARN_MIN;
    const step = nextStep(o);
    return (
      <div key={o.id} style={{ background: "white", border: late ? "2px solid #B3261E" : "1px solid #E3DECF", borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ background: info.bg, color: info.color, fontWeight: 800, fontSize: 15, borderRadius: 8, padding: "4px 10px" }}>{info.label}</span>
          <span style={{ fontSize: 12, color: late ? "#B3261E" : "#8B8576", fontWeight: 700 }}>{late ? "⏰ " : ""}{mins} min · {o.order_number}</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          {(o.items || []).map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 16, fontWeight: 700, padding: "3px 0" }}>
              <span style={{ minWidth: 28, color: "#1B4332" }}>{it.qty}×</span>
              <span>{it.name}{it.variant && it.variant !== "Standard" ? <span style={{ fontWeight: 500, color: "#5C5747" }}> ({it.variant})</span> : null}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => printKot(store, o)} title="KOT print" style={{ border: "1px solid #E3DECF", background: "white", borderRadius: 9, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}><Printer size={15} /></button>
          {step ? (
            <button onClick={() => advance(o)} disabled={busy === o.id} style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: busy === o.id ? 0.6 : 1 }}>
              {busy === o.id ? "..." : step.label}
            </button>
          ) : (
            <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#8B8576", alignSelf: "center" }}>Delivery boy assign karein (Orders tab)</div>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title, color, items) => (
    <div key={title} style={{ flex: 1, minWidth: 260 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color, margin: "0 0 8px" }}>{title} ({items.length})</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: "#A89F87", padding: "10px 0" }}>Koi order nahi</div> : [...items].sort(byAge).map((o) => renderCard(o))}
    </div>
  );

  return (
    <div ref={rootRef} style={{ background: "#F7F5F0", padding: "14px 16px 40px", minHeight: "70vh", ...(isFull ? { height: "100vh", overflowY: "auto" } : {}) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces', serif" }}>👨‍🍳 Kitchen</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={toggleSound} style={{ border: "1px solid #E3DECF", background: sound ? "#E7F0EA" : "white", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            {sound ? <Volume2 size={14} /> : <VolumeX size={14} />} {sound ? "Awaaz ON" : "Awaaz OFF"}
          </button>
          <button onClick={fullscreen} style={{ border: "1px solid #E3DECF", background: "white", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Maximize2 size={14} /> {isFull ? "Full screen band karein" : "Full screen"}</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        {renderSection("🔔 Naye (Accept baaki)", "#B3261E", newOnes)}
        {renderSection("🔥 Ban rahe hain", "#9A6B00", cooking)}
        {renderSection("✅ Ready", "#1B4332", ready)}
      </div>
    </div>
  );
}
