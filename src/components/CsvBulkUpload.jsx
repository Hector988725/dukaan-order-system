import React, { useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import { Upload, X, FileSpreadsheet, FileText, Download, Trash2, Plus, Camera, PenLine, Loader2 } from "lucide-react";
import { bulkImportProducts, uploadProductImage } from "../lib/api";

// ============================================================
// BULK UPLOAD — 3 tareeke se products add karne ka "chart":
//   1. CSV file (jaisa pehle tha — structured, columns fixed)
//   2. PDF (price-list/catalog scan) — text automatically nikalte hain
//      (best-effort, kyunki PDF ka format kuch bhi ho sakta hai — kirana
//      ho, hardware ho, kapde ki dukaan ho), phir ek editable chart mein
//      dikhate hain jahan dukaandar galtiyaan theek kar sake.
//   3. Bina file ke, seedha khaali chart se manually list banana.
// Teeno hi ek hi editable "chart" (preview/edit stage) par jaake milte
// hain — jahan har row ka naam/category/price/stock edit ho sakta hai
// aur ek photo bhi upload ki jaa sakti hai, phir sab ek saath import.
// ============================================================

function makeBlankRow() {
  return { product_name: "", category: "", variant_label: "", unit: "piece", price: "", stock: "", description: "", barcode: "", emoji: "", image_url: null };
}

// PDF ke text ko lines mein todkar, har line ke aakhir mein jo number
// dikhta hai use "price" maan lete hain aur baaki text ko "naam" —
// yeh koi bhi price-list/catalog PDF ke liye best-effort guess hai,
// isiliye result hamesha editable chart mein dikhta hai, seedha import
// nahi hota.
function linesToRows(lines) {
  const rows = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || line.length > 90) continue;
    const match = line.match(/(?:₹|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/-)?\s*$/i);
    if (!match) continue;
    const price = Number(match[1].replace(/,/g, ""));
    if (!price || price <= 0 || price > 10000000) continue;
    let name = line.slice(0, match.index).replace(/[-.:|•\s]+$/g, "").trim();
    if (!name || name.length < 2 || /^\d+$/.test(name)) continue;
    rows.push({ ...makeBlankRow(), product_name: name, price: String(price) });
  }
  return rows;
}

async function extractRowsFromPdf(file) {
  // Dynamic import — sirf tab load hota hai jab koi PDF upload karta
  // hai, taaki har user ke liye app ka normal load size na badhe.
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    // PDF text items line-by-line order guarantee nahi karte — same
    // y-position (approx) wale items ko ek line maan kar group karte
    // hain, phir x-position se left-to-right sort karte hain.
    const rowsByY = new Map();
    textContent.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (!rowsByY.has(y)) rowsByY.set(y, []);
      rowsByY.get(y).push(item);
    });
    const sortedY = Array.from(rowsByY.keys()).sort((a, b) => b - a); // PDF mein y upar se neeche ghatta hai
    sortedY.forEach((y) => {
      const items = rowsByY.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      const line = items.map((i) => i.str).join(" ");
      if (line.trim()) lines.push(line);
    });
  }
  return linesToRows(lines);
}

