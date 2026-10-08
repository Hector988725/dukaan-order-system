-- ============================================================
-- SHOP STAFF — MIGRATION B: Delivery ko Staff me merge karna
-- Ab "delivery" staff ki ek permission hai. Permission on karte hi us staff
-- ka ek delivery record (delivery_boys me) apne aap bann jata hai aur ussi login
-- se chalta hai. Assignments / COD / notifications ka purana engine same rehta hai.
-- Pehle migration_shop_staff_a.sql chal chuki honi chahiye.
-- ============================================================

-- 1) Link column: delivery record kis staff ka hai
alter table public.delivery_boys
  add column if not exists shop_staff_id uuid unique references public.shop_staff(id) on delete set null;

-- 2) Guard: shop_staff_id owner khud set/badal na sake (sirf sync trigger kare)
create or replace function public.guard_delivery_boys()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.store_id is distinct from old.store_id then
      raise exception 'store_id change nahi ho sakta';
    end if;
    if new.user_id is distinct from old.user_id
       and coalesce(current_setting('app.dstaff_ctx', true), '') <> '1' then
      raise exception 'Login link sirf invite code se hota hai';
    end if;
    if (new.invite_code is distinct from old.invite_code or new.invite_expires_at is distinct from old.invite_expires_at)
       and coalesce(current_setting('app.dstaff_ctx', true), '') <> '1' then
      raise exception 'Invite code sirf Generate Code se banta hai';
    end if;
    if new.shop_staff_id is distinct from old.shop_staff_id
       and coalesce(current_setting('app.dstaff_ctx', true), '') <> '1' then
      raise exception 'Staff link sirf Staff section se hota hai';
    end if;
    new.updated_at := now();
  elsif tg_op = 'INSERT' then
    new.user_id := null; new.invite_code := null; new.invite_expires_at := null;
    if coalesce(current_setting('app.dstaff_ctx', true), '') <> '1' then
      new.shop_staff_id := null;
    end if;
  end if;
  return new;
end $function$;

-- 3) Sync: staff ki delivery permission / naam / phone / active / login -> delivery record
create or replace function public._sync_staff_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare want boolean; b delivery_boys;
begin
  perform set_config('app.dstaff_ctx', '1', true);

  if tg_op = 'DELETE' then
    update delivery_boys
       set is_active = false, login_enabled = false, user_id = null,
           invite_code = null, invite_expires_at = null, shop_staff_id = null
     where shop_staff_id = old.id;
    return old;
  end if;

  want := coalesce(new.permissions ->> 'delivery', 'false') = 'true';
  select * into b from delivery_boys where shop_staff_id = new.id;

  if want then
    if not found then
      insert into delivery_boys (store_id, name, phone, is_active, shop_staff_id)
      values (new.store_id, new.name, coalesce(new.phone, ''), new.is_active, new.id)
      returning * into b;
    end if;
    update delivery_boys
       set name = new.name, phone = coalesce(new.phone, ''), is_active = new.is_active,
           user_id = new.user_id,
           login_enabled = (new.user_id is not null and new.is_active),
           invite_code = null, invite_expires_at = null
     where id = b.id;
  elsif found then
    update delivery_boys
       set is_active = false, login_enabled = false, user_id = null
     where id = b.id;
  end if;
  return new;
end $$;
revoke execute on function public._sync_staff_delivery() from public, anon, authenticated;

drop trigger if exists trg_sync_staff_delivery on public.shop_staff;
create trigger trg_sync_staff_delivery after insert or update on public.shop_staff
  for each row execute function public._sync_staff_delivery();
drop trigger if exists trg_sync_staff_delivery_del on public.shop_staff;
create trigger trg_sync_staff_delivery_del before delete on public.shop_staff
  for each row execute function public._sync_staff_delivery();

-- 4) update_shop_staff: ab 5 permission keys (delivery bhi)
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
  v_allowed constant text[] := array['orders_status','payment_verify','stock_update','price_update','delivery'];
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

-- 5) Purane delivery functions: staff-linked record ko wahan se chhedna mana
create or replace function public.generate_delivery_invite(p_boy_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_store uuid; v_staff uuid; v_code text; v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  select store_id, shop_staff_id into v_store, v_staff from delivery_boys where id = p_boy_id;
  if v_store is null then raise exception 'Delivery boy nahi mila'; end if;
  perform _assert_store_owner(v_store);
  if v_staff is not null then raise exception 'Yeh staff member hai — login code Admin → Staff se banayein'; end if;
  if exists (select 1 from delivery_boys where id = p_boy_id and user_id is not null) then
    raise exception 'Is delivery boy ka login pehle se linked hai';
  end if;
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from delivery_boys where invite_code = v_code);
  end loop;
  perform set_config('app.dstaff_ctx', '1', true);
  update delivery_boys set invite_code = v_code, invite_expires_at = now() + interval '7 days' where id = p_boy_id;
  return v_code;
end $function$;

create or replace function public.revoke_delivery_login(p_boy_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_store uuid; v_staff uuid;
begin
  select store_id, shop_staff_id into v_store, v_staff from delivery_boys where id = p_boy_id;
  if v_store is null then raise exception 'Delivery boy nahi mila'; end if;
  perform _assert_store_owner(v_store);
  if v_staff is not null then raise exception 'Yeh staff member hai — Admin → Staff se Login Reset karein'; end if;
  perform set_config('app.dstaff_ctx', '1', true);
  update delivery_boys set user_id = null, login_enabled = false, invite_code = null, invite_expires_at = null where id = p_boy_id;
end $$;

-- Staff wala account purane delivery code se na jude (aur ulta bhi: claim_shop_staff_invite pehle se rokta hai)
create or replace function public.claim_delivery_invite(p_code text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b delivery_boys;
begin
  if auth.uid() is null then raise exception 'Pehle login karein'; end if;
  if exists (select 1 from stores where user_id = auth.uid()) then
    raise exception 'Yeh account dukaandar ka hai — delivery ke liye alag account banayein';
  end if;
  if exists (select 1 from delivery_boys where user_id = auth.uid())
     or exists (select 1 from shop_staff where user_id = auth.uid()) then
    raise exception 'Aapka account pehle se kisi dukaan se linked hai';
  end if;
  select * into b from delivery_boys
   where invite_code = upper(trim(p_code)) and user_id is null and invite_expires_at > now()
     and shop_staff_id is null for update;
  if not found then raise exception 'Code galat hai ya expire ho gaya'; end if;
  perform set_config('app.dstaff_ctx', '1', true);
  update delivery_boys set user_id = auth.uid(), login_enabled = true, invite_code = null, invite_expires_at = null where id = b.id;
  return b.id;
end $function$;

-- 6) Staff-linked delivery: dukaan ka plan chalu ho tabhi (staff ke baaki kaam jaisa)
create or replace function public._my_delivery_boy()
 returns delivery_boys
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare b delivery_boys;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into b from delivery_boys where user_id = auth.uid();
  if not found then raise exception 'Not authorized'; end if;
  if not b.login_enabled then raise exception 'Aapka login band hai — dukaandar se baat karein'; end if;
  if not b.is_active then raise exception 'Aap abhi inactive hain — dukaandar se baat karein'; end if;
  if b.shop_staff_id is not null and not exists (
       select 1 from stores s where s.id = b.store_id and s.is_active is not false and s.subscription_expires_at > now()) then
    raise exception 'Dukaan ka plan expire hai — dukaandar se baat karein';
  end if;
  return b;
end $function$;

-- 7) Backfill: jo staff pehle se bane hain unki delivery permission default false hai -> kuch nahi badalta.
