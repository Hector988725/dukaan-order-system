-- ============================================================
-- PRODUCT FEATURED FLAG — Dukaandar kuch products ko bada/
-- highlight karke dikha sake (jaise ek "special" item)
-- ============================================================
-- sort_order already schema mein maujood hai (products table),
-- isliye reordering ke liye naya column nahi chahiye — sirf
-- featured flag naya hai.

alter table products add column if not exists featured boolean default false;
