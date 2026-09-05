-- ============================================================
-- SERVER TIME — countdown timers is par depend karte hain, customer
-- ke phone ki local clock par nahi (agar wo galat set ho to bhi
-- countdown sahi chalega).
-- ============================================================
create or replace function get_server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

grant execute on function get_server_time() to anon, authenticated;
