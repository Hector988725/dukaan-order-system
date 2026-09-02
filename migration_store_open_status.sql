-- ============================================================
-- STORE OPEN/CLOSED STATUS — customer ko turant pata chale dukaan
-- abhi order lene ke liye khuli hai ya nahi.
-- ============================================================
-- Yeh `is_active` (subscription status) se bilkul alag hai — is_open
-- sirf dukaandar khud toggle karta hai (jaise "lunch break", "aaj band
-- hai"), subscription se koi lena-dena nahi.
alter table stores add column if not exists is_open boolean not null default true;
