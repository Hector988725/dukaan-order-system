import React, { useState } from "react";
import { FAMILIES, num, inr, priceFor, qtyForAmount, showQty, discount, gstCalc, profitCalc } from "../lib/calc";

// ============================================================
// Dukaandar ka calculator: "10 gram kitne ka?", "₹50 ka kitna de dun?", bill ka jod, chhoot/GST/munafa.
// Sab kuch phone par, bina internet ya database ke — sirf hisaab.
// ============================================================
const G = "#1B4332";
const box = { background: "#F1F6F3", border: "1px solid #CFE0D5", borderRadius: 12, padding: "12px 14px" };
const inp = { width: "100%", boxSizing: "border-box", border: "1.5px solid #CFE0D5", borderRadius: 9, padding: "10px 11px", fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff" };
const lab = { fontSize: 11, fontWeight: 700, color: "#3F4A44", marginBottom: 4, display: "block" };

function Pill({ on, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      cursor: "pointer", fontFamily: "inherit", borderRadius: 999, padding: "6px 11px", fontSize: 12, fontWeight: 700,
      border: `1.5px solid ${G}`, background: on ? G : "#fff", color: on ? "#fff" : G,
    }}>{children}</button>
  );
}
function Num({ label, value, onChange, placeholder }) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={lab}>{label}</span>
      <input style={inp} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
function Sel({ label, value, onChange, options }) {
  return (
    <label style={{ width: 104, flex: "none" }}>
      <span style={lab}>{label}</span>
      <select style={{ ...inp, padding: "10px 6px" }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([n, v]) => <option key={n} value={v}>{n}</option>)}
      </select>
    </label>
  );
}
function Result({ children, big }) {
  return <div style={{ marginTop: 10, background: "#fff", border: `1.5px solid ${G}`, borderRadius: 11, padding: "11px 13px", fontWeight: 800, color: G, fontSize: big ? 24 : 14, lineHeight: 1.3 }}>{children}</div>;
}

