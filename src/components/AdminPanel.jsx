import React, { useState, useRef } from "react";
import { Settings, Package, Plus, Trash2, Edit2, X, Check, ChevronDown, ChevronUp, Save, Upload, Image, CreditCard, AlertCircle } from "lucide-react";
import {
  updateStoreSettings,
  createProduct, updateProduct, deleteProduct,
  createVariant, updateVariant, deleteVariant,
  uploadProductImage, renewSubscription, deactivateStore,
} from "../lib/api";
import { PRODUCT_ICONS, ICON_CATEGORIES, getIconsByCategory } from "../lib/icons";

export default function AdminPanel({ store, products, onRefresh }) {
  return <AdminContent store={store} products={products} onRefresh={onRefresh} />;
}

function AdminContent({ store, products, onRefresh }) {
  const [tab, setTab] = useState("products");

  const tabs = [
    { id: "products", label: "Products", icon: <Package size={14} /> },
    { id: "settings", label: "Store Settings", icon: <Settings size={14} /> },
    { id: "subscription", label: "Subscription", icon: <CreditCard size={14} /> },
  ];

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 18px 40px" }}>
      <div style={{ display: "flex", gap: "2px", borderBottom: "1px solid #E3DECF", marginBottom: "16px", overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 12px", fontSize: "12px", fontWeight: 700,
            border: "none", background: "transparent", cursor: "pointer", whiteSpace: "nowrap",
            color: tab === t.id ? "#1B4332" : "#8B8576",
            borderBottom: tab === t.id ? "2.5px solid #1B4332" : "2.5px solid transparent",
            marginBottom: "-1px",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductManager store={store} products={products} onRefresh={onRefresh} />}
      {tab === "settings" && <StoreSettingsForm store={store} onRefresh={onRefresh} />}
      {tab === "subscription" && <SubscriptionPanel store={store} onRefresh={onRefresh} />}
    </div>
  );
}

