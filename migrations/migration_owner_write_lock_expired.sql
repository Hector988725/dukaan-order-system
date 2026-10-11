-- ============================================================
-- STEP 5B — Plan expire / dukaan band hone par OWNER ke writes server par band
-- UI me owner ko expire par sirf renewal page dikhta hai; yeh uska server-side taala hai
-- (khula hua purana page ya seedha API call se bhi likhna nahi ho paayega).
-- Sirf us dukaan ke OWNER par lagta hai jiska plan expire / is_active=false ho.
-- Customers, staff (apne RPC se), super admin, service_role (payment/webhook) par koi asar nahi.
-- Dekhna (SELECT) band nahi hota. Renewal (stores table) ko nahi chhuta.
-- Undo: select _unlock_owner_write_guard();   (neeche function dikhega)
-- ============================================================
create or replace function public._guard_owner_write_when_expired()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_store uuid;
begin
  if auth.uid() is null then return coalesce(new, old); end if;

  if tg_table_name = 'variants' then
    select p.store_id into v_store from products p where p.id = (v_row ->> 'product_id')::uuid;
  else
    v_store := nullif(v_row ->> 'store_id', '')::uuid;
  end if;
  if v_store is null then return coalesce(new, old); end if;

  if exists (
    select 1 from stores s
    where s.id = v_store
      and s.user_id = auth.uid()
      and not (s.is_active is not false and s.subscription_expires_at > now())
  ) then
    raise exception 'Aapka plan expire ho gaya hai. Renew karne ke baad hi changes ho payenge.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public._guard_owner_write_when_expired() from public, anon, authenticated;

-- Jin tables me store_id hai (aur variants) un sab par trigger. In par NAHI: stores (renewal),
-- payment/webhook tables, shop_staff (owner expire par bhi staff ko band kar sake).
create or replace function public._install_owner_write_guard()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_list text := '';
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'store_id'
      and c.table_name not in ('stores', 'subscription_payments', 'subscription_charges', 'razorpay_webhook_events',
                               'shop_staff', 'delivery_notifications')
    union select 'variants'
  loop
    execute format('drop trigger if exists trg_owner_write_guard on public.%I', r.table_name);
    execute format('create trigger trg_owner_write_guard before insert or update or delete on public.%I for each row execute function public._guard_owner_write_when_expired()', r.table_name);
    v_list := v_list || r.table_name || ', ';
  end loop;
  return v_list;
end $$;
revoke execute on function public._install_owner_write_guard() from public, anon, authenticated;

create or replace function public._unlock_owner_write_guard()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in select event_object_table t from information_schema.triggers
           where trigger_schema = 'public' and trigger_name = 'trg_owner_write_guard' group by 1 loop
    execute format('drop trigger if exists trg_owner_write_guard on public.%I', r.t);
    n := n + 1;
  end loop;
  return n || ' triggers removed';
end $$;
revoke execute on function public._unlock_owner_write_guard() from public, anon, authenticated;

select public._install_owner_write_guard() as guarded_tables;
