-- ============================================================
-- FOUNDING MEMBER PRICING + STORAGE QUOTA
-- ============================================================
-- Founding member: pehli 20 dukaano ko ₹99/month hamesha ke liye
-- lock milega, uske baad naye signups ka base price ₹199/month
-- hoga. Yeh flag signup ke waqt hi permanently set ho jaata hai
-- (createStore() mein) — baad mein badalta nahi.
--
-- Storage quota: har dukaan ko fixed 5GB image-storage space
-- milta hai (product photos + logo). Isse zyada upload karne par
-- rok di jaati hai, taaki platform ka storage cost unpredictable
-- na badhe. Zaroorat ho to future mein extra space alag se becha
-- ja sakta hai.
-- ============================================================

alter table stores add column if not exists founding_member boolean default false;
alter table stores add column if not exists subscription_base_price integer default 199;
alter table stores add column if not exists storage_used_bytes bigint default 0;
alter table stores add column if not exists storage_limit_bytes bigint default 5368709120; -- 5 GB
alter table stores add column if not exists is_test_store boolean default false;

-- ============================================================
-- IMPORTANT: Apni khud ki test/personal dukaano ko founding-member
-- ke 20-slot count se poori tarah exclude karte hain — `is_test_store`
-- true set karne se yeh (a) founding-member badge nahi paatin, aur
-- (b) createStore() ki count query mein bhi shamil nahi hoti, isliye
-- asli 20 slots sirf real customers ke liye reserved rehte hain.
--
-- Neeche apne test-store slugs daal kar yeh query chalayein (naya
-- test store banayein to yahan slug add karke dobara chalayein):
update stores
set is_test_store = true, founding_member = false, subscription_base_price = null
where slug in ('hectorai', 'sharma-medical-store');