// ============================================================
// SUBSCRIPTION PANEL
// ============================================================
function SubscriptionPanel({ store, onRefresh }) {
  const [renewing, setRenewing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [msg, setMsg] = useState(null);

  const isActive = store.is_active !== false;
  const expiry = store.subscription_expires_at ? new Date(store.subscription_expires_at) : null;
  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = daysLeft !== null && daysLeft < 0;

  const handleRenew = async (months) => {
    setRenewing(true);
    setMsg(null);
    try {
      const newExpiry = await renewSubscription(store.id, months);
      setMsg({ type: "success", text: `Subscription renew ho gaya! Ab ${newExpiry.toLocaleDateString("en-IN")} tak active rahega.` });
      onRefresh();
    } catch (e) {
      setMsg({ type: "error", text: "Renew nahi ho paaya: " + e.message });
    } finally {
      setRenewing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Kya aap is dukaan ko pause karna chahte hain? Customer ko 'Store unavailable' dikhega.")) return;
    setDeactivating(true);
    try {
      await deactivateStore(store.id);
      setMsg({ type: "success", text: "Dukaan pause kar di gayi." });
      onRefresh();
    } catch (e) {
      setMsg({ type: "error", text: "Error: " + e.message });
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Status Card */}
      <div style={{ background: isActive && !isExpired ? "#E7F0EA" : "#FDECEA", border: `1px solid ${isActive && !isExpired ? "#1B4332" : "#B3261E"}`, borderRadius: "12px", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: isActive && !isExpired ? "#1B4332" : "#B3261E" }} />
          <div style={{ fontWeight: 700, fontSize: "14px", color: isActive && !isExpired ? "#1B4332" : "#B3261E" }}>
            {isActive && !isExpired ? "Dukaan Active Hai ✅" : isExpired ? "Subscription Expire Ho Gayi ⚠️" : "Dukaan Paused Hai ⏸️"}
          </div>
        </div>
        {expiry && (
          <div style={{ fontSize: "12px", color: "#5C5747" }}>
            {isExpired
              ? `${Math.abs(daysLeft)} din pehle expire hua`
              : `${daysLeft} din baaki hain (${expiry.toLocaleDateString("en-IN")} tak)`}
          </div>
        )}
      </div>

      {/* Pricing Info */}
      <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>Subscription Renew Karein</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { months: 1, label: "1 Mahina", price: "₹199" },
            { months: 3, label: "3 Mahine", price: "₹550", note: "₹16 bachao" },
            { months: 6, label: "6 Mahine", price: "₹1,000", note: "₹194 bachao" },
            { months: 12, label: "12 Mahine (1 Saal)", price: "₹1,800", note: "₹588 bachao" },
          ].map((plan) => (
            <div key={plan.months} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#F7F5F0", borderRadius: "9px" }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>{plan.label}</span>
                {plan.note && <span style={{ fontSize: "10.5px", color: "#1B4332", fontWeight: 600, marginLeft: "8px" }}>({plan.note})</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px", color: "#1B4332" }}>{plan.price}</span>
                <button
                  onClick={() => handleRenew(plan.months)}
                  disabled={renewing}
                  className="ddemo-btn"
                  style={{ background: "#1B4332", color: "white", border: "none", borderRadius: "7px", padding: "6px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
                >
                  {renewing ? "..." : "Select"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "10px", fontStyle: "italic" }}>
          Note: Yeh buttons abhi manual tracking ke liye hain. Payment UPI se alag se leni hogi.
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: "9px", background: msg.type === "success" ? "#E7F0EA" : "#FDECEA", color: msg.type === "success" ? "#1B4332" : "#B3261E", fontSize: "12.5px", fontWeight: 600 }}>
          {msg.text}
        </div>
      )}

      {/* Deactivate */}
      {isActive && (
        <button
          onClick={handleDeactivate}
          disabled={deactivating}
          style={{ background: "white", border: "1px solid #B3261E", color: "#B3261E", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}
        >
          {deactivating ? "Ho raha hai..." : "⏸️ Dukaan Pause Karein"}
        </button>
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
          storeId={store.id}
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
            storeId={store.id}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// IMAGE PICKER — Icon Library + Photo Upload
// ============================================================
function ImagePicker({ currentImage, currentEmoji, storeId, onChange, onEmojiChange }) {
  const [mode, setMode] = useState("icons"); // 'icons' | 'upload'
  const [activeCategory, setActiveCategory] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const icons = getIconsByCategory(activeCategory);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo 2MB se chhoti honi chahiye."); return; }
    setUploading(true);
    try {
      const url = await uploadProductImage(file, storeId);
      onChange(url);
    } catch (err) {
      alert("Upload nahi ho paaya: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ background: "#F7F5F0", borderRadius: "10px", padding: "12px" }}>
      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "8px" }}>Product ki Image Chunein</div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        <button onClick={() => setMode("icons")} style={{ flex: 1, padding: "7px 0", borderRadius: "7px", fontSize: "12px", fontWeight: 700, cursor: "pointer", border: "none", background: mode === "icons" ? "#1B4332" : "white", color: mode === "icons" ? "white" : "#5C5747" }}>
          🎨 Ready Icons
        </button>
        <button onClick={() => setMode("upload")} style={{ flex: 1, padding: "7px 0", borderRadius: "7px", fontSize: "12px", fontWeight: 700, cursor: "pointer", border: "none", background: mode === "upload" ? "#1B4332" : "white", color: mode === "upload" ? "white" : "#5C5747" }}>
          📷 Khud Upload Karein
        </button>
      </div>

      {mode === "icons" ? (
        <div>
          {/* Category filter */}
          <div style={{ display: "flex", gap: "4px", overflowX: "auto", marginBottom: "8px", paddingBottom: "2px" }}>
            {ICON_CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                whiteSpace: "nowrap", padding: "5px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, cursor: "pointer", flexShrink: 0,
                border: "none", background: activeCategory === cat.id ? "#1B4332" : "white", color: activeCategory === cat.id ? "white" : "#5C5747"
              }}>{cat.label}</button>
            ))}
          </div>

          {/* Icon grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
            {icons.map((icon) => {
              const isSelected = !currentImage && currentEmoji === icon.svg;
              return (
                <button
                  key={icon.key}
                  onClick={() => { onEmojiChange(icon.svg); onChange(null); }}
                  title={icon.label}
                  style={{
                    padding: "6px 4px", borderRadius: "8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                    border: isSelected ? "2px solid #1B4332" : "1px solid #E3DECF",
                    background: isSelected ? "#E7F0EA" : "white",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{icon.svg}</span>
                  <span style={{ fontSize: "8px", color: "#8B8576", textAlign: "center", lineHeight: 1.2, overflow: "hidden", maxWidth: "48px", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{icon.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: "none" }} />
          {currentImage ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "white", borderRadius: "9px", border: "1px solid #E3DECF" }}>
              <img src={currentImage} alt="product" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "7px" }} />
              <div style={{ flex: 1, fontSize: "11.5px", color: "#5C5747" }}>Photo upload ho gayi ✅</div>
              <button onClick={() => { onChange(null); }} style={{ border: "none", background: "transparent", color: "#B3261E", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>Hatao</button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ width: "100%", padding: "20px 0", border: "2px dashed #D4A24C", borderRadius: "9px", background: "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
            >
              <Upload size={20} color="#D4A24C" />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#5C5747" }}>{uploading ? "Upload ho raha hai..." : "Photo chunein (Max 2MB)"}</span>
              <span style={{ fontSize: "10.5px", color: "#8B8576" }}>JPG, PNG, WebP</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NEW PRODUCT FORM
// ============================================================
function NewProductForm({ storeId, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [imageUrl, setImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && category.trim();

  return (
    <div style={{ background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>Naya Product</div>
      <ImagePicker currentImage={imageUrl} currentEmoji={emoji} storeId={storeId} onChange={setImageUrl} onEmojiChange={setEmoji} />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
        <Field label="Product ka Naam" value={name} onChange={setName} placeholder="jaise Chini (Sugar)" />
        <Field label="Category" value={category} onChange={setCategory} placeholder="jaise Staples, Hardware, Medical" />
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={async () => { setSaving(true); await onSave({ name, category, emoji, image_url: imageUrl }); setSaving(false); }}
          className="ddemo-btn"
          style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}
        >
          {saving ? "Add ho raha hai..." : "Add Karein"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT ROW
// ============================================================
function ProductRow({ product, storeId, expanded, onToggle, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);

  const handleDeleteProduct = async () => {
    if (!confirm(`"${product.name}" ko delete karein?`)) return;
    try { await deleteProduct(product.id); onRefresh(); }
    catch (e) { alert("Delete nahi ho paaya: " + e.message); }
  };

  // Display: photo > emoji
  const displayImage = product.image_url || null;
  const displayEmoji = product.emoji || "📦";

  return (
    <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 13px", cursor: "pointer" }} onClick={onToggle}>
        {displayImage
          ? <img src={displayImage} alt={product.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "7px", flexShrink: 0 }} />
          : <span style={{ fontSize: "22px", flexShrink: 0 }}>{displayEmoji}</span>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "13px" }}>{product.name}</div>
          <div style={{ fontSize: "10.5px", color: "#8B8576" }}>{product.category} · {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setEditing(!editing); }} style={iconBtnStyle}><Edit2 size={14} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(); }} style={{ ...iconBtnStyle, color: "#B3261E" }}><Trash2 size={14} /></button>
        {expanded ? <ChevronUp size={16} color="#8B8576" /> : <ChevronDown size={16} color="#8B8576" />}
      </div>

      {editing && (
        <EditProductForm
          product={product}
          storeId={storeId}
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

function EditProductForm({ product, storeId, onCancel, onSave }) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [emoji, setEmoji] = useState(product.emoji || "📦");
  const [imageUrl, setImageUrl] = useState(product.image_url || null);
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ borderTop: "1px solid #E3DECF", padding: "12px 13px", background: "#F7F5F0" }}>
      <ImagePicker currentImage={imageUrl} currentEmoji={emoji} storeId={storeId} onChange={setImageUrl} onEmojiChange={setEmoji} />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
        <Field label="Product ka Naam" value={name} onChange={setName} />
        <Field label="Category" value={category} onChange={setCategory} />
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button disabled={saving} onClick={async () => { setSaving(true); await onSave({ name, category, emoji, image_url: imageUrl }); setSaving(false); }} className="ddemo-btn" style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
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
    try { await deleteVariant(variant.id); onRefresh(); }
    catch (e) { alert("Delete nahi ho paaya: " + e.message); }
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
        <button disabled={saving} onClick={async () => { setSaving(true); await onSave({ label, unit, price: Number(price), stock: Number(stock) }); setSaving(false); }} className="ddemo-btn" style={{ flex: 1, background: "#1B4332", color: "white", border: "none", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>
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
        <Field label="Naam/Brand" value={label} onChange={setLabel} placeholder="jaise Normal, Premium, 1kg" />
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ flex: 1 }}><Field label="Unit" value={unit} onChange={setUnit} placeholder="kg, litre, piece" /></div>
          <div style={{ flex: 1 }}><Field label="Price (₹)" value={price} onChange={(v) => setPrice(v.replace(/[^\d.]/g, ""))} /></div>
          <div style={{ flex: 1 }}><Field label="Stock" value={stock} onChange={(v) => setStock(v.replace(/\D/g, ""))} /></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button disabled={!valid || saving} onClick={async () => { setSaving(true); await onSave({ label, unit, price: Number(price), stock: Number(stock) }); setSaving(false); }} className="ddemo-btn" style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "7px", padding: "7px 0", fontSize: "11.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}>
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
