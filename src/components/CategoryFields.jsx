import React, { useState, useEffect } from "react";
import { fetchBusinessCategories, fetchCatalogBrands } from "../lib/api";

// ============================================================
// CATEGORY / SUB-CATEGORY / BRAND / AGE GROUP fields
// ============================================================
// Sirf un business types ke liye jinke liye Super Admin ne category
// preset banaye hain (Cosmetics, Gift/Toys). Baaki sab types (kirana,
// hardware, ...) ke liye yeh component sirf `fallback` (purana free-text
// Category field) dikhata hai — unka form bilkul pehle jaisa rehta hai.
// ============================================================

export const AGE_GROUPS = ["All ages", "0-2 years", "3-5 years", "6-8 years", "9-12 years", "12+ years"];

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #E3DECF", borderRadius: "7px", padding: "9px 10px", fontSize: "12.5px", background: "white", fontFamily: "inherit" };
const labelStyle = { fontSize: "11px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" };

export default function CategoryFields({
  businessType, category, setCategory, subCategory, setSubCategory,
  brand, setBrand, ageGroup, setAgeGroup, onActive, fallback,
}) {
  const [tree, setTree] = useState(null);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    let live = true;
    fetchBusinessCategories(businessType)
      .then((t) => {
        if (!live) return;
        setTree(t);
        if (onActive) onActive(t.length > 0);
        if (t.length > 0) fetchCatalogBrands(businessType).then((b) => live && setBrands(b)).catch(() => {});
      })
      .catch(() => { if (live) { setTree([]); if (onActive) onActive(false); } });
    return () => { live = false; };
    // eslint-disable-next-line
  }, [businessType]);

  if (!tree || tree.length === 0) return fallback;

  const mains = tree.map((t) => t.name);
  const mainOptions = category && !mains.includes(category) ? [category, ...mains] : mains;
  const subs = tree.find((t) => t.name === category)?.subs || [];
  const subOptions = subCategory && !subs.includes(subCategory) ? [subCategory, ...subs] : subs;
  const ageOptions = ageGroup && !AGE_GROUPS.includes(ageGroup) ? [ageGroup, ...AGE_GROUPS] : AGE_GROUPS;

  return (
    <>
      <div>
        <div style={labelStyle}>Category</div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(""); }} style={inputStyle}>
          <option value="">— Category chunein —</option>
          {mainOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {subOptions.length > 0 && (
        <div>
          <div style={labelStyle}>Sub-category</div>
          <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} style={inputStyle}>
            <option value="">— Sub-category chunein (optional) —</option>
            {subOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      <div>
        <div style={labelStyle}>Brand (optional)</div>
        <input list={`brands-${businessType}`} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="jaise Lakme, Funskool — ya khud likhein" style={inputStyle} />
        <datalist id={`brands-${businessType}`}>{brands.map((b) => <option key={b} value={b} />)}</datalist>
      </div>
      {businessType === "giftstoy" && (
        <div>
          <div style={labelStyle}>Age Group (optional)</div>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} style={inputStyle}>
            <option value="">— Age group —</option>
            {ageOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
