import React, { useState, useEffect, useCallback } from "react";
import { friendlyError } from "../lib/errors";
import { fetchDistributorsOverview, fetchStoreAreaSummary, fetchStoresForAssignment, assignStores, assignStoresByArea } from "./api";

const BORDER = "#E3DECF", MUTED = "#8B8576", G = "#1B4332";
const card = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "13px 15px" };
const inp = { padding: "9px 11px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", background: "white" };
const btn = (primary, disabled) => ({
  padding: "9px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
  border: primary ? "none" : `1px solid ${BORDER}`, background: primary ? (disabled ? "#D8D2BF" : G) : "white", color: primary ? "white" : "#5C5747",
});

// Super Admin: hand shops (e.g. the ones that came in through ads) to a distributor — by area or by selection.
export default function AssignShopsPanel() {
  const [areas, setAreas] = useState([]);
  const [dists, setDists] = useState([]);
  const [f, setF] = useState({ state: "", city: "", pincode: "", search: "", filter: "unassigned" });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState({});
  const [target, setTarget] = useState("");
  const [enableCentral, setEnableCentral] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadAreas = useCallback(() => { fetchStoreAreaSummary().then(setAreas).catch((e) => setErr(friendlyError(e, "en"))); }, []);
  useEffect(() => { loadAreas(); fetchDistributorsOverview().then(setDists).catch(() => setDists([])); }, [loadAreas]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const r = await fetchStoresForAssignment({ ...f, limit: 100 }); setRows(r.rows); setTotal(r.total); setSel({}); }
    catch (e) { setErr(friendlyError(e, "en")); setRows([]); setTotal(0); }
    setLoading(false);
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const chosen = Object.keys(sel).filter((k) => sel[k]);
  const hasArea = !!(f.state || f.city || f.pincode);
  const targetName = (dists.find((d) => d.distributor_id === target) || {}).name;
  const resultText = (r) => `Done: ${r.moved} shop(s) moved${r.already_there ? `, ${r.already_there} already there` : ""}${r.skipped_busy ? `, ${r.skipped_busy} skipped (Central Delivery order in progress — try again after it is delivered)` : ""}.`;

  const run = async (fn, confirmText) => {
    if (!target) { setErr("Choose the distributor first."); return; }
    if (!confirm(confirmText)) return;
    setBusy(true); setErr(""); setMsg("");
    try { const r = await fn(); setMsg(resultText(r)); await load(); loadAreas(); }
    catch (e) { setErr(friendlyError(e, "en")); }
    setBusy(false);
  };
  const assignSelected = () => run(() => assignStores(chosen, target, reason, enableCentral),
    `Assign ${chosen.length} selected shop(s) to ${targetName}?\n\nCommission for these shops goes to ${targetName} from the next monthly run. Past months are not changed.`);
  const assignArea = () => run(() => assignStoresByArea({ state: f.state, city: f.city, pincode: f.pincode, onlyUnassigned: true, distributorId: target, reason, enableCentral }),
    `Assign ALL unassigned shops in ${[f.pincode, f.city, f.state].filter(Boolean).join(", ")} to ${targetName}?\n\nCommission for these shops goes to ${targetName} from the next monthly run. Past months are not changed.`);
  const unassignSelected = () => run(() => assignStores(chosen, null, reason || "Moved back to Head office", false),
    `Move ${chosen.length} selected shop(s) back to Head office (no distributor)?`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...card, background: "#F7F5F0" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>Give shops to a distributor</div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
          Shops that join through ads have no distributor (Head office). When you later appoint a distributor for an area, assign those shops here.
          They then appear in the distributor's Central Delivery panel, and their monthly commission starts from the next commission run (past months stay as they were).
          Every change is logged.
        </div>
      </div>

      {areas.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Areas (tap to filter)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {areas.map((a, i) => {
              const on = (f.state === (a.state === "(no state)" ? "" : a.state)) && (f.city === (a.city === "(no city)" ? "" : a.city)) && (f.state || f.city);
              return (
                <button key={i} onClick={() => setF({ ...f, state: a.state === "(no state)" ? "" : a.state, city: a.city === "(no city)" ? "" : a.city, pincode: "" })}
                  style={{ border: `1px solid ${on ? G : BORDER}`, background: on ? G : "white", color: on ? "white" : "#5C5747", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {a.city}, {a.state} · {a.total}{a.unassigned > 0 ? ` (${a.unassigned} unassigned)` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "1 1 120px" }} placeholder="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
          <input style={{ ...inp, flex: "1 1 120px" }} placeholder="City / District" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input style={{ ...inp, flex: "1 1 100px" }} placeholder="Pincode" inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, "") })} />
          <input style={{ ...inp, flex: "2 1 160px" }} placeholder="Search shop name / link" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["unassigned", "Unassigned (ads / Head office)"], ["assigned", "Already assigned"], ["all", "All"]].map(([k, l]) => (
            <button key={k} onClick={() => setF({ ...f, filter: k })} style={{ border: `1px solid ${f.filter === k ? G : BORDER}`, background: f.filter === k ? G : "white", color: f.filter === k ? "white" : "#5C5747", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
          ))}
          <button onClick={() => setF({ state: "", city: "", pincode: "", search: "", filter: "unassigned" })} style={{ ...btn(false), padding: "6px 12px", fontSize: 12 }}>Clear</button>
        </div>
      </div>

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5 }}>Assign to</div>
        <select style={inp} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Distributor">
          <option value="">Choose distributor...</option>
          {dists.map((d) => <option key={d.distributor_id} value={d.distributor_id}>{d.name}{d.distributor_type === "special" ? " (special)" : ""}</option>)}
        </select>
        <label style={{ fontSize: 12.5, display: "flex", gap: 7, alignItems: "center" }}>
          <input type="checkbox" checked={enableCentral} onChange={(e) => setEnableCentral(e.target.checked)} /> Also enable Central Delivery for these shops
        </label>
        <input style={inp} placeholder="Reason (optional, saved in the log)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={busy || chosen.length === 0 || !target} onClick={assignSelected} style={btn(true, busy || chosen.length === 0 || !target)}>Assign selected ({chosen.length})</button>
          <button disabled={busy || !hasArea || !target} onClick={assignArea} style={btn(true, busy || !hasArea || !target)}>Assign ALL unassigned in this area</button>
          <button disabled={busy || chosen.length === 0} onClick={unassignSelected} style={btn(false, busy || chosen.length === 0)}>Move selected back to Head office</button>
        </div>
        {!hasArea && <div style={{ fontSize: 11.5, color: MUTED }}>To assign a whole area at once, set a state, city or pincode above (or tap an area).</div>}
        {msg && <div style={{ fontSize: 12.5, color: G, fontWeight: 700 }}>{msg}</div>}
        {err && <div style={{ fontSize: 12.5, color: "#B3261E" }}>{err}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: MUTED, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{loading ? "Loading..." : `${total} shop(s)${total > rows.length ? ` — showing first ${rows.length}` : ""}`}</span>
          {rows.length > 0 && <button style={{ ...btn(false), padding: "5px 10px", fontSize: 11.5 }} onClick={() => setSel(Object.fromEntries(rows.map((r) => [r.id, !(chosen.length === rows.length)])))}>{chosen.length === rows.length ? "Clear selection" : "Select all shown"}</button>}
        </div>
        {rows.map((r) => (
          <label key={r.id} data-testid="assign-row" style={{ ...card, display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={!!sel[r.id]} onChange={(e) => setSel({ ...sel, [r.id]: e.target.checked })} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name} <span style={{ fontWeight: 400, fontSize: 11, color: MUTED }}>/{r.slug}</span></div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{[r.pincode, r.city, r.state].filter(Boolean).join(", ") || "No address"} · {r.is_active ? "Active" : "Inactive"}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11.5 }}>
              <div style={{ fontWeight: 700, color: r.distributor_name ? G : "#9A6B00" }}>{r.distributor_name || "Head office"}</div>
              <div style={{ color: MUTED }}>{r.central_allowed ? "Central Delivery ✓" : "Central Delivery off"}</div>
            </div>
          </label>
        ))}
        {!loading && rows.length === 0 && <div style={{ textAlign: "center", padding: 24, color: MUTED, fontSize: 12.5 }}>No shops match.</div>}
      </div>
    </div>
  );
}
