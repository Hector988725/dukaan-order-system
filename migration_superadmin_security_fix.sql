-- ============================================================
-- SECURITY FIX: store_details_admin view (owner emails leak)
-- ============================================================
-- `store_details_admin` view auth.users ke saath join karta hai
-- (owner ka email dikhane ke liye). Postgres views by default
-- underlying tables ki RLS ko bypass kar dete hain (view creator
-- ke permissions se chalte hain) — isliye is view pe koi restriction
-- na hone ki wajah se, THEORETICALLY koi bhi (public anon key se)
-- seedha `select * from store_details_admin` chalakar SABHI store
-- owners ke real email nikal sakta tha.
--
-- Fix: view ka direct access revoke kar diya, aur ek security-definer
-- function banaya jo sirf tabhi data deta hai jab calling user
-- super_admins table mein ho.
-- ============================================================

revoke all on store_details_admin from anon, authenticated;

create or replace function get_admin_stores()
returns setof store_details_admin
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  return query select * from store_details_admin order by created_at desc;
end;
$$;

grant execute on function get_admin_stores() to authenticated;
