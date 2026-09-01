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

// Barcode lookup ko hamesha ke liye hang hone se bachane ke liye —
// agar network slow/atka hua ho, 10 second baad khud-ba-khud error
// dikha dete hain (bina isके, screen hamesha "dhoonda ja raha hai"
// pe atki reh sakti thi, koi cancel option ke bina).
function withTimeout(promise, ms, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
  ]);
}

export default function BarcodeScannerModal({ store, onClose, onFound, onNotFound }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const processingRef = useRef(false); // ek se zyada baar ek hi scan process na ho, isliye guard
  const [status, setStatus] = useState("starting"); // starting | scanning | looking-up | error
  const [error, setError] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        if (cancelled) return;
        // Camera continuously frames decode karta hai — ek successful scan
        // ke baad bhi 1-2 aur frames wahi barcode bhej sakte hain isse
        // pehle ki reader.reset() actually camera band kare. Yeh guard
        // ensure karta hai ki hum sirf PEHLI baar hi process karein.
        if (result && !processingRef.current) {
          processingRef.current = true;
          const barcode = result.getText();
          setStatus("looking-up");
          try { reader.reset(); } catch {} // camera band karo

          try {
            const match = await withTimeout(
              findVariantByBarcode(store.id, barcode),
              10000,
              "Product dhoondhne mein bahut zyada time lag raha hai. Internet check karke dobara try karein."
            );
            if (cancelled) return;
            if (match) {
              onFound(match, barcode);
            } else {
              onNotFound(barcode);
            }
          } catch (e) {
            if (cancelled) return;
            setError(e.message || "Barcode check karte waqt error aaya.");
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

  const handleRetry = () => {
    processingRef.current = false;
    setError("");
    setStatus("starting");
    // Poora component remount karke camera dobara shuru karne ka
    // sabse reliable tarika — parent se onClose+reopen bhi kaam karta,
    // lekin yahan seedha reload jaisa restart karte hain.
    window.location.reload();
  };

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
            <div style={{ fontSize: "13px", lineHeight: 1.6, marginBottom: "16px" }}>{error}</div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: "9px", padding: "10px 20px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
              Band Karein
            </button>
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
              <div style={{ position: "absolute", color: "white", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <Loader2 size={24} className="spin" />
                <div style={{ fontSize: "12.5px" }}>Product dhoonda ja raha hai...</div>
                {/* Ab yahan bhi cancel option hamesha available hai — pehle
                    is state mein user permanently atka reh sakta tha. */}
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.4)", color: "white", borderRadius: "8px", padding: "7px 16px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>
                  Cancel Karein
                </button>
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
