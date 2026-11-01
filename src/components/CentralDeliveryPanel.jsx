import React, { useState, useEffect, useCallback } from "react";
import { Bike, Store, RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { friendlyError as baseFriendlyError } from "../lib/errors";

// Server ke Hinglish messages ko English mein badalna (is panel mein sab English).
const EN_ERRORS = [
  ["Delivery service aapke liye abhi chalu nahi hai", "Delivery service is not enabled for you yet. Please contact head office."],
  ["Rider ka naam sahi likhein", "Please enter a valid rider name."],
  ["Phone number sahi likhein", "Please enter a valid phone number."],
  ["Rider nahi mila", "Rider not found."],
  ["Is rider ka login pehle se linked hai", "This rider's login is already linked."],
  ["Dukaan nahi mili", "Shop not found."],
  ["Delivery nahi mili", "Delivery not found."],
  ["Saman uth chuka hai", "The order has already been picked up, so the rider can no longer be changed."],
  ["Yeh rider available nahi hai", "This rider is not available."],
  ["Yeh rider is dukaan ke partner ka nahi hai", "This rider does not belong to this shop's partner."],
  ["Delivered delivery cancel nahi ho sakti", "A delivered order cannot be cancelled."],
  ["COD settle nahi ho sakta", "COD cannot be settled (already settled, or not a COD order)."],
  ["Parent partner nahi mila", "Parent partner not found."],
  ["Partner nahi mila", "Partner not found."],
  ["Partner apna hi parent nahi ho sakta", "A partner cannot be its own parent."],
  ["Sirf 2 level", "Only 2 levels are allowed: a market partner's parent cannot itself be a market partner."],
  ["already market partners hain", "This partner already has market partners under it. Remove them first."],
];
function friendlyError(e) {
  const raw = String((e && e.message) || e || "");
  for (const [k, v] of EN_ERRORS) if (raw.includes(k)) return v;
  return baseFriendlyError(e, "en");
}
import {
  fetchScopePartners, fetchPartnerOverview, fetchPartnerDeliveries, fetchPartnerRiders, addPartnerRider, updatePartnerRider,
  generatePartnerRiderInvite, revokePartnerRiderLogin, fetchPartnerStores, setPartnerStoreAllowed,
  assignPartnerRider, cancelPartnerDelivery, markPartnerCodSettled,
  fetchDeliveryPartnersAdmin, setDeliveryPartnerAdmin,
} from "../lib/api";

// ============================================================
// CENTRAL DELIVERY PANEL — partner (distributor) aur Super Admin dono yahi use karte hain.
//   isAdmin=true  : Super Admin — sab partners + "Head office", aur "Partners" tab (enable / market set)
//   isAdmin=false : Partner     — sirf apna + apne market partners ka data
// Sab data security-definer RPCs se; server har call par scope check karta hai
// (yahan ka dropdown sirf suvidha hai, suraksha nahi).
// ============================================================
const G = "#1B4332", BORDER = "#E3DECF", MUTED = "#8B8576";
const card = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 };
const inp = { border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const smallBtn = (primary, danger) => ({ border: primary ? "none" : `1px solid ${danger ? "#E5B5B0" : BORDER}`, background: primary ? G : "white", color: primary ? "white" : danger ? "#B3261E" : "#5C5747", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" });
const STATUS_LABEL = { REQUESTED: "In pool", ACCEPTED: "Accepted", PICKED_UP: "Picked up", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered" };
const STATUS_COLOR = { REQUESTED: ["#9A6B00", "#FFF4DB"], ACCEPTED: ["#1F5FA8", "#E4EEF9"], PICKED_UP: ["#5B2A5E", "#F3E6F0"], OUT_FOR_DELIVERY: [G, "#E7F0EA"], DELIVERED: [G, "#D5EBDD"] };
const when = (t) => (t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

// dropdown value -> server scope
export function scopeFromValue(v) {
  if (v === "head") return { partner: null, head: true };
  if (v && v !== "all") return { partner: v, head: false };
  return { partner: null, head: false };
}

export default function CentralDeliveryPanel({ isAdmin = false }) {
  const [sub, setSub] = useState("live");
  const [partners, setPartners] = useState([]);
  const [scopeVal, setScopeVal] = useState("all");
  useEffect(() => { fetchScopePartners().then(setPartners).catch(() => setPartners([])); }, []);
  const scope = scopeFromValue(scopeVal);
  const showScope = isAdmin || partners.length > 1;
  const tabs = [["live", "Live Deliveries"], ["riders", "Riders"], ["shops", "Shops"], ...(isAdmin ? [["partners", "Partners"]] : [])];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} style={{ border: `1px solid ${sub === k ? G : BORDER}`, background: sub === k ? G : "white", color: sub === k ? "white" : "#5C5747", borderRadius: 999, padding: "7px 15px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {showScope && sub !== "partners" && (
        <div style={{ marginBottom: 12 }}>
          <select aria-label="Choose partner" value={scopeVal} onChange={(e) => setScopeVal(e.target.value)} style={{ ...inp, width: "100%" }}>
            <option value="all">{isAdmin ? "All partners + Head office" : "Me + my market partners"}</option>
            {isAdmin && <option value="head">Head office (shops without a partner)</option>}
            {partners.map((p) => <option key={p.distributor_id} value={p.distributor_id}>{p.name}{p.market_name ? ` — ${p.market_name}` : ""}{p.enabled ? "" : " (delivery off)"}</option>)}
          </select>
        </div>
      )}
      {sub === "live" && <LiveTab scope={scope} />}
      {sub === "riders" && <RidersTab scope={scope} isAdmin={isAdmin} partners={partners} />}
      {sub === "shops" && <ShopsTab scope={scope} />}
      {sub === "partners" && isAdmin && <PartnersTab />}
    </div>
  );
}

function Stat({ label, value, color = G, bg = "#E7F0EA" }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "11px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 22, color }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color, opacity: 0.85 }}>{label}</div>
    </div>
  );
}

function LiveTab({ scope }) {
  const [ov, setOv] = useState(null);
  const [rows, setRows] = useState(null);
  const [riders, setRiders] = useState([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");
  const key = `${scope.partner}|${scope.head}`;
  const load = useCallback(async () => {
    try {
      const [o, r, rd] = await Promise.all([fetchPartnerOverview(scope), fetchPartnerDeliveries(scope, filter || null, 200), fetchPartnerRiders(scope)]);
      setOv(o); setRows(r); setRiders(rd); setErr("");
    } catch (e) { setErr(friendlyError(e)); setRows([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, filter]);
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const act = async (fn, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try { await fn(); await load(); } catch (e) { alert(friendlyError(e)); }
  };
  if (err && !ov) return <div style={{ ...card, color: "#B3261E", fontSize: 13 }}>{err}</div>;
  if (!ov) return <div style={{ color: MUTED, fontSize: 13 }}>Loading...</div>;
  const available = riders.filter((r) => r.is_active && r.login_linked);
  const late = Number(ov.late_pool) + Number(ov.late_active);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="Waiting in pool" value={ov.pool} color="#9A6B00" bg="#FFF4DB" />
        <Stat label="In progress" value={ov.active} color="#1F5FA8" bg="#E4EEF9" />
        <Stat label="Delivered today" value={ov.delivered_today} />
        <Stat label="Late" value={late} color={late ? "#B3261E" : G} bg={late ? "#FDECEA" : "#E7F0EA"} />
        <Stat label={`COD pending (${ov.cod_pending_count})`} value={`₹${ov.cod_pending_amount}`} color="#7A5400" bg="#FFF4DB" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", alignItems: "center" }}>
        {[["", "All"], ["REQUESTED", "Pool"], ["ACCEPTED", "Accepted"], ["OUT_FOR_DELIVERY", "On the way"], ["DELIVERED", "Delivered"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ border: `1px solid ${filter === k ? G : BORDER}`, background: filter === k ? G : "white", color: filter === k ? "white" : "#5C5747", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{l}</button>
        ))}
        <button onClick={load} aria-label="Refresh" style={{ ...smallBtn(false), display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={12} /></button>
      </div>

      {rows === null ? <div style={{ color: MUTED, fontSize: 13 }}>Loading...</div> : rows.length === 0 ? (
        <div style={{ ...card, color: MUTED, fontSize: 13, textAlign: "center" }}>No central deliveries</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => {
            const [c, bg] = STATUS_COLOR[r.status] || [G, "#E7F0EA"];
            const canReassign = r.status === "REQUESTED" || r.status === "ACCEPTED";
            return (
              <div key={r.assignment_id} style={{ ...card, borderLeft: `5px solid ${r.is_late ? "#B3261E" : c}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.store_name} <span style={{ color: MUTED, fontWeight: 500, fontSize: 12 }}>· {r.order_number}</span></div>
                    <div style={{ fontSize: 11.5, color: MUTED }}>{r.customer_name} · ₹{r.total} · {r.payment_method}</div>
                  </div>
                  <span style={{ alignSelf: "flex-start", background: bg, color: c, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#5C5747", margin: "6px 0" }}>
                  Rider: <b>{r.rider_name || "— none —"}</b> · Requested: {when(r.requested_at)}{r.delivered_at ? ` · Delivered: ${when(r.delivered_at)}` : ""}
                  {r.is_late && <span style={{ color: "#B3261E", fontWeight: 700 }}> · <AlertTriangle size={11} style={{ verticalAlign: "-1px" }} /> Late</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {canReassign && (
                    <select defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v !== "") act(() => assignPartnerRider(r.assignment_id, v === "__pool__" ? null : v)); }} style={{ ...inp, padding: "6px 8px", fontSize: 12 }}>
                      <option value="">Assign rider...</option>
                      {available.map((x) => <option key={x.id} value={x.id}>{x.name}{x.partner_name ? ` (${x.partner_name})` : ""}</option>)}
                      {r.status === "ACCEPTED" && <option value="__pool__">↩ Back to pool</option>}
                    </select>
                  )}
                  {r.status !== "DELIVERED" && <button onClick={() => act(() => cancelPartnerDelivery(r.assignment_id), "Cancel this central delivery? The shop can request it again.")} style={smallBtn(false, true)}>Cancel</button>}
                  {r.status === "DELIVERED" && Number(r.cod_collected) > 0 && (
                    r.cod_settled_at ? <span style={{ fontSize: 11.5, color: G, fontWeight: 700 }}>COD ₹{r.cod_collected} settled ✓</span>
                      : <button onClick={() => act(() => markPartnerCodSettled(r.assignment_id), `Confirm COD ₹${r.cod_collected} has been settled with the shop?`)} style={smallBtn(true)}>COD ₹{r.cod_collected} settle</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {Array.isArray(ov.shops) && ov.shops.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>By shop</div>
          {ov.shops.map((s) => (
            <div key={s.store_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${BORDER}` }}>
              <span>{s.name}</span><span style={{ color: MUTED }}>waiting {s.waiting} · in progress {s.in_progress} · total delivered {s.delivered_total}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RidersTab({ scope, isAdmin, partners }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", vehicle_type: "Bike", vehicle_number: "" });
  const [target, setTarget] = useState("");   // admin: "" = head office; partner: "" = khud
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState({});
  const [err, setErr] = useState("");
  const key = `${scope.partner}|${scope.head}`;
  const load = useCallback(async () => { try { setRows(await fetchPartnerRiders(scope)); setErr(""); } catch (e) { setErr(friendlyError(e)); setRows([]); } }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true);
    try { await addPartnerRider(form.name, form.phone, form.vehicle_type, form.vehicle_number, target || null); setForm({ name: "", phone: "", vehicle_type: "Bike", vehicle_number: "" }); await load(); }
    catch (e) { alert(friendlyError(e)); }
    setBusy(false);
  };
  const run = async (fn) => { try { await fn(); await load(); } catch (e) { alert(friendlyError(e)); } };
  const invite = async (id) => { try { const c = await generatePartnerRiderInvite(id); setCode((x) => ({ ...x, [id]: c })); await load(); } catch (e) { alert(friendlyError(e)); } };
  const link = `${window.location.origin}/rider`;
  const targetOptions = isAdmin ? [["", "Head office"], ...partners.map((p) => [p.distributor_id, p.name])] : partners.map((p, i) => [i === 0 ? "" : p.distributor_id, i === 0 ? `${p.name} (main)` : p.name]);
  return (
    <>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>Add a New Rider</div>
        {targetOptions.length > 1 && (
          <select style={{ ...inp, width: "100%", marginBottom: 8 }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Which partner this rider is for">
            {targetOptions.map(([v, l]) => <option key={v || "self"} value={v}>Rider for: {l}</option>)}
          </select>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <input style={inp} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={inp} placeholder="Mobile" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+ ]/g, "") })} />
          <select style={inp} value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>{["Bike", "Scooter", "Cycle", "Walking", "Other"].map((v) => <option key={v}>{v}</option>)}</select>
          <input style={inp} placeholder="Vehicle number (optional)" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
        </div>
        <button disabled={busy || form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 10} onClick={add} style={{ ...smallBtn(true), marginTop: 10, opacity: busy ? 0.6 : 1 }}>{busy ? "Please wait..." : "Add Rider"}</button>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Rider app link: <b>{link}</b> — the rider creates an account there and enters the 8-character login code shown below.</div>
      </div>
      {err && <div style={{ color: "#B3261E", fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
      {rows === null ? <div style={{ color: MUTED, fontSize: 13 }}>Loading...</div> : rows.length === 0 ? <div style={{ ...card, color: MUTED, fontSize: 13, textAlign: "center" }}>No riders yet</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => {
            const shown = code[r.id] || (r.invite_expires_at && new Date(r.invite_expires_at) > new Date() ? r.invite_code : null);
            return (
              <div key={r.id} style={{ ...card, opacity: r.is_active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div><div style={{ fontWeight: 700 }}><Bike size={14} style={{ verticalAlign: "-2px" }} /> {r.name} <span style={{ color: MUTED, fontWeight: 500, fontSize: 12 }}>· {r.phone} · {r.vehicle_type}{r.vehicle_number ? ` ${r.vehicle_number}` : ""}</span></div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{r.partner_name ? `Partner: ${r.partner_name} · ` : "Head office · "}{r.login_linked ? "Login linked ✓" : "Not linked yet"} · in progress {r.active_now} · total delivered {r.delivered_total}</div></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.is_active ? G : "#B3261E" }}>{r.is_active ? "Active" : "Off"}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                  {!r.login_linked && <button onClick={() => invite(r.id)} style={smallBtn(true)}>Generate Login Code</button>}
                  {shown && !r.login_linked && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FFF4DB", borderRadius: 8, padding: "5px 10px", fontFamily: "monospace", fontWeight: 800, letterSpacing: 2 }}>{shown}
                    <button aria-label="Copy" onClick={() => navigator.clipboard?.writeText(shown)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A5400", display: "flex" }}><Copy size={13} /></button></span>}
                  {r.login_linked && <button onClick={() => confirm("Remove this rider's login?") && run(() => revokePartnerRiderLogin(r.id))} style={smallBtn(false, true)}>Remove Login</button>}
                  <button onClick={() => run(() => updatePartnerRider(r.id, r.name, r.phone, r.vehicle_type, r.vehicle_number, !r.is_active))} style={smallBtn(false, r.is_active)}>{r.is_active ? "Deactivate" : "Activate"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ShopsTab({ scope }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const key = `${scope.partner}|${scope.head}`;
  const load = useCallback(async (query) => { try { setRows(await fetchPartnerStores(query, scope)); setErr(""); } catch (e) { setErr(friendlyError(e)); setRows([]); } }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setTimeout(() => load(q), 300); return () => clearTimeout(id); }, [q, load]);
  const toggle = async (s) => {
    try { await setPartnerStoreAllowed(s.store_id, !s.allowed); await load(q); } catch (e) { alert(friendlyError(e)); }
  };
  return (
    <>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>Only shops you allow here can use Central Delivery. This list only shows shops you enrolled.</div>
      <input style={{ ...inp, width: "100%", marginBottom: 10 }} placeholder="Search shop name..." value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <div style={{ color: "#B3261E", fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
      {rows === null ? <div style={{ color: MUTED, fontSize: 13 }}>Loading...</div> : rows.length === 0 ? <div style={{ ...card, color: MUTED, fontSize: 13, textAlign: "center" }}>No shops found</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((s) => (
            <div key={s.store_id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
              <Store size={15} color={MUTED} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</div><div style={{ fontSize: 11.5, color: MUTED }}>{s.city || "—"} · {s.partner_name ? `Partner: ${s.partner_name}` : "Head office"}</div></div>
              <button onClick={() => toggle(s)} style={smallBtn(!s.allowed, s.allowed)}>{s.allowed ? "Allowed ✓ (turn off)" : "Allow"}</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Sirf Super Admin: kaun partner delivery de sakta hai, aur kaun kiska market partner hai
function PartnersTab() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setRows(await fetchDeliveryPartnersAdmin()); setErr(""); } catch (e) { setErr(friendlyError(e)); setRows([]); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (r, patch) => {
    const next = { enabled: r.enabled, parent: r.parent_distributor_id, market: r.market_name, ...patch };
    try { await setDeliveryPartnerAdmin(r.distributor_id, next.enabled, next.parent || null, next.market || null); await load(); }
    catch (e) { alert(friendlyError(e)); await load(); }
  };
  return (
    <>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 10 }}>
        A partner is one of your distributors. Once "Delivery on" is set, they can run Central Delivery with their own riders and shops.
        To make someone a market/village partner, put them under a district partner (2 levels only).
      </div>
      {err && <div style={{ color: "#B3261E", fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
      {rows === null ? <div style={{ color: MUTED, fontSize: 13 }}>Loading...</div> : rows.length === 0 ? <div style={{ ...card, color: MUTED, fontSize: 13, textAlign: "center" }}>No distributors yet</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <PartnerRow key={r.distributor_id} r={r} all={rows} onSave={save} />
          ))}
        </div>
      )}
    </>
  );
}

function PartnerRow({ r, all, onSave }) {
  const [market, setMarket] = useState(r.market_name || "");
  useEffect(() => setMarket(r.market_name || ""), [r.market_name]);
  const parents = all.filter((x) => x.distributor_id !== r.distributor_id && !x.parent_distributor_id);
  return (
    <div style={{ ...card }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name} <span style={{ color: MUTED, fontWeight: 500, fontSize: 12 }}>· {r.status}</span></div>
          <div style={{ fontSize: 11.5, color: MUTED }}>{r.shops} shops · {r.riders} riders{r.parent_name ? ` · under ${r.parent_name}` : ""}</div>
        </div>
        <button onClick={() => onSave(r, { enabled: !r.enabled })} style={smallBtn(!r.enabled, r.enabled)}>{r.enabled ? "Delivery on ✓ (turn off)" : "Turn delivery on"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <select style={{ ...inp, flex: 1, minWidth: 150 }} value={r.parent_distributor_id || ""} onChange={(e) => onSave(r, { parent: e.target.value || null })}>
          <option value="">District partner (no parent)</option>
          {parents.map((p) => <option key={p.distributor_id} value={p.distributor_id}>Market partner — under {p.name}</option>)}
        </select>
        <input style={{ ...inp, flex: 1, minWidth: 150 }} placeholder="Market / area name" value={market} onChange={(e) => setMarket(e.target.value)} onBlur={() => market !== (r.market_name || "") && onSave(r, { market })} />
      </div>
    </div>
  );
}
