-- ============================================================
-- STORE BRANDING — Logo, custom tagline, timings
-- ============================================================
-- Ab dukaandar apni dukaan ka logo upload kar sakta hai, header
-- ke naam ke neeche apni khud ki custom line (tagline) likh sakta
-- hai (jaise "Sabse sasta kirana!"), aur apne khulne-band hone ke
-- timings customer ko dikha sakta hai.
--
-- Purane stores ke liye yeh saare columns null rahenge (koi break
-- nahi hota) — App.jsx mein fallback already handle kiya gaya hai
-- (logo na ho to purana icon dikhega, tagline na ho to address).
-- ============================================================

alter table stores add column if not exists logo_url text;
alter table stores add column if not exists tagline text;
alter table stores add column if not exists timings text;
