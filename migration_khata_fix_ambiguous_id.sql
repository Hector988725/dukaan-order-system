-- ============================================================
-- FIX: add_khata_transaction me "column reference "id" is ambiguous" error.
-- Wajah: function ka RETURNS TABLE(id, ...) hai, to "id" naam function ke
-- andar bhi ek variable ban jata hai, aur customers.id se takra jata tha.
-- Sirf column names ko table-alias ke saath likha hai. Logic, signature aur
-- permissions bilkul wahi hain (CREATE OR REPLACE se grants nahi badalte).
-- UNDO: baseline file (migration_baseline_functions.sql) me purana version hai.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_khata_transaction(p_store_id uuid, p_customer_id uuid, p_type text, p_amount numeric, p_description text)
 RETURNS TABLE(id uuid, new_balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_balance numeric;
  v_new_balance numeric;
  v_new_id uuid;
begin
  -- Sirf store ka owner hi khata entry add kar sake
  if not exists (select 1 from stores s where s.id = p_store_id and s.user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_type not in ('debit', 'credit') then
    raise exception 'Invalid transaction type';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount 0 se zyada hona chahiye';
  end if;

  -- Row lock lagakar current balance nikalo, taaki 2 entries same waqt
  -- add hone par race-condition se galat balance na bane.
  select c.khata_balance into v_current_balance
  from customers c
  where c.id = p_customer_id and c.store_id = p_store_id
  for update;
  if not found then
    raise exception 'Customer nahi mila';
  end if;

  v_new_balance := case when p_type = 'debit' then v_current_balance + p_amount else v_current_balance - p_amount end;

  update customers c set khata_balance = v_new_balance where c.id = p_customer_id;

  insert into khata_transactions (store_id, customer_id, type, amount, description, running_balance, created_by)
  values (p_store_id, p_customer_id, p_type, p_amount, p_description, v_new_balance, auth.uid())
  returning khata_transactions.id into v_new_id;

  return query select v_new_id, v_new_balance;
end;
$function$;
