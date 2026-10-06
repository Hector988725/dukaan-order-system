-- ============================================================
-- SECURITY PHASE 1C — STEP A (safe, additive)
-- Order tracking: ab order number ke saath customer ka phone bhi match hona
-- chahiye. Pehle sirf 4-digit order number se koi bhi kisi ka order dekh
-- sakta tha (items, total, delivery boy ka phone).
-- Purana 2-argument function ABHI nahi chhua gaya (purana frontend chalta rahe).
-- ============================================================
create or replace function public.get_order_tracking(p_store_id uuid, p_order_number text, p_phone text)
returns table (
  order_number text, status text, order_type text, total numeric, created_at timestamptz,
  delivery_boy_name text, delivery_boy_phone text
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.get_order_tracking(uuid, text, text) from public;
grant execute on function public.get_order_tracking(uuid, text, text) to anon, authenticated;
