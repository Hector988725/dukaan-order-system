-- ============================================================
-- GST / TAX — optional feature, default OFF har store ke liye
-- ============================================================
-- Sab naye columns NULLABLE ya DEFAULT ke saath hain — purane
-- products/orders/stores par bilkul asar nahi padta. Jab tak
-- dukaandar khud "GST Settings" se enable nahi karta, UI mein kuch
-- naya dikhega hi nahi (na product form mein, na checkout mein).

-- Store-level GST settings
alter table stores add column if not exists gst_enabled boolean not null default false;
alter table stores add column if not exists gst_price_type text not null default 'exclusive' check (gst_price_type in ('inclusive', 'exclusive'));
alter table stores add column if not exists gst_state text; -- dukaan kis state mein hai (CGST+SGST vs IGST decide karne ke liye)
alter table stores add column if not exists gstin text; -- optional, invoice par dikhane ke liye

-- Har variant (service/product) ka apna GST rate — default 0%, matlab
-- purane saare products automatically "0% GST" honge jab tak dukaandar
-- khud badle.
alter table variants add column if not exists gst_rate numeric not null default 0;

-- Order ke time ka tax-breakdown snapshot — taaki baad mein GST rate
-- ya settings badlein to bhi purane orders ka invoice kabhi na badle
-- (jaisa commission_ledger mein rate snapshot hota hai, wahi pattern).
alter table orders add column if not exists customer_state text;
alter table orders add column if not exists discount_amount numeric default 0;
alter table orders add column if not exists taxable_amount numeric;
alter table orders add column if not exists cgst_amount numeric default 0;
alter table orders add column if not exists sgst_amount numeric default 0;
alter table orders add column if not exists igst_amount numeric default 0;

-- place_order() ko naye optional params ke saath extend karna — sab
-- default null/0 hain, isliye purane saare calls (jo yeh params bhejte
-- hi nahi) bilkul waise hi kaam karte rahenge.
drop function if exists place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text, numeric, date, text);

create or replace function place_order(
  p_store_id uuid,
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_landmark text,
  p_pincode text,
  p_payment_method text,
  p_payment_status text,
  p_status text,
  p_items jsonb,
  p_total numeric,
  p_order_type text default 'Delivery',
  p_delivery_fee numeric default 0,
  p_booking_date date default null,
  p_booking_slot text default null,
  p_customer_state text default null,
  p_discount_amount numeric default 0,
  p_taxable_amount numeric default null,
  p_cgst_amount numeric default 0,
  p_sgst_amount numeric default 0,
  p_igst_amount numeric default 0
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_product_name text;
  v_new_stock int;
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

    update variants
    set stock = stock - v_qty
    where id = v_variant_id and stock >= v_qty
    returning stock into v_new_stock;

    if not found then
      raise exception 'STOCK_UNAVAILABLE: % ka stock kam pad gaya', v_product_name;
    end if;
  end loop;

  insert into orders (
    store_id, order_number, customer_name, customer_phone, address,
    landmark, pincode, payment_method, payment_status, status, items, total, order_type, delivery_fee,
    booking_date, booking_slot, customer_state, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount
  ) values (
    p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total, p_order_type,
    case when p_order_type in ('Pickup', 'Appointment', 'Dine In') then 0 else p_delivery_fee end,
    p_booking_date, p_booking_slot, p_customer_state, p_discount_amount, p_taxable_amount, p_cgst_amount, p_sgst_amount, p_igst_amount
  )
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text, numeric, date, text, text, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;

-- ============================================================
-- BULK GST APPLY — ek click mein saare products ka GST rate set karna
-- (har product mein alag-alag jaake set karna practical nahi hai)
-- ============================================================
create or replace function apply_gst_rate_to_all_products(p_store_id uuid, p_rate numeric)
returns int as $$
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
$$ language plpgsql security definer;

grant execute on function apply_gst_rate_to_all_products(uuid, numeric) to authenticated;
