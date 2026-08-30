-- ============================================================
-- DISTRIBUTOR / REFERRAL / RECURRING COMMISSION ARCHITECTURE
-- ============================================================
-- FOUNDATION ONLY (per requirement) — no UI required yet. This adds
-- the DB layer so shop attribution, commission, and nominee/death
-- transfer can be switched on later without re-architecting stores
-- or subscription data. 100% additive — does not modify existing
-- tables' data, only adds two nullable columns to `stores`.
--
-- Run this AFTER schema.sql and all existing migration_*.sql files.
-- ============================================================

-- ---- 1. DISTRIBUTORS ----
create table distributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- login account, nullable until onboarded
  name text not null,
  phone text not null,
  referral_code text unique not null, -- e.g. 'DIST-27' — used in signup link ?ref=DIST-27
  commission_rate numeric not null default 50, -- CURRENT ₹/month per active-paid shop; admin-editable, NOT retroactive
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_distributors_referral_code on distributors(referral_code);
create index idx_distributors_user on distributors(user_id);

-- Full audit trail of every rate change (admin visibility, does not affect
-- already-calculated commission_ledger rows since those snapshot their own rate)
create table distributor_commission_rate_history (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributors(id) on delete cascade not null,
  rate numeric not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz, -- null = currently in effect
  changed_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index idx_rate_history_distributor on distributor_commission_rate_history(distributor_id);

-- ---- 2. STORE ATTRIBUTION (permanent, admin-changeable only) ----
alter table stores add column referred_by_distributor_id uuid references distributors(id);
alter table stores add column referral_locked_at timestamptz; -- set once, on first attribution

create index idx_stores_referred_by on stores(referred_by_distributor_id);

-- Every attribution change (should be rare — admin-only, always with a reason)
create table store_referral_attribution_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  old_distributor_id uuid references distributors(id),
  new_distributor_id uuid references distributors(id),
  changed_by uuid references auth.users(id),
  reason text,
  created_at timestamptz default now()
);

-- ---- 3. COMMISSION LEDGER (one row per shop per billing month) ----
create table commission_ledger (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributors(id) not null, -- ORIGINAL lineage — never changes, even after nominee transfer
  payee_type text not null default 'distributor' check (payee_type in ('distributor', 'nominee')),
  payee_id uuid not null, -- distributors.id OR distributor_nominees.id, depending on payee_type
  store_id uuid references stores(id) not null,
  billing_month date not null, -- always the 1st of the month, e.g. 2026-08-01
  shop_subscription_amount numeric not null, -- ₹99 / ₹199 / future plan, whatever the shop actually paid that month
  commission_rate_applied numeric not null, -- SNAPSHOT of distributor's rate at calculation time
  commission_amount numeric not null,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Paid', 'Reversed')),
  reversed_reason text,
  payout_date timestamptz,
  created_at timestamptz default now(),
  unique (store_id, billing_month) -- prevents double-counting; makes the monthly job idempotent
);
create index idx_commission_distributor on commission_ledger(distributor_id);
create index idx_commission_payee on commission_ledger(payee_id, payee_type);
create index idx_commission_billing_month on commission_ledger(billing_month);
create index idx_commission_status on commission_ledger(status);

