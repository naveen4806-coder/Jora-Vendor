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
alter publication supabase_realtime add table public.vendor_documents;

-- Create a private bucket for product, shop, and compliance uploads.
insert into storage.buckets (id,name,public) values ('vendor-assets','vendor-assets',false)
on conflict (id) do nothing;
drop policy if exists "vendors manage own assets" on storage.objects;
create policy "vendors manage own assets" on storage.objects for all
  using (bucket_id='vendor-assets' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id='vendor-assets' and auth.uid()::text = (storage.foldername(name))[1]);
