-- Admin ko distributor ka referral_code baad mein edit karne dena
-- (pehle sirf create ke waqt set hota tha, baad mein badalne ka koi
-- tareeka nahi tha).
create or replace function admin_update_referral_code(p_distributor_id uuid, p_new_code text)
returns void as $$
begin
  if not exists (select 1 from super_admins where email = auth.email()) then
    raise exception 'Not authorized';
  end if;
  update distributors set referral_code = upper(p_new_code), updated_at = now() where id = p_distributor_id;
end;
$$ language plpgsql security definer;

grant execute on function admin_update_referral_code(uuid, text) to authenticated;
