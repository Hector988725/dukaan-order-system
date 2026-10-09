import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Check, X, Loader2, Upload, Eye, EyeOff } from "lucide-react";
import Papa from "papaparse";
import { BUSINESS_THEMES, BUSINESS_TYPE_LIST, getUnitPresets } from "../lib/theme";
import { AGE_GROUPS } from "../components/CategoryFields";
import { friendlyError } from "../lib/errors";
import {
  listTypeSettings, saveTypeSettings, listCategories, addCategory, renameCategory, deleteCategory,
  listBrands, addBrand, renameBrand, deleteBrand,
  listCatalogProducts, saveCatalogProduct, setCatalogProductActive, deleteCatalogProduct, uploadCatalogImage,
  countShopsUsingCatalogProduct, importCatalogProducts, CSV_TEMPLATE,
} from "./catalogApi";

// ============================================================
// SUPER ADMIN — Categories & Central Catalog
// (Cosmetics / Beauty + Gift / Toys / Kids)
// Enable/Disable type, Edit label, Sub-categories, Brands,
// Central Products, Product images — sab yahin se.
// ============================================================

// Saare shop types (kirana, medical, ... cosmetics, giftstoy) ka Central Catalog yahin se manage hota hai.
const MANAGED_TYPES = BUSINESS_TYPE_LIST.map((b) => b.id);
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
    try { setData(await fn()); setErr(""); } catch (e) { setErr(friendlyError(e) || "Load nahi hua"); }
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
          <button key={t} onClick={() => setType(t)} style={{ ...btn(type === t), padding: "8px 12px", fontSize: 12 }}>{BUSINESS_THEMES[t].label}</button>
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
    try { await saveTypeSettings(type, { is_enabled: enabled, label, description: desc, ...patch }); setMsg("Save ho gaya ✅"); reload(); } catch (e) { setMsg(friendlyError(e)); }
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
  const run = async (fn) => { setMsg(""); try { await fn(); await reload(); } catch (e) { setMsg(e.message?.includes("duplicate") ? "Yeh naam pehle se hai" : friendlyError(e)); } };
  if (!rows) return <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />;
  const mains = rows.filter((r) => !r.parent_id);
  // Sirf Cosmetics / Gift-Toys jaise types ke category presets hain. Baaki types mein dukaandar ke liye category
  // free text hai (catalog products ke andar likhi category se aati hai) — wahan preset banane se unka form badal jaata,
  // isliye yahan add nahi karne dete.
  if (rows.length === 0) {
    return <div style={{ ...card, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
      <b style={{ color: C.text }}>{BUSINESS_THEMES[type].label}</b> mein category <b>free text</b> hai — catalog product ki <i>Category</i> field mein jo likhoge wahi category ban jaati hai.
      Category dropdown/sub-category sirf Cosmetics aur Gift/Toys ke liye hain.
    </div>;
  }
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
  const run = async (fn) => { setMsg(""); try { await fn(); await reload(); } catch (e) { setMsg(e.message?.includes("duplicate") ? "Yeh brand pehle se hai" : friendlyError(e)); } };
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
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [msg, setMsg] = useState("");
  const run = async (fn) => { setMsg(""); try { await fn(); await reload(); } catch (e) { setMsg(friendlyError(e)); } };
  if (!rows) return <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />;
  const catList = Array.from(new Set(rows.map((r) => r.category))).sort();
  const shown = rows.filter((r) => (catFilter === "All" || r.category === catFilter) && `${r.name} ${r.brand || ""} ${r.category}`.toLowerCase().includes(q.toLowerCase()));

  // Deactivate / delete se pehle batao kitni dukaanon ne yeh product add kiya hai
  const withUsage = async (p, verb, action) => {
    let n = 0;
    try { n = await countShopsUsingCatalogProduct(p.id); } catch (e) { /* count na mile to bhi aage badho */ }
    const note = n > 0 ? `\n\n${n} dukaan(on) ne ise apni shop mein add kiya hai. Unke products delete NAHI honge — woh chalte rahenge${verb === "delete" ? " (bas catalog se link hat jaayega)" : ", unhe owner ko \"catalog se hata diya gaya\" warning dikhegi"}.` : "";
    if (confirm(`"${p.name}" ko ${verb === "delete" ? "catalog se delete" : "deactivate"} karein?${note}`)) run(action);
  };

  if (editing) {
    return <ProductForm type={type} initial={editing} cats={cats || []} brands={brands || []} knownCategories={catList} onCancel={() => setEditing(null)}
      onSave={async (f) => { await saveCatalogProduct(type, f); setEditing(null); reload(); }} />;
  }
  return (
    <div>
      <Err msg={err || msg} />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={input} placeholder="Search catalog…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button style={btn(false)} onClick={() => setImporting(true)}><Upload size={14} /> CSV</button>
        <button style={btn(true)} onClick={() => setEditing({ ...blank })}><Plus size={14} /> Naya</button>
      </div>
      {catList.length > 1 && (
        <select style={{ ...input, marginBottom: 10 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="All">Saari categories</option>
          {catList.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {importing && <ImportModal type={type} onClose={() => setImporting(false)} onDone={() => { reload(); }} />}
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{rows.length} products · {rows.filter((r) => r.is_active).length} active</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((p) => (
          <div key={p.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: 10, opacity: p.is_active ? 1 : 0.55 }}>
            {p.image_url ? <img src={p.image_url} alt="" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 42, height: 42, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{[p.brand, p.category, p.sub_category].filter(Boolean).join(" › ")}</div>
            </div>
            <button style={iconBtn} title={p.is_active ? "Hide" : "Show"} onClick={() => (p.is_active ? withUsage(p, "deactivate", () => setCatalogProductActive(p.id, false)) : run(() => setCatalogProductActive(p.id, true)))}>{p.is_active ? <Eye size={15} /> : <EyeOff size={15} />}</button>
            <button style={iconBtn} onClick={() => setEditing({ ...blank, ...p, brand: p.brand || "", sub_category: p.sub_category || "", description: p.description || "", image_url: p.image_url || "", mrp: p.mrp ?? "", gst_rate: p.gst_rate ?? "", barcode: p.barcode || "", age_group: p.age_group || "", variants: p.variants || [] })}><Edit2 size={15} /></button>
            <button style={{ ...iconBtn, color: C.red }} onClick={() => withUsage(p, "delete", () => deleteCatalogProduct(p.id))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductForm({ type, initial, cats, brands, knownCategories = [], onSave, onCancel }) {
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
        {mains.length > 0 ? (
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
        ) : (
          <div>
            <label style={lbl}>Category * (naya naam likhein ya list se chunein)</label>
            <input list="sa-cats" style={input} value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="jaise Staples, Cakes, Hand Tools" />
            <datalist id="sa-cats">{knownCategories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        )}
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

// ---- CSV import ----
const FIELD_ALIASES = {
  name: ["name", "product name", "product", "naam"], brand: ["brand"], category: ["category"], sub_category: ["sub_category", "sub-category", "subcategory", "sub category"],
  mrp: ["mrp"], gst_rate: ["gst_rate", "gst", "gst %", "gst rate"], unit: ["unit", "pack size", "size"], barcode: ["barcode", "sku", "barcode/sku"],
  age_group: ["age_group", "age group", "age"], description: ["description", "details"], image_url: ["image_url", "image", "image url"], is_active: ["is_active", "active", "status"],
};

function ImportModal({ type, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name); setResult(null); setErr("");
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const headers = (res.meta.fields || []).map((h) => h.trim().toLowerCase());
        const map = {};
        Object.entries(FIELD_ALIASES).forEach(([key, aliases]) => { const idx = headers.findIndex((h) => aliases.includes(h)); if (idx >= 0) map[key] = res.meta.fields[idx]; });
        if (!map.name || !map.category) { setErr("CSV mein 'name' aur 'category' columns zaroori hain."); setRows(null); return; }
        setRows(res.data.map((r) => Object.fromEntries(Object.entries(map).map(([k, col]) => [k, r[col]]))));
      },
      error: (x) => setErr(x.message),
    });
  };
  const download = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "catalog-template.csv"; a.click();
  };
  const run = async () => {
    setBusy(true); setErr("");
    try { const r = await importCatalogProducts(type, rows); setResult(r); onDone(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>CSV Import — {BUSINESS_THEMES[type].label}</div>
          <button style={iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
          Columns: <b>name, category</b> (zaroori) aur brand, sub_category, mrp, gst_rate, unit, barcode, age_group, description, image_url, is_active (optional).
          Jo product (naam + brand) pehle se catalog mein hai woh skip ho jaata hai.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button style={btn(false)} onClick={download}>Template download</button>
          <label style={{ ...btn(true), cursor: "pointer" }}><Upload size={14} /> {fileName || "CSV chunein"}<input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} /></label>
        </div>
        <Err msg={err} />
        {rows && !result && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{rows.length} rows mili</div>
            <div style={{ fontSize: 12, color: C.muted, maxHeight: 120, overflowY: "auto", background: C.bg, borderRadius: 8, padding: 8 }}>
              {rows.slice(0, 5).map((r, i) => <div key={i}>{r.name} — {r.category}{r.brand ? ` — ${r.brand}` : ""}</div>)}
              {rows.length > 5 && <div>… aur {rows.length - 5}</div>}
            </div>
            <button style={{ ...btn(true), marginTop: 10, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={run}>{busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />} Import karein</button>
          </div>
        )}
        {result && (
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ color: C.green, fontWeight: 800 }}>✅ {result.added} product add hue</div>
            {result.skipped > 0 && <div style={{ color: C.muted }}>{result.skipped} pehle se the (skip)</div>}
            {result.failed.length > 0 && <div style={{ color: C.red }}>{result.failed.length} fail: {result.failed.slice(0, 5).map((f) => `row ${f.row} (${f.reason})`).join("; ")}</div>}
            <button style={{ ...btn(false), marginTop: 10 }} onClick={onClose}>Band karein</button>
          </div>
        )}
      </div>
    </div>
  );
}
