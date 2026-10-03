-- ============================================================
-- DELIVERY STAFF MODULE (Delivery Boy login + assignments)
--
-- Har dukaan apne hi delivery boys manage karti hai (koi central
-- rider pool nahi, koi rider salary/commission nahi). Is file mein:
--   1. delivery_boys table EXTEND (naya table nahi) + public SELECT band
--   2. delivery_assignments  (delivery ka apna status; orders.status se alag)
--   3. delivery_notifications (in-app, push-ready)
--   4. store_delivery_methods (SHOP_DELIVERY / LOCAL_PARTNER / SHIPROCKET)
--   5. RPCs (saari writes yahin se, RLS bypass frontend se kabhi nahi)
--
-- Existing orders / stock / payments / GST / khata ko koi change nahi.
-- Safe to re-run (idempotent). Supabase SQL Editor mein poori file ek
-- baar run karein. ("destructive operation" warning aaye to Run this
-- query dabayein — sirf ek purani policy drop hoti hai.)
-- ============================================================

create or replace function _is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from super_admins where email = auth.email()); $$;
grant execute on function _is_super_admin() to anon, authenticated;

-- ------------------------------------------------------------
-- 1. delivery_boys: extra columns
-- ------------------------------------------------------------
alter table delivery_boys add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table delivery_boys add column if not exists vehicle_type text not null default 'Bike';
alter table delivery_boys add column if not exists vehicle_number text;
alter table delivery_boys add column if not exists login_enabled boolean not null default false;
alter table delivery_boys add column if not exists invite_code text;
alter table delivery_boys add column if not exists invite_expires_at timestamptz;
alter table delivery_boys add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_boys_vehicle_type_check') then
    alter table delivery_boys add constraint delivery_boys_vehicle_type_check
      check (vehicle_type in ('Bike','Scooter','Cycle','Walking','Other'));
  end if;
end $$;
create unique index if not exists uq_delivery_boys_invite on delivery_boys(invite_code) where invite_code is not null;

-- Purani policy "Anyone can view delivery boys" (using true) sab ke phone
-- number public kar rahi thi, aur logged-in delivery boy ko doosri
-- dukaanon ke boys dikha deti. Customer tracking RPC (get_order_tracking)
-- se chalti hai, isliye yeh band karna safe hai.
drop policy if exists "Anyone can view delivery boys" on delivery_boys;
drop policy if exists "Owner or self can view delivery boys" on delivery_boys;
create policy "Owner or self can view delivery boys" on delivery_boys for select
  using (
    user_id = auth.uid()
    or exists (select 1 from stores s where s.id = delivery_boys.store_id and s.user_id = auth.uid())
    or _is_super_admin()
  );

-- store_id / user_id direct UPDATE se nahi badal sakte (user_id sirf RPC se)
create or replace function guard_delivery_boys()
returns trigger language plpgsql as $$
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
    new.updated_at := now();
  elsif tg_op = 'INSERT' then
    new.user_id := null; new.invite_code := null; new.invite_expires_at := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_delivery_boys on delivery_boys;
create trigger trg_guard_delivery_boys before insert or update on delivery_boys
  for each row execute function guard_delivery_boys();

-- ------------------------------------------------------------
-- 2. delivery_assignments
-- ------------------------------------------------------------
create table if not exists delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  delivery_boy_id uuid not null references delivery_boys(id) on delete cascade,
  -- delivery method: order status / payment status / delivery status se ALAG field
  delivery_method text not null default 'SHOP_DELIVERY'
    check (delivery_method in ('SHOP_DELIVERY','LOCAL_PARTNER','SHIPROCKET')),
  status text not null default 'ASSIGNED'
    check (status in ('ASSIGNED','ACCEPTED','PICKED_UP','OUT_FOR_DELIVERY','DELIVERED','REASSIGNED')),
  is_current boolean not null default true,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  external_ref text,            -- future: partner / Shiprocket AWB (abhi hamesha null)
  created_at timestamptz not null default now()
);
create unique index if not exists uq_delivery_assign_current on delivery_assignments(order_id) where is_current;
create index if not exists idx_delivery_assign_boy on delivery_assignments(delivery_boy_id, status);
create index if not exists idx_delivery_assign_store on delivery_assignments(store_id, assigned_at desc);

alter table delivery_assignments enable row level security;
drop policy if exists "Owner reads own delivery assignments" on delivery_assignments;
create policy "Owner reads own delivery assignments" on delivery_assignments for select
  using (exists (select 1 from stores s where s.id = delivery_assignments.store_id and s.user_id = auth.uid()) or _is_super_admin());
