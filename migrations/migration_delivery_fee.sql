-- ============================================================
-- DELIVERY CHARGE — dukaandar apna delivery fee khud set kare
-- ============================================================
-- Do settings: fixed delivery_fee (jaise ₹20), aur optional
-- free_delivery_above (jaise ₹300 se upar order ho to delivery free).
-- Dono NULL/0 rakh sakte hain agar dukaandar delivery charge lena hi
-- nahi chahta — behavior bilkul pehle jaisa hi rahega (₹0 delivery fee).

alter table stores add column if not exists delivery_fee numeric not null default 0;
alter table stores add column if not exists free_delivery_above numeric; -- NULL = koi free-delivery threshold nahi

-- Order record mein bhi delivery_fee save karte hain (audit/history ke
-- liye) — taaki baad mein order dekhne par pata chale us waqt kya
-- charge liya gaya tha, chahe dukaandar ne rate baad mein badal diya ho.
alter table orders add column if not exists delivery_fee numeric not null default 0;

-- ============================================================
-- place_order() ko extend karo — delivery_fee bhi accept kare aur
-- total mein add kare (sirf Delivery orders ke liye; Pickup orders ka
-- delivery_fee hamesha 0 rahega, chahe store ka rate kuch bhi ho).
-- ============================================================
drop function if exists place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text);

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
  p_delivery_fee numeric default 0
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
    landmark, pincode, payment_method, payment_status, status, items, total, order_type, delivery_fee
  ) values (
    p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total, p_order_type,
    case when p_order_type = 'Pickup' then 0 else p_delivery_fee end
  )
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text, numeric) to anon, authenticated;
