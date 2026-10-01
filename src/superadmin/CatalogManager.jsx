import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, Upload, Eye, EyeOff } from "lucide-react";
import { BUSINESS_THEMES, getUnitPresets } from "../lib/theme";
import { AGE_GROUPS } from "../components/CategoryFields";
import {
  listTypeSettings, saveTypeSettings, listCategories, addCategory, renameCategory, deleteCategory,
  listBrands, addBrand, renameBrand, deleteBrand,
  listCatalogProducts, saveCatalogProduct, setCatalogProductActive, deleteCatalogProduct, uploadCatalogImage,
} from "./catalogApi";

// ============================================================
// SUPER ADMIN — Categories & Central Catalog
// (Cosmetics / Beauty + Gift / Toys / Kids)
// Enable/Disable type, Edit label, Sub-categories, Brands,
// Central Products, Product images — sab yahin se.
// ============================================================

const MANAGED_TYPES = ["cosmetics", "giftstoy"];
const C = { green: "#1B4332", border: "#E3DECF", bg: "#F7F5F0", muted: "#8B8576", red: "#B3261E", text: "#2A2A2A" };
const card = { background: "white", border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 };
const input = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, background: "white", fontFamily: "inherit" };
const lbl = { fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3, display: "block" };
const btn = (primary) => ({ border: primary ? "none" : `1px solid ${C.green}`, background: primary ? C.green : "white", color: primary ? "white" : C.green, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 });
const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: 6, color: C.muted };

function useAsync(fn, deps) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const reload = useCallback(async () => {
    try { setData(await fn()); setErr(""); } catch (e) { setErr(e.message || "Load nahi hua"); }
    // eslint-disable-next-line
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return [data, err, reload];
}

export default function CatalogManager() {
  const [type, setType] = useState(MANAGED_TYPES[0]);
  const [section, setSection] = useState("types");
  const sections = [["types", "Types"], ["categories", "Categories"], ["brands", "Brands"], ["products", "Catalog Products"]];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {MANAGED_TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} style={{ ...btn(type === t), padding: "9px 14px" }}>{BUSINESS_THEMES[t].label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto" }}>
        {sections.map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} style={{ border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", background: section === id ? C.green : C.bg, color: section === id ? "white" : C.muted }}>{label}</button>
        ))}
      </div>
      {section === "types" && <TypeSettings type={type} />}
      {section === "categories" && <Categories type={type} />}
      {section === "brands" && <Brands type={type} />}
      {section === "products" && <CatalogProducts type={type} />}
    </div>
  );
}

function Err({ msg }) { return msg ? <div style={{ background: "#FBE6E4", color: C.red, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{msg}</div> : null; }

// ---- Enable / Disable + edit label ----
function TypeSettings({ type }) {
  const [rows, err, reload] = useAsync(listTypeSettings, []);
  const row = (rows || []).find((r) => r.business_type === type);
  const theme = BUSINESS_THEMES[type];
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { setLabel(row?.label || theme.label); setDesc(row?.description || theme.description); }, [row, type]); // eslint-disable-line
  const enabled = row ? row.is_enabled : true;
  const save = async (patch = {}) => {
    setMsg("");
    try { await saveTypeSettings(type, { is_enabled: enabled, label, description: desc, ...patch }); setMsg("Save ho gaya ✅"); reload(); } catch (e) { setMsg(e.message); }
  };
  if (!rows) return <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />;
  return (
    <div style={card}>
      <Err msg={err} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{theme.label}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{enabled ? "Signup mein dikh raha hai" : "Signup se hidden (purane shops chalte rahenge)"}</div>
        </div>
        <button onClick={() => save({ is_enabled: !enabled })} style={btn(!enabled)}>{enabled ? <><EyeOff size={14} /> Disable</> : <><Eye size={14} /> Enable</>}</button>
      </div>
      <label style={lbl}>Signup mein dikhne wala naam</label>
      <input style={input} value={label} onChange={(e) => setLabel(e.target.value)} />
      <label style={{ ...lbl, marginTop: 10 }}>Description</label>
      <input style={input} value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => save()} style={btn(true)}><Check size={14} /> Save</button>
        {msg && <span style={{ fontSize: 12.5, color: C.muted }}>{msg}</span>}
      </div>
    </div>
  );
}

