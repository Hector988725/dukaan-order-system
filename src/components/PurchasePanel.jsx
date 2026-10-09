import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Minus, Search, X, ArrowLeft, Phone, Loader2, Edit2, Check, Truck } from "lucide-react";
import { friendlyError } from "../lib/errors";
import {
  fetchSuppliers, saveSupplier, recordSupplierPayment, fetchSupplierTransactions,
  fetchPurchases, fetchLastPurchasePrices, savePurchase, markPurchaseOrdered, receivePurchase, cancelPurchase,
} from "../lib/api";

// ============================================================
// PURCHASE + SUPPLIER PANEL (Dukaandar side)
// ============================================================
// Rozana ka kaam: Purchase -> New Purchase -> supplier chuno -> product
// search/dropdown se chuno -> qty + price -> "Save & Receive".
// Koi CSV/PDF upload nahi chahiye — dropdown mein dukaandar ke apne
// existing products hi aate hain.
//
// Stock / payable ka calculation yahan nahi hota — sab database ke
// RPCs (save_purchase / receive_purchase / record_supplier_payment) mein
// hota hai, jo stock_movements mein bhi log karte hain. Yeh UI sirf
// dikhata hai aur RPC call karta hai.
// ============================================================

const C = { green: "#1B4332", border: "#E3DECF", bg: "#F7F5F0", muted: "#8B8576", red: "#B3261E", amber: "#9A6B00", text: "#2A2A2A" };

const STATUS_STYLE = {
  Draft: { color: "#5F5B50", bg: "#EEEBE3" },
  Ordered: { color: "#1D4E89", bg: "#E4EEF9" },
  "Partially Received": { color: "#9A6B00", bg: "#FBF0D5" },
  Received: { color: "#1B4332", bg: "#E7F0EA" },
  Cancelled: { color: "#B3261E", bg: "#FBE6E4" },
};
const STATUS_FILTERS = ["All", "Draft", "Ordered", "Partially Received", "Received", "Cancelled"];
const PAY_METHODS = ["Cash", "UPI", "Bank Transfer", "Other"];

const money = (n) => "₹" + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN");
const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v) || 0);
const localDate = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

