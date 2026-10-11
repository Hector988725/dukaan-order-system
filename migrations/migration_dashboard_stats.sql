-- ============================================================
-- DASHBOARD: "Aaj ka Khata Collection" ke liye
-- ============================================================
-- Owner-only, sirf aaj ke credit (payment-received) transactions ka
-- total deta hai — khata_transactions table par direct access kisi
-- ko nahi hai (revoke all already lagi hai migration_khata.sql mein),
-- isliye yeh RPC banaya.
-- ============================================================
create or replace function get_todays_khata_collection(p_store_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function get_todays_khata_collection(uuid) to authenticated;