// ---- Categories + sub-categories ----
function Categories({ type }) {
  const [rows, err, reload] = useAsync(() => listCategories(type), [type]);
  const [newMain, setNewMain] = useState("");
  const [newSub, setNewSub] = useState({});
  const [msg, setMsg] = useState("");
  const run = async (fn) => { setMsg(""); try { await fn(); await reload(); } catch (e) { setMsg(e.message?.includes("duplicate") ? "Yeh naam pehle se hai" : e.message); } };
  if (!rows) return <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />;
  const mains = rows.filter((r) => !r.parent_id);
  return (
    <div>
      <Err msg={err || msg} />
      <div style={{ ...card, marginBottom: 10, display: "flex", gap: 8 }}>
        <input style={input} placeholder="Nayi main category" value={newMain} onChange={(e) => setNewMain(e.target.value)} />
        <button style={btn(true)} onClick={() => newMain.trim() && run(async () => { await addCategory(type, newMain, null, mains.length + 1); setNewMain(""); })}><Plus size={14} /> Add</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mains.map((m) => {
          const subs = rows.filter((r) => r.parent_id === m.id);
          return (
            <div key={m.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>{m.name}</div>
                <button style={iconBtn} onClick={() => { const n = prompt("Category ka naya naam", m.name); if (n && n.trim()) run(() => renameCategory(m.id, n)); }}><Edit2 size={14} /></button>
                <button style={{ ...iconBtn, color: C.red }} onClick={() => confirm(`"${m.name}" aur uski sab sub-categories delete karein? (Shops ke maujooda products par asar nahi)`) && run(() => deleteCategory(m.id))}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
                {subs.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>Koi sub-category nahi</span>}
                {subs.map((sc) => (
                  <span key={sc.id} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 4px 3px 11px", fontSize: 12, fontWeight: 600 }}>
                    {sc.name}
                    <button style={{ ...iconBtn, padding: 3 }} onClick={() => { const n = prompt("Sub-category ka naya naam", sc.name); if (n && n.trim()) run(() => renameCategory(sc.id, n)); }}><Edit2 size={11} /></button>
                    <button style={{ ...iconBtn, padding: 3, color: C.red }} onClick={() => confirm(`"${sc.name}" delete karein?`) && run(() => deleteCategory(sc.id))}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={input} placeholder="Nayi sub-category" value={newSub[m.id] || ""} onChange={(e) => setNewSub((s) => ({ ...s, [m.id]: e.target.value }))} />
                <button style={btn(false)} onClick={() => (newSub[m.id] || "").trim() && run(async () => { await addCategory(type, newSub[m.id], m.id, subs.length + 1); setNewSub((s) => ({ ...s, [m.id]: "" })); })}><Plus size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Brands ----
function Brands({ type }) {
  const [rows, err, reload] = useAsync(() => listBrands(type), [type]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const run = async (fn) => { setMsg(""); try { await fn(); await reload(); } catch (e) { setMsg(e.message?.includes("duplicate") ? "Yeh brand pehle se hai" : e.message); } };
  if (!rows) return <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />;
  return (
    <div>
      <Err msg={err || msg} />
      <div style={{ ...card, marginBottom: 10, display: "flex", gap: 8 }}>
        <input style={input} placeholder="Naya brand" value={name} onChange={(e) => setName(e.target.value)} />
        <button style={btn(true)} onClick={() => name.trim() && run(async () => { await addBrand(type, name); setName(""); })}><Plus size={14} /> Add</button>
      </div>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {rows.length === 0 && <span style={{ fontSize: 12.5, color: C.muted }}>Koi brand nahi.</span>}
        {rows.map((b) => (
          <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 4px 3px 11px", fontSize: 12, fontWeight: 600 }}>
            {b.name}
            <button style={{ ...iconBtn, padding: 3 }} onClick={() => { const n = prompt("Brand ka naya naam", b.name); if (n && n.trim()) run(() => renameBrand(b.id, n)); }}><Edit2 size={11} /></button>
            <button style={{ ...iconBtn, padding: 3, color: C.red }} onClick={() => confirm(`"${b.name}" delete karein?`) && run(() => deleteBrand(b.id))}><X size={12} /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Catalog products ----
const blank = { name: "", brand: "", category: "", sub_category: "", description: "", image_url: "", mrp: "", gst_rate: "", barcode: "", unit: "piece", age_group: "", variants: [], is_active: true };

function CatalogProducts({ type }) {
  const [rows, err, reload] = useAsync(() => listCatalogProducts(type), [type]);
  const [cats] = useAsync(() => listCategories(type), [type]);
  const [brands] = useAsync(() => listBrands(type), [type]);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const run = async (fn) => { setMsg(""); try { await fn(); await reload(); } catch (e) { setMsg(e.message); } };
  if (!rows) return <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />;
  const shown = rows.filter((r) => `${r.name} ${r.brand || ""} ${r.category}`.toLowerCase().includes(q.toLowerCase()));

  if (editing) {
    return <ProductForm type={type} initial={editing} cats={cats || []} brands={brands || []} onCancel={() => setEditing(null)}
      onSave={async (f) => { await saveCatalogProduct(type, f); setEditing(null); reload(); }} />;
  }
  return (
    <div>
      <Err msg={err || msg} />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={input} placeholder="Search catalog…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button style={btn(true)} onClick={() => setEditing({ ...blank })}><Plus size={14} /> Naya</button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{rows.length} products · {rows.filter((r) => r.is_active).length} active</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((p) => (
          <div key={p.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: 10, opacity: p.is_active ? 1 : 0.55 }}>
            {p.image_url ? <img src={p.image_url} alt="" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 42, height: 42, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{[p.brand, p.category, p.sub_category].filter(Boolean).join(" › ")}</div>
            </div>
            <button style={iconBtn} title={p.is_active ? "Hide" : "Show"} onClick={() => run(() => setCatalogProductActive(p.id, !p.is_active))}>{p.is_active ? <Eye size={15} /> : <EyeOff size={15} />}</button>
            <button style={iconBtn} onClick={() => setEditing({ ...blank, ...p, brand: p.brand || "", sub_category: p.sub_category || "", description: p.description || "", image_url: p.image_url || "", mrp: p.mrp ?? "", gst_rate: p.gst_rate ?? "", barcode: p.barcode || "", age_group: p.age_group || "", variants: p.variants || [] })}><Edit2 size={15} /></button>
            <button style={{ ...iconBtn, color: C.red }} onClick={() => confirm(`"${p.name}" catalog se delete karein? (Jin shops ne add kar liya hai unka product safe rahega)`) && run(() => deleteCatalogProduct(p.id))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductForm({ type, initial, cats, brands, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const mains = cats.filter((c) => !c.parent_id);
  const mainRow = mains.find((m) => m.name === f.category);
  const subs = mainRow ? cats.filter((c) => c.parent_id === mainRow.id) : [];
  const mainOpts = f.category && !mains.some((m) => m.name === f.category) ? [{ id: "x", name: f.category }, ...mains] : mains;
  const subOpts = f.sub_category && !subs.some((s) => s.name === f.sub_category) ? [{ id: "y", name: f.sub_category }, ...subs] : subs;
  const units = getUnitPresets(type);

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUpl(true); setErr("");
    try { set("image_url", await uploadCatalogImage(file)); } catch (x) { setErr(x.message); }
    setUpl(false);
  };
  const submit = async () => {
    if (!f.name.trim()) return setErr("Naam daalein");
    if (!f.category) return setErr("Category chunein");
    setBusy(true); setErr("");
    try { await onSave(f); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const setVar = (i, patch) => set("variants", f.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{f.id ? "Catalog Product Edit" : "Naya Catalog Product"}</div>
      <Err msg={err} />
      <div style={{ display: "grid", gap: 10 }}>
        <div><label style={lbl}>Product Name *</label><input style={input} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label style={lbl}>Brand</label><input list="sa-brands" style={input} value={f.brand} onChange={(e) => set("brand", e.target.value)} /><datalist id="sa-brands">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>Category *</label>
            <select style={input} value={f.category} onChange={(e) => { set("category", e.target.value); set("sub_category", ""); }}>
              <option value="">— chunein —</option>{mainOpts.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select></div>
          <div><label style={lbl}>Sub-category</label>
            <select style={input} value={f.sub_category} onChange={(e) => set("sub_category", e.target.value)}>
              <option value="">—</option>{subOpts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>MRP ₹</label><input style={input} inputMode="decimal" value={f.mrp} onChange={(e) => set("mrp", e.target.value.replace(/[^0-9.]/g, ""))} /></div>
          <div><label style={lbl}>GST %</label><input style={input} inputMode="decimal" value={f.gst_rate} onChange={(e) => set("gst_rate", e.target.value.replace(/[^0-9.]/g, ""))} /></div>
          <div><label style={lbl}>Unit / Size</label><select style={input} value={f.unit} onChange={(e) => set("unit", e.target.value)}>{(units.includes(f.unit) ? units : [f.unit, ...units]).map((u) => <option key={u}>{u}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: type === "giftstoy" ? "1fr 1fr" : "1fr", gap: 10 }}>
          <div><label style={lbl}>Barcode / SKU</label><input style={input} value={f.barcode} onChange={(e) => set("barcode", e.target.value)} /></div>
          {type === "giftstoy" && <div><label style={lbl}>Age Group</label><select style={input} value={f.age_group} onChange={(e) => set("age_group", e.target.value)}><option value="">—</option>{(f.age_group && !AGE_GROUPS.includes(f.age_group) ? [f.age_group, ...AGE_GROUPS] : AGE_GROUPS).map((a) => <option key={a}>{a}</option>)}</select></div>}
        </div>
        <div><label style={lbl}>Description</label><textarea style={{ ...input, minHeight: 60 }} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
        <div>
          <label style={lbl}>Product Image</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {f.image_url && <img src={f.image_url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }} />}
            <label style={{ ...btn(false), cursor: "pointer" }}><Upload size={14} /> {upl ? "Upload…" : "Photo chunein"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} style={{ display: "none" }} /></label>
            {f.image_url && <button style={{ ...iconBtn, color: C.red }} onClick={() => set("image_url", "")}><X size={16} /></button>}
          </div>
        </div>
        <div>
          <label style={lbl}>Variants (shade / size / color) — optional</label>
          {f.variants.map((v, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginBottom: 6 }}>
              <input style={input} placeholder="jaise Shade 02 Red" value={v.label || ""} onChange={(e) => setVar(i, { label: e.target.value })} />
              <input style={input} placeholder="MRP" inputMode="decimal" value={v.mrp ?? ""} onChange={(e) => setVar(i, { mrp: e.target.value.replace(/[^0-9.]/g, "") })} />
              <button style={{ ...iconBtn, color: C.red }} onClick={() => set("variants", f.variants.filter((_, idx) => idx !== i))}><X size={15} /></button>
            </div>
          ))}
          <button style={btn(false)} onClick={() => set("variants", [...f.variants, { label: "", mrp: "" }])}><Plus size={13} /> Variant</button>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={f.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} /> Active (shop owners ko dikhe)</label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={{ ...btn(false), flex: 1, justifyContent: "center" }} onClick={onCancel} disabled={busy}>Cancel</button>
        <button style={{ ...btn(true), flex: 1.5, justifyContent: "center", opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>{busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />} Save</button>
      </div>
    </div>
  );
}
