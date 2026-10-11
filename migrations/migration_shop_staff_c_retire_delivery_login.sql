-- ============================================================
-- SHOP STAFF — MIGRATION C: purana alag "delivery boy login" band
-- Ab delivery karne wale Staff hain (Admin → Staff → "Delivery karna").
-- Purane code se naya delivery-login banana/jodna ab band.
-- Pehle migration_shop_staff_a.sql aur _b_delivery.sql chal chuki honi chahiye.
-- Undo: grant execute on function public.<name> to authenticated;  (teeno ke liye)
-- ============================================================
revoke execute on function public.claim_delivery_invite(text)  from public, anon, authenticated;
revoke execute on function public.generate_delivery_invite(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_delivery_login(uuid)  from public, anon, authenticated;

-- Check (teeno false aane chahiye):
select
  has_function_privilege('authenticated','public.claim_delivery_invite(text)','execute')   as claim_ok,
  has_function_privilege('authenticated','public.generate_delivery_invite(uuid)','execute') as generate_ok,
  has_function_privilege('authenticated','public.revoke_delivery_login(uuid)','execute')    as revoke_ok;
