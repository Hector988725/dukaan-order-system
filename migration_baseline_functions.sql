-- ============================================================
-- BASELINE SNAPSHOT: live database ke saare public functions (2026-10-06).
-- SIRF RECORD ke liye. Ise Supabase me dobara chalane ki zaroorat nahi.
-- Agar kabhi naya database banana pade to ye reference kaam aayega
-- (grants alag se dekhne honge).
-- ============================================================

-- _assert_store_owner(uuid)
CREATE OR REPLACE FUNCTION public._assert_store_owner(p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null
     or not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;
end $function$;

-- _is_super_admin()
CREATE OR REPLACE FUNCTION public._is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from super_admins where email = auth.email()); $function$;

-- _method_enabled(uuid,text)
CREATE OR REPLACE FUNCTION public._method_enabled(p_store_id uuid, p_method text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_method = 'SHOP_DELIVERY'
              then coalesce((select enabled from store_delivery_methods where store_id = p_store_id and method = p_method), true)
         else coalesce((select enabled from store_delivery_methods where store_id = p_store_id and method = p_method), false)
         end;
$function$;

-- _my_delivery_boy()
CREATE OR REPLACE FUNCTION public._my_delivery_boy()
 RETURNS delivery_boys
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b delivery_boys;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into b from delivery_boys where user_id = auth.uid();
  if not found then raise exception 'Not authorized'; end if;
  if not b.login_enabled then raise exception 'Aapka login band hai — dukaandar se baat karein'; end if;
  if not b.is_active then raise exception 'Aap abhi inactive hain — dukaandar se baat karein'; end if;
  return b;
end $function$;

-- _receive_purchase(uuid,uuid,jsonb)
CREATE OR REPLACE FUNCTION public._receive_purchase(p_store_id uuid, p_purchase_id uuid, p_receipts jsonb)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pur purchases;
  it purchase_items;
  v_rem int;
  v_qty int;
  v_value numeric := 0;
  v_units int := 0;
  v_bal numeric;
  v_new_bal numeric;
  v_all_received boolean;
begin
  select * into pur from purchases where id = p_purchase_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Purchase nahi mila';
  end if;
  if pur.status in ('Cancelled', 'Received') then
    raise exception 'Is purchase ko receive nahi kar sakte (status: %)', pur.status;
  end if;

  for it in select * from purchase_items where purchase_id = p_purchase_id order by id for update
  loop
    v_rem := it.qty_ordered - it.qty_received;
    if v_rem <= 0 then
      continue;
    end if;

    if p_receipts is null then
      v_qty := v_rem;
    else
      select coalesce(sum((e->>'qty')::int), 0) into v_qty
      from jsonb_array_elements(p_receipts) e
      where (e->>'item_id')::uuid = it.id;
      if v_qty < 0 then
        raise exception 'Receive quantity negative nahi ho sakti';
      end if;
      if v_qty > v_rem then
        raise exception 'Receive quantity ordered se zyada nahi ho sakti (%)', it.product_name;
      end if;
    end if;

    if v_qty = 0 then
      continue;
    end if;
    if it.variant_id is null then
      raise exception '"%" product delete ho chuka hai — receive nahi kar sakte', it.product_name;
    end if;

    perform apply_stock_change(p_store_id, it.variant_id, v_qty, 'purchase_receive', 'purchase', p_purchase_id, null);

    update purchase_items set qty_received = qty_received + v_qty where id = it.id;
    v_value := v_value + v_qty * it.purchase_price;
    v_units := v_units + v_qty;

    insert into variant_purchase_prices (variant_id, store_id, last_purchase_price, updated_at)
    values (it.variant_id, p_store_id, it.purchase_price, now())
    on conflict (variant_id) do update
      set last_purchase_price = excluded.last_purchase_price, updated_at = now();
  end loop;

  if v_units = 0 then
    raise exception 'Receive karne ke liye kam se kam ek item ki quantity daalein';
  end if;

  if v_value > 0 then
    select payable_balance into v_bal from suppliers where id = pur.supplier_id for update;
    v_new_bal := v_bal + v_value;
    update suppliers set payable_balance = v_new_bal where id = pur.supplier_id;
    insert into supplier_transactions (store_id, supplier_id, type, amount, running_balance, purchase_id, note, created_by)
    values (p_store_id, pur.supplier_id, 'purchase', v_value, v_new_bal, p_purchase_id, 'Purchase ' || pur.purchase_number, auth.uid());
  end if;

  select bool_and(qty_received = qty_ordered) into v_all_received from purchase_items where purchase_id = p_purchase_id;

  update purchases
  set status = case when v_all_received then 'Received' else 'Partially Received' end,
      received_amount = received_amount + v_value,
      received_at = case when v_all_received then now() else received_at end,
      updated_at = now()
  where id = p_purchase_id
  returning * into pur;

  return pur;
end;
$function$;

-- _record_supplier_payment(uuid,uuid,numeric,text,text,uuid)
CREATE OR REPLACE FUNCTION public._record_supplier_payment(p_store_id uuid, p_supplier_id uuid, p_amount numeric, p_method text, p_note text, p_purchase_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bal numeric;
  v_new numeric;
begin
  select payable_balance into v_bal from suppliers
  where id = p_supplier_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Supplier nahi mila';
  end if;

  v_new := v_bal - p_amount;
  update suppliers set payable_balance = v_new where id = p_supplier_id;

  insert into supplier_transactions (store_id, supplier_id, type, amount, running_balance, purchase_id, payment_method, note, created_by)
  values (p_store_id, p_supplier_id, 'payment', p_amount, v_new, p_purchase_id, p_method, p_note, auth.uid());

  return v_new;
end;
$function$;

-- activate_subscription_payment(text,text,integer)
CREATE OR REPLACE FUNCTION public.activate_subscription_payment(p_order_id text, p_payment_id text, p_amount_paise integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- add_catalog_product_to_shop(uuid,uuid,jsonb,text,boolean)
CREATE OR REPLACE FUNCTION public.add_catalog_product_to_shop(p_store_id uuid, p_catalog_product_id uuid, p_variants jsonb, p_brand text DEFAULT NULL::text, p_available boolean DEFAULT true)
 RETURNS products
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store stores;
  cp catalog_products;
  prod products;
  item jsonb;
  v_price numeric;
  v_stock int;
  v_label text;
  v_var_id uuid;
  v_next_order int;
begin
  perform _assert_store_owner(p_store_id);

  select * into v_store from stores where id = p_store_id;
  select * into cp from catalog_products where id = p_catalog_product_id and is_active;
  if not found then
    raise exception 'Catalog product nahi mila';
  end if;
  if cp.business_type is distinct from v_store.business_type then
    raise exception 'Yeh catalog product is dukaan ke type ka nahi hai';
  end if;
  if exists (select 1 from products where store_id = p_store_id and catalog_product_id = cp.id) then
    raise exception 'Yeh product aapki dukaan mein pehle se hai';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'Kam se kam ek variant (price ke saath) daalein';
  end if;

  for item in select * from jsonb_array_elements(p_variants)
  loop
    v_price := (item->>'price')::numeric;
    v_stock := coalesce((item->>'stock')::int, 0);
    if v_price is null or v_price <= 0 then
      raise exception 'Selling price 0 se zyada hona chahiye';
    end if;
    if v_stock < 0 then
      raise exception 'Stock negative nahi ho sakta';
    end if;
  end loop;

  select coalesce(max(sort_order), 0) + 1 into v_next_order from products where store_id = p_store_id;

  insert into products (store_id, name, category, emoji, sort_order, description, image_url, image_urls, brand, sub_category, age_group, catalog_product_id, is_available)
  values (
    p_store_id, cp.name, cp.category, '📦', v_next_order, cp.description, cp.image_url,
    case when cp.image_url is null then '[]'::jsonb else jsonb_build_array(cp.image_url) end,
    coalesce(nullif(trim(p_brand), ''), cp.brand), cp.sub_category, cp.age_group, cp.id,
    coalesce(p_available, true)
  )
  returning * into prod;

  for item in select * from jsonb_array_elements(p_variants)
  loop
    v_label := coalesce(nullif(trim(item->>'label'), ''), 'Standard');
    v_stock := coalesce((item->>'stock')::int, 0);

    insert into variants (product_id, label, unit, price, stock, mrp, barcode, gst_rate)
    values (
      prod.id, v_label,
      coalesce(nullif(trim(item->>'unit'), ''), cp.unit, 'piece'),
      (item->>'price')::numeric, 0,
      nullif(item->>'mrp', '')::numeric,
      nullif(trim(item->>'barcode'), ''),
      coalesce(nullif(item->>'gst_rate', '')::numeric, cp.gst_rate, 0)
    )
    returning id into v_var_id;

    if v_stock > 0 then
      perform apply_stock_change(p_store_id, v_var_id, v_stock, 'opening', 'catalog', prod.id, 'Added from Central Catalog');
    end if;
  end loop;

  return prod;
end;
$function$;

-- add_khata_transaction(uuid,uuid,text,numeric,text)
CREATE OR REPLACE FUNCTION public.add_khata_transaction(p_store_id uuid, p_customer_id uuid, p_type text, p_amount numeric, p_description text)
 RETURNS TABLE(id uuid, new_balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_balance numeric;
  v_new_balance numeric;
  v_new_id uuid;
begin
  -- Sirf store ka owner hi khata entry add kar sake
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_type not in ('debit', 'credit') then
    raise exception 'Invalid transaction type';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount 0 se zyada hona chahiye';
  end if;

  -- Row lock lagakar current balance nikalo, taaki 2 entries same waqt
  -- add hone par race-condition se galat balance na bane.
  select khata_balance into v_current_balance from customers where id = p_customer_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Customer nahi mila';
  end if;

  v_new_balance := case when p_type = 'debit' then v_current_balance + p_amount else v_current_balance - p_amount end;

  update customers set khata_balance = v_new_balance where id = p_customer_id;

  insert into khata_transactions (store_id, customer_id, type, amount, description, running_balance, created_by)
  values (p_store_id, p_customer_id, p_type, p_amount, p_description, v_new_balance, auth.uid())
  returning khata_transactions.id into v_new_id;

  return query select v_new_id, v_new_balance;
end;
$function$;

-- adjust_variant_stock(uuid,integer,text)
CREATE OR REPLACE FUNCTION public.adjust_variant_stock(p_variant_id uuid, p_delta integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  perform _assert_store_owner(v_store_id);

  -- lock leke current stock dekho, taaki clamp sahi ho
  select stock into v_cur from variants where id = p_variant_id for update;
  return apply_stock_change(v_store_id, p_variant_id, greatest(p_delta, -v_cur), 'manual_adjust', 'manual', null, p_note);
end;
$function$;

-- admin_activate_store(uuid)
CREATE OR REPLACE FUNCTION public.admin_activate_store(p_store_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select admin_extend_subscription(p_store_id, 1) $function$;

-- admin_create_distributor(text,text,text,numeric)
CREATE OR REPLACE FUNCTION public.admin_create_distributor(p_name text, p_phone text, p_referral_code text, p_commission_rate numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;

  insert into distributors (name, phone, referral_code, commission_rate)
  values (p_name, p_phone, upper(p_referral_code), p_commission_rate)
  returning id into v_id;

  insert into distributor_commission_rate_history (distributor_id, rate, changed_by)
  values (v_id, p_commission_rate, auth.uid());

  return v_id;
end;
$function$;

-- admin_deactivate_store(uuid)
CREATE OR REPLACE FUNCTION public.admin_deactivate_store(p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _is_super_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  update stores set is_active = false where id = p_store_id;
end $function$;

-- admin_extend_subscription(uuid,integer)
CREATE OR REPLACE FUNCTION public.admin_extend_subscription(p_store_id uuid, p_months integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- admin_mark_commission_paid(uuid)
CREATE OR REPLACE FUNCTION public.admin_mark_commission_paid(p_distributor_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_count int;
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;

  update commission_ledger
  set status = 'Paid'
  where distributor_id = p_distributor_id and status in ('Pending', 'Approved');

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- admin_reassign_store_distributor(uuid,uuid,text)
CREATE OR REPLACE FUNCTION public.admin_reassign_store_distributor(p_store_id uuid, p_new_distributor_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- admin_set_distributor_type(uuid,text,numeric)
CREATE OR REPLACE FUNCTION public.admin_set_distributor_type(p_distributor_id uuid, p_type text, p_custom_rate numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- admin_set_store_price(uuid,integer)
CREATE OR REPLACE FUNCTION public.admin_set_store_price(p_store_id uuid, p_price integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _is_super_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_price not in (49, 199) then raise exception 'allowed prices: 49, 199'; end if;
  update stores set subscription_base_price = p_price where id = p_store_id;
end $function$;

-- admin_update_commission_tier(uuid,numeric)
CREATE OR REPLACE FUNCTION public.admin_update_commission_tier(p_tier_id uuid, p_rate numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  update commission_tiers set rate = p_rate, updated_at = now() where id = p_tier_id;
end;
$function$;

-- admin_update_referral_code(uuid,text)
CREATE OR REPLACE FUNCTION public.admin_update_referral_code(p_distributor_id uuid, p_new_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  update distributors set referral_code = upper(p_new_code), updated_at = now() where id = p_distributor_id;
end;
$function$;

-- admin_verify_death_claim(uuid,boolean,date)
CREATE OR REPLACE FUNCTION public.admin_verify_death_claim(p_claim_id uuid, p_approve boolean, p_effective_date date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- admin_verify_nominee(uuid,boolean)
CREATE OR REPLACE FUNCTION public.admin_verify_nominee(p_nominee_id uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  update distributor_nominees
  set verification_status = case when p_approve then 'Verified' else 'Rejected' end, updated_at = now()
  where id = p_nominee_id;
end;
$function$;

-- apply_gst_rate_to_all_products(uuid,numeric)
CREATE OR REPLACE FUNCTION public.apply_gst_rate_to_all_products(p_store_id uuid, p_rate numeric)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_count int;
begin
  -- Sirf usi store ka owner hi apne products ka GST rate bulk-set kar sake
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update variants
  set gst_rate = p_rate
  where product_id in (select id from products where store_id = p_store_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- apply_stock_change(uuid,uuid,integer,text,text,uuid,text,boolean)
CREATE OR REPLACE FUNCTION public.apply_stock_change(p_store_id uuid, p_variant_id uuid, p_delta integer, p_reason text, p_ref_type text DEFAULT NULL::text, p_ref_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_allow_negative boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_stock int;
  v_name text;
  v_new int;
begin
  select v.stock, p.name into v_stock, v_name
  from variants v
  join products p on p.id = v.product_id
  where v.id = p_variant_id and p.store_id = p_store_id
  for update of v;

  if not found then
    raise exception 'VARIANT_MISSING: Product is dukaan mein nahi mila';
  end if;

  if p_delta = 0 then
    return v_stock;
  end if;

  v_new := v_stock + p_delta;
  if v_new < 0 and not p_allow_negative then
    raise exception 'STOCK_UNAVAILABLE: % ka stock kam pad gaya', v_name;
  end if;

  perform set_config('app.stock_ctx', '1', true);
  update variants set stock = v_new where id = p_variant_id;
  perform set_config('app.stock_ctx', '', true);

  insert into stock_movements (store_id, variant_id, delta, stock_after, reason, ref_type, ref_id, note, created_by)
  values (p_store_id, p_variant_id, p_delta, v_new, p_reason, p_ref_type, p_ref_id, p_note, auth.uid());

  return v_new;
end;
$function$;

-- apply_subscription_webhook_update(text,text,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.apply_subscription_webhook_update(p_razorpay_subscription_id text, p_status text, p_next_billing_date timestamp with time zone, p_subscription_expires_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- assign_delivery(uuid,uuid,text)
CREATE OR REPLACE FUNCTION public.assign_delivery(p_order_id uuid, p_boy_id uuid, p_method text DEFAULT 'SHOP_DELIVERY'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- attribute_store_to_referral_code(uuid,text)
CREATE OR REPLACE FUNCTION public.attribute_store_to_referral_code(p_store_id uuid, p_referral_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_distributor_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    return;
  end if;
  select id into v_distributor_id from distributors where referral_code = p_referral_code and status = 'active';
  if v_distributor_id is null then return; end if;
  update stores set referred_by_distributor_id = v_distributor_id, referral_locked_at = now()
    where id = p_store_id and referred_by_distributor_id is null;
end $function$;

-- cancel_purchase(uuid,uuid)
CREATE OR REPLACE FUNCTION public.cancel_purchase(p_store_id uuid, p_purchase_id uuid)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pur purchases;
begin
  perform _assert_store_owner(p_store_id);
  update purchases
  set status = 'Cancelled', updated_at = now()
  where id = p_purchase_id and store_id = p_store_id and status in ('Draft', 'Ordered', 'Partially Received')
  returning * into pur;
  if not found then
    raise exception 'Yeh purchase cancel nahi ho sakti (Received ya pehle se Cancelled)';
  end if;
  return pur;
end;
$function$;

-- check_and_apply_founding_expiry(uuid)
CREATE OR REPLACE FUNCTION public.check_and_apply_founding_expiry(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$ begin return; end $function$;

-- claim_delivery_invite(text)
CREATE OR REPLACE FUNCTION public.claim_delivery_invite(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- claim_distributor_account(text)
CREATE OR REPLACE FUNCTION public.claim_distributor_account(p_referral_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_id uuid;
  v_existing_user uuid;
begin
  select id, user_id into v_id, v_existing_user from distributors where referral_code = upper(p_referral_code);

  if v_id is null then
    raise exception 'That referral code is not valid.';
  end if;

  if v_existing_user is not null and v_existing_user != auth.uid() then
    raise exception 'This referral code is already linked to another account.';
  end if;

  update distributors set user_id = auth.uid(), updated_at = now() where id = v_id;
end;
$function$;

-- compute_subscription_amount(integer,integer)
CREATE OR REPLACE FUNCTION public.compute_subscription_amount(p_base integer, p_months integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
end $function$;

-- count_real_stores()
CREATE OR REPLACE FUNCTION public.count_real_stores()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select count(*) from stores where is_test_store is not true; $function$;

-- create_combo_with_items(uuid,text,numeric,text,jsonb)
CREATE OR REPLACE FUNCTION public.create_combo_with_items(p_store_id uuid, p_name text, p_combo_price numeric, p_image_url text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_combo_id uuid;
  item jsonb;
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 2 then
    raise exception 'Combo mein kam se kam 2 items hone chahiye';
  end if;

  insert into combos (store_id, name, combo_price, image_url)
  values (p_store_id, p_name, p_combo_price, p_image_url)
  returning id into v_combo_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    -- Har variant is store ka hi hai, yeh confirm karte hain (koi
    -- doosri dukaan ka variant_id galti se/jaan-bujh kar na daala ja sake).
    if not exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = (item->>'variant_id')::uuid and p.store_id = p_store_id
    ) then
      raise exception 'Variant is store ka nahi hai';
    end if;

    insert into combo_items (combo_id, variant_id, qty)
    values (v_combo_id, (item->>'variant_id')::uuid, (item->>'qty')::int);
  end loop;

  return v_combo_id;
end;
$function$;

-- create_khata_customer(uuid,text,text)
CREATE OR REPLACE FUNCTION public.create_khata_customer(p_store_id uuid, p_phone text, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into customers (store_id, phone, name, address, pincode)
  values (p_store_id, p_phone, p_name, null, null)
  on conflict (store_id, phone) do update set name = excluded.name
  returning id into v_id;

  return v_id;
end;
$function$;

-- delivery_update_status(uuid,text)
CREATE OR REPLACE FUNCTION public.delivery_update_status(p_assignment_id uuid, p_new_status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- find_variant_by_barcode(uuid,text)
CREATE OR REPLACE FUNCTION public.find_variant_by_barcode(p_store_id uuid, p_barcode text)
 RETURNS TABLE(variant_id uuid, product_id uuid, product_name text, product_category text, product_emoji text, variant_label text, variant_unit text, variant_price numeric, variant_stock integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select v.id, p.id, p.name, p.category, p.emoji, v.label, v.unit, v.price, v.stock
  from variants v
  join products p on p.id = v.product_id
  where p.store_id = p_store_id and v.barcode = p_barcode
  limit 1;
end;
$function$;

-- generate_delivery_invite(uuid)
CREATE OR REPLACE FUNCTION public.generate_delivery_invite(p_boy_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- get_admin_distributor_overview()
CREATE OR REPLACE FUNCTION public.get_admin_distributor_overview()
 RETURNS TABLE(distributor_id uuid, name text, phone text, referral_code text, commission_rate numeric, status text, distributor_type text, current_rate numeric, nominee_eligible boolean, total_referred bigint, active_paid bigint, inactive bigint, this_month_commission numeric, lifetime_commission numeric, pending_payout numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- get_admin_stores()
CREATE OR REPLACE FUNCTION public.get_admin_stores()
 RETURNS SETOF store_details_admin
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  return query select * from store_details_admin order by created_at desc;
end;
$function$;

-- get_catalog_link_status(uuid)
CREATE OR REPLACE FUNCTION public.get_catalog_link_status(p_store_id uuid)
 RETURNS TABLE(product_id uuid, catalog_product_id uuid, catalog_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select p.id, p.catalog_product_id, c.is_active
    from products p
    join catalog_products c on c.id = p.catalog_product_id
    where p.store_id = p_store_id and c.is_active = false;
end;
$function$;

-- get_commission_tiers()
CREATE OR REPLACE FUNCTION public.get_commission_tiers()
 RETURNS SETOF commission_tiers
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  return query select * from commission_tiers order by min_shops;
end;
$function$;

-- get_customer_khata_history(uuid)
CREATE OR REPLACE FUNCTION public.get_customer_khata_history(p_customer_id uuid)
 RETURNS TABLE(id uuid, type text, amount numeric, description text, running_balance numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from customers c join stores s on s.id = c.store_id
    where c.id = p_customer_id and s.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select kt.id, kt.type, kt.amount, kt.description, kt.running_balance, kt.created_at
  from khata_transactions kt
  where kt.customer_id = p_customer_id
  order by kt.created_at desc;
end;
$function$;

-- get_delivery_dashboard(uuid)
CREATE OR REPLACE FUNCTION public.get_delivery_dashboard(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- get_distributor_dashboard()
CREATE OR REPLACE FUNCTION public.get_distributor_dashboard()
 RETURNS TABLE(distributor_id uuid, name text, referral_code text, commission_rate numeric, distributor_type text, current_rate numeric, nominee_eligible boolean, total_referred bigint, active_paid bigint, inactive bigint, this_month_commission numeric, lifetime_commission numeric, pending_payout numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- get_my_deliveries(text,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.get_my_deliveries(p_scope text DEFAULT 'active'::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(assignment_id uuid, order_id uuid, order_number text, status text, delivery_method text, customer_name text, customer_phone text, address text, landmark text, pincode text, items jsonb, total numeric, delivery_fee numeric, payment_method text, payment_status text, amount_to_collect numeric, assigned_at timestamp with time zone, accepted_at timestamp with time zone, picked_up_at timestamp with time zone, out_for_delivery_at timestamp with time zone, delivered_at timestamp with time zone, order_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- get_my_delivery_profile()
CREATE OR REPLACE FUNCTION public.get_my_delivery_profile()
 RETURNS TABLE(id uuid, name text, phone text, photo_url text, vehicle_type text, vehicle_number text, is_active boolean, login_enabled boolean, store_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.name, b.phone, b.photo_url, b.vehicle_type, b.vehicle_number, b.is_active, b.login_enabled, s.name
  from delivery_boys b join stores s on s.id = b.store_id
  where b.user_id = auth.uid();
$function$;

-- get_my_khata(uuid,text)
CREATE OR REPLACE FUNCTION public.get_my_khata(p_store_id uuid, p_phone text)
 RETURNS TABLE(khata_balance numeric, transactions jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.khata_balance,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', kt.type, 'amount', kt.amount, 'description', kt.description,
        'running_balance', kt.running_balance, 'created_at', kt.created_at
      ) order by kt.created_at desc)
      from khata_transactions kt where kt.customer_id = c.id
    ), '[]'::jsonb)
  from customers c
  where c.store_id = p_store_id and c.phone = p_phone
  limit 1;
$function$;

-- get_order_tracking(uuid,text)
CREATE OR REPLACE FUNCTION public.get_order_tracking(p_store_id uuid, p_order_number text)
 RETURNS TABLE(order_number text, status text, order_type text, items jsonb, total numeric, created_at timestamp with time zone, delivery_boy_name text, delivery_boy_phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.order_number, o.status, o.order_type, o.items, o.total, o.created_at,
    db.name, db.phone
  from orders o
  left join delivery_boys db on db.id = o.delivery_boy_id
  where o.store_id = p_store_id and o.order_number = p_order_number
  limit 1;
$function$;

-- get_order_tracking(uuid)
CREATE OR REPLACE FUNCTION public.get_order_tracking(order_id uuid)
 RETURNS TABLE(id uuid, order_number text, customer_name text, address text, landmark text, pincode text, payment_method text, payment_status text, status text, items jsonb, total numeric, created_at timestamp with time zone, store_name text, store_slug text, store_whatsapp text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    o.id, o.order_number, o.customer_name, o.address, o.landmark, o.pincode,
    o.payment_method, o.payment_status, o.status, o.items, o.total, o.created_at,
    s.name as store_name, s.slug as store_slug, s.whatsapp_number as store_whatsapp
  from orders o
  join stores s on s.id = o.store_id
  where o.id = order_id
  limit 1;
$function$;

-- get_order_tracking(uuid,text,text)
CREATE OR REPLACE FUNCTION public.get_order_tracking(p_store_id uuid, p_order_number text, p_phone text)
 RETURNS TABLE(order_number text, status text, order_type text, total numeric, created_at timestamp with time zone, delivery_boy_name text, delivery_boy_phone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.order_number, o.status, o.order_type, o.total, o.created_at,
         case when o.status in ('Ready','Out for Delivery') then db.name  end,
         case when o.status in ('Ready','Out for Delivery') then db.phone end
  from orders o
  left join delivery_boys db on db.id = o.delivery_boy_id
  where o.store_id = p_store_id
    and o.order_number = upper(trim(p_order_number))
    and length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 10
    and right(regexp_replace(coalesce(o.customer_phone,''), '\D', '', 'g'), 10)
      = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  limit 1;
$function$;

-- get_server_time()
CREATE OR REPLACE FUNCTION public.get_server_time()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
AS $function$
  select now();
$function$;

-- get_store_delivery_assignments(uuid,uuid,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.get_store_delivery_assignments(p_store_id uuid, p_boy_id uuid DEFAULT NULL::uuid, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(assignment_id uuid, order_id uuid, order_number text, customer_name text, total numeric, delivery_boy_id uuid, delivery_boy_name text, delivery_method text, status text, assigned_at timestamp with time zone, accepted_at timestamp with time zone, picked_up_at timestamp with time zone, out_for_delivery_at timestamp with time zone, delivered_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- get_store_khata_overview(uuid)
CREATE OR REPLACE FUNCTION public.get_store_khata_overview(p_store_id uuid)
 RETURNS TABLE(customer_id uuid, customer_name text, customer_phone text, khata_balance numeric, last_transaction_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select c.id, c.name, c.phone, c.khata_balance,
    (select max(kt.created_at) from khata_transactions kt where kt.customer_id = c.id)
  from customers c
  where c.store_id = p_store_id and c.khata_balance != 0
  order by c.khata_balance desc;
end;
$function$;

-- get_suppliers_overview(uuid)
CREATE OR REPLACE FUNCTION public.get_suppliers_overview(p_store_id uuid)
 RETURNS TABLE(id uuid, name text, phone text, address text, gstin text, notes text, is_active boolean, payable_balance numeric, total_purchased numeric, purchase_count bigint, last_purchase_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.name, s.phone, s.address, s.gstin, s.notes, s.is_active, s.payable_balance,
         coalesce(sum(p.received_amount) filter (where p.status <> 'Cancelled'), 0) as total_purchased,
         count(p.id) filter (where p.status <> 'Cancelled') as purchase_count,
         max(p.purchase_date) filter (where p.status <> 'Cancelled') as last_purchase_date
  from suppliers s
  left join purchases p on p.supplier_id = s.id
  where s.store_id = p_store_id
    and exists (select 1 from stores st where st.id = p_store_id and st.user_id = auth.uid())
  group by s.id
  order by s.is_active desc, s.name;
$function$;

-- get_tier_rate(integer)
CREATE OR REPLACE FUNCTION public.get_tier_rate(p_shop_count integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_rate numeric;
begin
  select rate into v_rate from commission_tiers
  where p_shop_count >= min_shops and (max_shops is null or p_shop_count <= max_shops)
  order by min_shops desc
  limit 1;
  return coalesce(v_rate, 0);
end;
$function$;

-- get_todays_khata_collection(uuid)
CREATE OR REPLACE FUNCTION public.get_todays_khata_collection(p_store_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total numeric;
begin
  if not exists (select 1 from stores where id = p_store_id and user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select coalesce(sum(kt.amount), 0) into v_total
  from khata_transactions kt
  where kt.store_id = p_store_id
    and kt.type = 'credit'
    and kt.created_at::date = current_date;

  return v_total;
end;
$function$;

-- guard_delivery_boys()
CREATE OR REPLACE FUNCTION public.guard_delivery_boys()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
end $function$;

-- guard_order_store_active()
CREATE OR REPLACE FUNCTION public.guard_order_store_active()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from stores
    where id = new.store_id and is_active is not false
      and subscription_expires_at is not null and subscription_expires_at > now()
  ) then
    raise exception 'STORE_INACTIVE: Yeh dukaan abhi orders nahi le rahi hai.';
  end if;
  return new;
end $function$;

-- guard_store_protected_columns()
CREATE OR REPLACE FUNCTION public.guard_store_protected_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
end $function$;

-- guard_variant_stock()
CREATE OR REPLACE FUNCTION public.guard_variant_stock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.stock_ctx', true), '') <> '1' then
    raise exception 'Stock seedha change nahi ho sakta — apply_stock_change / set_variant_stock use karein';
  end if;
  return new;
end;
$function$;

-- is_slug_available(text)
CREATE OR REPLACE FUNCTION public.is_slug_available(check_slug text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return not exists (select 1 from stores where slug = check_slug);
end;
$function$;

-- is_store_active(uuid)
CREATE OR REPLACE FUNCTION public.is_store_active(store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  store_record record;
begin
  select is_active, subscription_expires_at
  into store_record
  from stores
  where id = store_id;

  -- Agar store nahi mila
  if not found then return false; end if;

  -- Agar manually deactivate kiya hai
  if not store_record.is_active then return false; end if;

  -- Agar subscription expire ho gayi
  if store_record.subscription_expires_at < now() then
    -- Auto-deactivate
    update stores set is_active = false where id = store_id;
    return false;
  end if;

  return true;
end;
$function$;

-- list_store_delivery_methods(uuid)
CREATE OR REPLACE FUNCTION public.list_store_delivery_methods(p_store_id uuid)
 RETURNS TABLE(method text, enabled boolean, implemented boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform _assert_store_owner(p_store_id);
  return query
    select m.method, _method_enabled(p_store_id, m.method), (m.method = 'SHOP_DELIVERY')
    from (values ('SHOP_DELIVERY'),('LOCAL_PARTNER'),('SHIPROCKET')) as m(method);
end $function$;

-- mark_delivery_notifications_read()
CREATE OR REPLACE FUNCTION public.mark_delivery_notifications_read()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b delivery_boys;
begin
  b := _my_delivery_boy();
  update delivery_notifications set read_at = now() where delivery_boy_id = b.id and read_at is null;
end $function$;

-- mark_purchase_ordered(uuid,uuid)
CREATE OR REPLACE FUNCTION public.mark_purchase_ordered(p_store_id uuid, p_purchase_id uuid)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pur purchases;
begin
  perform _assert_store_owner(p_store_id);
  update purchases
  set status = 'Ordered', ordered_at = coalesce(ordered_at, now()), updated_at = now()
  where id = p_purchase_id and store_id = p_store_id and status = 'Draft'
  returning * into pur;
  if not found then
    raise exception 'Sirf Draft purchase ko Ordered mark kar sakte hain';
  end if;
  return pur;
end;
$function$;

-- place_order(uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric,text,numeric,date,text,text,numeric,numeric,numeric,numeric,numeric)
CREATE OR REPLACE FUNCTION public.place_order(p_store_id uuid, p_order_number text, p_customer_name text, p_customer_phone text, p_address text, p_landmark text, p_pincode text, p_payment_method text, p_payment_status text, p_status text, p_items jsonb, p_total numeric, p_order_type text DEFAULT 'Delivery'::text, p_delivery_fee numeric DEFAULT 0, p_booking_date date DEFAULT NULL::date, p_booking_slot text DEFAULT NULL::text, p_customer_state text DEFAULT NULL::text, p_discount_amount numeric DEFAULT 0, p_taxable_amount numeric DEFAULT NULL::numeric, p_cgst_amount numeric DEFAULT 0, p_sgst_amount numeric DEFAULT 0, p_igst_amount numeric DEFAULT 0)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_product_name text;
  v_order_id uuid := gen_random_uuid();
  new_order orders;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_variant_id := (item->>'variant_id')::uuid;
    v_qty := (item->>'qty')::int;
    v_product_name := coalesce(item->>'name', 'Item');

    if v_variant_id is null then
      raise exception 'VARIANT_MISSING: % ke liye variant ID nahi mila', v_product_name;
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'STOCK_UNAVAILABLE: % ki quantity sahi nahi hai', v_product_name;
    end if;

    -- Dukaandar ne product ko "Available: No" kiya ho to order nahi (storefront bhi rokta hai,
    -- yeh server-side guard hai taaki seedha API call se bhi na ho sake)
    if exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = v_variant_id and p.store_id = p_store_id and p.is_available = false
    ) then
      raise exception 'STOCK_UNAVAILABLE: % abhi uplabdh nahi hai', v_product_name;
    end if;

    perform apply_stock_change(p_store_id, v_variant_id, -v_qty, 'sale', 'order', v_order_id);
  end loop;

  insert into orders (
    id, store_id, order_number, customer_name, customer_phone, address,
    landmark, pincode, payment_method, payment_status, status, items, total, order_type, delivery_fee,
    booking_date, booking_slot, customer_state, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount
  ) values (
    v_order_id, p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total, p_order_type,
    case when p_order_type in ('Pickup', 'Appointment', 'Dine In') then 0 else p_delivery_fee end,
    p_booking_date, p_booking_slot, p_customer_state, p_discount_amount, p_taxable_amount, p_cgst_amount, p_sgst_amount, p_igst_amount
  )
  returning * into new_order;

  return new_order;
end;
$function$;

-- receive_purchase(uuid,uuid,jsonb,numeric,text)
CREATE OR REPLACE FUNCTION public.receive_purchase(p_store_id uuid, p_purchase_id uuid, p_receipts jsonb DEFAULT NULL::jsonb, p_paid_now numeric DEFAULT 0, p_payment_method text DEFAULT 'Cash'::text)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pur purchases;
  v_before numeric;
  v_value numeric;
begin
  perform _assert_store_owner(p_store_id);

  if coalesce(p_paid_now, 0) < 0 then
    raise exception 'Paid amount negative nahi ho sakta';
  end if;
  if p_payment_method not in ('Cash', 'UPI', 'Bank Transfer', 'Other') then
    raise exception 'Payment method galat hai';
  end if;

  select received_amount into v_before from purchases where id = p_purchase_id and store_id = p_store_id;
  if not found then
    raise exception 'Purchase nahi mila';
  end if;

  pur := _receive_purchase(p_store_id, p_purchase_id, p_receipts);
  v_value := pur.received_amount - v_before;

  if coalesce(p_paid_now, 0) > v_value then
    raise exception 'Paid amount receive hue maal ki value se zyada nahi ho sakta';
  end if;
  if coalesce(p_paid_now, 0) > 0 then
    perform _record_supplier_payment(p_store_id, pur.supplier_id, p_paid_now, p_payment_method, 'Paid at receiving ' || pur.purchase_number, pur.id);
  end if;

  return pur;
end;
$function$;

-- record_supplier_payment(uuid,uuid,numeric,text,text)
CREATE OR REPLACE FUNCTION public.record_supplier_payment(p_store_id uuid, p_supplier_id uuid, p_amount numeric, p_method text DEFAULT 'Cash'::text, p_note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform _assert_store_owner(p_store_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount 0 se zyada hona chahiye';
  end if;
  if p_method not in ('Cash', 'UPI', 'Bank Transfer', 'Other') then
    raise exception 'Payment method galat hai';
  end if;
  return _record_supplier_payment(p_store_id, p_supplier_id, p_amount, p_method, nullif(trim(p_note), ''), null);
end;
$function$;

-- refresh_storage_usage(uuid)
CREATE OR REPLACE FUNCTION public.refresh_storage_usage(p_store_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- register_distributor_nominee(uuid,text,text,text)
CREATE OR REPLACE FUNCTION public.register_distributor_nominee(p_distributor_id uuid, p_name text, p_relationship text, p_phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- reverse_commission_on_deactivation()
CREATE OR REPLACE FUNCTION public.reverse_commission_on_deactivation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

-- revoke_delivery_login(uuid)
CREATE OR REPLACE FUNCTION public.revoke_delivery_login(p_boy_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_store uuid;
begin
  select store_id into v_store from delivery_boys where id = p_boy_id;
  if v_store is null then raise exception 'Delivery boy nahi mila'; end if;
  perform _assert_store_owner(v_store);
  perform set_config('app.dstaff_ctx', '1', true);
  update delivery_boys set user_id = null, login_enabled = false, invite_code = null, invite_expires_at = null where id = p_boy_id;
end $function$;

-- run_monthly_commission_calculation(date)
CREATE OR REPLACE FUNCTION public.run_monthly_commission_calculation(p_billing_month date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  return run_monthly_commission_calculation_internal(p_billing_month);
end;
$function$;

-- run_monthly_commission_calculation_internal(date)
CREATE OR REPLACE FUNCTION public.run_monthly_commission_calculation_internal(p_billing_month date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- save_customer_details(uuid,text,text,text,text,boolean,text)
CREATE OR REPLACE FUNCTION public.save_customer_details(p_store_id uuid, p_phone text, p_name text, p_address text, p_landmark text, p_update_landmark boolean, p_pincode text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_phone is null or p_phone !~ '^[0-9]{10}$' then raise exception 'Invalid phone'; end if;
  if coalesce(length(trim(p_name)), 0) = 0 or length(p_name) > 100 then raise exception 'Invalid name'; end if;
  if length(coalesce(p_address, '')) > 300 or length(coalesce(p_landmark, '')) > 150 or length(coalesce(p_pincode, '')) > 10 then
    raise exception 'Invalid address';
  end if;
  if not exists (select 1 from stores where id = p_store_id and is_active is not false
                 and subscription_expires_at > now()) then
    raise exception 'STORE_INACTIVE';
  end if;
  insert into customers (store_id, phone, name, address, landmark, pincode, updated_at)
  values (p_store_id, p_phone, trim(p_name), p_address,
          case when p_update_landmark then nullif(p_landmark, '') else null end, p_pincode, now())
  on conflict (store_id, phone) do update set
    name = excluded.name, address = excluded.address, pincode = excluded.pincode,
    landmark = case when p_update_landmark then nullif(p_landmark, '') else customers.landmark end,
    updated_at = now();
end $function$;

-- save_purchase(uuid,uuid,jsonb,text,uuid,text,date,text,numeric,text)
CREATE OR REPLACE FUNCTION public.save_purchase(p_store_id uuid, p_supplier_id uuid, p_items jsonb, p_status text DEFAULT 'Draft'::text, p_purchase_id uuid DEFAULT NULL::uuid, p_invoice_number text DEFAULT NULL::text, p_purchase_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_paid_now numeric DEFAULT 0, p_payment_method text DEFAULT 'Cash'::text)
 RETURNS purchases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pur purchases;
  item jsonb;
  v_variant uuid;
  v_qty int;
  v_price numeric;
  v_total numeric := 0;
  v_seq int;
  v_pname text;
  v_vlabel text;
  v_vunit text;
begin
  perform _assert_store_owner(p_store_id);

  if p_status not in ('Draft', 'Ordered', 'Received') then
    raise exception 'Status galat hai';
  end if;
  if not exists (select 1 from suppliers where id = p_supplier_id and store_id = p_store_id and is_active) then
    raise exception 'Supplier select karein';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Kam se kam ek product add karein';
  end if;
  if coalesce(p_paid_now, 0) < 0 then
    raise exception 'Paid amount negative nahi ho sakta';
  end if;
  if coalesce(p_paid_now, 0) > 0 and p_status <> 'Received' then
    raise exception 'Payment tabhi record hoga jab maal receive ho';
  end if;
  if p_payment_method not in ('Cash', 'UPI', 'Bank Transfer', 'Other') then
    raise exception 'Payment method galat hai';
  end if;

  -- Pehle sab items validate + total nikalo
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (item->>'qty')::int;
    v_price := (item->>'purchase_price')::numeric;
    if (item->>'variant_id') is null then
      raise exception 'Product select karein';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity 0 se zyada honi chahiye';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Purchase price galat hai';
    end if;
    if not exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = (item->>'variant_id')::uuid and p.store_id = p_store_id
    ) then
      raise exception 'Product is dukaan mein nahi mila';
    end if;
    v_total := v_total + v_qty * v_price;
  end loop;

  if coalesce(p_paid_now, 0) > v_total then
    raise exception 'Paid amount purchase total se zyada nahi ho sakta';
  end if;

  if p_purchase_id is null then
    perform pg_advisory_xact_lock(hashtextextended('purchase_seq:' || p_store_id::text, 0));
    select coalesce(max(purchase_seq), 0) + 1 into v_seq from purchases where store_id = p_store_id;

    insert into purchases (store_id, supplier_id, purchase_seq, purchase_number, status, invoice_number, purchase_date, notes, total_amount, created_by, ordered_at)
    values (
      p_store_id, p_supplier_id, v_seq, 'PUR-' || lpad(v_seq::text, 4, '0'),
      case when p_status = 'Draft' then 'Draft' else 'Ordered' end,
      nullif(trim(p_invoice_number), ''), coalesce(p_purchase_date, current_date), nullif(trim(p_notes), ''),
      v_total, auth.uid(), case when p_status = 'Draft' then null else now() end
    )
    returning * into pur;
  else
    select * into pur from purchases where id = p_purchase_id and store_id = p_store_id for update;
    if not found then
      raise exception 'Purchase nahi mila';
    end if;
    if pur.status not in ('Draft', 'Ordered') or exists (select 1 from purchase_items where purchase_id = pur.id and qty_received > 0) then
      raise exception 'Sirf Draft ya Ordered purchase edit ho sakti hai';
    end if;

    update purchases
    set supplier_id = p_supplier_id,
        status = case when p_status = 'Draft' then 'Draft' else 'Ordered' end,
        invoice_number = nullif(trim(p_invoice_number), ''),
        purchase_date = coalesce(p_purchase_date, purchase_date),
        notes = nullif(trim(p_notes), ''),
        total_amount = v_total,
        ordered_at = case when p_status = 'Draft' then null else coalesce(ordered_at, now()) end,
        updated_at = now()
    where id = pur.id
    returning * into pur;

    delete from purchase_items where purchase_id = pur.id;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    select p.name, v.label, v.unit into v_pname, v_vlabel, v_vunit
    from variants v join products p on p.id = v.product_id
    where v.id = (item->>'variant_id')::uuid;

    insert into purchase_items (purchase_id, store_id, variant_id, product_name, variant_label, unit, qty_ordered, purchase_price)
    values (pur.id, p_store_id, (item->>'variant_id')::uuid, v_pname, v_vlabel, v_vunit, (item->>'qty')::int, (item->>'purchase_price')::numeric);
  end loop;

  if p_status = 'Received' then
    pur := _receive_purchase(p_store_id, pur.id, null);
    if coalesce(p_paid_now, 0) > 0 then
      perform _record_supplier_payment(p_store_id, p_supplier_id, p_paid_now, p_payment_method, 'Paid at purchase ' || pur.purchase_number, pur.id);
    end if;
  end if;

  return pur;
end;
$function$;

-- set_store_delivery_method(uuid,text,boolean)
CREATE OR REPLACE FUNCTION public.set_store_delivery_method(p_store_id uuid, p_method text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

-- set_variant_stock(uuid,integer,text)
CREATE OR REPLACE FUNCTION public.set_variant_stock(p_variant_id uuid, p_new_stock integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  perform _assert_store_owner(v_store_id);

  return apply_stock_change(v_store_id, p_variant_id, p_new_stock - v_cur, 'manual_adjust', 'manual', null, p_note);
end;
$function$;

-- submit_death_claim(uuid,uuid,jsonb)
CREATE OR REPLACE FUNCTION public.submit_death_claim(p_distributor_id uuid, p_nominee_id uuid, p_documents jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not (_is_super_admin() or exists (select 1 from distributors where id = p_distributor_id and user_id = auth.uid())) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from distributor_nominees where id = p_nominee_id and distributor_id = p_distributor_id) then
    raise exception 'Invalid nominee';
  end if;
  insert into distributor_death_claims (distributor_id, nominee_id, supporting_documents, claim_status)
  values (p_distributor_id, p_nominee_id, p_documents, 'Pending') returning id into v_id;
  return v_id;
end $function$;

-- update_combo_with_items(uuid,text,numeric,text,jsonb)
CREATE OR REPLACE FUNCTION public.update_combo_with_items(p_combo_id uuid, p_name text, p_combo_price numeric, p_image_url text, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store_id uuid;
  item jsonb;
begin
  select store_id into v_store_id from combos
  where id = p_combo_id and exists (
    select 1 from stores where stores.id = combos.store_id and stores.user_id = auth.uid()
  );
  if v_store_id is null then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_array_length(p_items) < 2 then
    raise exception 'Combo mein kam se kam 2 items hone chahiye';
  end if;

  update combos set name = p_name, combo_price = p_combo_price, image_url = p_image_url
  where id = p_combo_id;

  delete from combo_items where combo_id = p_combo_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    if not exists (
      select 1 from variants v join products p on p.id = v.product_id
      where v.id = (item->>'variant_id')::uuid and p.store_id = v_store_id
    ) then
      raise exception 'Variant is store ka nahi hai';
    end if;

    insert into combo_items (combo_id, variant_id, qty)
    values (p_combo_id, (item->>'variant_id')::uuid, (item->>'qty')::int);
  end loop;
end;
$function$;

-- upsert_supplier(uuid,text,text,text,text,text,uuid,numeric,boolean)
CREATE OR REPLACE FUNCTION public.upsert_supplier(p_store_id uuid, p_name text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_gstin text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_supplier_id uuid DEFAULT NULL::uuid, p_opening_payable numeric DEFAULT 0, p_is_active boolean DEFAULT true)
 RETURNS suppliers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sup suppliers;
begin
  perform _assert_store_owner(p_store_id);

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Supplier ka naam zaroori hai';
  end if;

  if p_supplier_id is null then
    insert into suppliers (store_id, name, phone, address, gstin, notes, is_active)
    values (p_store_id, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_address), ''), nullif(trim(p_gstin), ''), nullif(trim(p_notes), ''), true)
    returning * into sup;

    if coalesce(p_opening_payable, 0) > 0 then
      update suppliers set payable_balance = p_opening_payable where id = sup.id returning * into sup;
      insert into supplier_transactions (store_id, supplier_id, type, amount, running_balance, note, created_by)
      values (p_store_id, sup.id, 'opening', p_opening_payable, p_opening_payable, 'Opening balance (pehle se baaki)', auth.uid());
    end if;
  else
    update suppliers
    set name = trim(p_name), phone = nullif(trim(p_phone), ''), address = nullif(trim(p_address), ''),
        gstin = nullif(trim(p_gstin), ''), notes = nullif(trim(p_notes), ''), is_active = coalesce(p_is_active, true)
    where id = p_supplier_id and store_id = p_store_id
    returning * into sup;
    if not found then
      raise exception 'Supplier nahi mila';
    end if;
  end if;

  return sup;
exception
  when unique_violation then
    raise exception 'Is naam ka supplier pehle se hai';
end;
$function$;
