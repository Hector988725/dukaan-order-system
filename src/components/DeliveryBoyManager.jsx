import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bike, Plus, Phone, Edit2, Trash2, X, Camera } from "lucide-react";
import { fetchDeliveryBoys, createDeliveryBoy, updateDeliveryBoy, toggleDeliveryBoyActive, deleteDeliveryBoy, uploadProductImage } from "../lib/api";

// ============================================================
// DELIVERY BOY MANAGEMENT — Dukaandar apna delivery staff khud
// add/manage karta hai. Hum delivery boy provide nahi karte, sirf
// management tool dete hain (jaisa requirement mein clear kiya gaya).
// ============================================================
export default function DeliveryBoyManager({ store }) {
  const [boys, setBoys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDeliveryBoys(store.id);
      setBoys(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (boy) => {
    try {
      await toggleDeliveryBoyActive(boy.id, !boy.is_active);
      load();
    } catch (e) {
      alert("Update nahi ho paaya: " + e.message);
    }
  };

  const handleDelete = async (boy) => {
    if (!confirm(`"${boy.name}" ko delivery staff se hatayein?`)) return;
    try {
      await deleteDeliveryBoy(boy.id);
      load();
    } catch (e) {
      alert("Delete nahi ho paaya: " + e.message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", color: "#8B8576" }}>{boys.length} delivery staff</div>
        <button onClick={() => setAdding(true)} className="ddemo-btn" style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Naya Delivery Boy
        </button>
      </div>

      {adding && (
        <DeliveryBoyForm
          storeId={store.id}
          onCancel={() => setAdding(false)}
          onSave={async (form) => { await createDeliveryBoy(store.id, form); setAdding(false); load(); }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#8B8576" }}>Load ho raha hai...</div>
      ) : boys.length === 0 && !adding ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8B8576" }}>
          <div style={{ fontSize: "30px", marginBottom: "8px" }}>🏍️</div>
          <div style={{ fontSize: "13px" }}>Abhi koi delivery boy add nahi kiya. "Naya Delivery Boy" se shuru karein.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {boys.map((boy) => (
            editing === boy.id ? (
              <DeliveryBoyForm
                key={boy.id}
                storeId={store.id}
                initial={boy}
                onCancel={() => setEditing(null)}
                onSave={async (form) => { await updateDeliveryBoy(boy.id, form); setEditing(null); load(); }}
              />
            ) : (
              <div key={boy.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "10px 13px", opacity: boy.is_active ? 1 : 0.55 }}>
                {boy.photo_url
                  ? <img src={boy.photo_url} alt={boy.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F3ECDC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Bike size={18} color="#1B4332" /></div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>{boy.name}</div>
                  <div style={{ fontSize: "11px", color: "#8B8576", display: "flex", alignItems: "center", gap: "4px" }}><Phone size={11} /> {boy.phone}</div>
                </div>
                <button onClick={() => handleToggleActive(boy)} style={{
                  fontSize: "10.5px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", border: "none", cursor: "pointer",
                  background: boy.is_active ? "#E7F0EA" : "#F0EEE6", color: boy.is_active ? "#1B4332" : "#8B8576",
                }}>
                  {boy.is_active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => setEditing(boy.id)} style={iconBtnStyle}><Edit2 size={13} /></button>
                <button onClick={() => handleDelete(boy)} style={{ ...iconBtnStyle, color: "#B3261E" }}><Trash2 size={13} /></button>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryBoyForm({ storeId, initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const valid = name.trim() && phone.trim().length >= 10;

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo 2MB se chhoti honi chahiye."); return; }
    setUploading(true);
    try {
      const url = await uploadProductImage(file, storeId);
      setPhotoUrl(url);
    } catch (err) {
      alert(err.message || "Upload nahi ho paaya.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name: name.trim(), phone: phone.trim(), photo_url: photoUrl || null });
    setSaving(false);
  };

  return (
    <div style={{ background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 52, height: 52, borderRadius: "50%", border: "2px dashed #D4A24C", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, padding: 0 }}>
          {photoUrl ? <img src={photoUrl} alt="photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={18} color="#D4A24C" />}
        </button>
        <div style={{ fontSize: "11px", color: "#8B8576" }}>{uploading ? "Upload ho raha hai..." : "Photo (optional)"}</div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} style={{ display: "none" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Field label="Naam" value={name} onChange={setName} placeholder="jaise Rakesh Kumar" />
        <Field label="Mobile Number" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit number" />
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
        <button disabled={!valid || saving} onClick={handleSave} className="ddemo-btn" style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "8px", padding: "9px 0", fontSize: "12.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}>
          {saving ? "Save ho raha hai..." : "Save Karein"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "7px", padding: "8px 10px", fontSize: "12.5px", fontFamily: "inherit", outline: "none" }} />
    </div>
  );
}

const iconBtnStyle = { width: 28, height: 28, borderRadius: "6px", border: "1px solid #E3DECF", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#5C5747", flexShrink: 0 };
