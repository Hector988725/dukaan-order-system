import React, { useState } from "react";
import { Settings, Package, Plus, Trash2, Edit2, X, Check, ChevronDown, ChevronUp, Save } from "lucide-react";
import {
  updateStoreSettings,
  createProduct, updateProduct, deleteProduct,
  createVariant, updateVariant, deleteVariant,
} from "../lib/api";

const EMOJI_CHOICES = ["📦", "🧂", "🍚", "🛢️", "🫘", "🌾", "🌶️", "✨", "🍵", "🔧", "🔩", "💊", "📱", "🔌", "🧴", "🪛", "🔋", "🧰"];

export default function AdminPanel({ store, products, onRefresh }) {
  return <AdminContent store={store} products={products} onRefresh={onRefresh} />;
}

function AdminContent({ store, products, onRefresh }) {
  const [tab, setTab] = useState("products");

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "16px 18px 40px" }}>
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #E3DECF", marginBottom: "16px" }}>
        {[{ id: "products", label: "Products", icon: <Package size={14} /> }, { id: "settings", label: "Store Settings", icon: <Settings size={14} /> }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", fontSize: "12.5px", fontWeight: 700,
            border: "none", background: "transparent", cursor: "pointer",
            color: tab === t.id ? "#1B4332" : "#8B8576",
            borderBottom: tab === t.id ? "2.5px solid #1B4332" : "2.5px solid transparent",
            marginBottom: "-1px",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <ProductManager store={store} products={products} onRefresh={onRefresh} />
      ) : (
        <StoreSettingsForm store={store} onRefresh={onRefresh} />
      )}
    </div>
  );
}

// ============================================================
// STORE SETTINGS
// ============================================================
function StoreSettingsForm({ store, onRefresh }) {
  const [name, setName] = useState(store.name);
  const [whatsapp, setWhatsapp] = useState(store.whatsapp_number);
  const [upi, setUpi] = useState(store.upi_id || "");
  const [address, setAddress] = useState(store.address || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateStoreSettings(store.id, { name, whatsapp_number: whatsapp, upi_id: upi, address });
      setSaved(true);
      onRefresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Save nahi ho paaya: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <Field label="Dukaan ka Naam" value={name} onChange={setName} />
      <Field label="WhatsApp Number (91 ke saath, jaise 919876543210)" value={whatsapp} onChange={setWhatsapp} />
      <Field label="UPI ID (jaise dukaan@upi)" value={upi} onChange={setUpi} placeholder="abhi optional hai" />
      <Field label="Address" value={address} onChange={setAddress} textarea />

      <button onClick={handleSave} disabled={saving} className="ddemo-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: saved ? "#1B4332" : "#D4A24C", color: saved ? "white" : "#123026", fontWeight: 800, fontSize: "13.5px", border: "none", borderRadius: "10px", padding: "12px 0", cursor: "pointer", marginTop: "6px" }}>
        {saved ? <><Check size={15} /> Save Ho Gaya</> : <><Save size={15} /> {saving ? "Save ho raha hai..." : "Changes Save Karein"}</>}
      </button>
    </div>
  );
}

