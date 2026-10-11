-- ============================================================
-- DISTRIBUTOR — Tiered Commission + Special Distributor + Nominee
-- ============================================================
-- Run this AFTER: migration_distributor_referral.sql,
-- migration_distributor_admin_rpcs.sql, migration_distributor_auto_commission.sql
--
-- Kuch bhi purana TOOTTA nahi — sab additive hai:
-- - distributors mein ek naya column (distributor_type)
-- - ek naya table (commission_tiers, admin-editable)
-- - run_monthly_commission_calculation_internal() REWRITE hota hai
--   (tier-aware), lekin same naam/signature — existing "Run Commission"
--   button aur pg_cron schedule bina kisi change ke kaam karte rahenge
-- - Nominee registration/death-claim RPCs pehli baar ban rahe hain
--   (tables pehle se thi, RPC kabhi nahi bani thi)
-- ============================================================

-- ---- 1. Normal vs Special distributor ----
alter table distributors add column if not exists distributor_type text not null default 'normal'
  check (distributor_type in ('normal', 'special'));
-- 'special' distributors ka commission_rate field hi seedha unka
-- fixed rate hai (tier table ignore hoti hai unke liye).
-- 'normal' distributors ke liye commission_rate field ab sirf legacy/
-- reference hai — asal rate hamesha commission_tiers se live-calculate
-- hoti hai unki us mahine ki active-paid shop count ke hisaab se.

