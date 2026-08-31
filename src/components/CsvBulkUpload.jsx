import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Download } from "lucide-react";
import { bulkImportProducts } from "../lib/api";

// ============================================================
// CSV BULK UPLOAD — upload → preview → validate → confirm → import
// ============================================================
const REQUIRED_COLUMNS = ["product_name", "category", "price"];
const ALL_COLUMNS = ["product_name", "category", "variant_label", "unit", "price", "stock", "description", "barcode", "emoji"];

export default function CsvBulkUploadModal({ store, onClose, onDone }) {
  const [stage, setStage] = useState("upload"); // upload | preview | importing | done
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [fileError, setFileError] = useState("");
  const [importResults, setImportResults] = useState([]);
  const fileRef = useRef(null);

  const handleFile = (e) => {
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
        const missingCols = REQUIRED_COLUMNS.filter((c) => !results.meta.fields.includes(c));
        if (missingCols.length > 0) {
          setFileError(`Yeh columns CSV mein zaroori hain lekin mile nahi: ${missingCols.join(", ")}`);
          return;
        }
        const parsedRows = results.data;
        const errors = {};
        parsedRows.forEach((row, idx) => {
          const rowErrs = [];
          if (!row.product_name?.trim()) rowErrs.push("Product name khali hai");
          if (!row.category?.trim()) rowErrs.push("Category khali hai");
          if (!row.price || isNaN(Number(row.price)) || Number(row.price) <= 0) rowErrs.push("Price valid number nahi hai");
          if (row.stock && isNaN(Number(row.stock))) rowErrs.push("Stock valid number nahi hai");
          if (rowErrs.length > 0) errors[idx] = rowErrs;
        });
        setRows(parsedRows);
        setRowErrors(errors);
        setStage("preview");
      },
      error: (err) => setFileError("File padhi nahi ja saki: " + err.message),
    });
  };

  const validRowCount = rows.length - Object.keys(rowErrors).length;

  const handleImport = async () => {
    setStage("importing");
    // Sirf valid rows import karte hain — error wali rows skip ho jaati hain.
    const validRows = rows.filter((_, idx) => !rowErrors[idx]);
    try {
      const results = await bulkImportProducts(store.id, validRows);
      setImportResults(results);
      setStage("done");
    } catch (e) {
      setFileError("Import mein error aaya: " + e.message);
      setStage("preview");
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
          <div style={{ fontWeight: 700, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FileSpreadsheet size={17} /> CSV se Bulk Upload</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" }}><X size={18} /></button>
        </div>

        {stage === "upload" && (
          <>
            <div style={{ fontSize: "12px", color: "#8B8576", marginBottom: "10px", lineHeight: 1.5 }}>
              CSV file mein yeh columns hone chahiye: <b>product_name, category, price</b> zaroori hain; variant_label, unit, stock, description, barcode, emoji optional hain. Same product_name+category wali rows automatically ek hi product ke alag-alag variants ban jaayengi.
            </div>
            <button onClick={downloadSampleCsv} className="ddemo-btn" style={{ display: "flex", alignItems: "center", gap: "6px", background: "white", border: "1px solid #E3DECF", color: "#5C5747", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", marginBottom: "14px" }}>
              <Download size={13} /> Sample CSV Download Karein
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "30px 0", border: "2px dashed #D4A24C", borderRadius: "10px", background: "#F7F5F0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <Upload size={24} color="#D4A24C" />
              <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#5C5747" }}>CSV File Chunein</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
            {fileError && <div style={{ color: "#B3261E", fontSize: "12px", marginTop: "10px" }}>{fileError}</div>}
          </>
        )}

        {stage === "preview" && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1, background: "#E7F0EA", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#1B4332" }}>{validRowCount}</div>
                <div style={{ fontSize: "10.5px", color: "#5C5747" }}>Valid Rows</div>
              </div>
              <div style={{ flex: 1, background: Object.keys(rowErrors).length > 0 ? "#FDECEA" : "#F0EEE6", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: Object.keys(rowErrors).length > 0 ? "#B3261E" : "#8B8576" }}>{Object.keys(rowErrors).length}</div>
                <div style={{ fontSize: "10.5px", color: "#5C5747" }}>Error Rows (Skip Hongi)</div>
              </div>
            </div>

            <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid #E3DECF", borderRadius: "8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                <thead style={{ position: "sticky", top: 0, background: "#F7F5F0" }}>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Price</th>
                    <th style={thStyle}>Stock</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} style={{ background: rowErrors[idx] ? "#FDECEA" : "white" }}>
                      <td style={tdStyle}>{idx + 1}</td>
                      <td style={tdStyle}>{row.product_name}</td>
                      <td style={tdStyle}>{row.category}</td>
                      <td style={tdStyle}>₹{row.price}</td>
                      <td style={tdStyle}>{row.stock || 0}</td>
                      <td style={tdStyle}>
                        {rowErrors[idx]
                          ? <span style={{ color: "#B3261E", fontWeight: 700 }} title={rowErrors[idx].join(", ")}>⚠️ {rowErrors[idx][0]}</span>
                          : <span style={{ color: "#1B4332", fontWeight: 700 }}>✓ OK</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fileError && <div style={{ color: "#B3261E", fontSize: "12px", marginTop: "10px" }}>{fileError}</div>}

            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <button onClick={() => { setStage("upload"); setRows([]); setRowErrors({}); }} style={{ flex: 1, background: "white", border: "1px solid #E3DECF", borderRadius: "9px", padding: "10px 0", fontSize: "12.5px", fontWeight: 700, color: "#5C5747", cursor: "pointer" }}>Wapas Jaayein</button>
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
const thStyle = { padding: "7px 8px", textAlign: "left", fontWeight: 700, color: "#5C5747", borderBottom: "1px solid #E3DECF" };
const tdStyle = { padding: "6px 8px", borderBottom: "1px solid #F0EEE6" };
