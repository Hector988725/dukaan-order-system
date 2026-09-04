-- ============================================================
-- LIMITED-TIME DEAL / OFFER
-- ============================================================
-- Koi "expiry cron job" nahi chahiye — expiry automatic hai kyunki
-- "kya offer abhi active hai" hamesha LIVE calculate hota hai
-- (offer_starts_at <= now() <= offer_ends_at). Jab time nikal jaata
-- hai, system khud-ba-khud normal price dikhane lagta hai, kyunki
-- kuch overwrite hi nahi hota tha.
alter table variants add column if not exists offer_enabled boolean not null default false;
alter table variants add column if not exists offer_price numeric;
alter table variants add column if not exists offer_starts_at timestamptz;
alter table variants add column if not exists offer_ends_at timestamptz;
