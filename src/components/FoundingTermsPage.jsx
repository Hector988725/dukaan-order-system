import React, { useState } from "react";
import { Star, Check, Loader2, AlertCircle } from "lucide-react";
import { acceptFoundingTerms } from "../lib/api";

// ============================================================
// FOUNDING SHOP TERMS & PRICING LOCK
// ============================================================
// Sirf pehli 1000 (founding) dukaano ko yeh page dikhta hai — payment
// screen khulne se pehle, ek baar. Accept karne par
// `founding_terms_accepted_at` set ho jaata hai, dobara nahi dikhega.
// ============================================================
export default function FoundingTermsPage({ store, onAccept, onSignOut }) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    setSubmitting(true);
    setError("");
    try {
      await acceptFoundingTerms(store.id);
      onAccept();
    } catch (e) {
      setError("Kuch gadbad ho gayi: " + e.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0" }}>
      <div style={{ background: "#1B4332", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "15px" }}>{store.name}</div>
        <button onClick={onSignOut} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "8px", padding: "6px 12px", color: "white", fontSize: "11.5px", fontWeight: 600, cursor: "pointer" }}>Logout</button>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "28px 20px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FFF4DB", color: "#8A6A0F", fontSize: "11.5px", fontWeight: 800, padding: "6px 14px", borderRadius: "999px", marginBottom: "10px" }}>
            <Star size={13} fill="#8A6A0F" /> FOUNDING SHOP OFFER
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "20px", color: "#1A1A1A" }}>Founding Shop Terms & Pricing Lock</div>
          <div style={{ fontSize: "12.5px", color: "#8B8576", marginTop: "4px" }}>Aage badhne se pehle yeh ek baar padh lein</div>
        </div>

        <div style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <TermBlock
            title="1. Aapka Lifetime-Locked Price"
            body="Aap Dukaan Order System ke pehle 1,000 Founding Shops mein se ek hain. Aapka price ₹49/month par hamesha ke liye lock hai — jab tak aapki subscription active rehti hai."
          />
          <TermBlock
            title="2. Price Kab Tak Valid Rahega"
            body="₹49/month ka price tab tak valid rahega jab tak aap regular time par payment karte rahenge aur subscription active rehti hai. Yeh koi time-limited trial nahi hai — jitna chahe chalayein, price nahi badhega (jab tak neeche wali shart follow ho)."
          />
          <TermBlock
            title="3. Payment Due Date & 7-Din Grace Period"
            body="Agar payment due date nikal jaaye, ghabraane ki zaroorat nahi — aapko 7 din ka grace period milta hai. Is 7 din ke andar payment karke subscription renew karne par aapka ₹49/month lock bilkul safe rehta hai, koi asar nahi padta."
          />
          <TermBlock
            title="4. 7 Din Ke Baad Kya Hota Hai"
            body="Agar 7-din ke grace period ke baad bhi subscription inactive rehti hai (payment nahi hota), to aapka ₹49/month lifetime-lock benefit hamesha ke liye khatam ho jaata hai. Dobara subscription activate karne par regular price (₹299/month Basic) lagu hoga — is baad ₹49 wapas nahi milega."
            highlight
          />
          <TermBlock
            title="5. Regular & Premium Pricing (Reference)"
            body="Pehli 1,000 shops poori hone ke baad naye customers ke liye Regular Basic price ₹299/month hoga. Agar aap kabhi Premium features chahte hain, Founding Shops ke liye Premium ₹499/month (naye customers ke liye ₹999/month) alag se, optional upgrade ke roop mein available hai — yeh aapke ₹49 Basic lock ko prabhavit nahi karta jab tak aap khud upgrade na karein."
          />
          <TermBlock
            title="6. Infrastructure & Third-Party Costs"
            body="₹49/month ka price Dukaan Order System ke SaaS subscription ke liye hai, aur ismein normal hosting/database infrastructure cost included hai (jahan tak commercially feasible ho). Third-party costs — jaise custom domain registration, payment gateway (Razorpay) fees, ya SMS/WhatsApp charges — alag se lag sakte hain, ya us provider ki apni pricing ke hisaab se badal sakte hain. Yeh aapke ₹49/month SaaS price ka hissa nahi hain."
          />
        </div>

        {error && (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#FDECEA", borderRadius: "9px", padding: "10px 12px", marginTop: "14px" }}>
            <AlertCircle size={16} color="#B3261E" style={{ flexShrink: 0, marginTop: "1px" }} />
            <div style={{ fontSize: "12px", color: "#B3261E" }}>{error}</div>
          </div>
        )}

        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "18px", cursor: "pointer" }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: "18px", height: "18px", marginTop: "1px", flexShrink: 0 }} />
          <span style={{ fontSize: "12.5px", color: "#5C5747", lineHeight: 1.5 }}>
            Maine upar ki saari terms padh li hain aur samajh li hain — khaaskar 7-din grace period aur uske baad ₹49 lifetime-lock khatam hone wali shart. Main in terms se sehmat hoon.
          </span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!checked || submitting}
          style={{
            width: "100%", marginTop: "16px", padding: "14px 0", borderRadius: "11px", border: "none",
            background: checked && !submitting ? "#1B4332" : "#D8D2BF", color: "white",
            fontWeight: 800, fontSize: "14.5px", cursor: checked && !submitting ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          {submitting ? (<><Loader2 size={16} className="spin" /> Save ho raha hai...</>) : (<><Check size={16} /> Maine Padh Liya, Sehmat Hoon — Aage Badhein</>)}
        </button>
      </div>
    </div>
  );
}

function TermBlock({ title, body, highlight }) {
  return (
    <div style={highlight ? { background: "#FDECEA", borderRadius: "9px", padding: "12px 14px", margin: "-4px -6px" } : undefined}>
      <div style={{ fontWeight: 700, fontSize: "13px", color: highlight ? "#B3261E" : "#1B4332", marginBottom: "4px" }}>{title}</div>
      <div style={{ fontSize: "12.5px", color: "#5C5747", lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}
