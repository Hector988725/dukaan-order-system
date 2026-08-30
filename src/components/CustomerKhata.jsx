import React, { useState } from "react";
import { BookText, X, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fetchMyKhata } from "../lib/api";

// ============================================================
// CUSTOMER-FACING KHATA — read-only, phone-number se (guest, koi
// login nahi). Isi RPC (get_my_khata) se data aata hai jo dukaandar
// wale table se seedha read karta hai — isliye jo balance/history
// customer ko yahan dikhega, wahi dukaandar ke dashboard mein bhi
// dikhega, hamesha. Customer khud kabhi entry edit nahi kar sakta —
// sirf dekh sakta hai.
// ============================================================
export default function CustomerKhataButton({ store }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ddemo-btn"
        style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.14)", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
      >
        <BookText size={13} /> Mera Khata
      </button>
      {open && <CustomerKhataModal store={store} onClose={() => setOpen(false)} />}
    </>
  );
}

function CustomerKhataModal({ store, onClose }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    if (phone.replace(/\D/g, "").length !== 10) { setError("10 digit ka sahi mobile number daalein."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await fetchMyKhata(store.id, phone.replace(/\D/g, ""));
      setResult(data);
    } catch (e) {
      setError("Kuch gadbad ho gayi, dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "360px", maxHeight: "85vh", overflowY: "auto", padding: "20px", margin: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontWeight: 700, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Fraunces', serif" }}><BookText size={17} /> {store.name} — Aapka Khata</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" }}><X size={18} /></button>
        </div>

        {!result ? (
          <>
            <div style={{ fontSize: "12px", color: "#8B8576", marginBottom: "10px" }}>Apna registered mobile number daalkar apna Khata (udhaar/payment) balance dekhein.</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10 digit mobile number"
              type="tel"
              style={{ width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", outline: "none", marginBottom: "8px" }}
              autoFocus
            />
            {error && <div style={{ color: "#B3261E", fontSize: "11.5px", marginBottom: "8px" }}>{error}</div>}
            <button onClick={handleCheck} disabled={loading} className="ddemo-btn" style={{ width: "100%", background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              {loading ? <Loader2 size={15} className="spin" /> : "Khata Dekhein"}
            </button>
          </>
        ) : (
          <>
            <div style={{ background: "#F7F5F0", borderRadius: "10px", padding: "16px", textAlign: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", color: "#8B8576", fontWeight: 600 }}>
                {result.khata_balance > 0 ? "Aapko Dena Hai" : result.khata_balance < 0 ? "Aapka Advance Jama Hai" : "Aapka Khata Clear Hai"}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, fontFamily: "'Fraunces', serif", color: result.khata_balance > 0 ? "#B3261E" : "#1B4332" }}>
                ₹{Math.abs(result.khata_balance).toLocaleString("en-IN")}
              </div>
            </div>

            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#5C5747", marginBottom: "8px" }}>Transaction History</div>
            {(!result.transactions || result.transactions.length === 0) ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#8B8576", fontSize: "12px" }}>Abhi koi transaction nahi hai.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {result.transactions.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #E3DECF" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {h.type === "debit" ? <ArrowUpRight size={14} color="#B3261E" /> : <ArrowDownRight size={14} color="#1B4332" />}
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600 }}>{h.description || (h.type === "debit" ? "Udhaar" : "Payment")}</div>
                        <div style={{ fontSize: "10px", color: "#8B8576" }}>{new Date(h.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "12.5px", color: h.type === "debit" ? "#B3261E" : "#1B4332" }}>
                      {h.type === "debit" ? "+" : "−"}₹{Number(h.amount).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setResult(null); setPhone(""); }} style={{ width: "100%", background: "transparent", border: "1px solid #E3DECF", borderRadius: "9px", padding: "9px 0", fontSize: "12px", fontWeight: 700, color: "#5C5747", cursor: "pointer", marginTop: "12px" }}>
              Dusra Number Check Karein
            </button>
          </>
        )}
      </div>
    </div>
  );
}
