-- ============================================================
-- SECURITY PHASE 1B — STEP 1 (database only)
-- ============================================================
-- Subscription ko server-side lock karna. Ek hi plan: ₹199/month.
-- (Special price ₹49 sirf super admin kisi shop ke liye set kar sakta hai.)
--
-- Kya badalta hai:
--  1. stores ke protected columns (is_active, subscription_*, plan_tier,
--     next_billing_date, autopay_enabled, razorpay_subscription_id,
--     founding_*, is_test_store, storage_*, referral, user_id) ko client
--     (anon/authenticated) change NAHI kar sakta. INSERT par bhi safe
--     defaults force hote hain (koi apne aap active/founding nahi ban sakta).
--  2. subscription_payments table: har one-time order server banata hai,
--     amount server tay karta hai, verify hone par hi subscription badhti hai.
--  3. activate_subscription_payment(): sirf service_role (edge function).
--  4. apply_subscription_webhook_update(): sirf service_role + status
--     whitelist + expiry sirf aage badhti hai.
--  5. payment_logs: open insert policy band. razorpay_webhook_events: RLS ON.
--  6. public_stores view se next_billing_date / autopay_enabled hataye.
--  7. check_and_apply_founding_expiry: no-op (founding system hat gaya).
--  8. Pricing: sabka base price ₹199, founding flag off (expiry/access
--     ko HAATH NAHI lagaya jaata).
--  9. Super admin RPCs: activate / extend / deactivate / set price,
--     aur orders + payment_logs read policy.
-- 10. refresh_storage_usage(): storage_used_bytes ab server calculate karta hai.
--
-- Additive: koi table/column/data delete nahi. Idempotent (dobara run safe).
-- IMPORTANT: Is migration ke baad purana frontend payment-activation
-- (activateSubscription) kaam NAHI karega — yehi hole band karna tha.
-- Step 2 (edge functions) + Step 3 (frontend) deploy hone tak koi naya
-- payment activate nahi hoga. Existing active/free shops ko koi asar nahi.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Price helper (ek hi jagah): months ke hisaab se server-side amount.
--    Discount % wahi hai jo UI mein tha (3m ~8%, 6m ~16%, 12m ~25%).
--    ₹199 -> 1:199, 3:549, 6:999, 12:1799     ₹49 -> 49, 135, 246, 443
-- ------------------------------------------------------------
create or replace function compute_subscription_amount(p_base integer, p_months integer)
returns integer language plpgsql immutable
as $$
declare disc numeric;
begin
  if p_base is null or p_base <= 0 then raise exception 'invalid base price'; end if;
  disc := case p_months
            when 1  then 0
            when 3  then 48 / 597.0
            when 6  then 195 / 1194.0
            when 12 then 589 / 2388.0
            else null end;
  if disc is null then raise exception 'invalid months (allowed: 1, 3, 6, 12)'; end if;
  return round(p_base * p_months * (1 - disc))::integer;
end $$;
grant execute on function compute_subscription_amount(integer, integer) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 1. subscription_payments (one-time orders ka server-side record)
-- ------------------------------------------------------------
create table if not exists subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  months integer not null check (months in (1, 3, 6, 12)),
  base_price integer not null,
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_subscription_payments_store on subscription_payments(store_id);
alter table subscription_payments enable row level security;
drop policy if exists "Owner reads own subscription payments" on subscription_payments;
create policy "Owner reads own subscription payments" on subscription_payments for select
  using (exists (select 1 from stores s where s.id = subscription_payments.store_id and s.user_id = auth.uid()));
drop policy if exists "Super admin reads subscription payments" on subscription_payments;
create policy "Super admin reads subscription payments" on subscription_payments for select
  using (_is_super_admin());
revoke all on subscription_payments from anon, authenticated;
grant select on subscription_payments to authenticated;

-- ------------------------------------------------------------
-- 2. stores: protected columns guard (INSERT + UPDATE)
--    Sirf anon/authenticated (browser) rokta hai. Security-definer
--    functions (owner = postgres) aur service_role (edge) allowed hain.
-- ------------------------------------------------------------
create or replace function guard_store_protected_columns()
returns trigger language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Naya store hamesha "inactive, unpaid, normal" shuru hota hai —
    -- client kuch bhi bheje, yeh values force hoti hain.
    new.is_active := false;
    new.subscription_expires_at := null;
    new.subscription_status := 'expired';
    new.next_billing_date := null;
    new.autopay_enabled := false;
    new.razorpay_subscription_id := null;
    new.plan_tier := 'basic';
    new.subscription_base_price := 199;
    new.founding_member := false;
    new.founding_number := null;
    new.founding_terms_accepted_at := null;
    new.is_test_store := false;
    new.storage_used_bytes := 0;
    new.storage_limit_bytes := 5368709120;
    new.referred_by_distributor_id := null;
    new.referral_locked_at := null;
    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.is_active is distinct from old.is_active
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     or new.subscription_status is distinct from old.subscription_status
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_base_price is distinct from old.subscription_base_price
     or new.plan_tier is distinct from old.plan_tier
     or new.next_billing_date is distinct from old.next_billing_date
     or new.autopay_enabled is distinct from old.autopay_enabled
     or new.razorpay_subscription_id is distinct from old.razorpay_subscription_id
     or new.founding_member is distinct from old.founding_member
     or new.founding_number is distinct from old.founding_number
     or new.founding_terms_accepted_at is distinct from old.founding_terms_accepted_at
     or new.is_test_store is distinct from old.is_test_store
     or new.storage_used_bytes is distinct from old.storage_used_bytes
     or new.storage_limit_bytes is distinct from old.storage_limit_bytes
     or new.referred_by_distributor_id is distinct from old.referred_by_distributor_id
     or new.referral_locked_at is distinct from old.referral_locked_at
  then
    raise exception 'protected store column: subscription/billing/ownership fields client se change nahi ho sakte'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_store_protected_columns on stores;
