-- ============================================================
-- KHATA PIN — MIGRATION A (additive; purana get_my_khata abhi chalta rahega)
-- Dukaandar har customer ke liye auto-generated 4-digit PIN banata hai.
-- PIN sirf hash (bcrypt) ke roop mein store hota hai.
-- 5 galat try ke baad 15 minute ka lockout.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) PIN table — koi bhi direct access nahi (RLS on, koi policy nahi,
--    anon/authenticated ke grants hata diye). Sirf neeche ke functions chhu sakte hain.
create table if not exists public.customer_khata_pins (
  customer_id     uuid primary key references public.customers(id) on delete cascade,
  pin_hash        text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
alter table public.customer_khata_pins enable row level security;
revoke all on table public.customer_khata_pins from public, anon, authenticated;

-- 2) Dukaandar ke liye: naya random PIN banao (dobara chalane par purana PIN band ho jata hai)
create or replace function public.generate_khata_pin(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin text;
  b bytea;
begin
  if auth.uid() is null or not exists (
    select 1 from customers c join stores s on s.id = c.store_id
    where c.id = p_customer_id and s.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  b := gen_random_bytes(3);
  v_pin := lpad(((get_byte(b,0) * 65536 + get_byte(b,1) * 256 + get_byte(b,2)) % 10000)::text, 4, '0');

  insert into customer_khata_pins (customer_id, pin_hash, failed_attempts, locked_until, updated_at)
  values (p_customer_id, crypt(v_pin, gen_salt('bf', 8)), 0, null, now())
  on conflict (customer_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();

  return v_pin;
end $$;

revoke execute on function public.generate_khata_pin(uuid) from public, anon;
grant  execute on function public.generate_khata_pin(uuid) to authenticated;

-- 3) Dukaandar ke liye: kin customers ka PIN set hai (PIN khud kabhi wapas nahi aata)
create or replace function public.get_khata_pin_status(p_store_id uuid)
returns table(customer_id uuid, pin_updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select p.customer_id, p.updated_at
    from customer_khata_pins p
    join customers c on c.id = p.customer_id
    where c.store_id = p_store_id;
end $$;

revoke execute on function public.get_khata_pin_status(uuid) from public, anon;
grant  execute on function public.get_khata_pin_status(uuid) to authenticated;

-- 4) Customer ke liye: phone + PIN se khata (login nahi chahiye)
--    status: 'ok' | 'invalid' | 'locked'
--    Galat number / galat PIN / PIN set nahi — teeno ka jawab same ('invalid').
create or replace function public.get_my_khata(p_store_id uuid, p_phone text, p_pin text)
returns table(status text, khata_balance numeric, transactions jsonb)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_cust  customers%rowtype;
  v_pin   customer_khata_pins%rowtype;
  v_fails int;
begin
  if p_pin is null or p_pin !~ '^\d{4}$' or length(v_phone) <> 10 then
    return query select 'invalid'::text, 0::numeric, '[]'::jsonb;
    return;
  end if;

  select * into v_cust from customers where store_id = p_store_id and phone = v_phone limit 1;
  if not found then
    perform crypt(p_pin, gen_salt('bf', 8));   -- same time lagao
    return query select 'invalid'::text, 0::numeric, '[]'::jsonb;
    return;
  end if;

  -- row lock: ek saath kai guess ek ek karke gine jaayenge
  select * into v_pin from customer_khata_pins where customer_id = v_cust.id for update;
  if not found then
    perform crypt(p_pin, gen_salt('bf', 8));
    return query select 'invalid'::text, 0::numeric, '[]'::jsonb;
    return;
  end if;

  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    return query select 'locked'::text, 0::numeric, '[]'::jsonb;
    return;
  end if;

  if crypt(p_pin, v_pin.pin_hash) = v_pin.pin_hash then
    if v_pin.failed_attempts <> 0 or v_pin.locked_until is not null then
      update customer_khata_pins set failed_attempts = 0, locked_until = null where customer_id = v_cust.id;
    end if;
    return query
      select 'ok'::text,
             v_cust.khata_balance,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                 'type', kt.type, 'amount', kt.amount, 'description', kt.description,
                 'running_balance', kt.running_balance, 'created_at', kt.created_at
               ) order by kt.created_at desc)
               from khata_transactions kt where kt.customer_id = v_cust.id
             ), '[]'::jsonb);
    return;
  end if;

  v_fails := v_pin.failed_attempts + 1;
  if v_fails >= 5 then
    update customer_khata_pins set failed_attempts = 0, locked_until = now() + interval '15 minutes' where customer_id = v_cust.id;
    return query select 'locked'::text, 0::numeric, '[]'::jsonb;
  else
    update customer_khata_pins set failed_attempts = v_fails where customer_id = v_cust.id;
    return query select 'invalid'::text, 0::numeric, '[]'::jsonb;
  end if;
end $$;

revoke execute on function public.get_my_khata(uuid, text, text) from public;
grant  execute on function public.get_my_khata(uuid, text, text) to anon, authenticated;
