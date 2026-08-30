import React, { useState, useEffect, useCallback } from "react";
import { BookText, Plus, ArrowUpRight, ArrowDownRight, X, Loader2, TrendingUp, Users, IndianRupee } from "lucide-react";
import { fetchStoreKhataOverview, fetchCustomerKhataHistory, addKhataTransaction, createKhataCustomer } from "../lib/api";

// ============================================================
// KHATA / UDHAARI PANEL — Dukaandar side
// ============================================================
// Sabse zaroori cheez (jo requirement mein bola gaya tha): yeh khud
// koi alag "balance" nahi rakhta — customer.khata_balance aur
// khata_transactions dono ek hi RPC (add_khata_transaction) se atomic
// update hote hain, aur customer apni taraf se bhi (get_my_khata) isi
// table se read karta hai. Ek hi source of truth, dispute possible
// nahi — same data dono taraf.
// ============================================================
export default function KhataPanel({ store }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchStoreKhataOverview(store.id);
      setCustomers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => { load(); }, [load]);

  const totalOutstanding = customers.reduce((s, c) => s + (c.khata_balance > 0 ? Number(c.khata_balance) : 0), 0);
  const totalAdvance = customers.reduce((s, c) => s + (c.khata_balance < 0 ? Math.abs(Number(c.khata_balance)) : 0), 0);
  const customersWithDue = customers.filter((c) => c.khata_balance > 0).length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "50px 0", color: "#8B8576" }}>
        <Loader2 size={24} className="spin" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", padding: "16px 18px 0" }}>
        <StatCard icon={<IndianRupee size={16} />} label="Total Outstanding" value={`₹${totalOutstanding.toLocaleString("en-IN")}`} highlight={totalOutstanding > 0} />
        <StatCard icon={<Users size={16} />} label="Due Wale Customers" value={customersWithDue} />
        <StatCard icon={<TrendingUp size={16} />} label="Advance Jama" value={`₹${totalAdvance.toLocaleString("en-IN")}`} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 10px" }}>
        <div style={{ fontSize: "12px", color: "#8B8576" }}>{customers.length} customer{customers.length !== 1 ? "s" : ""} ka khata khula hai</div>
        <button onClick={() => setAddingNew(true)} className="ddemo-btn" style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1B4332", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Naya Khata / Entry
        </button>
      </div>

      <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {customers.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#8B8576" }}>
            <div style={{ fontSize: "30px", marginBottom: "8px" }}>📒</div>
            <div style={{ fontSize: "13px" }}>Abhi koi khata entry nahi hai. "Naya Khata / Entry" se shuru karein.</div>
          </div>
        )}
        {customers.map((c) => (
          <button
            key={c.customer_id}
            onClick={() => setSelectedCustomer(c)}
            className="ddemo-card ddemo-btn"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1px solid #E3DECF", borderRadius: "12px", padding: "13px 15px", textAlign: "left", cursor: "pointer" }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{c.customer_name}</div>
              <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "2px" }}>{c.customer_phone}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: "15px", fontFamily: "'Fraunces', serif", color: c.khata_balance > 0 ? "#B3261E" : c.khata_balance < 0 ? "#1B4332" : "#5C5747" }}>
                ₹{Math.abs(c.khata_balance).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "10px", color: "#8B8576" }}>{c.khata_balance > 0 ? "Due Hai" : c.khata_balance < 0 ? "Advance Jama" : "Clear"}</div>
            </div>
          </button>
        ))}
      </div>

      {selectedCustomer && (
        <CustomerKhataDetail
          storeId={store.id}
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onChanged={() => { load(); }}
        />
      )}

      {addingNew && (
        <NewKhataEntryModal
          storeId={store.id}
          existingCustomers={customers}
          onClose={() => setAddingNew(false)}
          onDone={() => { setAddingNew(false); load(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className="ddemo-card" style={{ background: highlight ? "#FDECEA" : "white", border: `1px solid ${highlight ? "#F3C6C1" : "#E3DECF"}`, borderRadius: "12px", padding: "12px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "8px", background: highlight ? "#F3C6C1" : "#EFE9D8", color: highlight ? "#B3261E" : "#1B4332", marginBottom: "8px" }}>
        {icon}
      </div>
      <div style={{ fontSize: "10.5px", fontWeight: 600, color: highlight ? "#B3261E" : "#8B8576", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "17px", fontWeight: 800, color: highlight ? "#B3261E" : "#1A1A1A", fontFamily: "'Fraunces', serif" }}>{value}</div>
    </div>
  );
}

// ============================================================
// Ek customer ka poora ledger (dono taraf same data) + naya entry
// ============================================================
function CustomerKhataDetail({ storeId, customer, onClose, onChanged }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEntry, setShowEntry] = useState(null); // 'debit' | 'credit' | null

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerKhataHistory(customer.customer_id);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [customer.customer_id]);

  useEffect(() => { load(); }, [load]);

  const currentBalance = history.length > 0 ? history[0].running_balance : customer.khata_balance;

  return (
    <div style={overlayStyle}>
      <div style={{ background: "white", width: "100%", maxWidth: "420px", borderRadius: "16px 16px 0 0", maxHeight: "85%", display: "flex", flexDirection: "column", margin: "0 auto" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #E3DECF", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", fontFamily: "'Fraunces', serif" }}>{customer.customer_name}</div>
            <div style={{ fontSize: "11.5px", color: "#8B8576" }}>{customer.customer_phone}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "16px 18px", background: "#F7F5F0", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "#8B8576", fontWeight: 600 }}>{currentBalance > 0 ? "Aapko Lena Hai" : currentBalance < 0 ? "Advance Jama Hai" : "Balance Clear Hai"}</div>
          <div style={{ fontSize: "26px", fontWeight: 800, fontFamily: "'Fraunces', serif", color: currentBalance > 0 ? "#B3261E" : "#1B4332" }}>₹{Math.abs(currentBalance).toLocaleString("en-IN")}</div>
        </div>

        <div style={{ display: "flex", gap: "8px", padding: "12px 18px" }}>
          <button onClick={() => setShowEntry("debit")} className="ddemo-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "#FDECEA", color: "#B3261E", border: "1px solid #F3C6C1", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
            <ArrowUpRight size={14} /> Naya Udhaar
          </button>
          <button onClick={() => setShowEntry("credit")} className="ddemo-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "#E7F0EA", color: "#1B4332", border: "1px solid #1B4332", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
            <ArrowDownRight size={14} /> Payment Mila
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "4px 18px 18px", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#8B8576" }}><Loader2 size={18} className="spin" /></div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#8B8576", fontSize: "12.5px" }}>Abhi koi transaction nahi hai.</div>
          ) : (
            history.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #E3DECF" }}>
                <div>
                  <div style={{ fontSize: "12.5px", fontWeight: 600 }}>{h.description || (h.type === "debit" ? "Udhaar" : "Payment")}</div>
                  <div style={{ fontSize: "10.5px", color: "#8B8576" }}>{new Date(h.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: h.type === "debit" ? "#B3261E" : "#1B4332" }}>
                    {h.type === "debit" ? "+" : "−"}₹{Number(h.amount).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "10px", color: "#8B8576" }}>Balance: ₹{Number(h.running_balance).toLocaleString("en-IN")}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showEntry && (
        <EntryForm
          storeId={storeId}
          customerId={customer.customer_id}
          type={showEntry}
          onClose={() => setShowEntry(null)}
          onDone={() => { setShowEntry(null); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function EntryForm({ storeId, customerId, type, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isDebit = type === "debit";

  const handleSave = async () => {
    setError("");
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Amount ek valid number hona chahiye, 0 se zyada."); return; }
    setSaving(true);
    try {
      await addKhataTransaction(storeId, customerId, type, amt, description || null);
      onDone();
    } catch (e) {
      setError(e.message || "Save nahi ho paaya.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...overlayStyle, zIndex: 60, alignItems: "center" }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "340px", padding: "20px", margin: "20px" }}>
        <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "14px" }}>{isDebit ? "Naya Udhaar Add Karein" : "Payment Mila — Entry Karein"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Amount (₹)</div>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="jaise 500" type="tel" style={inputStyle} autoFocus />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Note (optional)</div>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isDebit ? "jaise Saaman udhaar diya" : "jaise Cash mila"} style={inputStyle} />
          </div>
          {error && <div style={{ color: "#B3261E", fontSize: "11.5px" }}>{error}</div>}
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button onClick={onClose} style={{ flex: 1, background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
          <button disabled={saving} onClick={handleSave} className="ddemo-btn" style={{ flex: 1, background: isDebit ? "#B3261E" : "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Save ho raha hai..." : "Save Karein"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Naya khata shuru karna — existing customer chunein ya naya
// walk-in customer banayein (jisne kabhi online order nahi kiya)
// ============================================================
function NewKhataEntryModal({ storeId, onClose, onDone }) {
  const [mode, setMode] = useState(null); // 'new' | null
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("debit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid = name.trim() && phone.trim().length >= 10 && amount && Number(amount) > 0;

  const handleSave = async () => {
    setError("");
    if (!valid) { setError("Naam, phone (10 digit), aur amount bharna zaroori hai."); return; }
    setSaving(true);
    try {
      const customerId = await createKhataCustomer(storeId, phone.trim(), name.trim());
      await addKhataTransaction(storeId, customerId, type, Number(amount), description || null);
      onDone();
    } catch (e) {
      setError(e.message || "Save nahi ho paaya.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...overlayStyle, alignItems: "center" }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "360px", padding: "20px", margin: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontWeight: 700, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><BookText size={17} /> Naya Khata</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: "11.5px", color: "#8B8576", marginBottom: "12px" }}>
          Agar customer ne pehle online order kiya hai, to uska record dhoondhne ke liye "Khata" list mein pehle se dikh jaayega. Yeh naya form sirf naye/walk-in customer ke liye hai.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Customer ka Naam</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="jaise Ramesh Yadav" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Mobile Number</div>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit number" type="tel" style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["debit", "credit"].map((t) => (
              <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "9px 0", borderRadius: "8px", border: type === t ? "1.5px solid #1B4332" : "1px solid #E3DECF", background: type === t ? "#E7F0EA" : "white", color: type === t ? "#1B4332" : "#5C5747", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                {t === "debit" ? "Udhaar Diya" : "Payment Mila"}
              </button>
            ))}
          </div>
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Amount (₹)</div>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="jaise 500" type="tel" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>Note (optional)</div>
            <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={{ color: "#B3261E", fontSize: "11.5px" }}>{error}</div>}
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button onClick={onClose} style={{ flex: 1, background: "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Cancel</button>
          <button disabled={!valid || saving} onClick={handleSave} className="ddemo-btn" style={{ flex: 1, background: valid ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed" }}>
            {saving ? "Save ho raha hai..." : "Save Karein"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 };
const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", fontFamily: "inherit", outline: "none" };