-- ---- 2. Commission tiers (admin-editable, hardcoded NAHI) ----
create table if not exists commission_tiers (
  id uuid primary key default gen_random_uuid(),
  min_shops int not null,
  max_shops int, -- null = koi upper limit nahi (jaise 1000+)
  rate numeric not null, -- ₹/shop/month, poori count par flat apply hota hai
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into commission_tiers (min_shops, max_shops, rate)
select * from (values
  (0, 9, 0),
  (10, 49, 30),
  (50, 199, 45),
  (200, 499, 60),
  (500, 999, 80),
  (1000, null, 100)
) as t(min_shops, max_shops, rate)
where not exists (select 1 from commission_tiers);

-- Kisi bhi active-paid-shop-count ke liye lagu rate dhoondhta hai.
-- "1000+ ho to SAARI shops ₹100" — yeh isi tarah kaam karta hai kyunki
-- pura count ek hi tier match karta hai, phir wahi rate un SAARI shops
-- par (ek-ek row mein) apply hoti hai neeche wale calculation mein.
create or replace function get_tier_rate(p_shop_count int)
returns numeric as $$
declare
  v_rate numeric;
begin
  select rate into v_rate from commission_tiers
  where p_shop_count >= min_shops and (max_shops is null or p_shop_count <= max_shops)
  order by min_shops desc
  limit 1;
  return coalesce(v_rate, 0);
end;
$$ language plpgsql stable;

-- ---- 3. Monthly calculation — REWRITE, tier + special dono aware ----
-- Har distributor ke liye: pehle is mahine ki active-paid shop count
-- nikalta hai, phir ek hi rate decide karta hai (special → unka fixed
-- rate; normal → tier lookup usi count se), phir har shop ke liye
-- ek-ek ledger row banata hai (poore distributor ki total earning =
-- count × rate, jaisa examples mein bataya gaya tha).
create or replace function run_monthly_commission_calculation_internal(p_billing_month date default date_trunc('month', now())::date)
returns int as $$
declare
  v_count int := 0;
  d record;
  s record;
  v_rate numeric;
  v_active_count int;
  v_payee_type text;
  v_payee_id uuid;
begin
  for d in select * from distributors where status = 'active'
  loop
    select count(*) into v_active_count
    from stores s2
    where s2.referred_by_distributor_id = d.id and s2.is_active = true and s2.subscription_expires_at > now();

    if v_active_count = 0 then
      continue;
    end if;

    v_rate := case when d.distributor_type = 'special' then d.commission_rate else get_tier_rate(v_active_count) end;

    if v_rate = 0 then
      continue; -- 1-9 shops = ₹0, koi ledger row banane ki zaroorat nahi
    end if;

    v_payee_type := 'distributor';
    v_payee_id := d.id;
    -- Verified nominee ho to seedha unhi ko payee banate hain (jaisa
    -- pehle se tha — is behavior mein koi badlaav nahi)
    select 'nominee', dn.id into v_payee_type, v_payee_id
    from distributor_nominees dn
    where dn.distributor_id = d.id and dn.verification_status = 'Verified'
    limit 1;

    for s in
      select st.id as store_id, st.subscription_base_price as subscription_amount
      from stores st
      where st.referred_by_distributor_id = d.id and st.is_active = true and st.subscription_expires_at > now()
    loop
      insert into commission_ledger (distributor_id, payee_type, payee_id, store_id, billing_month,
        shop_subscription_amount, commission_rate_applied, commission_amount, status)
      values (d.id, v_payee_type, v_payee_id, s.store_id, p_billing_month,
        s.subscription_amount, v_rate, v_rate, 'Pending')
      on conflict (store_id, billing_month) do nothing;

      if found then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$ language plpgsql security definer;
-- (admin-facing wrapper run_monthly_commission_calculation() ismein
--  already delegate karta hai — usme kuch badalne ki zaroorat nahi)

-- ---- 4. Admin: distributor ko Special mark karna + custom rate set karna ----
create or replace function admin_set_distributor_type(p_distributor_id uuid, p_type text, p_custom_rate numeric default null)
returns void as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  if p_type not in ('normal', 'special') then
    raise exception 'Invalid distributor_type';
  end if;
  if p_type = 'special' and p_custom_rate is null then
    raise exception 'Special distributor ke liye commission rate zaroori hai';
  end if;

  update distributors
  set distributor_type = p_type,
      commission_rate = case when p_type = 'special' then p_custom_rate else commission_rate end,
      updated_at = now()
  where id = p_distributor_id;

  if p_type = 'special' then
    insert into distributor_commission_rate_history (distributor_id, rate, changed_by)
    values (p_distributor_id, p_custom_rate, auth.uid());
  end if;
end;
$$ language plpgsql security definer;

grant execute on function admin_set_distributor_type(uuid, text, numeric) to authenticated;

-- ---- 5. Admin: commission tiers dekhna/edit karna (configurable, hardcoded nahi) ----
create or replace function get_commission_tiers()
returns setof commission_tiers as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  return query select * from commission_tiers order by min_shops;
end;
$$ language plpgsql security definer;

grant execute on function get_commission_tiers() to authenticated;

create or replace function admin_update_commission_tier(p_tier_id uuid, p_rate numeric)
returns void as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  update commission_tiers set rate = p_rate, updated_at = now() where id = p_tier_id;
end;
$$ language plpgsql security definer;

grant execute on function admin_update_commission_tier(uuid, numeric) to authenticated;

-- ---- 6. Nominee registration — sirf 500+ ACTIVE-PAID (abhi ki count,
--         milestone hamesha ke liye lock nahi hota) walon ke liye ----
create or replace function register_distributor_nominee(p_distributor_id uuid, p_name text, p_relationship text, p_phone text)
returns uuid as $$
declare
  v_active_count int;
  v_is_admin boolean;
  v_is_self boolean;
  v_new_id uuid;
  v_old_id uuid;
begin
  v_is_admin := exists (select 1 from super_admins where email = auth.email());
  v_is_self := exists (select 1 from distributors where id = p_distributor_id and user_id = auth.uid());
  if not v_is_admin and not v_is_self then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_active_count
  from stores where referred_by_distributor_id = p_distributor_id and is_active = true and subscription_expires_at > now();

  if v_active_count < 500 then
    raise exception 'Nominee sirf 500+ active-paid shops wale distributors register kar sakte hain (abhi: %)', v_active_count;
  end if;

  select id into v_old_id from distributor_nominees where distributor_id = p_distributor_id and is_current = true;
  update distributor_nominees set is_current = false, updated_at = now() where distributor_id = p_distributor_id and is_current = true;

  insert into distributor_nominees (distributor_id, name, relationship, phone, verification_status, is_current)
  values (p_distributor_id, p_name, p_relationship, p_phone, 'Pending', true)
  returning id into v_new_id;

  insert into nominee_change_audit (distributor_id, old_nominee_id, new_nominee_id, changed_by, reason)
  values (p_distributor_id, v_old_id, v_new_id, auth.uid(), 'Registered via ' || case when v_is_admin then 'admin' else 'self-service' end);

  return v_new_id;
end;
$$ language plpgsql security definer;

grant execute on function register_distributor_nominee(uuid, text, text, text) to authenticated;

-- Admin nominee ko verify/reject kare (KYC jaisa — relationship/ID proof check)
create or replace function admin_verify_nominee(p_nominee_id uuid, p_approve boolean)
returns void as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  update distributor_nominees
  set verification_status = case when p_approve then 'Verified' else 'Rejected' end, updated_at = now()
  where id = p_nominee_id;
end;
$$ language plpgsql security definer;

grant execute on function admin_verify_nominee(uuid, boolean) to authenticated;

-- ---- 7. Death claim — submit + admin verify ----
create or replace function submit_death_claim(p_distributor_id uuid, p_nominee_id uuid, p_documents jsonb default null)
returns uuid as $$
declare
  v_id uuid;
begin
  insert into distributor_death_claims (distributor_id, nominee_id, supporting_documents, claim_status)
  values (p_distributor_id, p_nominee_id, p_documents, 'Pending')
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

grant execute on function submit_death_claim(uuid, uuid, jsonb) to authenticated;

create or replace function admin_verify_death_claim(p_claim_id uuid, p_approve boolean, p_effective_date date default date_trunc('month', now())::date)
returns void as $$
declare
  v_distributor_id uuid;
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;

  update distributor_death_claims
  set claim_status = case when p_approve then 'Approved' else 'Rejected' end,
      admin_verified_by = auth.uid(), verified_at = now(),
      commission_transfer_effective_date = case when p_approve then p_effective_date else null end,
      updated_at = now()
  where id = p_claim_id
  returning distributor_id into v_distributor_id;

  -- Approve hote hi distributor ko 'inactive' mark karte hain — naye
  -- signups ab unse attribute nahi honge, lekin existing shops ka
  -- commission (verified nominee ke through) chalta rehta hai.
  if p_approve then
    update distributors set status = 'inactive', updated_at = now() where id = v_distributor_id;
  end if;
end;
$$ language plpgsql security definer;

grant execute on function admin_verify_death_claim(uuid, boolean, date) to authenticated;

-- ---- 8. Dashboards — distributor_type, current tier-rate, nominee
--         eligibility bhi dikhayein ----
-- Return type badal raha hai (naye columns add hue hain), isliye pehle
-- purana function DROP karna zaroori hai — "create or replace" is case
-- mein kaam nahi karta.
drop function if exists get_distributor_dashboard();
drop function if exists get_admin_distributor_overview();

create or replace function get_distributor_dashboard()
returns table (
  distributor_id uuid, name text, referral_code text, commission_rate numeric,
  distributor_type text, current_rate numeric, nominee_eligible boolean,
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
    d.distributor_type,
    case when d.distributor_type = 'special' then d.commission_rate
         else get_tier_rate((select count(*)::int from stores s where s.referred_by_distributor_id = d.id and s.is_active = true and s.subscription_expires_at > now())) end,
    (select count(*) from stores s where s.referred_by_distributor_id = d.id and s.is_active = true and s.subscription_expires_at > now()) >= 500,
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

create or replace function get_admin_distributor_overview()
returns table (
  distributor_id uuid, name text, phone text, referral_code text, commission_rate numeric, status text,
  distributor_type text, current_rate numeric, nominee_eligible boolean,
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
    d.distributor_type,
    case when d.distributor_type = 'special' then d.commission_rate
         else get_tier_rate((select count(*)::int from stores s where s.referred_by_distributor_id = d.id and s.is_active = true and s.subscription_expires_at > now())) end,
    (select count(*) from stores s where s.referred_by_distributor_id = d.id and s.is_active = true and s.subscription_expires_at > now()) >= 500,
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
