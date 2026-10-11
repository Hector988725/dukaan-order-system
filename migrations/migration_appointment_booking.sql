-- ============================================================
-- APPOINTMENT BOOKING — Salon/Beauty Parlour ke liye
-- ============================================================
-- Existing e-commerce order flow (grocery/fashion/electronics/etc) ko
-- BILKUL NAHI chhera — sirf 2 naye NULLABLE columns add ho rahe hain
-- orders table mein, aur place_order() mein 2 naye OPTIONAL parameters
-- (default null) add ho rahe hain. Purane saare calls (jo yeh 2 naye
-- params bhejte hi nahi) waise hi kaam karte rahenge, kyunki defaults
-- null hain.
-- ============================================================

alter table orders add column if not exists booking_date date;
alter table orders add column if not exists booking_slot text; -- jaise "10:00 AM"

drop function if exists place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text, numeric);

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
  p_booking_slot text default null
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
    booking_date, booking_slot
  ) values (
    p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total, p_order_type,
    case when p_order_type in ('Pickup', 'Appointment') then 0 else p_delivery_fee end,
    p_booking_date, p_booking_slot
  )
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text, numeric, date, text) to anon, authenticated;
