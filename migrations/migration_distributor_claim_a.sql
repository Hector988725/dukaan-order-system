-- ============================================================
-- DISTRIBUTOR CLAIM CODE — MIGRATION A (additive; purana claim abhi chalta rahega)
-- Problem: referral code public hai (link me), aur wahi code claim ke kaam
-- aata tha -> koi bhi unclaimed distributor account le sakta tha.
-- Fix: alag private claim code, hash me store, ek baar chalne wala, 7 din
-- me expire, 5 galat try par 15 minute lock.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.distributors
  add column if not exists claim_code_hash       text,
  add column if not exists claim_code_expires_at timestamptz,
  add column if not exists claim_failed_attempts int not null default 0,
  add column if not exists claim_locked_until    timestamptz;

-- 1) Super Admin: naya claim code banao. p_release_login = true ho to
--    purana linked login bhi hata deta hai (jaise Nishant ka case).
create or replace function public.admin_generate_claim_code(p_distributor_id uuid, p_release_login boolean default false)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 0/O, 1/I/L jaise confusing nahi
  b bytea;
  v_code text := '';
  i int;
begin
  if not _is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select user_id into v_user from distributors where id = p_distributor_id for update;
  if not found then
    raise exception 'Distributor not found';
  end if;
  if v_user is not null and not coalesce(p_release_login, false) then
    raise exception 'ALREADY_CLAIMED: is distributor ka login pehle se juda hai. Naya code chahiye to "Login Reset" ke saath banayein.';
  end if;

  b := gen_random_bytes(8);
  for i in 0..7 loop
    v_code := v_code || substr(v_chars, (get_byte(b, i) % length(v_chars)) + 1, 1);
  end loop;

  update distributors
     set user_id = case when coalesce(p_release_login, false) then null else user_id end,
         claim_code_hash = crypt(v_code, gen_salt('bf', 8)),
         claim_code_expires_at = now() + interval '7 days',
         claim_failed_attempts = 0,
         claim_locked_until = null,
         updated_at = now()
   where id = p_distributor_id;

  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end $$;

revoke execute on function public.admin_generate_claim_code(uuid, boolean) from public, anon;
grant  execute on function public.admin_generate_claim_code(uuid, boolean) to authenticated;

-- 2) Super Admin: har distributor ka claim status (code kabhi wapas nahi aata)
create or replace function public.admin_distributor_claim_status()
returns table(distributor_id uuid, claimed boolean, claim_code_active boolean, claim_expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not _is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select d.id, d.user_id is not null,
           (d.claim_code_hash is not null and d.claim_code_expires_at > now()),
           d.claim_code_expires_at
    from distributors d;
end $$;

revoke execute on function public.admin_distributor_claim_status() from public, anon;
grant  execute on function public.admin_distributor_claim_status() to authenticated;

-- 3) Distributor: referral code + claim code se apna login jodo.
--    Status text me lautata hai ('ok' | 'invalid' | 'locked' | 'already_linked')
--    taaki galat try ki ginti save rahe (exception se rollback ho jata).
create or replace function public.claim_distributor_account(p_referral_code text, p_claim_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  d distributors%rowtype;
  v_code text := upper(regexp_replace(coalesce(p_claim_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_fails int;
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into d from distributors where referral_code = upper(trim(coalesce(p_referral_code, ''))) for update;
  if not found or length(v_code) <> 8 then
    perform crypt('x', gen_salt('bf', 8));      -- same time lagao
    return 'invalid';
  end if;

  if d.user_id = auth.uid() then
    return 'ok';                                 -- pehle se isi account se juda hai
  end if;

  if d.claim_locked_until is not null and d.claim_locked_until > now() then
    return 'locked';
  end if;

  if d.user_id is not null or d.claim_code_hash is null or d.claim_code_expires_at is null or d.claim_code_expires_at <= now() then
    perform crypt('x', gen_salt('bf', 8));
    return 'invalid';
  end if;

  if exists (select 1 from distributors o where o.user_id = auth.uid() and o.id <> d.id) then
    return 'already_linked';
  end if;

  if crypt(v_code, d.claim_code_hash) = d.claim_code_hash then
    update distributors
       set user_id = auth.uid(), claim_code_hash = null, claim_code_expires_at = null,
           claim_failed_attempts = 0, claim_locked_until = null, updated_at = now()
     where id = d.id;
    return 'ok';
  end if;

  v_fails := d.claim_failed_attempts + 1;
  if v_fails >= 5 then
    update distributors set claim_failed_attempts = 0, claim_locked_until = now() + interval '15 minutes' where id = d.id;
    return 'locked';
  end if;
  update distributors set claim_failed_attempts = v_fails where id = d.id;
  return 'invalid';
end $$;

revoke execute on function public.claim_distributor_account(text, text) from public, anon;
grant  execute on function public.claim_distributor_account(text, text) to authenticated;