export default function RateCalculator() {
  const [tab, setTab] = useState("tol"); // tol | amt | jod | per
  const [fam, setFam] = useState("weight");
  const F = FAMILIES[fam];
  const [rate, setRate] = useState("");
  const [ratePer, setRatePer] = useState(1000);
  const [qty, setQty] = useState("");
  const [qtyU, setQtyU] = useState(1);
  const [amount, setAmount] = useState("");
  const [list, setList] = useState([]); // jod list
  const [paid, setPaid] = useState("");
  const [pmode, setPmode] = useState("disc"); // disc | gst | profit
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [gmode, setGmode] = useState("add");

  const pickFam = (k) => {
    setFam(k); const f = FAMILIES[k];
    setRatePer(f.rateUnits[0][1]); setQtyU(f.qtyUnits[0][1]); setQty(""); setAmount("");
  };
  const rateN = num(rate), qtyN = num(qty), amtN = num(amount);
  const unitName = (arr, v) => (arr.find(([, x]) => x === Number(v)) || [""])[0];
  const price = rate === "" || qty === "" ? NaN : priceFor(rateN, Number(ratePer), qtyN * Number(qtyU));
  const give = rate === "" || amount === "" ? NaN : qtyForAmount(rateN, Number(ratePer), amtN);
  const qtyLabel = () => `${qty} ${unitName(F.qtyUnits, qtyU)}`;
  const total = list.reduce((s, x) => s + x.price, 0);
  const paidN = num(paid);

  const rateRow = (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <Num label="Rate (₹)" value={rate} onChange={setRate} placeholder="jaise 260" />
      <Sel label="Per" value={ratePer} onChange={(v) => setRatePer(Number(v))} options={F.rateUnits} />
    </div>
  );

  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 13, color: G, marginBottom: 8 }}>🧮 Dukaan Calculator</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Pill on={tab === "tol"} onClick={() => setTab("tol")}>⚖️ Tol → ₹</Pill>
        <Pill on={tab === "amt"} onClick={() => setTab("amt")}>₹ → Maal</Pill>
        <Pill on={tab === "jod"} onClick={() => setTab("jod")}>🧾 Jod{list.length ? ` (${list.length})` : ""}</Pill>
        <Pill on={tab === "per"} onClick={() => setTab("per")}>% Chhoot/GST</Pill>
      </div>

      {(tab === "tol" || tab === "amt" || tab === "jod") && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(FAMILIES).map(([k, f]) => <Pill key={k} on={fam === k} onClick={() => pickFam(k)}>{f.label}</Pill>)}
        </div>
      )}

      {(tab === "tol" || tab === "jod") && (
        <>
          {rateRow}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
            <Num label="Kitna chahiye" value={qty} onChange={setQty} placeholder={fam === "weight" ? "jaise 10" : "jaise 2"} />
            <Sel label="Unit" value={qtyU} onChange={(v) => setQtyU(Number(v))} options={F.qtyUnits} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {F.chips.map(([n, base]) => (
              <Pill key={n} onClick={() => { const u = F.qtyUnits[0][1]; setQtyU(u); setQty(String(base / u)); }}>{n}</Pill>
            ))}
          </div>
          <Result big>{Number.isFinite(price) ? inr(price) : "₹ —"}</Result>
          {Number.isFinite(price) && (
            <div style={{ fontSize: 11.5, color: "#3F4A44", marginTop: 6 }}>
              {qtyLabel()} × ₹{rateN}/{unitName(F.rateUnits, ratePer)} = {inr(price)}
              {Math.round(price) !== price ? ` (round: ₹${Math.round(price)})` : ""}
            </div>
          )}
          {tab === "jod" && (
            <button type="button" disabled={!Number.isFinite(price)} onClick={() => { setList((l) => [...l, { text: `${qtyLabel()} @ ₹${rateN}/${unitName(F.rateUnits, ratePer)}`, price }]); setQty(""); }}
              style={{ marginTop: 10, width: "100%", border: "none", background: Number.isFinite(price) ? G : "#B9C7BE", color: "#fff", borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              ➕ Jod list me daalo
            </button>
          )}
        </>
      )}

      {tab === "jod" && list.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {list.map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "6px 0", borderBottom: "1px dashed #CFE0D5" }}>
              <span style={{ flex: 1, minWidth: 0 }}>{x.text}</span>
              <b>{inr(x.price)}</b>
              <button type="button" aria-label="hatao" onClick={() => setList((l) => l.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#B3261E", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
            </div>
          ))}
          <Result big>Total {inr(total)}{Math.round(total) !== total ? <span style={{ fontSize: 12, fontWeight: 700 }}> (round ₹{Math.round(total)})</span> : null}</Result>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
            <Num label="Customer ne diye (₹)" value={paid} onChange={setPaid} placeholder="jaise 500" />
            <button type="button" onClick={() => { setList([]); setPaid(""); }} style={{ border: "1.5px solid #B3261E", background: "#fff", color: "#B3261E", borderRadius: 9, padding: "10px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Saaf</button>
          </div>
          {Number.isFinite(paidN) && paid !== "" && (
            <Result>{paidN >= total ? `Wapas dein: ${inr(paidN - total)}` : `Abhi baaki: ${inr(total - paidN)}`}</Result>
          )}
        </div>
      )}

      {tab === "amt" && (
        <>
          {rateRow}
          <div style={{ marginTop: 8 }}>
            <Num label="Customer ke paise (₹)" value={amount} onChange={setAmount} placeholder="jaise 50" />
          </div>
          <Result big>{Number.isFinite(give) ? showQty(fam, give) : "—"}</Result>
          {Number.isFinite(give) && <div style={{ fontSize: 11.5, color: "#3F4A44", marginTop: 6 }}>₹{amtN} me, ₹{rateN}/{unitName(F.rateUnits, ratePer)} ke rate par.</div>}
        </>
      )}

      {tab === "per" && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <Pill on={pmode === "disc"} onClick={() => { setPmode("disc"); setA(""); setB(""); }}>Chhoot %</Pill>
            <Pill on={pmode === "gst"} onClick={() => { setPmode("gst"); setA(""); setB(""); }}>GST</Pill>
            <Pill on={pmode === "profit"} onClick={() => { setPmode("profit"); setA(""); setB(""); }}>Munafa</Pill>
          </div>
          {pmode === "disc" && (() => {
            const r = discount(num(a), num(b));
            return (<>
              <div style={{ display: "flex", gap: 8 }}><Num label="Price (₹)" value={a} onChange={setA} placeholder="jaise 500" /><Num label="Chhoot (%)" value={b} onChange={setB} placeholder="jaise 10" /></div>
              {r && <Result>Chhoot: {inr(r.saving)} · Dena hai: <span style={{ fontSize: 20 }}>{inr(r.final)}</span></Result>}
            </>);
          })()}
          {pmode === "gst" && (() => {
            const r = gstCalc(num(a), num(b), gmode);
            return (<>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <Pill on={gmode === "add"} onClick={() => setGmode("add")}>GST jodo</Pill>
                <Pill on={gmode === "remove"} onClick={() => setGmode("remove")}>GST nikalo</Pill>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Num label={gmode === "add" ? "Amount (GST ke bina)" : "Amount (GST ke saath)"} value={a} onChange={setA} placeholder="jaise 1000" />
                <Num label="GST (%)" value={b} onChange={setB} placeholder="5, 12, 18" />
              </div>
              {r && <Result>Base {inr(r.base)} + GST {inr(r.gst)} = <span style={{ fontSize: 20 }}>{inr(r.total)}</span></Result>}
            </>);
          })()}
          {pmode === "profit" && (() => {
            const r = profitCalc(num(a), num(b));
            return (<>
              <div style={{ display: "flex", gap: 8 }}><Num label="Kharid (₹)" value={a} onChange={setA} placeholder="jaise 200" /><Num label="Bech (₹)" value={b} onChange={setB} placeholder="jaise 240" /></div>
              {r && <Result>{r.profit >= 0 ? "Munafa" : "Nuksaan"} {inr(Math.abs(r.profit))} · kharid par {r.onCost}% · bech par {r.onSell}%</Result>}
            </>);
          })()}
        </>
      )}
    </div>
  );
}
