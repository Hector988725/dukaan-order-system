import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ScanLine, AlertCircle, Loader2 } from "lucide-react";
import { findVariantByBarcode } from "../lib/api";

// ============================================================
// BARCODE SCANNER — asli camera se scan karta hai (ZXing library,
// browser ke camera API se), koi fake/simulated scan nahi. Agar
// browser camera access na de (permission deny, ya HTTP par — camera
// sirf HTTPS/localhost par kaam karta hai), clear error dikhata hai.
// ============================================================
export default function BarcodeScannerModal({ store, onClose, onFound, onNotFound }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | looking-up | error
  const [error, setError] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        if (cancelled) return;
        if (result) {
          const barcode = result.getText();
          setStatus("looking-up");
          reader.reset(); // camera band karo, ek hi scan process karna hai
          try {
            const match = await findVariantByBarcode(store.id, barcode);
            if (match) {
              onFound(match, barcode);
            } else {
              onNotFound(barcode);
            }
          } catch (e) {
            setError("Barcode check karte waqt error aaya: " + e.message);
            setStatus("error");
          }
        }
        // NotFoundException har frame par aata hai jab tak barcode na
        // mile — yeh normal hai, error nahi dikhate is case mein.
      })
      .then(() => { if (!cancelled) setStatus("scanning"); })
      .catch((e) => {
        if (cancelled) return;
        // Camera access na milna sabse common issue hai (permission deny,
        // ya HTTP par site khuli hai — camera sirf HTTPS/localhost pe chalta hai).
        setError(
          e.name === "NotAllowedError"
            ? "Camera permission nahi mili. Browser settings mein camera access allow karein."
            : "Camera start nahi ho paaya: " + e.message
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
      try { reader.reset(); } catch {}
    };
  }, [store.id, onFound, onNotFound]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", zIndex: 70 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px" }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <ScanLine size={17} /> Barcode Scan Karein
        </div>
        <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {error ? (
          <div style={{ color: "white", textAlign: "center", padding: "0 30px" }}>
            <AlertCircle size={30} style={{ marginBottom: "10px" }} />
            <div style={{ fontSize: "13px", lineHeight: 1.6 }}>{error}</div>
          </div>
        ) : (
          <>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
            {status === "starting" && (
              <div style={{ position: "absolute", color: "white", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <Loader2 size={24} className="spin" />
                <div style={{ fontSize: "12.5px" }}>Camera shuru ho raha hai...</div>
              </div>
            )}
            {status === "scanning" && (
              <div style={{ position: "absolute", width: "70%", maxWidth: "320px", aspectRatio: "2/1", border: "3px solid #D4A24C", borderRadius: "12px", boxShadow: "0 0 0 2000px rgba(0,0,0,0.5)" }} />
            )}
            {status === "looking-up" && (
              <div style={{ position: "absolute", color: "white", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <Loader2 size={24} className="spin" />
                <div style={{ fontSize: "12.5px" }}>Product dhoonda ja raha hai...</div>
              </div>
            )}
          </>
        )}
      </div>

      {status === "scanning" && (
        <div style={{ padding: "16px 18px", textAlign: "center", color: "rgba(255,255,255,0.75)", fontSize: "12px" }}>
          Barcode ko frame ke andar rakhein
        </div>
      )}
    </div>
  );
}
