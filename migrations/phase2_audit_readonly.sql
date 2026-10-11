-- ============================================================
-- PHASE 2 AUDIT — READ ONLY. Sirf SELECT hai, kuch badalta nahi.
-- Har query alag chalao (ek ek karke) aur result ka screenshot bhejo.
-- ============================================================

-- QUERY 1: Kaun si tables par RLS band hai? (ideal: koi nahi)
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- QUERY 2: Anon (bina login) ke liye khuli policies
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (roles::text like '%anon%' or roles::text = '{public}')
order by tablename, cmd;

-- QUERY 3: Kaun se functions bina login (anon/public) chal sakte hain?
select p.proname as function_name, p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
order by p.prosecdef desc, p.proname;

-- QUERY 4: Storage bucket policies
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects'
order by cmd;
