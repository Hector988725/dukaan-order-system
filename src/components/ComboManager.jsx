import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, X, ChevronDown, ChevronUp, Upload, Eye, EyeOff } from "lucide-react";
import { fetchAllCombosForAdmin, createCombo, updateCombo, toggleComboActive, deleteCombo, uploadProductImage } from "../lib/api";

// ============================================================
// COMBO OFFER — Admin CRUD
// ============================================================
// Combo alag-alag products ke variants ko ek fixed "bundle price" par
// jodta hai (jaise "Chai Combo: Doodh 1L + Chini 1kg @ ₹99"). Yahan sirf
// dukaandar-side management hai — customer-facing display/cart alag
// (CustomerView.jsx) mein hota hai.
// ============================================================

export default function ComboManager({ store, products }) {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setCombos(await fetchAllCombosForAdmin(store.id));
    } catch (e) {
      console.error("Combos load nahi ho paaye:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  // Sab products ke variants ki ek flat list — item-picker ke liye
  // (combo kisi bhi product ke kisi bhi variant se bana sakta hai).
  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name, productEmoji: p.emoji }))
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: "#8B8576" }}>{combos.length} combo{combos.length !== 1 ? "s" : ""} · alag products ko ek bundle price par bechein</div>
        <button onClick={() => setAdding(true)} className="ddemo-btn" style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Naya Combo
        </button>
      </div>

      {allVariants.length < 2 && (
        <div style={{ background: "#FDECEA", border: "1px solid #B3261E", borderRadius: "10px", padding: "12px 14px", fontSize: "12px", color: "#5C5747", marginBottom: "12px" }}>
          Combo banane ke liye kam se kam 2 variants chahiye. Pehle "Products" tab mein products/variants add karein.
        </div>
      )}

      {adding && (
        <ComboForm
          storeId={store.id}
          allVariants={allVariants}
          onCancel={() => setAdding(false)}
          onSave={async (form, items) => {
            await createCombo(store.id, form, items);
            setAdding(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#8B8576", fontSize: "13px" }}>Load ho raha hai...</div>
      ) : combos.length === 0 && !adding ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#8B8576", fontSize: "13px" }}>Koi combo nahi bana abhi tak.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {combos.map((c) => (
            <ComboRow
              key={c.id}
              combo={c}
              allVariants={allVariants}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onRefresh={load}
              storeId={store.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComboRow({ combo, allVariants, expanded, onToggle, onRefresh, storeId }) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`"${combo.name}" combo delete karein?`)) return;
    try {
      await deleteCombo(combo.id);
      onRefresh();
    } catch (err) {
      alert("Delete nahi ho paaya: " + err.message);
    }
  };

  const handleToggleActive = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await toggleComboActive(combo.id, !combo.active);
      onRefresh();
    } catch (err) {
      alert("Toggle nahi ho paaya: " + err.message);
    } finally {
      setToggling(false);
    }
  };

  const itemsSummary = (combo.combo_items || [])
    .map((ci) => `${ci.qty}× ${ci.variants?.products?.name || "?"} (${ci.variants?.label || ""})`)
    .join(", ");

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", opacity: combo.active ? 1 : 0.6, borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 13px", cursor: "pointer" }} onClick={onToggle}>
        {combo.image_url
          ? <img src={combo.image_url} alt={combo.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "7px", flexShrink: 0 }} />
          : <span style={{ fontSize: "22px", flexShrink: 0 }}>🎁</span>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "13px" }}>
            {combo.name} {!combo.active && <span style={{ fontSize: "10px", color: "#B3261E", fontWeight: 700 }}>(Inactive)</span>}
          </div>
          <div style={{ fontSize: "10.5px", color: "#8B8576", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ₹{combo.combo_price} · {itemsSummary}
          </div>
        </div>
        <button onClick={handleToggleActive} disabled={toggling} title={combo.active ? "Combo band karein" : "Combo chalu karein"} style={{ ...iconBtnStyle, color: combo.active ? "#1B4332" : "#B7AF9B" }}>
          {combo.active ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); setEditing(!editing); }} style={iconBtnStyle}><Edit2 size={14} /></button>
        <button onClick={handleDelete} style={{ ...iconBtnStyle, color: "#B3261E" }}><Trash2 size={14} /></button>
        {expanded ? <ChevronUp size={16} color="#8B8576" /> : <ChevronDown size={16} color="#8B8576" />}
      </div>

      {editing && (
        <ComboForm
          storeId={storeId}
          allVariants={allVariants}
          combo={combo}
          onCancel={() => setEditing(false)}
          onSave={async (form, items) => {
            await updateCombo(combo.id, form, items);
            setEditing(false);
            onRefresh();
          }}
        />
      )}

      {expanded && !editing && (
        <div style={{ borderTop: "1px solid #E3DECF", padding: "12px 13px", background: "#FBFAF6" }}>
          {(combo.combo_items || []).map((ci) => (
            <div key={ci.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "5px 0" }}>
              <span>{ci.qty}× {ci.variants?.products?.name} — {ci.variants?.label}</span>
              <span style={{ color: "#8B8576" }}>₹{ci.variants?.price}/piece</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NEW / EDIT COMBO FORM
// ============================================================
function ComboForm({ storeId, allVariants, combo, onCancel, onSave }) {
  const [name, setName] = useState(combo?.name || "");
  const [comboPrice, setComboPrice] = useState(combo?.combo_price != null ? String(combo.combo_price) : "");
  const [imageUrl, setImageUrl] = useState(combo?.image_url || null);
  const [items, setItems] = useState(
    () => (combo?.combo_items || []).map((ci) => ({ variant_id: ci.variant_id || ci.variants?.id, qty: ci.qty }))
  );
  const [pickerVariantId, setPickerVariantId] = useState("");
  const [pickerQty, setPickerQty] = useState("1");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const normalPrice = items.reduce((sum, it) => {
    const v = allVariants.find((av) => av.id === it.variant_id);
    return sum + (v ? Number(v.price) * it.qty : 0);
  }, 0);
  const savings = comboPrice ? Math.round(normalPrice - Number(comboPrice)) : 0;
  const valid = name.trim() && Number(comboPrice) > 0 && items.length >= 2;

  const handleAddItem = () => {
    if (!pickerVariantId || Number(pickerQty) <= 0) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.variant_id === pickerVariantId);
      if (existing) {
        return prev.map((it) => (it.variant_id === pickerVariantId ? { ...it, qty: it.qty + Number(pickerQty) } : it));
      }
      return [...prev, { variant_id: pickerVariantId, qty: Number(pickerQty) }];
    });
    setPickerVariantId("");
    setPickerQty("1");
  };

  const handleRemoveItem = (variantId) => {
    setItems((prev) => prev.filter((it) => it.variant_id !== variantId));
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo 2MB se chhoti honi chahiye."); return; }
    setUploading(true);
    try {
      setImageUrl(await uploadProductImage(file, storeId));
    } catch (err) {
      alert(err.message || "Upload nahi ho paaya.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, combo_price: Number(comboPrice), image_url: imageUrl }, items);
    } catch (e) {
      alert("Save nahi ho paaya: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginTop: "10px", marginBottom: "12px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>{combo ? "Combo Edit Karein" : "Naya Combo"}</div>

      {/* Photo (optional) */}
      <div style={{ background: "white", borderRadius: "10px", padding: "12px", marginBottom: "10px" }}>
        <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "8px" }}>Combo ki Photo (optional)</div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadImage} style={{ display: "none" }} />
        {imageUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "#F7F5F0", borderRadius: "9px", border: "1px solid #E3DECF" }}>
            <img src={imageUrl} alt="combo" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "7px" }} />
            <div style={{ flex: 1, fontSize: "11.5px", color: "#5C5747" }}>Photo upload ho gayi ✅</div>
            <button onClick={() => setImageUrl(null)} style={{ border: "none", background: "transparent", color: "#B3261E", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>Hatao</button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width: "100%", padding: "16px 0", border: "2px dashed #D4A24C", borderRadius: "9px", background: "#F7F5F0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
          >
            <Upload size={18} color="#D4A24C" />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#5C5747" }}>{uploading ? "Upload ho raha hai..." : "Photo chunein (optional, Max 2MB)"}</span>
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Field label="Combo ka Naam" value={name} onChange={setName} placeholder="jaise Chai Combo" />
        <Field label="Combo ki Price (₹)" value={comboPrice} onChange={setComboPrice} placeholder="jaise 99" />
      </div>

      {/* Item picker */}
      <div style={{ marginTop: "12px", background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "12px" }}>
        <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "8px" }}>Combo mein kya-kya shamil hai (kam se kam 2)</div>

        {items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
            {items.map((it) => {
              const v = allVariants.find((av) => av.id === it.variant_id);
              return (
                <div key={it.variant_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F5F0", borderRadius: "7px", padding: "7px 10px" }}>
                  <span style={{ fontSize: "12px" }}>{it.qty}× {v ? `${v.productName} — ${v.label}` : "Deleted variant"}</span>
                  <button onClick={() => handleRemoveItem(it.variant_id)} style={{ border: "none", background: "transparent", color: "#B3261E", cursor: "pointer", display: "flex" }}><X size={14} /></button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px" }}>
          <select value={pickerVariantId} onChange={(e) => setPickerVariantId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">Variant chunein...</option>
            {allVariants.map((v) => (
              <option key={v.id} value={v.id}>{v.productName} — {v.label} (₹{v.price})</option>
            ))}
          </select>
          <input type="number" min="1" value={pickerQty} onChange={(e) => setPickerQty(e.target.value)} style={{ ...inputStyle, width: "56px" }} />
          <button onClick={handleAddItem} style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "7px", padding: "0 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Add</button>
        </div>
      </div>

      {items.length >= 2 && comboPrice && (
        <div style={{ marginTop: "10px", fontSize: "11.5px", color: savings > 0 ? "#1B4332" : "#8B8576", fontWeight: 600 }}>
          Normal price: ₹{normalPrice} {savings > 0 ? `→ Combo mein customer ₹${savings} bachayega` : "(combo price normal price se zyada/barabar hai)"}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={handleSave}
          className="ddemo-btn"
          style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}
        >
          {saving ? "Save ho raha hai..." : combo ? "Update Karein" : "Combo Banayein"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "7px", padding: "8px 10px", fontSize: "12.5px", fontFamily: "inherit", outline: "none" };
const iconBtnStyle = { width: 28, height: 28, borderRadius: "6px", border: "1px solid #E3DECF", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#5C5747" };