// ============================================================
// PRODUCT MANAGER
// ============================================================
function ProductManager({ store, products, onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", color: "#8B8576" }}>{products.length} products</div>
        <button onClick={() => setAdding(true)} className="ddemo-btn" style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Naya Product
        </button>
      </div>

      {adding && (
        <NewProductForm
          onCancel={() => setAdding(false)}
          onSave={async (form) => {
            await createProduct(store.id, { ...form, sort_order: products.length + 1 });
            setAdding(false);
            onRefresh();
          }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {products.map((p) => (
          <ProductRow
            key={p.id}
            product={p}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

function NewProductForm({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && category.trim();

  return (
    <div style={{ background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>Naya Product</div>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
        <Field label="Product ka Naam" value={name} onChange={setName} placeholder="jaise Chini (Sugar)" />
        <Field label="Category" value={category} onChange={setCategory} placeholder="jaise Staples" />
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={async () => { setSaving(true); await onSave({ name, category, emoji }); setSaving(false); }}
          className="ddemo-btn"
          style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}
        >
          {saving ? "Add ho raha hai..." : "Add Karein"}
        </button>
      </div>
    </div>
  );
}

function EmojiPicker({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "6px" }}>Icon Chunein</div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {EMOJI_CHOICES.map((e) => (
          <button key={e} onClick={() => onChange(e)} style={{
            width: 34, height: 34, fontSize: "16px", borderRadius: "8px", cursor: "pointer",
            border: value === e ? "2px solid #1B4332" : "1px solid #E3DECF",
            background: value === e ? "#E7F0EA" : "white",
          }}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function ProductRow({ product, expanded, onToggle, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);

  const handleDeleteProduct = async () => {
    if (!confirm(`"${product.name}" ko delete karein? Iske saare variants bhi delete ho jaayenge.`)) return;
    try {
      await deleteProduct(product.id);
      onRefresh();
    } catch (e) {
      alert("Delete nahi ho paaya: " + e.message);
    }
  };

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 13px", cursor: "pointer" }} onClick={onToggle}>
        <span style={{ fontSize: "20px" }}>{product.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "13px" }}>{product.name}</div>
          <div style={{ fontSize: "10.5px", color: "#8B8576" }}>{product.category} · {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} style={iconBtnStyle}><Edit2 size={14} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(); }} style={{ ...iconBtnStyle, color: "#B3261E" }}><Trash2 size={14} /></button>
        {expanded ? <ChevronUp size={16} color="#8B8576" /> : <ChevronDown size={16} color="#8B8576" />}
      </div>

      {editing && (
        <EditProductForm
          product={product}
          onCancel={() => setEditing(false)}
          onSave={async (form) => { await updateProduct(product.id, form); setEditing(false); onRefresh(); }}
        />
      )}

      {expanded && (
        <div style={{ borderTop: "1px solid #E3DECF", padding: "12px 13px", background: "#FBFAF6" }}>
          {product.variants.map((v) => (
            <VariantRow key={v.id} variant={v} onRefresh={onRefresh} />
          ))}

          {addingVariant ? (
            <NewVariantForm
              onCancel={() => setAddingVariant(false)}
              onSave={async (form) => { await createVariant(product.id, form); setAddingVariant(false); onRefresh(); }}
            />
          ) : (
            <button onClick={() => setAddingVariant(true)} className="ddemo-btn" style={{ display: "flex", alignItems: "center", gap: "6px", background: "white", border: "1px dashed #1B4332", color: "#1B4332", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", marginTop: "6px" }}>
              <Plus size={13} /> Naya Variant/Brand Add Karein
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EditProductForm({ product, onCancel, onSave }) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [emoji, setEmoji] = useState(product.emoji);
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ borderTop: "1px solid #E3DECF", padding: "12px 13px", background: "#F7F5F0" }}>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
        <Field label="Product ka Naam" value={name} onChange={setName} />
        <Field label="Category" value={category} onChange={setCategory} />
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button disabled={saving} onClick={async () => { setSaving(true); await onSave({ name, category, emoji }); setSaving(false); }} className="ddemo-btn" style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Save ho raha hai..." : "Save Karein"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// VARIANT MANAGEMENT
// ============================================================
function VariantRow({ variant, onRefresh }) {
  const [editing, setEditing] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`"${variant.label}" variant delete karein?`)) return;
    try {
      await deleteVariant(variant.id);
      onRefresh();
    } catch (e) {
      alert("Delete nahi ho paaya: " + e.message);
    }
  };

  if (editing) {
    return (
      <EditVariantForm
        variant={variant}
        onCancel={() => setEditing(false)}
        onSave={async (form) => { await updateVariant(variant.id, form); setEditing(false); onRefresh(); }}
      />
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid #E3DECF" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{variant.label}</div>
        <div style={{ fontSize: "10.5px", color: "#8B8576" }}>₹{variant.price} / {variant.unit} · Stock: {variant.stock}</div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtnStyle}><Edit2 size={13} /></button>
      <button onClick={handleDelete} style={{ ...iconBtnStyle, color: "#B3261E" }}><Trash2 size={13} /></button>
    </div>
  );
}

function EditVariantForm({ variant, onCancel, onSave }) {
  const [label, setLabel] = useState(variant.label);
  const [unit, setUnit] = useState(variant.unit);
  const [price, setPrice] = useState(String(variant.price));
  const [stock, setStock] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "10px", margin: "6px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Field label="Naam/Brand" value={label} onChange={setLabel} />
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ flex: 1 }}><Field label="Unit" value={unit} onChange={setUnit} placeholder="kg, litre, piece" /></div>
          <div style={{ flex: 1 }}><Field label="Price (₹)" value={price} onChange={(v) => setPrice(v.replace(/[^\d.]/g, ""))} /></div>
          <div style={{ flex: 1 }}><Field label="Stock" value={stock} onChange={(v) => setStock(v.replace(/\D/g, ""))} /></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button
          disabled={saving}
          onClick={async () => { setSaving(true); await onSave({ label, unit, price: Number(price), stock: Number(stock) }); setSaving(false); }}
          className="ddemo-btn"
          style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function NewVariantForm({ onCancel, onSave }) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [saving, setSaving] = useState(false);
  const valid = label.trim() && unit.trim() && price;

  return (
    <div style={{ background: "white", border: "1px solid #1B4332", borderRadius: "8px", padding: "10px", marginTop: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Field label="Naam/Brand" value={label} onChange={setLabel} placeholder="jaise Normal, Premium" />
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ flex: 1 }}><Field label="Unit" value={unit} onChange={setUnit} placeholder="kg, litre, piece" /></div>
          <div style={{ flex: 1 }}><Field label="Price (₹)" value={price} onChange={(v) => setPrice(v.replace(/[^\d.]/g, ""))} /></div>
          <div style={{ flex: 1 }}><Field label="Stock" value={stock} onChange={(v) => setStock(v.replace(/\D/g, ""))} /></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={async () => { setSaving(true); await onSave({ label, unit, price: Number(price), stock: Number(stock) }); setSaving(false); }}
          className="ddemo-btn"
          style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}
        >
          {saving ? "..." : "Add Karein"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SHARED
// ============================================================
function Field({ label, value, onChange, placeholder, textarea }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={inputStyle} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "7px", padding: "8px 10px", fontSize: "12.5px", fontFamily: "inherit", outline: "none" };
const iconBtnStyle = { width: 28, height: 28, borderRadius: "6px", border: "1px solid #E3DECF", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#5C5747" };