create trigger trg_guard_store_protected_columns
  before insert or update on stores
  for each row execute function guard_store_protected_columns();

-- ------------------------------------------------------------
-- 3. Payment activation (SIRF service_role / edge function)
-- ------------------------------------------------------------
create or replace function activate_subscription_payment(
  p_order_id text, p_payment_id text, p_amount_paise integer)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_pay subscription_payments%rowtype;
  v_base timestamptz;
  v_new timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_pay from subscription_payments where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'unknown order'; end if;

  if v_pay.status = 'paid' then
    -- idempotent: wahi payment dobara aaye to kuch nahi badhta
    if v_pay.razorpay_payment_id is distinct from p_payment_id then
      raise exception 'order already paid with a different payment';
    end if;
    select subscription_expires_at into v_new from stores where id = v_pay.store_id;
    return v_new;
  end if;

  if p_amount_paise is distinct from v_pay.amount_paise then
    raise exception 'amount mismatch';
  end if;

  update subscription_payments
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
   where id = v_pay.id;

  select greatest(coalesce(subscription_expires_at, now()), now()) into v_base
    from stores where id = v_pay.store_id for update;
  v_new := v_base + make_interval(months => v_pay.months);

  update stores
     set is_active = true,
         subscription_expires_at = v_new,
         subscription_status = 'active',
         subscription_base_price = v_pay.base_price
   where id = v_pay.store_id;
  return v_new;
end $$;
revoke all on function activate_subscription_payment(text, text, integer) from public, anon, authenticated;
grant execute on function activate_subscription_payment(text, text, integer) to service_role;

