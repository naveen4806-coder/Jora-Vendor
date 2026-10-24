-- Run once after schema.sql. This is the Supabase document store used by the vendor portal.
create table if not exists public.vendor_documents (
  collection text not null,
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection,id)
);
alter table public.vendor_documents enable row level security;
drop policy if exists "vendors manage own documents" on public.vendor_documents;
create policy "vendors manage own documents" on public.vendor_documents for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- Realtime may already be enabled from an earlier setup run.
do $$ begin
  alter publication supabase_realtime add table public.vendor_documents;
exception when duplicate_object then null;
end $$;

-- Profile creation is an authenticated RPC so first login does not depend on
-- a browser-side RLS read/write race.
create or replace function public.ensure_vendor_profile(
  profile_name text default '',
  profile_email text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_data jsonb;
  incoming jsonb;
begin
  if current_user_id is null then raise exception 'Sign in required'; end if;
  incoming := jsonb_strip_nulls(jsonb_build_object(
    'uid', current_user_id, 'name', nullif(trim(profile_name), ''),
    'email', nullif(trim(profile_email), ''), 'role', 'vendor',
    'active', true, 'updatedAt', now()
  ));
  insert into public.vendor_documents (collection, id, owner_id, data, created_at, updated_at)
  values ('vendor_profiles', current_user_id::text, current_user_id,
    incoming || jsonb_build_object('createdAt', now()), now(), now())
  on conflict (collection, id) do update
    set data = public.vendor_documents.data || incoming, updated_at = now()
  returning data into saved_data;
  return saved_data;
end;
$$;
revoke all on function public.ensure_vendor_profile(text, text) from public, anon;
grant execute on function public.ensure_vendor_profile(text, text) to authenticated;
notify pgrst, 'reload schema';

-- Create a private bucket for product, shop, and compliance uploads.
insert into storage.buckets (id,name,public) values ('vendor-assets','vendor-assets',false)
on conflict (id) do nothing;
drop policy if exists "vendors manage own assets" on storage.objects;
create policy "vendors manage own assets" on storage.objects for all
  using (bucket_id='vendor-assets' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id='vendor-assets' and auth.uid()::text = (storage.foldername(name))[1]);
