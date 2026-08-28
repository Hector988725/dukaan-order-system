-- ============================================================
-- ATOMIC ORDER PLACEMENT — stock automatically kam hoga, aur
-- overselling kabhi nahi hogi (chahe 2 customers same second
-- mein last item order kar rahe hon)
-- ============================================================
-- PEHLE: createOrder() sirf orders table mein insert karta tha —
-- variants ka stock kabhi automatically kam nahi hota tha. Dukaandar
-- ko manually dashboard se stock ghatana padta tha har order ke baad.
--
-- AB: Order place karte waqt yeh function har item ka stock check
-- karke usi waqt kam karta hai — SAB EK HI TRANSACTION MEIN. Agar
-- kisi bhi item ka stock kam pada, POORA order (aur stock changes)
-- rollback ho jaate hain — customer ko clear error milta hai
-- "Stock khatam hai", aur galti se koi order create nahi hota jiska
-- saaman dukaan mein hai hi nahi.
-- ============================================================

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
  p_total numeric
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

    -- Atomic check-and-decrement: sirf tabhi update hoga jab stock
    -- kaafi ho. Race condition (2 customers ek saath order karein)
    -- yahan naturally handle ho jaata hai kyunki Postgres row-level
    -- lock khud laga deta hai is UPDATE ke waqt.
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
    landmark, pincode, payment_method, payment_status, status, items, total
  ) values (
    p_store_id, p_order_number, p_customer_name, p_customer_phone, p_address,
    p_landmark, p_pincode, p_payment_method, p_payment_status, p_status, p_items, p_total
  )
  returning * into new_order;

  return new_order;
end;
$$;

grant execute on function place_order(uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric) to anon, authenticated;
