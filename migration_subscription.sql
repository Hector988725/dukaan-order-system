-- ============================================================
-- MIGRATION: Subscription System + Image Support
-- Supabase SQL Editor mein paste karke Run karein
-- ============================================================

-- 1. Stores table mein subscription columns add karein
alter table stores
  add column if not exists is_active boolean default true,
  add column if not exists subscription_expires_at timestamptz default (now() + interval '30 days'),
  add column if not exists subscription_plan text default 'monthly';

-- 2. Products table mein image_url column add karein
-- (dukaandar khud photo upload kar sake ya ready icon use kare)
alter table products
  add column if not exists image_url text default null;

-- 3. Supabase Storage bucket banana hai photos ke liye
-- (Yeh SQL se nahi hota - Storage tab se manually karna hai, neeche guide hai)

-- 4. Sabke existing stores ko active mark karein
update stores set is_active = true where is_active is null;

-- ============================================================
-- STORAGE SETUP (SQL Editor ke baad karna hai manually):
-- 1. Supabase Dashboard → Storage → "New bucket"
-- 2. Bucket name: "product-images"
-- 3. Public: ON (toggle on karein)
-- 4. Save karein
-- ============================================================

-- 5. Storage ke liye RLS policy (bucket banana ke baad chalana)
-- Yeh allow karta hai ki logged-in users apni images upload kar sakein
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "Anyone can view images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Users can delete own images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- ============================================================
-- SUBSCRIPTION CHECK FUNCTION
-- Yeh automatically check karta hai ki store active hai ya nahi
-- ============================================================
create or replace function is_store_active(store_id uuid)
returns boolean as $$
declare
  store_record record;
begin
  select is_active, subscription_expires_at
  into store_record
  from stores
  where id = store_id;

  -- Agar store nahi mila
  if not found then return false; end if;

  -- Agar manually deactivate kiya hai
  if not store_record.is_active then return false; end if;

  -- Agar subscription expire ho gayi
  if store_record.subscription_expires_at < now() then
    -- Auto-deactivate
    update stores set is_active = false where id = store_id;
    return false;
  end if;

  return true;
end;
$$ language plpgsql security definer;
