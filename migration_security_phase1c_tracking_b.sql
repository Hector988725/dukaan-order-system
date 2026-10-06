-- ============================================================
-- SECURITY PHASE 1C — STEP B
-- SIRF tab chalao jab naya frontend (phone wala tracking) live ho chuka ho.
-- Purana phone-less tracking function band karta hai.
-- ============================================================
revoke execute on function public.get_order_tracking(uuid, text) from anon, authenticated, public;
