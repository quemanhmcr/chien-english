-- Create the 'avatars' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Remove existing policies to avoid conflicts (clean slate for these specific policies)
-- Note: We use 'storage.objects' as the table.
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Authenticated users can upload avatars." on storage.objects;
drop policy if exists "Authenticated users can update avatars." on storage.objects;

-- 1. Allow public read access to the avatars bucket
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- 2. Allow authenticated users to upload files to the avatars bucket
create policy "Authenticated users can upload avatars."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- 3. Allow authenticated users to update files in the avatars bucket
create policy "Authenticated users can update avatars."
  on storage.objects for update
  using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );
