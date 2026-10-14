-- Run this in the Supabase SQL Editor before switching the live portal.
create table if not exists public.vendor_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'vendor',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vendor_profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
create policy "vendor profile access" on public.vendor_profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "vendor shop access" on public.shops for all using (auth.uid() = vendor_id) with check (auth.uid() = vendor_id);
create policy "vendor product access" on public.products for all using (auth.uid() = vendor_id) with check (auth.uid() = vendor_id);
create policy "vendor order access" on public.orders for select using (exists (select 1 from public.shops s where s.id = orders.shop_id and s.vendor_id = auth.uid()));