-- ---- 4. NOMINEE SYSTEM ----
create table distributor_nominees (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributors(id) on delete cascade not null,
  name text not null,
  relationship text not null,
  phone text not null,
  verification_status text not null default 'Pending' check (verification_status in ('Pending', 'Verified', 'Rejected')),
  verification_documents jsonb, -- storage refs/URLs to ID + relationship proof
  is_current boolean not null default true, -- only one current nominee per distributor
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_nominees_distributor on distributor_nominees(distributor_id);
-- Only one CURRENT nominee per distributor at a time
create unique index idx_one_current_nominee on distributor_nominees(distributor_id) where is_current = true;

-- Nominee changes are audited, never a silent overwrite
create table nominee_change_audit (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributors(id) on delete cascade not null,
  old_nominee_id uuid references distributor_nominees(id),
  new_nominee_id uuid references distributor_nominees(id),
  changed_by uuid references auth.users(id), -- admin who approved the change
  reason text,
  created_at timestamptz default now()
);

-- ---- 5. DEATH CLAIM / COMMISSION TRANSFER ----
create table distributor_death_claims (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributors(id) not null,
  nominee_id uuid references distributor_nominees(id) not null,
  claim_status text not null default 'Pending' check (claim_status in ('Pending', 'UnderReview', 'Approved', 'Rejected')),
  supporting_documents jsonb, -- death certificate, nominee ID proof, etc.
  admin_verified_by uuid references auth.users(id),
  verified_at timestamptz,
  commission_transfer_effective_date date, -- billing_month from which payee switches to nominee
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_death_claims_distributor on distributor_death_claims(distributor_id);

-- ============================================================
-- ROW LEVEL SECURITY — RPC-gated (same pattern as super_admins / customers)
-- ============================================================
alter table distributors enable row level security;
alter table distributor_commission_rate_history enable row level security;
alter table store_referral_attribution_audit enable row level security;
alter table commission_ledger enable row level security;
alter table distributor_nominees enable row level security;
alter table nominee_change_audit enable row level security;
alter table distributor_death_claims enable row level security;

-- No direct table access for anyone — everything goes through the
-- security-definer RPCs below, so a distributor can never query another
-- distributor's rows, and a shop owner can never see who gets paid on their store.
revoke all on distributors, distributor_commission_rate_history, store_referral_attribution_audit,
  commission_ledger, distributor_nominees, nominee_change_audit, distributor_death_claims
  from anon, authenticated;

-- ---- Distributor's own dashboard (self-service) ----
create or replace function get_distributor_dashboard()
returns table (
  distributor_id uuid, name text, referral_code text, commission_rate numeric,
  total_referred bigint, active_paid bigint, inactive bigint,
  this_month_commission numeric, lifetime_commission numeric, pending_payout numeric
) as $$
declare
  v_distributor_id uuid;
begin
  select id into v_distributor_id from distributors where user_id = auth.uid();
  if v_distributor_id is null then
    raise exception 'Not a registered distributor';
  end if;

  return query
  select
    d.id, d.name, d.referral_code, d.commission_rate,
    (select count(*) from stores s where s.referred_by_distributor_id = d.id),
    (select count(*) from stores s where s.referred_by_distributor_id = d.id
       and s.is_active = true and s.subscription_expires_at > now()),
    (select count(*) from stores s where s.referred_by_distributor_id = d.id
       and (s.is_active = false or s.subscription_expires_at <= now())),
    coalesce((select sum(cl.commission_amount) from commission_ledger cl
       where cl.distributor_id = d.id and cl.billing_month = date_trunc('month', now())::date
       and cl.status != 'Reversed'), 0),
    coalesce((select sum(cl.commission_amount) from commission_ledger cl
       where cl.distributor_id = d.id and cl.status = 'Paid'), 0),
    coalesce((select sum(cl.commission_amount) from commission_ledger cl
       where cl.distributor_id = d.id and cl.status in ('Pending', 'Approved')), 0)
  from distributors d where d.id = v_distributor_id;
end;
$$ language plpgsql security definer;

grant execute on function get_distributor_dashboard() to authenticated;

-- ---- Admin: every distributor, same aggregates (super_admins only) ----
create or replace function get_admin_distributor_overview()
returns table (
  distributor_id uuid, name text, phone text, referral_code text, commission_rate numeric, status text,
  total_referred bigint, active_paid bigint, inactive bigint,
  this_month_commission numeric, lifetime_commission numeric, pending_payout numeric
) as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    d.id, d.name, d.phone, d.referral_code, d.commission_rate, d.status,
    (select count(*) from stores s where s.referred_by_distributor_id = d.id),
    (select count(*) from stores s where s.referred_by_distributor_id = d.id and s.is_active = true and s.subscription_expires_at > now()),
    (select count(*) from stores s where s.referred_by_distributor_id = d.id and (s.is_active = false or s.subscription_expires_at <= now())),
    coalesce((select sum(cl.commission_amount) from commission_ledger cl where cl.distributor_id = d.id and cl.billing_month = date_trunc('month', now())::date and cl.status != 'Reversed'), 0),
    coalesce((select sum(cl.commission_amount) from commission_ledger cl where cl.distributor_id = d.id and cl.status = 'Paid'), 0),
    coalesce((select sum(cl.commission_amount) from commission_ledger cl where cl.distributor_id = d.id and cl.status in ('Pending', 'Approved')), 0)
  from distributors d;
end;
$$ language plpgsql security definer;

grant execute on function get_admin_distributor_overview() to authenticated;

-- ---- Admin: attribute a shop to a distributor (used at signup, or manual override) ----
create or replace function admin_reassign_store_distributor(p_store_id uuid, p_new_distributor_id uuid, p_reason text)
returns void as $$
declare
  v_old uuid;
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  select referred_by_distributor_id into v_old from stores where id = p_store_id;
  update stores set referred_by_distributor_id = p_new_distributor_id,
    referral_locked_at = coalesce(referral_locked_at, now())
    where id = p_store_id;
  insert into store_referral_attribution_audit (store_id, old_distributor_id, new_distributor_id, changed_by, reason)
    values (p_store_id, v_old, p_new_distributor_id, auth.uid(), p_reason);
end;
$$ language plpgsql security definer;

grant execute on function admin_reassign_store_distributor(uuid, uuid, text) to authenticated;

-- ---- Signup-time attribution by referral code (called from createStore() flow) ----
create or replace function attribute_store_to_referral_code(p_store_id uuid, p_referral_code text)
returns void as $$
declare
  v_distributor_id uuid;
begin
  select id into v_distributor_id from distributors where referral_code = p_referral_code and status = 'active';
  if v_distributor_id is null then
    return; -- invalid/unknown code — silently no-op, signup should never fail because of a bad ref code
  end if;
  update stores set referred_by_distributor_id = v_distributor_id, referral_locked_at = now()
    where id = p_store_id and referred_by_distributor_id is null; -- never overwrite an existing attribution
end;
$$ language plpgsql security definer;

grant execute on function attribute_store_to_referral_code(uuid, text) to anon, authenticated;

-- ---- Monthly commission run (admin-triggered, or scheduled via pg_cron) ----
-- One row per active-paid referred shop for the given month. Redirects to the
-- verified nominee automatically if an approved death claim's transfer date
-- has passed — otherwise pays the distributor. Idempotent via the unique
-- (store_id, billing_month) constraint.
create or replace function run_monthly_commission_calculation(p_billing_month date default date_trunc('month', now())::date)
returns int as $$
declare
  v_count int := 0;
  r record;
  v_payee_type text;
  v_payee_id uuid;
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;

  for r in
    select s.id as store_id, s.referred_by_distributor_id as distributor_id,
           s.subscription_base_price as subscription_amount, d.commission_rate
    from stores s
    join distributors d on d.id = s.referred_by_distributor_id
    where s.is_active = true and s.subscription_expires_at > now()
      and d.status = 'active'
  loop
    v_payee_type := 'distributor';
    v_payee_id := r.distributor_id;

    select 'nominee', dc.nominee_id into v_payee_type, v_payee_id
      from distributor_death_claims dc
      where dc.distributor_id = r.distributor_id
        and dc.claim_status = 'Approved'
        and dc.commission_transfer_effective_date <= p_billing_month
      order by dc.commission_transfer_effective_date desc
      limit 1;

    insert into commission_ledger (distributor_id, payee_type, payee_id, store_id, billing_month,
      shop_subscription_amount, commission_rate_applied, commission_amount, status)
    values (r.distributor_id, v_payee_type, v_payee_id, r.store_id, p_billing_month,
      r.subscription_amount, r.commission_rate, r.commission_rate, 'Pending')
    on conflict (store_id, billing_month) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql security definer;

grant execute on function run_monthly_commission_calculation(date) to authenticated;

-- ---- Auto-reverse THIS MONTH's pending commission if a shop deactivates mid-cycle ----
-- Already-Approved/Paid rows are untouched — only a still-Pending row for the
-- current billing month gets reversed, matching "commission automatically
-- rukna chahiye jab shop inactive ho jaaye".
create or replace function reverse_commission_on_deactivation()
returns trigger as $$
begin
  if new.is_active = false and old.is_active = true then
    update commission_ledger
      set status = 'Reversed', reversed_reason = 'Shop deactivated mid-cycle'
      where store_id = new.id
        and billing_month = date_trunc('month', now())::date
        and status = 'Pending';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_reverse_commission_on_deactivation
  after update of is_active on stores
  for each row execute function reverse_commission_on_deactivation();

-- ============================================================
-- INTEGRATION NOTES (for whoever wires up the app code)
-- ============================================================
-- 1. Signup flow: if the signup URL/form carries a ?ref=CODE, after
--    createStore() succeeds, call attribute_store_to_referral_code(newStoreId, code).
--    This keeps attribution logic server-side and idempotent — it will never
--    overwrite an existing attribution.
--
-- 2. This migration does NOT build any UI (per requirement #12). The two
--    RPCs (get_distributor_dashboard / get_admin_distributor_overview)
--    are ready to be called from a future DistributorDashboard.jsx and a
--    "Distributors" tab in SuperAdminApp.jsx whenever you're ready to build
--    the screens — no further schema changes needed for that.
--
-- 3. run_monthly_commission_calculation() needs to actually run every
--    month. Options: (a) pg_cron scheduled job inside Supabase (if enabled
--    on your plan), or (b) a manual "Run This Month's Commission" button in
--    the future Admin > Distributors tab that calls the RPC. Start with (b)
--    — simpler, and lets admin review before it becomes routine.
-- ============================================================