export default function CsvBulkUploadModal({ store, onClose, onDone }) {
  const [stage, setStage] = useState("upload"); // upload | parsing | edit | importing | done
  const [rows, setRows] = useState([]);
  const [fileError, setFileError] = useState("");
  const [importResults, setImportResults] = useState([]);
  const [uploadingPhotoIdx, setUploadingPhotoIdx] = useState(null);
  const csvRef = useRef(null);
  const pdfRef = useRef(null);
  const photoRef = useRef(null);
  const photoTargetIdx = useRef(null);

  // Har row ki validity live-check hoti hai jaise-jaise dukaandar chart
  // edit karta hai (koi "re-upload karo" step nahi — yahin theek karo).
  const rowErrors = useMemo(() => {
    const errors = {};
    rows.forEach((row, idx) => {
      const errs = [];
      if (!row.product_name?.trim()) errs.push("Naam khali hai");
      if (!row.category?.trim()) errs.push("Category khali hai");
      if (!row.price || isNaN(Number(row.price)) || Number(row.price) <= 0) errs.push("Price theek nahi hai");
      if (row.stock && isNaN(Number(row.stock))) errs.push("Stock theek nahi hai");
      if (errs.length > 0) errors[idx] = errs;
    });
    return errors;
  }, [rows]);
  const validRowCount = rows.length - Object.keys(rowErrors).length;

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        if (results.errors.length > 0) {
          setFileError("CSV padhne mein error aaya: " + results.errors[0].message);
          return;
        }
        const missingCols = ["product_name", "category", "price"].filter((c) => !results.meta.fields.includes(c));
        if (missingCols.length > 0) {
          setFileError(`Yeh columns CSV mein zaroori hain lekin mile nahi: ${missingCols.join(", ")}`);
          return;
        }
        setRows(results.data.map((r) => ({ ...makeBlankRow(), ...r })));
        setStage("edit");
      },
      error: (err) => setFileError("File padhi nahi ja saki: " + err.message),
    });
  };

  const handlePdfFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    setStage("parsing");
    try {
      const parsed = await extractRowsFromPdf(file);
      if (parsed.length === 0) {
        setFileError("PDF se koi item automatically nahi mila — ho sakta hai format alag ho. Neeche manually add kar sakte hain.");
        setRows([makeBlankRow()]);
      } else {
        setRows(parsed);
      }
      setStage("edit");
    } catch (err) {
      setFileError("PDF padhi nahi ja saki: " + err.message);
      setStage("upload");
    }
  };

  const startManual = () => {
    setRows([makeBlankRow(), makeBlankRow(), makeBlankRow()]);
    setStage("edit");
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () => setRows((prev) => [...prev, makeBlankRow()]);

  const openPhotoPicker = (idx) => {
    photoTargetIdx.current = idx;
    photoRef.current?.click();
  };
  const handlePhotoChosen = async (e) => {
    const file = e.target.files?.[0];
    const idx = photoTargetIdx.current;
    e.target.value = ""; // taaki same file dobara select karne par bhi onChange chale
    if (!file || idx == null) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo 2MB se chhoti honi chahiye."); return; }
    setUploadingPhotoIdx(idx);
    try {
      const url = await uploadProductImage(file, store.id);
      updateRow(idx, "image_url", url);
    } catch (err) {
      alert(err.message || "Photo upload nahi ho paayi.");
    } finally {
      setUploadingPhotoIdx(null);
    }
  };

  const handleImport = async () => {
    setStage("importing");
    const validRows = rows.filter((_, idx) => !rowErrors[idx]);
    try {
      const results = await bulkImportProducts(store.id, validRows);
      setImportResults(results);
      setStage("done");
    } catch (e) {
      setFileError("Import mein error aaya: " + e.message);
      setStage("edit");
    }
  };

  const downloadSampleCsv = () => {
    const sample = "product_name,category,variant_label,unit,price,stock,description,barcode,emoji\nChini,Staples,1kg Packet,kg,45,50,,890123456789,🍚\nAata,Staples,5kg Bag,kg,220,30,,,🌾\n";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sample_products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={overlayStyle}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "560px", maxHeight: "88vh", overflowY: "auto", padding: "20px", margin: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontWeight: 700, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FileSpreadsheet size={17} /> Bulk mein Products Add Karein</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" }}><X size={18} /></button>
        </div>

        <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChosen} style={{ display: "none" }} />

        {stage === "upload" && (
          <>
            <div style={{ fontSize: "12px", color: "#8B8576", marginBottom: "14px", lineHeight: 1.5 }}>
              Kirana, hardware, mobile, kapde — kisi bhi tarah ki dukaan ke liye: apna PDF price-list/catalog upload karein (items automatically nikal ke ek editable chart mein aa jaayenge), ya CSV file use karein, ya seedha chart mein type karke list banayein. Photo har item ke liye chart mein hi upload ho jaati hai.
            </div>

            <button onClick={() => pdfRef.current?.click()} style={{ width: "100%", padding: "22px 0", border: "2px dashed #D4A24C", borderRadius: "10px", background: "#F7F5F0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <FileText size={22} color="#D4A24C" />
              <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#5C5747" }}>PDF Catalog/Price-list Upload Karein</span>
              <span style={{ fontSize: "10.5px", color: "#8B8576" }}>Items automatically chart mein nikal aayenge</span>
            </button>
            <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePdfFile} style={{ display: "none" }} />

            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <button onClick={() => csvRef.current?.click()} className="ddemo-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "white", border: "1px solid #E3DECF", color: "#5C5747", borderRadius: "8px", padding: "10px 8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                <Upload size={13} /> CSV Upload
              </button>
              <button onClick={startManual} className="ddemo-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "white", border: "1px solid #E3DECF", color: "#5C5747", borderRadius: "8px", padding: "10px 8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                <PenLine size={13} /> Manually Likhein
              </button>
            </div>
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvFile} style={{ display: "none" }} />

            <button onClick={downloadSampleCsv} style={{ display: "flex", alignItems: "center", gap: "5px", background: "transparent", border: "none", color: "#8B8576", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
              <Download size={12} /> Sample CSV Dekhein
            </button>

            {fileError && <div style={{ color: "#B3261E", fontSize: "12px", marginTop: "10px" }}>{fileError}</div>}
          </>
        )}

        {stage === "parsing" && (
          <div style={{ textAlign: "center", padding: "50px 0" }}>
            <Loader2 size={26} color="#D4A24C" style={{ animation: "ddemoSpin 1s linear infinite" }} />
            <div style={{ fontSize: "13px", color: "#5C5747", marginTop: "12px" }}>PDF se items nikaale ja rahe hain...</div>
          </div>
        )}

        {stage === "edit" && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1, background: "#E7F0EA", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#1B4332" }}>{validRowCount}</div>
                <div style={{ fontSize: "10.5px", color: "#5C5747" }}>Ready Items</div>
              </div>
              <div style={{ flex: 1, background: Object.keys(rowErrors).length > 0 ? "#FDECEA" : "#F0EEE6", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: Object.keys(rowErrors).length > 0 ? "#B3261E" : "#8B8576" }}>{Object.keys(rowErrors).length}</div>
                <div style={{ fontSize: "10.5px", color: "#5C5747" }}>Adhoore (theek karein)</div>
              </div>
            </div>

            {fileError && <div style={{ color: "#B3261E", fontSize: "11.5px", marginBottom: "10px", background: "#FDECEA", borderRadius: "7px", padding: "8px 10px" }}>{fileError}</div>}

            <div style={{ fontSize: "10.5px", color: "#8B8576", marginBottom: "8px" }}>Har item ka naam, category, price, stock check/edit karein — photo bhi yahin daal sakte hain.</div>

            <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {rows.map((row, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: rowErrors[idx] ? "#FDECEA" : "#F7F5F0", border: "1px solid #E3DECF", borderRadius: "9px", padding: "8px" }}>
                  <button
                    onClick={() => openPhotoPicker(idx)}
                    disabled={uploadingPhotoIdx === idx}
                    title="Photo upload karein"
                    style={{ width: 44, height: 44, borderRadius: "8px", border: "1px dashed #D4A24C", background: row.image_url ? "transparent" : "white", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 0 }}
                  >
                    {uploadingPhotoIdx === idx
                      ? <Loader2 size={16} color="#D4A24C" style={{ animation: "ddemoSpin 1s linear infinite" }} />
                      : row.image_url
                        ? <img src={row.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <Camera size={16} color="#D4A24C" />
                    }
                  </button>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
                    <input value={row.product_name} onChange={(e) => updateRow(idx, "product_name", e.target.value)} placeholder="Product ka naam" style={{ ...cellInputStyle, fontWeight: 700 }} />
                    <div style={{ display: "flex", gap: "5px" }}>
                      <input value={row.category} onChange={(e) => updateRow(idx, "category", e.target.value)} placeholder="Category (jaise Hardware)" style={{ ...cellInputStyle, flex: 1.4 }} />
                      <input value={row.price} onChange={(e) => updateRow(idx, "price", e.target.value)} placeholder="₹" type="text" inputMode="decimal" style={{ ...cellInputStyle, width: "58px" }} />
                      <input value={row.stock} onChange={(e) => updateRow(idx, "stock", e.target.value)} placeholder="Stock" type="text" inputMode="numeric" style={{ ...cellInputStyle, width: "52px" }} />
                    </div>
                    {rowErrors[idx] && <div style={{ fontSize: "10px", color: "#B3261E", fontWeight: 600 }}>⚠️ {rowErrors[idx].join(", ")}</div>}
                  </div>

                  <button onClick={() => removeRow(idx)} title="Yeh item hatayein" style={{ border: "none", background: "transparent", color: "#B3261E", cursor: "pointer", padding: "4px", flexShrink: 0 }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            <button onClick={addRow} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", background: "white", border: "1px dashed #D4A24C", borderRadius: "8px", padding: "9px 0", fontSize: "12px", fontWeight: 700, color: "#5C5747", cursor: "pointer", marginTop: "8px" }}>
              <Plus size={14} /> Naya Item Add Karein
            </button>

            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <button onClick={() => { setStage("upload"); setRows([]); setFileError(""); }} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Wapas Jaayein</button>
              <button disabled={validRowCount === 0} onClick={handleImport} className="ddemo-btn" style={{ flex: 1.5, background: validRowCount > 0 ? "#1B4332" : "#D8D2BF", color: "white", border: "none", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, cursor: validRowCount > 0 ? "pointer" : "not-allowed" }}>
                {validRowCount} Products Import Karein
              </button>
            </div>
          </>
        )}

        {stage === "importing" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: "13px", color: "#5C5747" }}>Import ho raha hai, please wait...</div>
          </div>
        )}

        {stage === "done" && (
          <>
            <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: "15px" }}>
                {importResults.filter((r) => r.success).length} products import ho gaye
              </div>
              {importResults.filter((r) => !r.success).length > 0 && (
                <div style={{ fontSize: "12px", color: "#B3261E", marginTop: "4px" }}>
                  {importResults.filter((r) => !r.success).length} fail hue
                </div>
              )}
            </div>
            {importResults.filter((r) => !r.success).length > 0 && (
              <div style={{ maxHeight: "150px", overflowY: "auto", background: "#FDECEA", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>
                {importResults.filter((r) => !r.success).map((r, i) => (
                  <div key={i} style={{ fontSize: "11px", color: "#B3261E", marginBottom: "4px" }}>{r.product}: {r.error}</div>
                ))}
              </div>
            )}
            <button onClick={onDone} className="ddemo-btn" style={{ width: "100%", background: "#1B4332", color: "white", border: "none", borderRadius: "9px", padding: "11px 0", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              Theek Hai
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 };
const cellInputStyle = { border: "1px solid #E3DECF", borderRadius: "6px", padding: "6px 8px", fontSize: "12px", fontFamily: "inherit", outline: "none", background: "white", width: "100%" };
