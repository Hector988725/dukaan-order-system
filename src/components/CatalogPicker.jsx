import React, { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Loader2, Check, ArrowLeft } from "lucide-react";
import { fetchCatalogProducts, fetchCatalogBrands, addCatalogProductToShop } from "../lib/api";
import { isBookingCategory } from "../lib/theme";

import { friendlyError } from "../lib/errors";
// ============================================================
// CENTRAL CATALOG PICKER (Dukaandar side)
// Catalog product chuno -> apna Selling Price + apna Stock -> "Add to My Shop".
// Catalog mein na ho to "Custom Product banayein" (purana manual form).
// Variants (shade/size/color) ke liye "+ Variant" se rows badha sakte hain.
// ============================================================

const C = { green: "#1B4332", border: "#E3DECF", bg: "#F7F5F0", muted: "#8B8576", red: "#B3261E", text: "#2A2A2A" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px", fontSize: "14px", background: "white", fontFamily: "inherit" };
const labelStyle = { fontSize: "10.5px", fontWeight: 700, color: C.muted, marginBottom: "3px", display: "block" };
const btn = { border: "none", borderRadius: "9px", padding: "12px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" };

const blankRow = (cp) => ({ label: "Standard", unit: cp.unit || "piece", mrp: cp.mrp ?? "", price: "", stock: "", barcode: cp.barcode || "", gst_rate: cp.gst_rate ?? "" });

function rowsFor(cp) {
  const cv = Array.isArray(cp.variants) ? cp.variants : [];
  if (cv.length === 0) return [blankRow(cp)];
  return cv.map((v) => ({ label: v.label || "Standard", unit: v.unit || cp.unit || "piece", mrp: v.mrp ?? cp.mrp ?? "", price: "", stock: "", barcode: v.barcode || "", gst_rate: v.gst_rate ?? cp.gst_rate ?? "" }));
}

export default function CatalogPicker({ store, products, onClose, onAdded, onCustom }) {
  const [items, setItems] = useState(null);
  const [brands, setBrands] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [available, setAvailable] = useState(true);
  const [picked, setPicked] = useState(null);
  const [rows, setRows] = useState([]);
  const [brand, setBrand] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchCatalogProducts(store.business_type).then(setItems).catch((e) => { setItems([]); setErr(friendlyError(e)); });
    fetchCatalogBrands(store.business_type).then(setBrands).catch(() => {});
  }, [store.business_type]);

  const added = useMemo(() => new Set((products || []).map((p) => p.catalog_product_id).filter(Boolean)), [products]);
  const cats = useMemo(() => ["All", ...Array.from(new Set((items || []).map((i) => i.category)))], [items]);
  const brandList = useMemo(() => Array.from(new Set((items || []).map((i) => i.brand).filter(Boolean))).sort(), [items]);
  const shown = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (items || []).filter((i) => (cat === "All" || i.category === cat) &&
      (brandFilter === "All" || i.brand === brandFilter) &&
      t.every((w) => `${i.name} ${i.brand || ""} ${i.sub_category || ""} ${i.category}`.toLowerCase().includes(w)));
  }, [items, q, cat, brandFilter]);
  // Salon jaisi services mein stock nahi hota (default 9999 jaise baaki flow mein) — stock ka box nahi dikhate.
  const isService = isBookingCategory(store.business_type);

  const pick = (cp) => { setPicked(cp); setRows(rowsFor(cp).map((r) => (isService ? { ...r, stock: "9999" } : r))); setBrand(cp.brand || ""); setAvailable(true); setErr(""); };
  const upd = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    for (const r of rows) {
      if (!r.label.trim()) { setErr("Variant ka naam daalein"); return; }
      if (!(Number(r.price) > 0)) { setErr(`"${r.label}": apna Selling Price daalein`); return; }
      if (r.stock !== "" && (!Number.isInteger(Number(r.stock)) || Number(r.stock) < 0)) { setErr(`"${r.label}": stock poora number hona chahiye`); return; }
    }
    setBusy(true); setErr("");
    try {
      await addCatalogProductToShop(store.id, picked.id, rows, brand, available);
      onAdded();
    } catch (e) { setErr(friendlyError(e)); setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 560, maxHeight: "92vh", borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
          {picked && <button onClick={() => { setPicked(null); setErr(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><ArrowLeft size={18} /></button>}
          <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: C.green }}>{picked ? picked.name : "Central Catalog"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: 16, WebkitOverflowScrolling: "touch" }}>
          {err && <div style={{ background: "#FBE6E4", color: C.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}

          {!picked && (
            <>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={15} style={{ position: "absolute", left: 11, top: 13, color: C.muted }} />
                <input style={{ ...inputStyle, paddingLeft: 33 }} placeholder="Catalog mein search karein…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
                {cats.map((c) => (
                  <button key={c} onClick={() => setCat(c)} style={{ whiteSpace: "nowrap", border: `1px solid ${cat === c ? C.green : C.border}`, background: cat === c ? C.green : "white", color: cat === c ? "white" : C.muted, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{c}</button>
                ))}
              </div>
              {brandList.length > 1 && (
                <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ ...inputStyle, marginTop: 4, padding: "9px 10px", fontSize: 13 }}>
                  <option value="All">Saare brands</option>
                  {brandList.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
              {items === null && <div style={{ textAlign: "center", padding: 30, color: C.muted }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>}
              {items && shown.length === 0 && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "22px 8px" }}>Catalog mein nahi mila.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {shown.map((cp) => {
                  const isAdded = added.has(cp.id);
                  return (
                    <button key={cp.id} disabled={isAdded} onClick={() => pick(cp)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: isAdded ? C.bg : "white", border: `1px solid ${C.border}`, borderRadius: 11, padding: "10px 12px", cursor: isAdded ? "default" : "pointer", opacity: isAdded ? 0.6 : 1 }}>
                      {cp.image_url ? <img src={cp.image_url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 44, height: 44, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📦</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{cp.name}</div>
                        <div style={{ fontSize: 11.5, color: C.muted }}>{[cp.brand, cp.sub_category || cp.category, cp.age_group].filter(Boolean).join(" · ")}</div>
                      </div>
                      {isAdded ? <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>✓ Added</span> : <Plus size={18} color={C.green} />}
                    </button>
                  );
                })}
              </div>
              <button onClick={onCustom} style={{ ...btn, width: "100%", marginTop: 14, background: "white", color: C.green, border: `1.5px solid ${C.green}` }}>
                <Plus size={15} /> Catalog mein nahi hai? Custom Product banayein
              </button>
            </>
          )}

          {picked && (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{[picked.category, picked.sub_category].filter(Boolean).join(" › ")} — apna Selling Price aur Stock daalein.</div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Brand</label>
                <input list="catalog-brands" style={inputStyle} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" />
                <datalist id="catalog-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 11, padding: 12, background: C.bg }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Variant / Shade / Size</label>
                        <input style={inputStyle} value={r.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="jaise Shade 02 Red, 100 ml, Large" />
                      </div>
                      {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: C.red, padding: 8, cursor: "pointer" }}><X size={16} /></button>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isService ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div><label style={labelStyle}>MRP ₹</label><input style={inputStyle} inputMode="decimal" value={r.mrp} onChange={(e) => upd(i, { mrp: e.target.value.replace(/[^0-9.]/g, "") })} /></div>
                      <div><label style={labelStyle}>Selling Price ₹ *</label><input style={{ ...inputStyle, borderColor: C.green }} inputMode="decimal" value={r.price} onChange={(e) => upd(i, { price: e.target.value.replace(/[^0-9.]/g, "") })} /></div>
                      {!isService && <div><label style={labelStyle}>Stock</label><input style={inputStyle} inputMode="numeric" placeholder="0" value={r.stock} onChange={(e) => upd(i, { stock: e.target.value.replace(/\D/g, "") })} /></div>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: store.gst_enabled ? "1fr 1fr" : "1fr", gap: 8, marginTop: 8 }}>
                      <div><label style={labelStyle}>Barcode / SKU (optional)</label><input style={inputStyle} value={r.barcode} onChange={(e) => upd(i, { barcode: e.target.value })} /></div>
                      {store.gst_enabled && <div><label style={labelStyle}>GST %</label><input style={inputStyle} inputMode="decimal" value={r.gst_rate} onChange={(e) => upd(i, { gst_rate: e.target.value.replace(/[^0-9.]/g, "") })} /></div>}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setRows((rs) => [...rs, { ...blankRow(picked), label: "" }])} style={{ ...btn, width: "100%", marginTop: 10, background: "white", color: C.green, border: `1.5px solid ${C.green}` }}><Plus size={14} /> Aur Variant (shade / size)</button>
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 13.5, fontWeight: 700, color: C.text }}>
                <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} style={{ width: 18, height: 18 }} />
                Available (customer ko order ke liye dikhe)
              </label>
              <button onClick={submit} disabled={busy} style={{ ...btn, width: "100%", marginTop: 10, background: C.green, color: "white", fontSize: 14, padding: 14, opacity: busy ? 0.6 : 1 }}>
                {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />} Add to My Shop
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
