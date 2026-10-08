-- ============================================================
-- STEP 5A — AutoPay hardening
--  1) Remaining days nahi jaate: charge hone par expiry = (abhi ya purani expiry,
--     jo aage ho) + 1 mahina. Pehle Razorpay ki current_end se set hota tha, isliye
--     plan khatam hone se pehle AutoPay lene par bache hue din kat jaate the.
--  2) Out-of-order events: purana event naye status ko wapas nahi badal sakta
--     (jaise late "authenticated" ya "pending" ek "active" ko palat de).
--  3) Ek hi payment do baar expiry nahi badha sakta (payment_id unique).
-- Purana apply_subscription_webhook_update NAHI badla (rollback ke liye safe).
-- Pehle yeh SQL chalao, uske baad edge function "razorpay-webhook" deploy karo.
-- Undo: webhook ko purane version par deploy karo; yeh function/table padhe rehne do.
-- ============================================================
alter table public.stores add column if not exists subscription_event_at timestamptz;

create table if not exists public.subscription_charges (
  payment_id   text primary key,
  store_id     uuid not null references public.stores(id) on delete cascade,
  amount_paise integer,
  created_at   timestamptz not null default now()
);
alter table public.subscription_charges enable row level security;
revoke all on table public.subscription_charges from public, anon, authenticated;

create or replace function public.apply_subscription_event(
  p_razorpay_subscription_id text,
  p_status text,
  p_event_at timestamptz default null,
  p_next_billing_date timestamptz default null,
  p_payment_id text default null,
  p_amount_paise integer default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  st stores%rowtype;
  v_stale boolean := false;
  v_new_exp timestamptz;
  v_result text := 'applied';
  v_inserted int;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('active', 'payment_pending', 'payment_failed', 'cancelled', 'expired') then
    raise exception 'invalid status %', p_status;
  end if;

  select * into st from stores where razorpay_subscription_id = p_razorpay_subscription_id for update;
  if not found then return 'no_store'; end if;

  v_stale := p_event_at is not null and st.subscription_event_at is not null and p_event_at < st.subscription_event_at;

  -- (A) Asli paisa kata (payment_id diya hai): expiry badhao — event purana ho tab bhi, par ek payment sirf ek baar
  if p_payment_id is not null then
    insert into subscription_charges (payment_id, store_id, amount_paise)
    values (p_payment_id, st.id, p_amount_paise)
    on conflict (payment_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      v_new_exp := greatest(coalesce(st.subscription_expires_at, now()), now()) + interval '1 month';
      update stores set subscription_expires_at = v_new_exp, is_active = true where id = st.id;
    else
      v_result := 'duplicate_charge';
    end if;
  end if;

  -- (B) Status: sirf naya event; purana (stale) ho to chhod do
  if v_stale then
    return case when v_result = 'applied' and p_payment_id is null then 'stale' else v_result end;
  end if;

  update stores
     set subscription_status = p_status,
         autopay_enabled = case when p_status in ('cancelled', 'expired') then false else autopay_enabled end,
         next_billing_date = coalesce(p_next_billing_date, next_billing_date),
         subscription_event_at = greatest(coalesce(subscription_event_at, p_event_at), coalesce(p_event_at, subscription_event_at))
   where id = st.id;
  return v_result;
end $$;

revoke execute on function public.apply_subscription_event(text, text, timestamptz, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(text, text, timestamptz, timestamptz, text, integer) to service_role;