-- ------------------------------------------------------------
-- 4. Webhook RPC (signature wahi, ab sirf service_role)
--    - sirf known statuses
--    - expiry sirf aage badhti hai (purani event se peeche nahi jaati)
--    - is_active sirf tab true hota hai jab asli expiry aayi ho (charged)
--    - baaki statuses (pending/halted/cancelled/completed) access turant
--      nahi kaat'te; paid period expiry tak chalta hai
-- ------------------------------------------------------------
create or replace function apply_subscription_webhook_update(
  p_razorpay_subscription_id text, p_status text,
  p_next_billing_date timestamptz, p_subscription_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('active', 'payment_pending', 'payment_failed', 'cancelled', 'expired') then
    raise exception 'invalid status %', p_status;
  end if;

  update stores
     set subscription_status = p_status,
         autopay_enabled = case when p_status in ('cancelled', 'expired') then false else autopay_enabled end,
         is_active = case when p_status = 'active' and p_subscription_expires_at is not null
                          then true else is_active end,
         next_billing_date = coalesce(p_next_billing_date, next_billing_date),
         subscription_expires_at = case
           when p_subscription_expires_at is null then subscription_expires_at
           else greatest(coalesce(subscription_expires_at, p_subscription_expires_at), p_subscription_expires_at) end
   where razorpay_subscription_id = p_razorpay_subscription_id;
end $$;
revoke all on function apply_subscription_webhook_update(text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function apply_subscription_webhook_update(text, text, timestamptz, timestamptz) to service_role;

-- ------------------------------------------------------------
-- 5. payment_logs + razorpay_webhook_events
-- ------------------------------------------------------------
do $$
declare r record;
begin
  if to_regclass('public.payment_logs') is not null then
    execute 'alter table payment_logs enable row level security';
    for r in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'payment_logs' and cmd = 'INSERT' loop
      execute format('drop policy %I on payment_logs', r.policyname);
    end loop;
    execute 'drop policy if exists "Super admin reads payment logs" on payment_logs';
    execute 'create policy "Super admin reads payment logs" on payment_logs for select using (_is_super_admin())';
  end if;

  if to_regclass('public.razorpay_webhook_events') is not null then
    execute 'alter table razorpay_webhook_events enable row level security';
    if not exists (select 1 from razorpay_webhook_events where razorpay_event_id is not null
                   group by razorpay_event_id having count(*) > 1) then
      execute 'create unique index if not exists uq_razorpay_webhook_event_id on razorpay_webhook_events(razorpay_event_id)';
    else
      raise notice 'razorpay_webhook_events mein duplicate event ids hain — unique index skip hua';
    end if;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. public_stores: billing columns bhi hide
-- ------------------------------------------------------------
do $$
declare cols text;
begin
  select string_agg(format('s.%I', column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'stores'
    and column_name not in ('user_id', 'is_active', 'is_test_store', 'founding_terms_accepted_at')
    and column_name not like 'razorpay%' and column_name not like 'subscription%'
    and column_name not like 'plan\_%' and column_name not like 'storage\_%'
    and column_name not like 'referr%' and column_name not like 'distributor%'
    and column_name not like 'next\_billing%' and column_name not like 'autopay%';
  execute 'drop view if exists public_stores';
  execute 'create view public_stores as select ' || cols ||
          ', (s.is_active is not false and s.subscription_expires_at is not null and s.subscription_expires_at > now()) as is_active' ||
          ', coalesce(s.user_id = auth.uid(), false) as is_owner from stores s';
end $$;
grant select on public_stores to anon, authenticated;

-- ------------------------------------------------------------
-- 7. Founding expiry: ab koi founding system nahi -> no-op
--    (purane cached frontend isko call karte rehte hain, error na aaye)
-- ------------------------------------------------------------
create or replace function check_and_apply_founding_expiry(p_user_id uuid)
returns void language plpgsql
as $$ begin return; end $$;

-- ------------------------------------------------------------
-- 8. Pricing normalisation: ek plan ₹199. Expiry/access ko haath nahi.
-- ------------------------------------------------------------
do $$
declare n_price int; n_found int;
begin
  update stores set subscription_base_price = 199
   where subscription_base_price is distinct from 199 and coalesce(is_test_store, false) = false;
  get diagnostics n_price = row_count;
  update stores set founding_member = false where founding_member = true;
  get diagnostics n_found = row_count;
  raise notice 'base price ₹199 set on % stores; founding flag hataya on % stores', n_price, n_found;
end $$;

-- ------------------------------------------------------------
-- 9. Super admin RPCs (stores par direct write policy ki zaroorat nahi)
-- ------------------------------------------------------------
create or replace function admin_extend_subscription(p_store_id uuid, p_months integer)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare v_new timestamptz;
begin
  if not _is_super_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_months is null or p_months < 1 or p_months > 36 then raise exception 'months 1-36 hona chahiye'; end if;
  update stores
     set is_active = true,
         subscription_expires_at = greatest(coalesce(subscription_expires_at, now()), now()) + make_interval(months => p_months)
   where id = p_store_id
   returning subscription_expires_at into v_new;
  if v_new is null then raise exception 'store not found'; end if;
  return v_new;
end $$;

create or replace function admin_activate_store(p_store_id uuid)
returns timestamptz language sql security definer set search_path = public
as $$ select admin_extend_subscription(p_store_id, 1) $$;

create or replace function admin_deactivate_store(p_store_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not _is_super_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  update stores set is_active = false where id = p_store_id;
end $$;

-- Special price (jaise 3 shops ke liye ₹49). Sirf allowed prices — har price
-- ke liye Razorpay plan alag banta hai.
create or replace function admin_set_store_price(p_store_id uuid, p_price integer)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not _is_super_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_price not in (49, 199) then raise exception 'allowed prices: 49, 199'; end if;
  update stores set subscription_base_price = p_price where id = p_store_id;
end $$;

revoke all on function admin_extend_subscription(uuid, integer), admin_activate_store(uuid),
  admin_deactivate_store(uuid), admin_set_store_price(uuid, integer) from public, anon;
grant execute on function admin_extend_subscription(uuid, integer), admin_activate_store(uuid),
  admin_deactivate_store(uuid), admin_set_store_price(uuid, integer) to authenticated;

-- Super admin dashboard ko orders/revenue dikhne ke liye (read-only)
drop policy if exists "Super admin can view all orders" on orders;
create policy "Super admin can view all orders" on orders for select using (_is_super_admin());

-- ------------------------------------------------------------
-- 10. Storage usage: server calculate karta hai (client likh nahi sakta)
-- ------------------------------------------------------------
create or replace function refresh_storage_usage(p_store_id uuid)
returns bigint language plpgsql security definer set search_path = public
as $$
declare v_used bigint;
begin
  if not (exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) or _is_super_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select coalesce(sum(nullif(o.metadata ->> 'size', '')::bigint), 0) into v_used
    from storage.objects o
   where o.bucket_id = 'product-images'
     and (storage.foldername(o.name))[1] = p_store_id::text;
  update stores set storage_used_bytes = v_used where id = p_store_id;
  return v_used;
end $$;
revoke all on function refresh_storage_usage(uuid) from public, anon;
grant execute on function refresh_storage_usage(uuid) to authenticated;