drop policy if exists "Boy reads own delivery assignments" on delivery_assignments;
create policy "Boy reads own delivery assignments" on delivery_assignments for select
  using (exists (select 1 from delivery_boys b where b.id = delivery_assignments.delivery_boy_id and b.user_id = auth.uid()));
-- INSERT/UPDATE/DELETE policy jaan-boojhkar nahi — sirf RPC se.

-- ------------------------------------------------------------
-- 3. delivery_notifications (in-app; push-ready: ek hi table, kal
--    web-push/FCM sender isi se padh sakta hai)
-- ------------------------------------------------------------
create table if not exists delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  delivery_boy_id uuid not null references delivery_boys(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  type text not null default 'ASSIGNED',
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_delivery_notif_boy on delivery_notifications(delivery_boy_id, created_at desc);
alter table delivery_notifications enable row level security;
drop policy if exists "Boy reads own notifications" on delivery_notifications;
create policy "Boy reads own notifications" on delivery_notifications for select
  using (exists (select 1 from delivery_boys b where b.id = delivery_notifications.delivery_boy_id and b.user_id = auth.uid()));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'delivery_notifications') then
    alter publication supabase_realtime add table delivery_notifications;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. store_delivery_methods
--    SHOP_DELIVERY abhi implemented. LOCAL_PARTNER / SHIPROCKET sirf
--    architecture: enable nahi ho sakte, koi fake credentials/data nahi.
-- ------------------------------------------------------------
create table if not exists store_delivery_methods (
  store_id uuid not null references stores(id) on delete cascade,
  method text not null check (method in ('SHOP_DELIVERY','LOCAL_PARTNER','SHIPROCKET')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,   -- future provider settings (credentials yahan NAHI, server-side secret store mein)
  updated_at timestamptz not null default now(),
  primary key (store_id, method)
);
alter table store_delivery_methods enable row level security;
drop policy if exists "Owner reads own delivery methods" on store_delivery_methods;
create policy "Owner reads own delivery methods" on store_delivery_methods for select
  using (exists (select 1 from stores s where s.id = store_delivery_methods.store_id and s.user_id = auth.uid()) or _is_super_admin());

-- ------------------------------------------------------------
-- 5. Internal helpers
-- ------------------------------------------------------------
create or replace function _assert_store_owner(p_store_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;
end $$;
revoke all on function _assert_store_owner(uuid) from public, anon, authenticated;

create or replace function _method_enabled(p_store_id uuid, p_method text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case when p_method = 'SHOP_DELIVERY'
              then coalesce((select enabled from store_delivery_methods where store_id = p_store_id and method = p_method), true)
         else coalesce((select enabled from store_delivery_methods where store_id = p_store_id and method = p_method), false)
         end;
$$;
revoke all on function _method_enabled(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6. Owner RPCs
-- ------------------------------------------------------------
create or replace function list_store_delivery_methods(p_store_id uuid)
returns table (method text, enabled boolean, implemented boolean)
language plpgsql security definer set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select m.method, _method_enabled(p_store_id, m.method), (m.method = 'SHOP_DELIVERY')
    from (values ('SHOP_DELIVERY'),('LOCAL_PARTNER'),('SHIPROCKET')) as m(method);
end $$;
grant execute on function list_store_delivery_methods(uuid) to authenticated;

create or replace function set_store_delivery_method(p_store_id uuid, p_method text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  if p_method not in ('SHOP_DELIVERY','LOCAL_PARTNER','SHIPROCKET') then
    raise exception 'Invalid delivery method';
  end if;
  if p_enabled and p_method <> 'SHOP_DELIVERY' then
    raise exception 'Yeh delivery method abhi available nahi hai (coming soon)';
  end if;
  insert into store_delivery_methods (store_id, method, enabled) values (p_store_id, p_method, p_enabled)
  on conflict (store_id, method) do update set enabled = excluded.enabled, updated_at = now();
end $$;
grant execute on function set_store_delivery_method(uuid, text, boolean) to authenticated;

-- Invite code: owner boy ko deta hai; boy /delivery par signup/login ke baad enter karta hai
create or replace function generate_delivery_invite(p_boy_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare v_store uuid; v_code text; v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  select store_id into v_store from delivery_boys where id = p_boy_id;
  if v_store is null then raise exception 'Delivery boy nahi mila'; end if;
  perform _assert_store_owner(v_store);
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
end $$;
grant execute on function generate_delivery_invite(uuid) to authenticated;

create or replace function revoke_delivery_login(p_boy_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_store uuid;
begin
  select store_id into v_store from delivery_boys where id = p_boy_id;
  if v_store is null then raise exception 'Delivery boy nahi mila'; end if;
  perform _assert_store_owner(v_store);
  perform set_config('app.dstaff_ctx', '1', true);
  update delivery_boys set user_id = null, login_enabled = false, invite_code = null, invite_expires_at = null where id = p_boy_id;
end $$;
grant execute on function revoke_delivery_login(uuid) to authenticated;

-- Order assign / reassign
create or replace function assign_delivery(p_order_id uuid, p_boy_id uuid, p_method text default 'SHOP_DELIVERY')
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  o orders%rowtype; b delivery_boys%rowtype; cur delivery_assignments%rowtype; v_id uuid; v_prev uuid;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order nahi mila'; end if;
  perform _assert_store_owner(o.store_id);

  if p_method <> 'SHOP_DELIVERY' then raise exception 'Yeh delivery method abhi available nahi hai'; end if;
  if not _method_enabled(o.store_id, p_method) then raise exception 'Shop Delivery is dukaan ke liye band hai'; end if;
  if coalesce(o.order_type, 'Delivery') <> 'Delivery' then raise exception 'Sirf Delivery orders assign ho sakte hain'; end if;
  if o.status = 'Delivered' then raise exception 'Delivered order reassign nahi ho sakta'; end if;

  if p_boy_id is null then
    -- unassign
    update delivery_assignments set is_current = false, status = 'REASSIGNED' where order_id = p_order_id and is_current;
    update orders set delivery_boy_id = null where id = p_order_id;
    return null;
  end if;

  select * into b from delivery_boys where id = p_boy_id;
  if not found or b.store_id <> o.store_id then raise exception 'Delivery boy is dukaan ka nahi hai'; end if;
  if not b.is_active then raise exception 'Yeh delivery boy inactive hai'; end if;

  select * into cur from delivery_assignments where order_id = p_order_id and is_current for update;
  if found then
    if cur.delivery_boy_id = p_boy_id then return cur.id; end if;
    v_prev := cur.delivery_boy_id;
    update delivery_assignments set is_current = false, status = 'REASSIGNED' where id = cur.id;
  end if;

  insert into delivery_assignments (store_id, order_id, delivery_boy_id, delivery_method, assigned_by)
  values (o.store_id, o.id, p_boy_id, p_method, auth.uid())
  returning id into v_id;

  update orders set delivery_boy_id = p_boy_id where id = o.id;

  insert into delivery_notifications (store_id, delivery_boy_id, order_id, type, title, body)
  values (o.store_id, p_boy_id, o.id, 'ASSIGNED', 'Nayi delivery assign hui', 'Order ' || o.order_number || ' — ' || o.customer_name);
  if v_prev is not null then
    insert into delivery_notifications (store_id, delivery_boy_id, order_id, type, title, body)
    values (o.store_id, v_prev, o.id, 'REASSIGNED', 'Delivery hata di gayi', 'Order ' || o.order_number || ' ab aapko assign nahi hai');
  end if;
  return v_id;
end $$;
grant execute on function assign_delivery(uuid, uuid, text) to authenticated;

create or replace function get_delivery_dashboard(p_store_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
        r jsonb;
begin
  perform _assert_store_owner(p_store_id);
  select jsonb_build_object(
    'total_staff', (select count(*) from delivery_boys where store_id = p_store_id),
    'active_staff', (select count(*) from delivery_boys where store_id = p_store_id and is_active),
    'pending', (select count(*) from delivery_assignments where store_id = p_store_id and is_current and status in ('ASSIGNED','ACCEPTED','PICKED_UP')),
    'out_for_delivery', (select count(*) from delivery_assignments where store_id = p_store_id and is_current and status = 'OUT_FOR_DELIVERY'),
    'delivered_today', (select count(*) from delivery_assignments where store_id = p_store_id and status = 'DELIVERED' and delivered_at >= v_day_start),
    'per_boy', coalesce((select jsonb_agg(jsonb_build_object(
        'delivery_boy_id', b.id, 'name', b.name,
        'assigned', (select count(*) from delivery_assignments a where a.delivery_boy_id = b.id and a.is_current and a.status <> 'DELIVERED'),
        'completed_today', (select count(*) from delivery_assignments a where a.delivery_boy_id = b.id and a.status = 'DELIVERED' and a.delivered_at >= v_day_start),
        'completed_total', (select count(*) from delivery_assignments a where a.delivery_boy_id = b.id and a.status = 'DELIVERED')
      ) order by b.name) from delivery_boys b where b.store_id = p_store_id), '[]'::jsonb)
  ) into r;
  return r;
end $$;
grant execute on function get_delivery_dashboard(uuid) to authenticated;

-- Owner: assignments + order basics (per boy history ke liye bhi)
create or replace function get_store_delivery_assignments(p_store_id uuid, p_boy_id uuid default null,
                                                           p_from timestamptz default null, p_to timestamptz default null)
returns table (
  assignment_id uuid, order_id uuid, order_number text, customer_name text, total numeric,
  delivery_boy_id uuid, delivery_boy_name text, delivery_method text, status text,
  assigned_at timestamptz, accepted_at timestamptz, picked_up_at timestamptz,
  out_for_delivery_at timestamptz, delivered_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select a.id, a.order_id, o.order_number, o.customer_name, o.total,
           a.delivery_boy_id, b.name, a.delivery_method, a.status,
           a.assigned_at, a.accepted_at, a.picked_up_at, a.out_for_delivery_at, a.delivered_at
    from delivery_assignments a
    join orders o on o.id = a.order_id
    join delivery_boys b on b.id = a.delivery_boy_id
    where a.store_id = p_store_id and a.status <> 'REASSIGNED'
      and (p_boy_id is null or a.delivery_boy_id = p_boy_id)
      and (p_from is null or coalesce(a.delivered_at, a.assigned_at) >= p_from)
      and (p_to is null or coalesce(a.delivered_at, a.assigned_at) < p_to)
    order by coalesce(a.delivered_at, a.assigned_at) desc
    limit 500;
end $$;
grant execute on function get_store_delivery_assignments(uuid, uuid, timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- 7. Delivery boy RPCs (sirf apna data)
-- ------------------------------------------------------------
create or replace function _my_delivery_boy()
returns delivery_boys language plpgsql stable security definer set search_path = public
as $$
declare b delivery_boys;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into b from delivery_boys where user_id = auth.uid();
  if not found then raise exception 'Not authorized'; end if;
  if not b.login_enabled then raise exception 'Aapka login band hai — dukaandar se baat karein'; end if;
  if not b.is_active then raise exception 'Aap abhi inactive hain — dukaandar se baat karein'; end if;
  return b;
end $$;
revoke all on function _my_delivery_boy() from public, anon, authenticated;

create or replace function claim_delivery_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare b delivery_boys;
begin
  if auth.uid() is null then raise exception 'Pehle login karein'; end if;
  if exists (select 1 from stores where user_id = auth.uid()) then
    raise exception 'Yeh account dukaandar ka hai — delivery ke liye alag account banayein';
  end if;
  if exists (select 1 from delivery_boys where user_id = auth.uid()) then
    raise exception 'Aapka account pehle se kisi dukaan se linked hai';
  end if;
  select * into b from delivery_boys
   where invite_code = upper(trim(p_code)) and user_id is null and invite_expires_at > now() for update;
  if not found then raise exception 'Code galat hai ya expire ho gaya'; end if;
  perform set_config('app.dstaff_ctx', '1', true);
  update delivery_boys set user_id = auth.uid(), login_enabled = true, invite_code = null, invite_expires_at = null where id = b.id;
  return b.id;
end $$;
grant execute on function claim_delivery_invite(text) to authenticated;

create or replace function get_my_delivery_profile()
returns table (id uuid, name text, phone text, photo_url text, vehicle_type text, vehicle_number text,
               is_active boolean, login_enabled boolean, store_name text)
language sql stable security definer set search_path = public
as $$
  select b.id, b.name, b.phone, b.photo_url, b.vehicle_type, b.vehicle_number, b.is_active, b.login_enabled, s.name
  from delivery_boys b join stores s on s.id = b.store_id
  where b.user_id = auth.uid();
$$;
grant execute on function get_my_delivery_profile() to authenticated;

-- scope: 'active' (delivered ke alawa sab) | 'history' (delivered, date filter ke saath)
create or replace function get_my_deliveries(p_scope text default 'active',
                                              p_from timestamptz default null, p_to timestamptz default null)
returns table (
  assignment_id uuid, order_id uuid, order_number text, status text, delivery_method text,
  customer_name text, customer_phone text, address text, landmark text, pincode text,
  items jsonb, total numeric, delivery_fee numeric, payment_method text, payment_status text,
  amount_to_collect numeric, assigned_at timestamptz, accepted_at timestamptz, picked_up_at timestamptz,
  out_for_delivery_at timestamptz, delivered_at timestamptz, order_status text
)
language plpgsql stable security definer set search_path = public
as $$
declare b delivery_boys;
begin
  b := _my_delivery_boy();
  return query
    select a.id, o.id, o.order_number, a.status, a.delivery_method,
           o.customer_name, o.customer_phone, o.address, o.landmark, o.pincode,
           o.items, o.total, o.delivery_fee, o.payment_method, o.payment_status,
           case when o.payment_method = 'COD' and o.payment_status not in ('Payment Confirmed','Paid')
                then o.total else 0::numeric end,
           a.assigned_at, a.accepted_at, a.picked_up_at, a.out_for_delivery_at, a.delivered_at, o.status
    from delivery_assignments a join orders o on o.id = a.order_id
    where a.delivery_boy_id = b.id
      and a.status <> 'REASSIGNED'
      and ((p_scope = 'active' and a.status <> 'DELIVERED')
        or (p_scope = 'history' and a.status = 'DELIVERED'
            and (p_from is null or a.delivered_at >= p_from) and (p_to is null or a.delivered_at < p_to)))
    order by case when p_scope = 'active' then a.assigned_at end asc,
             case when p_scope = 'history' then a.delivered_at end desc
    limit 200;
end $$;
grant execute on function get_my_deliveries(text, timestamptz, timestamptz) to authenticated;

-- Strict status chain. payment_status ko KABHI touch nahi karta.
create or replace function delivery_update_status(p_assignment_id uuid, p_new_status text)
returns text language plpgsql security definer set search_path = public
as $$
declare b delivery_boys; a delivery_assignments; o orders; v_expected text;
begin
  b := _my_delivery_boy();
  select * into a from delivery_assignments where id = p_assignment_id for update;
  if not found or a.delivery_boy_id <> b.id then raise exception 'Not authorized'; end if;
  if not a.is_current then raise exception 'Yeh delivery ab aapko assign nahi hai'; end if;

  v_expected := case a.status
    when 'ASSIGNED' then 'ACCEPTED'
    when 'ACCEPTED' then 'PICKED_UP'
    when 'PICKED_UP' then 'OUT_FOR_DELIVERY'
    when 'OUT_FOR_DELIVERY' then 'DELIVERED'
    else null end;
  if v_expected is null or p_new_status is distinct from v_expected then
    raise exception 'Invalid status change (% -> %)', a.status, p_new_status;
  end if;

  select * into o from orders where id = a.order_id for update;
  if o.status = 'Delivered' then raise exception 'Order pehle hi Delivered mark ho chuka hai'; end if;
  if p_new_status = 'PICKED_UP' and o.status not in ('Ready','Out for Delivery') then
    raise exception 'Order abhi ready nahi hai — dukaan se ready hone ka wait karein';
  end if;

  if p_new_status = 'ACCEPTED' then
    update delivery_assignments set status = 'ACCEPTED', accepted_at = now() where id = a.id;
  elsif p_new_status = 'PICKED_UP' then
    update delivery_assignments set status = 'PICKED_UP', picked_up_at = now() where id = a.id;
  elsif p_new_status = 'OUT_FOR_DELIVERY' then
    update delivery_assignments set status = 'OUT_FOR_DELIVERY', out_for_delivery_at = now() where id = a.id;
    update orders set status = 'Out for Delivery' where id = o.id and status = 'Ready';
  else
    update delivery_assignments set status = 'DELIVERED', delivered_at = now() where id = a.id;
    update orders set status = 'Delivered' where id = o.id;   -- payment_status untouched (COD cash alag confirm hota hai)
  end if;
  return p_new_status;
end $$;
grant execute on function delivery_update_status(uuid, text) to authenticated;

create or replace function mark_delivery_notifications_read()
returns void language plpgsql security definer set search_path = public
as $$
declare b delivery_boys;
begin
  b := _my_delivery_boy();
  update delivery_notifications set read_at = now() where delivery_boy_id = b.id and read_at is null;
end $$;
grant execute on function mark_delivery_notifications_read() to authenticated;

-- ------------------------------------------------------------
-- 8. Purane orders jin mein delivery_boy_id pehle se set hai: unke liye
--    current assignment bana do (taaki naye flow mein bhi dikhein)
-- ------------------------------------------------------------
insert into delivery_assignments (store_id, order_id, delivery_boy_id, status, assigned_at, delivered_at, out_for_delivery_at)
select o.store_id, o.id, o.delivery_boy_id,
       case when o.status = 'Delivered' then 'DELIVERED'
            when o.status = 'Out for Delivery' then 'OUT_FOR_DELIVERY' else 'ASSIGNED' end,
       o.created_at,
       case when o.status = 'Delivered' then o.created_at end,
       case when o.status in ('Out for Delivery','Delivered') then o.created_at end
from orders o
join delivery_boys b on b.id = o.delivery_boy_id and b.store_id = o.store_id
where o.delivery_boy_id is not null
  and not exists (select 1 from delivery_assignments a where a.order_id = o.id and a.is_current);
