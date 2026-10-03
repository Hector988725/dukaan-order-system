import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bike, Plus, Phone, Edit2, Trash2, X, Camera, KeyRound, Copy, History } from "lucide-react";
import {
  fetchDeliveryBoys, createDeliveryBoy, updateDeliveryBoy, toggleDeliveryBoyActive, deleteDeliveryBoy, uploadProductImage,
  generateDeliveryInvite, revokeDeliveryLogin, setDeliveryBoyLoginEnabled,
  fetchDeliveryDashboard, fetchStoreDeliveryAssignments, fetchStoreDeliveryMethods, setStoreDeliveryMethod,
} from "../lib/api";
import { DELIVERY_METHODS, DELIVERY_STATUS_META } from "../lib/deliveryMethods";

// ============================================================
// DELIVERY BOY MANAGEMENT — Dukaandar apna delivery staff khud
// add/manage karta hai. Hum delivery boy provide nahi karte, sirf
// management tool dete hain (jaisa requirement mein clear kiya gaya).
// ============================================================
function StaffList({ store }) {
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
                  <div style={{ fontSize: "11px", color: "#8B8576", display: "flex", alignItems: "center", gap: "4px" }}><Phone size={11} /> {boy.phone}{boy.vehicle_type ? ` · ${boy.vehicle_type}` : ""}{boy.vehicle_number ? ` ${boy.vehicle_number}` : ""}</div>
                  <LoginControls boy={boy} onChanged={load} />
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
  const [vehicleType, setVehicleType] = useState(initial?.vehicle_type || "Bike");
  const [vehicleNumber, setVehicleNumber] = useState(initial?.vehicle_number || "");
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
    await onSave({ name: name.trim(), phone: phone.trim(), photo_url: photoUrl || null, vehicle_type: vehicleType, vehicle_number: vehicleNumber.trim() || null });
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
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Vehicle</div>
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "7px", padding: "8px 10px", fontSize: "12.5px", fontFamily: "inherit", background: "white" }}>
            {["Bike", "Scooter", "Cycle", "Walking", "Other"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {vehicleType !== "Walking" && vehicleType !== "Cycle" && <Field label="Vehicle Number (optional)" value={vehicleNumber} onChange={(v) => setVehicleNumber(v.toUpperCase())} placeholder="jaise UP32 AB 1234" />}
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

// ------------------------------------------------------------
// Login controls: invite code generate, login on/off, revoke
// ------------------------------------------------------------
function LoginControls({ boy, onChanged }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await onChanged(); } catch (e) { alert(e.message); }
    setBusy(false);
  };
  const link = `${window.location.origin}/delivery`;
  const small = { fontSize: "10.5px", fontWeight: 700, border: "1px solid #E3DECF", background: "white", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", color: "#1B4332" };
  if (boy.user_id) {
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "5px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10.5px", color: boy.login_enabled ? "#1B4332" : "#B3261E", fontWeight: 700 }}>🔐 Login {boy.login_enabled ? "ON" : "OFF"}</span>
        <button disabled={busy} style={small} onClick={() => run(() => setDeliveryBoyLoginEnabled(boy.id, !boy.login_enabled))}>{boy.login_enabled ? "Band karein" : "Chalu karein"}</button>
        <button disabled={busy} style={{ ...small, color: "#B3261E" }} onClick={() => confirm("Login unlink karein? Boy ko naya code lena padega.") && run(() => revokeDeliveryLogin(boy.id))}>Unlink</button>
      </div>
    );
  }
  return (
    <div style={{ marginTop: "5px" }}>
      {code ? (
        <div style={{ fontSize: "11px", background: "#FFF4DB", borderRadius: "7px", padding: "6px 8px" }}>
          Code: <b style={{ letterSpacing: "2px", fontSize: "13px" }}>{code}</b> <button style={small} onClick={() => navigator.clipboard?.writeText(`Delivery app: ${link}\nCode: ${code}`)}><Copy size={10} /> Copy</button>
          <div style={{ color: "#7A5400", marginTop: "3px" }}>Boy {link} par signup karke yeh code daalega (7 din valid)</div>
        </div>
      ) : (
        <button disabled={busy} style={small} onClick={() => run(async () => setCode(await generateDeliveryInvite(boy.id)))}><KeyRound size={10} /> Login Code Banayein</button>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Delivery Dashboard + History + Methods
// ------------------------------------------------------------
function DeliveryDashboard({ store }) {
  const [d, setD] = useState(null);
  const [methods, setMethods] = useState([]);
  const load = useCallback(async () => {
    try { setD(await fetchDeliveryDashboard(store.id)); setMethods(await fetchStoreDeliveryMethods(store.id)); } catch (e) { console.error(e); }
  }, [store.id]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  if (!d) return <div style={{ textAlign: "center", padding: "30px", color: "#8B8576" }}>Load ho raha hai...</div>;
  const cards = [["Total Staff", d.total_staff, "#1B4332", "#E7F0EA"], ["Active Staff", d.active_staff, "#1B4332", "#E7F0EA"], ["Pending", d.pending, "#9A6B00", "#FFF4DB"], ["Out for Delivery", d.out_for_delivery, "#1F5FA8", "#E4EEF9"], ["Delivered Aaj", d.delivered_today, "#1B4332", "#D5EBDD"]];
  const available = methods.filter((m) => DELIVERY_METHODS[m.method]?.implemented);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "8px", marginBottom: "14px" }}>
        {cards.map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: "12px", padding: "11px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: "21px", color: c }}>{v}</div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: c }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>Delivery Boy-wise</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
        {(d.per_boy || []).length === 0 && <div style={{ fontSize: "12px", color: "#8B8576" }}>Abhi koi delivery staff nahi</div>}
        {(d.per_boy || []).map((b) => (
          <div key={b.delivery_boy_id} style={{ display: "flex", justifyContent: "space-between", background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "9px 12px", fontSize: "12.5px" }}>
            <b>{b.name}</b>
            <span style={{ color: "#5C5747" }}>Assigned {b.assigned} · Aaj {b.completed_today} · Total {b.completed_total}</span>
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>Delivery Method</div>
      {available.map((m) => (
        <label key={m.method} style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "10px 12px", fontSize: "12.5px" }}>
          <input type="checkbox" checked={m.enabled} onChange={async (e) => { try { await setStoreDeliveryMethod(store.id, m.method, e.target.checked); load(); } catch (err) { alert(err.message); } }} />
          <span><b>{DELIVERY_METHODS[m.method].label}</b><br /><span style={{ color: "#8B8576", fontSize: "11px" }}>{DELIVERY_METHODS[m.method].description}</span></span>
        </label>
      ))}
    </div>
  );
}

function DeliveryHistory({ store }) {
  const [boys, setBoys] = useState([]);
  const [boyId, setBoyId] = useState("");
  const [range, setRange] = useState("today");
  const [rows, setRows] = useState(null);
  useEffect(() => { fetchDeliveryBoys(store.id).then(setBoys).catch(() => {}); }, [store.id]);
  useEffect(() => {
    setRows(null);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const day = 86400000;
    let from = t0, to = new Date(t0.getTime() + day);
    if (range === "yesterday") { from = new Date(t0.getTime() - day); to = t0; }
    if (range === "week") { from = new Date(t0); from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); }
    if (range === "month") from = new Date(t0.getFullYear(), t0.getMonth(), 1);
    fetchStoreDeliveryAssignments(store.id, { boyId: boyId || null, from: from.toISOString(), to: to.toISOString() })
      .then(setRows).catch(() => setRows([]));
  }, [store.id, boyId, range]);
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <select value={boyId} onChange={(e) => setBoyId(e.target.value)} style={{ border: "1px solid #E3DECF", borderRadius: "8px", padding: "7px 9px", fontSize: "12px", background: "white" }}>
          <option value="">Sabhi Delivery Boys</option>
          {boys.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {[["today", "Aaj"], ["yesterday", "Kal"], ["week", "Is Hafte"], ["month", "Is Mahine"]].map(([k, l]) => (
          <button key={k} onClick={() => setRange(k)} style={{ border: "1px solid #E3DECF", background: range === k ? "#1B4332" : "white", color: range === k ? "white" : "#5C5747", borderRadius: "999px", padding: "6px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {rows === null ? <div style={{ color: "#8B8576", fontSize: "12.5px" }}>Load ho raha hai...</div> : rows.length === 0 ? <div style={{ color: "#8B8576", fontSize: "12.5px", padding: "20px", textAlign: "center" }}>Koi delivery nahi mili</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {rows.map((r) => {
            const m = DELIVERY_STATUS_META[r.status];
            return (
              <div key={r.assignment_id} style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "10px", padding: "9px 12px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{r.order_number} · {r.customer_name}</b><span>₹{r.total}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", fontSize: "11px", color: "#8B8576" }}>
                  <span>{r.delivery_boy_name} · {new Date(r.delivered_at || r.assigned_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ background: m.bg, color: m.color, fontWeight: 700, padding: "1px 8px", borderRadius: "999px" }}>{m.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DeliveryBoyManager({ store }) {
  const [sub, setSub] = useState("staff");
  const subs = [["staff", "Staff"], ["dashboard", "Dashboard"], ["history", "History"]];
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {subs.map(([id, l]) => (
          <button key={id} onClick={() => setSub(id)} style={{ flex: 1, border: "1px solid #E3DECF", background: sub === id ? "#1B4332" : "white", color: sub === id ? "white" : "#5C5747", borderRadius: "8px", padding: "8px 0", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {sub === "staff" && <StaffList store={store} />}
      {sub === "dashboard" && <DeliveryDashboard store={store} />}
      {sub === "history" && <DeliveryHistory store={store} />}
    </div>
  );
}
