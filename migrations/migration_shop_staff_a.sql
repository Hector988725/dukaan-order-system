-- ============================================================
-- SHOP STAFF ROLE — MIGRATION A (database)
-- Staff sirf: orders dekhna + status badalna, stock/price/availability badalna
-- (aur optional: UPI payment verify). Baaki sab sirf owner.
-- Naye tables/functions hain; orders/products/variants ki existing RLS
-- policies ko NAHI chhua gaya. Staff ka orders dekhna RPC se hota hai.
-- Permissions ek jsonb me hain -> naye option baad me bina table badle jod sakte hain.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) Table (koi direct access nahi — sab kuch functions se)
create table if not exists public.shop_staff (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 80),
  phone             text,
  user_id           uuid unique references auth.users(id) on delete set null,
  permissions       jsonb not null default '{"orders_status":true,"payment_verify":false,"stock_update":true,"price_update":true}'::jsonb,
  is_active         boolean not null default true,
  invite_code       text unique,
  invite_expires_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_shop_staff_store on public.shop_staff(store_id);
alter table public.shop_staff enable row level security;
revoke all on table public.shop_staff from public, anon, authenticated;

-- 2) Helpers
-- Owner -> hamesha true (jaisa pehle tha). Staff -> active staff + dukaan ka plan chalu + permission on.
create or replace function public._has_store_perm(p_store_id uuid, p_perm text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    return true;
  end if;
  return exists (
    select 1
    from shop_staff ss
    join stores s on s.id = ss.store_id
    where ss.store_id = p_store_id
      and ss.user_id = auth.uid()
      and ss.is_active
      and s.is_active is not false
      and s.subscription_expires_at > now()
      and coalesce(ss.permissions ->> p_perm, 'false') = 'true'
  );
end $$;

create or replace function public._assert_store_perm(p_store_id uuid, p_perm text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not _has_store_perm(p_store_id, p_perm) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end $$;

revoke execute on function public._has_store_perm(uuid, text) from public, anon, authenticated;
revoke execute on function public._assert_store_perm(uuid, text) from public, anon, authenticated;

-- 3) OWNER functions
create or replace function public.add_shop_staff(p_store_id uuid, p_name text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform _assert_store_owner(p_store_id);
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Staff ka naam daalein';
  end if;
  if (select count(*) from shop_staff where store_id = p_store_id) >= 10 then
    raise exception 'Ek dukaan me maximum 10 staff ho sakte hain';
  end if;
  insert into shop_staff (store_id, name, phone)
  values (p_store_id, trim(p_name), nullif(trim(coalesce(p_phone, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_shop_staff(p_store_id uuid)
returns table(id uuid, name text, phone text, is_active boolean, permissions jsonb,
              linked boolean, invite_active boolean, invite_expires_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select ss.id, ss.name, ss.phone, ss.is_active, ss.permissions,
           ss.user_id is not null,
           (ss.invite_code is not null and ss.invite_expires_at > now()),
           ss.invite_expires_at, ss.created_at
    from shop_staff ss
    where ss.store_id = p_store_id
    order by ss.created_at;
end $$;

-- Sirf yeh 4 permission keys, sirf true/false
create or replace function public.update_shop_staff(p_staff_id uuid, p_name text, p_permissions jsonb, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_key text;
  v_clean jsonb := '{}'::jsonb;
  v_allowed constant text[] := array['orders_status','payment_verify','stock_update','price_update'];
begin
  select store_id into v_store from shop_staff where id = p_staff_id;
  if v_store is null then raise exception 'Staff nahi mila'; end if;
  perform _assert_store_owner(v_store);

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Staff ka naam daalein';
  end if;
  foreach v_key in array v_allowed loop
    v_clean := v_clean || jsonb_build_object(v_key, coalesce((p_permissions ->> v_key)::boolean, false));
  end loop;

  update shop_staff
     set name = trim(p_name), permissions = v_clean, is_active = coalesce(p_is_active, true)
   where id = p_staff_id;
end $$;

create or replace function public.remove_shop_staff(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_store uuid;
begin
  select store_id into v_store from shop_staff where id = p_staff_id;
  if v_store is null then raise exception 'Staff nahi mila'; end if;
  perform _assert_store_owner(v_store);
  delete from shop_staff where id = p_staff_id;
end $$;

-- Invite code: 8 chars, 7 din, ek baar. p_reset_login=true -> purana login hata deta hai.
create or replace function public.generate_shop_staff_invite(p_staff_id uuid, p_reset_login boolean default false)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_store uuid; v_user uuid; v_code text; i int; b bytea;
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select store_id, user_id into v_store, v_user from shop_staff where id = p_staff_id;
  if v_store is null then raise exception 'Staff nahi mila'; end if;
  perform _assert_store_owner(v_store);
  if v_user is not null and not coalesce(p_reset_login, false) then
    raise exception 'ALREADY_LINKED: Is staff ka login pehle se juda hai.';
  end if;
  loop
    b := gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_chars, (get_byte(b, i) % length(v_chars)) + 1, 1);
    end loop;
    exit when not exists (select 1 from shop_staff where invite_code = v_code);
  end loop;
  update shop_staff
     set invite_code = v_code, invite_expires_at = now() + interval '7 days',
         user_id = case when coalesce(p_reset_login, false) then null else user_id end
   where id = p_staff_id;
  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end $$;

-- 4) STAFF functions
create or replace function public.claim_shop_staff_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s shop_staff;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Pehle login karein'; end if;
  if exists (select 1 from stores where user_id = auth.uid()) then
    raise exception 'Yeh account dukaandar ka hai — staff ke liye alag account banayein';
  end if;
  if exists (select 1 from shop_staff where user_id = auth.uid()) then
    raise exception 'Aapka account pehle se kisi dukaan se linked hai';
  end if;
  if exists (select 1 from delivery_boys where user_id = auth.uid()) then
    raise exception 'Yeh account delivery staff ka hai — staff ke liye alag account banayein';
  end if;
  select * into s from shop_staff
   where invite_code = v_code and user_id is null and invite_expires_at > now() for update;
  if not found then raise exception 'Code galat hai ya expire ho gaya'; end if;
  update shop_staff set user_id = auth.uid(), invite_code = null, invite_expires_at = null where id = s.id;
  return s.id;
end $$;

-- Staff app bootstrap: kis dukaan ka hai + kya kar sakta hai
create or replace function public.get_my_staff_context()
returns table(staff_id uuid, store_id uuid, store_name text, store_slug text, staff_name text,
              permissions jsonb, is_active boolean, store_active boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
    select ss.id, s.id, s.name, s.slug, ss.name, ss.permissions, ss.is_active,
           (s.is_active is not false and s.subscription_expires_at > now())
    from shop_staff ss join stores s on s.id = ss.store_id
    where ss.user_id = auth.uid();
end $$;

-- Staff orders padhe (existing orders RLS policies badli nahi gayi)
create or replace function public.staff_get_orders(p_store_id uuid, p_limit int default 50, p_before timestamptz default null)
returns setof orders
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from shop_staff ss join stores s on s.id = ss.store_id
    where ss.store_id = p_store_id and ss.user_id = auth.uid() and ss.is_active
      and s.is_active is not false and s.subscription_expires_at > now()
      and coalesce(ss.permissions ->> 'orders_status', 'false') = 'true'
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select * from orders o
    where o.store_id = p_store_id and (p_before is null or o.created_at < p_before)
    order by o.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

-- Order status: forward hi, aur Delivered ke baad staff kuch nahi badal sakta
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
  v_stages constant text[] := array['New','Accepted','Preparing','Ready','Out for Delivery','Delivered'];
  v_is_owner boolean;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order nahi mila'; end if;
  perform _assert_store_perm(o.store_id, 'orders_status');
  if not (p_status = any (v_stages)) then
    raise exception 'Invalid status';
  end if;

  v_is_owner := exists (select 1 from stores where id = o.store_id and user_id = auth.uid());
  if not v_is_owner then
    if o.status = 'Delivered' then
      raise exception 'Delivered order ka status sirf dukaandar badal sakta hai';
    end if;
    if array_position(v_stages, p_status) < array_position(v_stages, o.status) then
      raise exception 'Staff status peeche nahi kar sakta';
    end if;
  end if;

  update orders set status = p_status where id = p_order_id;
end $$;

-- UPI payment verify (optional permission): sirf "Pending Verification" -> "Payment Confirmed"
create or replace function public.set_order_payment_confirmed(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order nahi mila'; end if;
  perform _assert_store_perm(o.store_id, 'payment_verify');
  if o.payment_status <> 'Pending Verification' then
    raise exception 'Is order ki payment verify karne ki zaroorat nahi';
  end if;
  update orders set payment_status = 'Payment Confirmed' where id = p_order_id;
end $$;

create or replace function public.set_variant_price(p_variant_id uuid, p_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_store uuid;
begin
  if p_price is null or p_price <= 0 or p_price > 10000000 then
    raise exception 'Price 0 se zyada hona chahiye';
  end if;
  select p.store_id into v_store
  from variants v join products p on p.id = v.product_id
  where v.id = p_variant_id;
  if v_store is null then raise exception 'Variant nahi mila'; end if;
  perform _assert_store_perm(v_store, 'price_update');
  update variants set price = p_price where id = p_variant_id;
end $$;

create or replace function public.set_product_availability(p_product_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_store uuid;
begin
  select store_id into v_store from products where id = p_product_id;
  if v_store is null then raise exception 'Product nahi mila'; end if;
  perform _assert_store_perm(v_store, 'stock_update');
  update products set is_available = coalesce(p_available, false) where id = p_product_id;
end $$;

-- 5) Existing stock functions: sirf owner-check ki jagah "owner ya permission wala staff".
--    Baaki poora logic wahi hai (baseline file se).
create or replace function public.set_variant_stock(p_variant_id uuid, p_new_stock integer, p_note text default null::text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_store_id uuid;
  v_cur int;
begin
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'Stock 0 ya usse zyada hona chahiye';
  end if;

  select p.store_id, v.stock into v_store_id, v_cur
  from variants v join products p on p.id = v.product_id
  where v.id = p_variant_id;
  if not found then
    raise exception 'Variant nahi mila';
  end if;

  perform _assert_store_perm(v_store_id, 'stock_update');

  return apply_stock_change(v_store_id, p_variant_id, p_new_stock - v_cur, 'manual_adjust', 'manual', null, p_note);
end;
$function$;

create or replace function public.adjust_variant_stock(p_variant_id uuid, p_delta integer, p_note text default null::text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_store_id uuid;
  v_cur int;
begin
  select p.store_id into v_store_id
  from variants v join products p on p.id = v.product_id
  where v.id = p_variant_id;
  if not found then
    raise exception 'Variant nahi mila';
  end if;

  perform _assert_store_perm(v_store_id, 'stock_update');

  -- lock leke current stock dekho, taaki clamp sahi ho
  select stock into v_cur from variants where id = p_variant_id for update;
  return apply_stock_change(v_store_id, p_variant_id, greatest(p_delta, -v_cur), 'manual_adjust', 'manual', null, p_note);
end;
$function$;

-- 6) Grants: sirf logged-in users; andar se har function apni permission check karta hai
do $$
declare f text;
begin
  foreach f in array array[
    'add_shop_staff(uuid,text,text)', 'get_shop_staff(uuid)', 'update_shop_staff(uuid,text,jsonb,boolean)',
    'remove_shop_staff(uuid)', 'generate_shop_staff_invite(uuid,boolean)', 'claim_shop_staff_invite(text)',
    'get_my_staff_context()', 'staff_get_orders(uuid,int,timestamptz)', 'set_order_status(uuid,text)',
    'set_order_payment_confirmed(uuid)', 'set_variant_price(uuid,numeric)', 'set_product_availability(uuid,boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