const cardStyle = { background: "white", border: `1px solid ${C.border}`, borderRadius: "12px", padding: "12px 14px" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: "9px", padding: "11px 12px", fontSize: "15px", background: "white", color: C.text, outline: "none" };
const labelStyle = { fontSize: "11px", fontWeight: 700, color: C.muted, marginBottom: "4px", display: "block" };
const btnPrimary = { background: C.green, color: "white", border: "none", borderRadius: "10px", padding: "13px 16px", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" };
const btnSecondary = { background: "white", color: C.green, border: `1.5px solid ${C.green}`, borderRadius: "10px", padding: "11px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" };
const btnDanger = { ...btnSecondary, color: C.red, border: `1.5px solid ${C.red}` };

// Products -> flat searchable list of variants (stock isi level par hota hai)
function flattenVariants(products) {
  const out = [];
  (products || []).forEach((p) => {
    const vs = p.variants || [];
    vs.forEach((v) => {
      const showLabel = vs.length > 1 || (v.label && v.label.toLowerCase() !== "standard");
      out.push({
        variantId: v.id,
        productName: p.name,
        emoji: p.emoji,
        label: v.label,
        unit: v.unit,
        stock: v.stock ?? 0,
        barcode: v.barcode || "",
        displayName: showLabel && v.label ? `${p.name} · ${v.label}` : p.name,
        haystack: `${p.name} ${v.label || ""} ${v.barcode || ""} ${p.category || ""} ${p.brand || ""} ${p.sub_category || ""}`.toLowerCase(),
      });
    });
  });
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Draft;
  return <span style={{ background: s.bg, color: s.color, fontSize: "10.5px", fontWeight: 800, borderRadius: "999px", padding: "3px 9px", whiteSpace: "nowrap" }}>{status}</span>;
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return <div style={{ background: "#FBE6E4", color: C.red, borderRadius: "9px", padding: "9px 12px", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{msg}</div>;
}

function BackBar({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
      <button onClick={onBack} style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: "9px", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={17} /></button>
      <div style={{ fontSize: "16px", fontWeight: 800, color: C.green, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      {right}
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================
export default function PurchasePanel({ store, products, onRefresh }) {
  const [tab, setTab] = useState("purchases");
  const [screen, setScreen] = useState({ type: "home" });
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const load = useCallback(async () => {
    try {
      const [s, p, pr] = await Promise.all([fetchSuppliers(store.id), fetchPurchases(store.id), fetchLastPurchasePrices(store.id)]);
      setSuppliers(s); setPurchases(p); setPrices(pr); setLoadError("");
    } catch (e) {
      setLoadError(friendlyError(e) || "Load nahi ho paaya. Kya migration_purchase_supplier.sql run ho chuka hai?");
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => { load(); }, [load]);

  // Koi bhi change (stock/payable) ke baad: apna data + products (stock dikhane ke liye) dono refresh
  const afterChange = useCallback(async () => {
    await load();
    if (onRefresh) onRefresh();
  }, [load, onRefresh]);

  const totalPayable = suppliers.reduce((s, x) => s + (Number(x.payable_balance) > 0 ? Number(x.payable_balance) : 0), 0);
  const openOrders = purchases.filter((p) => p.status === "Ordered" || p.status === "Partially Received").length;

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "50px 0", color: C.muted }}><Loader2 size={22} className="spin" style={{ animation: "spin 1s linear infinite" }} /></div>;
  }

  if (loadError) {
    return (
      <div style={{ ...cardStyle, color: C.red, fontSize: "13px" }}>
        <b>Purchase module load nahi hua.</b><br />{loadError}
        <div style={{ marginTop: 10 }}><button onClick={() => { setLoading(true); load(); }} style={btnSecondary}>Dobara try karein</button></div>
      </div>
    );
  }

  // ---------- Screens ----------
  if (screen.type === "form") {
    return (
      <PurchaseForm
        store={store} products={products} suppliers={suppliers} prices={prices}
        existing={screen.purchase || null} presetSupplierId={screen.supplierId || ""}
        onCancel={() => setScreen(screen.purchase ? { type: "purchase", id: screen.purchase.id } : { type: "home" })}
        onSuppliersChanged={load}
        onDone={async (pur) => { await afterChange(); setScreen({ type: "purchase", id: pur.id }); }}
      />
    );
  }

  if (screen.type === "purchase") {
    const pur = purchases.find((p) => p.id === screen.id);
    if (!pur) { setScreen({ type: "home" }); return null; }
    return (
      <PurchaseDetail
        store={store} purchase={pur}
        onBack={() => setScreen(screen.fromSupplier ? { type: "supplier", id: screen.fromSupplier } : { type: "home" })}
        onEdit={() => setScreen({ type: "form", purchase: pur })}
        onChanged={afterChange}
      />
    );
  }

  if (screen.type === "supplier") {
    const sup = suppliers.find((s) => s.id === screen.id);
    if (!sup) { setScreen({ type: "home" }); return null; }
    return (
      <SupplierDetail
        store={store} supplier={sup}
        purchases={purchases.filter((p) => p.supplier_id === sup.id)}
        onBack={() => { setTab("suppliers"); setScreen({ type: "home" }); }}
        onOpenPurchase={(id) => setScreen({ type: "purchase", id, fromSupplier: sup.id })}
        onNewPurchase={() => setScreen({ type: "form", supplierId: sup.id })}
        onChanged={load}
      />
    );
  }

  // ---------- Home ----------
  const shown = statusFilter === "All" ? purchases : purchases.filter((p) => p.status === statusFilter);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
        <div style={{ ...cardStyle, padding: "10px 12px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: C.muted }}>Supplier ko dena baaki</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: totalPayable > 0 ? C.red : C.green }}>{money(totalPayable)}</div>
        </div>
        <div style={{ ...cardStyle, padding: "10px 12px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: C.muted }}>Aane wale orders</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: C.green }}>{openOrders}</div>
        </div>
      </div>

      <button onClick={() => setScreen({ type: "form" })} style={{ ...btnPrimary, width: "100%", fontSize: "15px", padding: "15px" }}>
        <Plus size={18} /> New Purchase
      </button>

      <div style={{ display: "flex", background: C.bg, borderRadius: "10px", padding: "3px", margin: "14px 0 12px", border: `1px solid ${C.border}` }}>
        {[["purchases", "Purchases"], ["suppliers", "Suppliers"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, border: "none", borderRadius: "8px", padding: "9px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: tab === id ? "white" : "transparent", color: tab === id ? C.green : C.muted, boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{label}</button>
        ))}
      </div>

      {tab === "purchases" && (
        <>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px", marginBottom: "4px" }}>
            {STATUS_FILTERS.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ whiteSpace: "nowrap", border: `1px solid ${statusFilter === s ? C.green : C.border}`, background: statusFilter === s ? C.green : "white", color: statusFilter === s ? "white" : C.muted, borderRadius: "999px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "34px 10px", fontSize: "13px" }}>
              <Truck size={30} style={{ opacity: 0.4, marginBottom: 8 }} /><br />
              {purchases.length === 0 ? "Abhi koi purchase nahi hai. \"New Purchase\" dabakar pehli entry karein." : "Is status ki koi purchase nahi."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {shown.map((p) => (
                <button key={p.id} onClick={() => setScreen({ type: "purchase", id: p.id })} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: C.text }}>{p.suppliers?.name || "Supplier"}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: "12px", color: C.muted }}>
                    <span>{p.purchase_number} · {fmtDate(p.purchase_date)} · {(p.purchase_items || []).length} items</span>
                    <b style={{ color: C.text, fontSize: "14px" }}>{money(p.total_amount)}</b>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "suppliers" && (
        <SuppliersTab store={store} suppliers={suppliers} onOpen={(id) => setScreen({ type: "supplier", id })} onChanged={load} />
      )}
    </div>
  );
}

// ============================================================
// SUPPLIERS LIST + ADD
// ============================================================
function SuppliersTab({ store, suppliers, onOpen, onChanged }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      {adding ? (
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <SupplierForm onCancel={() => setAdding(false)} onSave={async (f) => { await saveSupplier(store.id, f); setAdding(false); onChanged(); }} />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...btnSecondary, width: "100%", marginBottom: 12 }}><Plus size={16} /> Add Supplier</button>
      )}
      {suppliers.length === 0 && !adding && <div style={{ textAlign: "center", color: C.muted, padding: "28px 10px", fontSize: "13px" }}>Abhi koi supplier nahi. Upar se add karein (ya New Purchase ke time bhi add kar sakte hain).</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {suppliers.map((s) => {
          const bal = Number(s.payable_balance);
          return (
            <button key={s.id} onClick={() => onOpen(s.id)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", width: "100%", opacity: s.is_active ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: "14px", color: C.text }}>{s.name}{!s.is_active && " (inactive)"}</div>
                <div style={{ fontWeight: 800, fontSize: "14px", color: bal > 0 ? C.red : bal < 0 ? C.green : C.muted }}>
                  {bal > 0 ? `${money(bal)} baaki` : bal < 0 ? `${money(-bal)} advance` : "Clear"}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: C.muted, marginTop: 3 }}>
                {s.phone ? `${s.phone} · ` : ""}{s.purchase_count} purchases · Total {money(s.total_purchased)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SupplierForm({ initial, onSave, onCancel, compact }) {
  const [f, setF] = useState({ name: "", phone: "", address: "", gstin: "", notes: "", openingPayable: "", ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    if (!f.name.trim()) { setErr("Supplier ka naam daalein"); return; }
    setBusy(true); setErr("");
    try { await onSave({ ...f, id: initial?.id }); } catch (e) { setErr(friendlyError(e)); setBusy(false); }
  };
  return (
    <div>
      <ErrorBanner msg={err} />
      <div style={{ display: "grid", gap: 10 }}>
        <div><label style={labelStyle}>Supplier / Distributor ka naam *</label><input style={inputStyle} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="jaise ABC Distributor" autoFocus /></div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} inputMode="tel" value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
        {!compact && (
          <>
            <div><label style={labelStyle}>Address</label><input style={inputStyle} value={f.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
            <div><label style={labelStyle}>GSTIN (optional)</label><input style={inputStyle} value={f.gstin || ""} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></div>
            <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </>
        )}
        {!initial?.id && (
          <div><label style={labelStyle}>Pehle se kitna baaki hai? (optional)</label><input style={inputStyle} inputMode="decimal" value={f.openingPayable} onChange={(e) => set("openingPayable", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="₹0" /></div>
        )}
        {initial?.id && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={f.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} /> Active supplier (naye purchase mein dikhe)
          </label>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} disabled={busy} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, flex: 1.4, opacity: busy ? 0.6 : 1 }}>{busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={15} />} Save</button>
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT PICKER — searchable dropdown of the shop's OWN products
// ============================================================
function ProductPicker({ variants, addedIds, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, []);

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = tokens.length ? variants.filter((v) => tokens.every((t) => v.haystack.includes(t))) : variants;
    return list.slice(0, 40);
  }, [q, variants]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: 14, color: C.muted }} />
        <input
          style={{ ...inputStyle, paddingLeft: 36, paddingRight: q ? 36 : 12, borderColor: open ? C.green : C.border }}
          placeholder="Product search karein ya list se chunein…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {q && <button onClick={() => setQ("")} style={{ position: "absolute", right: 6, top: 6, background: "none", border: "none", padding: 7, cursor: "pointer", color: C.muted }}><X size={16} /></button>}
      </div>
      {open && (
        <div style={{ marginTop: 6, background: "white", border: `1px solid ${C.border}`, borderRadius: 10, maxHeight: 280, overflowY: "auto", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", WebkitOverflowScrolling: "touch" }}>
          {variants.length === 0 && <div style={{ padding: 14, fontSize: 13, color: C.muted }}>Aapke paas abhi koi product nahi hai. Pehle Admin → Products mein product add karein.</div>}
          {variants.length > 0 && results.length === 0 && <div style={{ padding: 14, fontSize: 13, color: C.muted }}>"{q}" naam ka koi product nahi mila. Naya product Admin → Products mein add karein.</div>}
          {results.map((v) => (
            <button key={v.variantId} onClick={() => { onPick(v); setQ(""); setOpen(false); }}
              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left", background: "white", border: "none", borderBottom: `1px solid ${C.bg}`, padding: "12px 14px", cursor: "pointer", minHeight: 48 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{v.emoji || "📦"} {v.displayName}{addedIds.has(v.variantId) && <span style={{ color: C.green, fontSize: 11, marginLeft: 6 }}>✓ added (+1)</span>}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: v.stock <= 0 ? C.red : C.muted, whiteSpace: "nowrap" }}>Stock {v.stock}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NEW / EDIT PURCHASE
// ============================================================
function PurchaseForm({ store, products, suppliers, prices, existing, presetSupplierId, onCancel, onDone, onSuppliersChanged }) {
  const variants = useMemo(() => flattenVariants(products), [products]);
  const variantMap = useMemo(() => Object.fromEntries(variants.map((v) => [v.variantId, v])), [variants]);
  const activeSuppliers = suppliers.filter((s) => s.is_active || s.id === existing?.supplier_id);

  const [supplierId, setSupplierId] = useState(existing?.supplier_id || presetSupplierId || "");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [lines, setLines] = useState(() =>
    (existing?.purchase_items || []).filter((i) => i.variant_id).map((i) => ({ key: i.id, variantId: i.variant_id, qty: String(i.qty_ordered), price: String(i.purchase_price) }))
  );
  const [invoice, setInvoice] = useState(existing?.invoice_number || "");
  const [date, setDate] = useState(existing?.purchase_date || localDate());
  const [notes, setNotes] = useState(existing?.notes || "");
  const [showMore, setShowMore] = useState(!!(existing?.invoice_number || existing?.notes));
  const [paidNow, setPaidNow] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [focusKey, setFocusKey] = useState(null);
  const qtyRefs = useRef({});

  useEffect(() => {
    if (focusKey && qtyRefs.current[focusKey]) { qtyRefs.current[focusKey].focus(); qtyRefs.current[focusKey].select(); }
  }, [focusKey, lines.length]);

  const droppedCount = (existing?.purchase_items || []).filter((i) => !i.variant_id).length;
  const addedIds = useMemo(() => new Set(lines.map((l) => l.variantId)), [lines]);

  const pick = (v) => {
    const found = lines.find((l) => l.variantId === v.variantId);
    if (found) {
      setLines((ls) => ls.map((l) => (l.key === found.key ? { ...l, qty: String(num(l.qty) + 1) } : l)));
      setFocusKey(found.key);
      return;
    }
    const key = `n${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
    const last = prices[v.variantId];
    setLines((ls) => [...ls, { key, variantId: v.variantId, qty: "1", price: last !== undefined ? String(last) : "" }]);
    setFocusKey(key);
  };
  const upd = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const total = Math.round(lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0) * 100) / 100;
  const totalUnits = lines.reduce((s, l) => s + num(l.qty), 0);

  const validate = () => {
    if (!supplierId) return "Supplier select karein";
    if (lines.length === 0) return "Kam se kam ek product add karein";
    for (const l of lines) {
      const name = variantMap[l.variantId]?.displayName || "Product";
      if (!(num(l.qty) > 0) || !Number.isInteger(num(l.qty))) return `${name}: quantity poora number (1 ya zyada) honi chahiye`;
      if (l.price === "" || num(l.price) < 0) return `${name}: purchase price daalein`;
    }
    return "";
  };

  const submit = async (status) => {
    const v = validate();
    if (v) { setErr(v); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (status === "Received" && num(paidNow) > total) { setErr("Paid amount total se zyada nahi ho sakta"); return; }
    setBusy(true); setErr("");
    try {
      const pur = await savePurchase(store.id, {
        purchaseId: existing?.id, supplierId, items: lines, status,
        invoiceNumber: invoice, purchaseDate: date, notes,
        paidNow: status === "Received" ? paidNow : 0, paymentMethod: payMethod,
      });
      await onDone(pur);
    } catch (e) {
      setErr(friendlyError(e)); setBusy(false); window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div style={{ paddingBottom: 150 }}>
      <BackBar title={existing ? `Edit ${existing.purchase_number}` : "New Purchase"} onBack={onCancel} />
      <ErrorBanner msg={err} />
      {droppedCount > 0 && <ErrorBanner msg={`${droppedCount} item ka product delete ho chuka hai, woh is purchase se hata diya gaya hai.`} />}

      {/* 1. Supplier */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <label style={labelStyle}>Supplier / Vendor *</label>
        {addingSupplier ? (
          <SupplierForm compact onCancel={() => setAddingSupplier(false)}
            onSave={async (f) => { const s = await saveSupplier(store.id, f); await onSuppliersChanged(); setSupplierId(s.id); setAddingSupplier(false); }} />
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...inputStyle, flex: 1 }} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Supplier chunein —</option>
              {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{Number(s.payable_balance) > 0 ? ` (baaki ${money(s.payable_balance)})` : ""}</option>)}
            </select>
            <button onClick={() => setAddingSupplier(true)} style={{ ...btnSecondary, padding: "0 14px" }} title="Naya supplier"><Plus size={16} /></button>
          </div>
        )}
      </div>

      {/* 2. Product search */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Product add karein</label>
        <ProductPicker variants={variants} addedIds={addedIds} onPick={pick} />
      </div>

      {/* 3. Lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((l) => {
          const v = variantMap[l.variantId];
          const lineTotal = num(l.qty) * num(l.price);
          return (
            <div key={l.key} style={{ ...cardStyle, borderColor: focusKey === l.key ? C.green : C.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: C.text }}>{v?.emoji || "📦"} {v?.displayName || "Product"}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Abhi stock: <b style={{ color: C.text }}>{v?.stock ?? "-"}</b>
                    {v && num(l.qty) > 0 && <span> → <b style={{ color: C.green }}>{v.stock + num(l.qty)}</b> (receive ke baad)</span>}
                  </div>
                </div>
                <button onClick={() => remove(l.key)} style={{ background: "none", border: "none", color: C.muted, padding: 6, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <div style={{ display: "flex", alignItems: "stretch" }}>
                    <button onClick={() => upd(l.key, { qty: String(Math.max(1, num(l.qty) - 1)) })} style={{ width: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: "9px 0 0 9px", cursor: "pointer" }}><Minus size={14} /></button>
                    <input ref={(el) => { qtyRefs.current[l.key] = el; }} style={{ ...inputStyle, borderRadius: 0, textAlign: "center", padding: "11px 4px", minWidth: 0 }} inputMode="numeric" value={l.qty}
                      onFocus={(e) => e.target.select()} onChange={(e) => upd(l.key, { qty: e.target.value.replace(/\D/g, "") })} />
                    <button onClick={() => upd(l.key, { qty: String(num(l.qty) + 1) })} style={{ width: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: "0 9px 9px 0", cursor: "pointer" }}><Plus size={14} /></button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Purchase price (₹ / piece)</label>
                  <input style={inputStyle} inputMode="decimal" placeholder="₹" value={l.price} onFocus={(e) => e.target.select()} onChange={(e) => upd(l.key, { price: e.target.value.replace(/[^0-9.]/g, "") })} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13, color: C.muted }}>
                <span>{num(l.qty)} × {money(num(l.price))}</span>
                <b style={{ color: C.green, fontSize: 15 }}>Total {money(lineTotal)}</b>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. More details */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowMore((s) => !s)} style={{ background: "none", border: "none", color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "6px 0" }}>{showMore ? "− Kam details" : "+ Invoice no. / Date / Notes"}</button>
        {showMore && (
          <div style={{ ...cardStyle, display: "grid", gap: 10, marginTop: 4 }}>
            <div><label style={labelStyle}>Purchase date</label><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Supplier invoice / bill no.</label><input style={inputStyle} value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
            <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
        )}
      </div>

      {/* 5. Payment-at-receive (optional) */}
      {lines.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <label style={labelStyle}>Supplier ko abhi kitna diya? (optional — "Save & Receive" ke saath record hoga)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...inputStyle, flex: "1 1 110px", minWidth: 0 }} inputMode="decimal" placeholder="₹0 (udhaar)" value={paidNow} onChange={(e) => setPaidNow(e.target.value.replace(/[^0-9.]/g, ""))} />
            <select style={{ ...inputStyle, flex: "1 1 110px", minWidth: 0 }} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => setPaidNow(String(total))} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12 }}>Poora {money(total)}</button>
            <button onClick={() => setPaidNow("")} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, color: C.muted, border: `1.5px solid ${C.border}` }}>Udhaar</button>
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "white", borderTop: `1px solid ${C.border}`, padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))", zIndex: 30, boxShadow: "0 -4px 14px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, color: C.muted }}>{lines.length} products · {totalUnits} pcs</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>Total {money(total)}</span>
          </div>
          <button onClick={() => submit("Received")} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />} Save &amp; Receive (Stock +{totalUnits})
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => submit("Ordered")} disabled={busy} style={{ ...btnSecondary, flex: 1 }}>Mark Ordered</button>
            <button onClick={() => submit("Draft")} disabled={busy} style={{ ...btnSecondary, flex: 1, color: C.muted, border: `1.5px solid ${C.border}` }}>Save Draft</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PURCHASE DETAIL (+ receive / cancel)
// ============================================================
function PurchaseDetail({ store, purchase, onBack, onEdit, onChanged }) {
  const p = purchase;
  const items = [...(p.purchase_items || [])].sort((a, b) => a.product_name.localeCompare(b.product_name));
  const [receiving, setReceiving] = useState(false);
  const [recv, setRecv] = useState({});
  const [paidNow, setPaidNow] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canReceive = p.status === "Draft" || p.status === "Ordered" || p.status === "Partially Received";
  const canEdit = (p.status === "Draft" || p.status === "Ordered") && items.every((i) => i.qty_received === 0);

  const startReceive = () => {
    const init = {};
    items.forEach((i) => { init[i.id] = String(i.qty_ordered - i.qty_received); });
    setRecv(init); setPaidNow(""); setErr(""); setReceiving(true);
  };

  const receiveValue = items.reduce((s, i) => s + Math.min(num(recv[i.id]), i.qty_ordered - i.qty_received) * Number(i.purchase_price), 0);
  const receiveUnits = items.reduce((s, i) => s + Math.min(num(recv[i.id]), i.qty_ordered - i.qty_received), 0);

  const run = async (fn) => {
    setBusy(true); setErr("");
    try { await fn(); await onChanged(); setReceiving(false); } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };

  const confirmReceive = () => {
    for (const i of items) {
      const rem = i.qty_ordered - i.qty_received;
      if (num(recv[i.id]) > rem) { setErr(`${i.product_name}: sirf ${rem} baaki hai`); return; }
    }
    if (receiveUnits <= 0) { setErr("Kam se kam ek item ki quantity daalein"); return; }
    if (num(paidNow) > receiveValue) { setErr("Paid amount receive hue maal ki value se zyada nahi ho sakta"); return; }
    const receipts = items.filter((i) => num(recv[i.id]) > 0).map((i) => ({ itemId: i.id, qty: num(recv[i.id]) }));
    run(() => receivePurchase(store.id, p.id, { receipts, paidNow, paymentMethod: payMethod }));
  };

  return (
    <div>
      <BackBar title={p.purchase_number} onBack={onBack} right={<StatusBadge status={p.status} />} />
      <ErrorBanner msg={err} />

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{p.suppliers?.name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
          {fmtDate(p.purchase_date)}{p.invoice_number ? ` · Bill: ${p.invoice_number}` : ""}
        </div>
        {p.notes && <div style={{ fontSize: 12.5, color: C.text, marginTop: 6 }}>{p.notes}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((i) => {
          const rem = i.qty_ordered - i.qty_received;
          return (
            <div key={i.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{i.product_name}{i.variant_label && i.variant_label.toLowerCase() !== "standard" ? ` · ${i.variant_label}` : ""}</div>
                <b style={{ fontSize: 14 }}>{money(i.line_total)}</b>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {i.qty_ordered} × {money(i.purchase_price)} · Received <b style={{ color: i.qty_received === i.qty_ordered ? C.green : C.amber }}>{i.qty_received}/{i.qty_ordered}</b>
              </div>
              {receiving && rem > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <label style={{ ...labelStyle, margin: 0, flex: 1 }}>Abhi receive (max {rem})</label>
                  <input style={{ ...inputStyle, width: 90, textAlign: "center" }} inputMode="numeric" value={recv[i.id] ?? ""} onFocus={(e) => e.target.select()}
                    onChange={(e) => setRecv((r) => ({ ...r, [i.id]: e.target.value.replace(/\D/g, "") }))} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ ...cardStyle, marginTop: 12, display: "grid", gap: 5, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>Order total</span><b>{money(p.total_amount)}</b></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>Receive hua maal (payable mein juda)</span><b>{money(p.received_amount)}</b></div>
      </div>

      {receiving && (
        <div style={{ ...cardStyle, marginTop: 12, borderColor: C.green }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>Stock +{receiveUnits} · Supplier payable +{money(receiveValue)}</div>
          <label style={labelStyle}>Supplier ko abhi kitna diya? (optional)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ ...inputStyle, flex: "1 1 110px", minWidth: 0 }} inputMode="decimal" placeholder="₹0 (udhaar)" value={paidNow} onChange={(e) => setPaidNow(e.target.value.replace(/[^0-9.]/g, ""))} />
            <select style={{ ...inputStyle, flex: "1 1 110px", minWidth: 0 }} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <button onClick={() => setPaidNow(String(receiveValue))} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, marginTop: 8 }}>Poora {money(receiveValue)}</button>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setReceiving(false)} disabled={busy} style={{ ...btnSecondary, flex: 1 }}>Back</button>
            <button onClick={confirmReceive} disabled={busy} style={{ ...btnPrimary, flex: 1.6, opacity: busy ? 0.6 : 1 }}>{busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={15} />} Confirm Receive</button>
          </div>
        </div>
      )}

      {!receiving && (
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {canReceive && <button onClick={startReceive} style={btnPrimary}><Truck size={16} /> {p.status === "Partially Received" ? "Baaki maal receive karein" : "Maal receive karein (Stock add)"}</button>}
          {p.status === "Draft" && <button disabled={busy} onClick={() => run(() => markPurchaseOrdered(store.id, p.id))} style={btnSecondary}>Mark as Ordered</button>}
          {canEdit && <button onClick={onEdit} style={btnSecondary}><Edit2 size={14} /> Edit</button>}
          {canReceive && (
            <button disabled={busy} style={btnDanger} onClick={() => {
              const msg = p.status === "Partially Received" ? "Baaki maal cancel karein? Jo maal receive ho chuka hai (stock aur payable) woh waise hi rahega." : "Yeh purchase cancel karein?";
              if (confirm(msg)) run(() => cancelPurchase(store.id, p.id));
            }}>Cancel Purchase</button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUPPLIER DETAIL (payable, history, ledger, payment)
// ============================================================
function SupplierDetail({ store, supplier, purchases, onBack, onOpenPurchase, onNewPurchase, onChanged }) {
  const [view, setView] = useState("purchases");
  const [ledger, setLedger] = useState([]);
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bal = Number(supplier.payable_balance);

  const loadLedger = useCallback(async () => {
    try { setLedger(await fetchSupplierTransactions(supplier.id)); } catch (e) { console.error(e); }
  }, [supplier.id]);
  useEffect(() => { loadLedger(); }, [loadLedger, supplier.payable_balance]);

  const pay = async () => {
    if (!(num(amount) > 0)) { setErr("Amount daalein"); return; }
    setBusy(true); setErr("");
    try {
      await recordSupplierPayment(store.id, supplier.id, amount, method, note);
      setPaying(false); setAmount(""); setNote("");
      await onChanged(); await loadLedger();
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };

  if (editing) {
    return (
      <div>
        <BackBar title="Edit Supplier" onBack={() => setEditing(false)} />
        <div style={cardStyle}>
          <SupplierForm initial={{ id: supplier.id, name: supplier.name, phone: supplier.phone, address: supplier.address, gstin: supplier.gstin, notes: supplier.notes, is_active: supplier.is_active }}
            onCancel={() => setEditing(false)}
            onSave={async (f) => { await saveSupplier(store.id, { ...f, isActive: f.is_active }); setEditing(false); await onChanged(); }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackBar title={supplier.name} onBack={onBack} right={<button onClick={() => setEditing(true)} style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 9, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit2 size={15} /></button>} />
      <ErrorBanner msg={err} />

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{bal < 0 ? "Advance diya hua" : "Supplier ko dena baaki"}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: bal > 0 ? C.red : C.green }}>{money(Math.abs(bal))}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{supplier.purchase_count} purchases · Total {money(supplier.total_purchased)}</div>
        {supplier.phone && <a href={`tel:${supplier.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: C.green, fontWeight: 700, textDecoration: "none" }}><Phone size={14} /> {supplier.phone}</a>}
      </div>

      {paying ? (
        <div style={{ ...cardStyle, borderColor: C.green, marginBottom: 12 }}>
          <label style={labelStyle}>Payment amount (supplier ko diya)</label>
          <input style={inputStyle} inputMode="decimal" autoFocus placeholder="₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          {bal > 0 && <button onClick={() => setAmount(String(bal))} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, marginTop: 8 }}>Poora {money(bal)}</button>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <select style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            <input style={inputStyle} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setPaying(false); setErr(""); }} disabled={busy} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
            <button onClick={pay} disabled={busy} style={{ ...btnPrimary, flex: 1.5, opacity: busy ? 0.6 : 1 }}>{busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={15} />} Payment Save</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <button onClick={() => { setPaying(true); setErr(""); }} style={btnPrimary}>Payment Do</button>
          <button onClick={onNewPurchase} style={btnSecondary}><Plus size={15} /> New Purchase</button>
        </div>
      )}

      <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 3, marginBottom: 12, border: `1px solid ${C.border}` }}>
        {[["purchases", "Purchase History"], ["ledger", "Ledger"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{ flex: 1, border: "none", borderRadius: 8, padding: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", background: view === id ? "white" : "transparent", color: view === id ? C.green : C.muted }}>{label}</button>
        ))}
      </div>

      {view === "purchases" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {purchases.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 24, fontSize: 13 }}>Is supplier se abhi koi purchase nahi.</div>}
          {purchases.map((p) => (
            <button key={p.id} onClick={() => onOpenPurchase(p.id)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 14 }}>{p.purchase_number} · {fmtDate(p.purchase_date)}</b><StatusBadge status={p.status} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginTop: 4 }}>
                <span>{(p.purchase_items || []).length} items</span><b style={{ color: C.text }}>{money(p.total_amount)}</b>
              </div>
            </button>
          ))}
        </div>
      )}

      {view === "ledger" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ledger.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 24, fontSize: 13 }}>Abhi koi entry nahi.</div>}
          {ledger.map((t) => (
            <div key={t.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t.type === "payment" ? `Payment${t.payment_method ? ` (${t.payment_method})` : ""}` : t.type === "opening" ? "Opening balance" : "Purchase"}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{fmtDate(t.created_at)}{t.note ? ` · ${t.note}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: t.type === "payment" ? C.green : C.red }}>{t.type === "payment" ? "−" : "+"}{money(t.amount)}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Baaki {money(t.running_balance)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
