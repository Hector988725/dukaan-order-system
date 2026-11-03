import React, { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { pushState, enablePush, disablePush, enableCustomerPush } from "../lib/push";

// "Order alerts" button. role = owner | staff | rider | distributor ; customer ke liye: customer={{storeId, orderNumber, phone}}
export default function PushToggle({ role, customer, color = "#1B4332", label, compact = false }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { let a = true; pushState().then((s) => { if (a) setSt(s); }); return () => { a = false; }; }, []);
  if (st === null || st === "unavailable" || st === "unsupported") return null;

  const on = async () => {
    setBusy(true); setMsg("");
    try {
      if (customer) await enableCustomerPush(customer); else await enablePush(role);
      setSt("on");
    } catch (e) {
      setSt(await pushState());
      setMsg(String(e && e.message) === "denied" ? "Notifications are blocked. Allow them in your browser settings." : "Could not turn on alerts. Please try again.");
    }
    setBusy(false);
  };
  const off = async () => { setBusy(true); await disablePush(); setSt("off"); setBusy(false); };

  const base = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontSize: compact ? 11.5 : 12.5, padding: compact ? "5px 11px" : "8px 14px", border: `1px solid ${color}`, background: "white", color };
  if (st === "needs-install") {
    return <div style={{ fontSize: 11.5, color: "#8B8576", lineHeight: 1.5 }}>🔔 To get alerts on iPhone: open the Share menu → <b>Add to Home Screen</b>, then open the app from its icon.</div>;
  }
  if (st === "denied") {
    return <div style={{ fontSize: 11.5, color: "#8B8576", lineHeight: 1.5 }}>🔕 Alerts are blocked. Allow notifications for this site in your browser settings.</div>;
  }
  if (st === "on") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#1B7F3B", fontWeight: 700 }}>
        <Bell size={13} /> {customer ? "Order updates on" : "Alerts on"}
        {!customer && <button onClick={off} disabled={busy} style={{ background: "none", border: "none", color: "#8B8576", textDecoration: "underline", cursor: "pointer", fontSize: 11, padding: 0 }}>turn off</button>}
      </span>
    );
  }
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button data-testid="push-on" onClick={on} disabled={busy} style={base}><BellOff size={13} /> {busy ? "Please wait..." : (label || (customer ? "🔔 Get order updates" : "🔔 Turn on order alerts"))}</button>
      {msg && <div style={{ fontSize: 11, color: "#B3261E" }}>{msg}</div>}
    </div>
  );
}
