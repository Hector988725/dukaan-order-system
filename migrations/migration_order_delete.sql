-- ============================================================
-- ORDERS: Owner ko apne orders delete karne ki permission
-- ============================================================
-- Abhi tak sirf "view" aur "update" policy thi — "delete" thi hi nahi,
-- isliye dukaandar galti se bane test order bhi delete nahi kar sakta
-- tha. Yeh sirf store ke owner ko, sirf apne hi orders delete karne
-- deta hai — customer ya koi aur kisi order ko delete nahi kar sakta.
--
-- NOTE: Order delete karne se agar us order ne stock decrement kiya
-- tha, woh stock automatically wapas nahi aata (yeh jaan-bujh kar
-- simple rakha hai — agar stock wapas chahiye ho, dukaandar Products
-- tab se manually +/- se adjust kar sakta hai).
create policy "Owner can delete own orders" on orders for delete
  using (exists (select 1 from stores where stores.id = orders.store_id and stores.user_id = auth.uid()));
