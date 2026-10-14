-- Run this once in the jorra-delivery Supabase project's SQL Editor.
-- One project for customer, vendor, delivery partner, and administrator apps.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','vendor','delivery_partner','admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users create own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users create own profile" on public.profiles for insert with check (auth.uid() = id and role = 'customer');
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.vendor_documents (
  collection text not null,
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
alter table public.vendor_documents enable row level security;
drop policy if exists "vendors manage own documents" on public.vendor_documents;
create policy "vendors manage own documents" on public.vendor_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.market_shops (
  vendor_shop_id text primary key,
  vendor_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.market_products (
  vendor_product_id text primary key,
  vendor_id text not null,
  shop_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.market_shops add column if not exists vendor_id text;
alter table public.market_shops add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.market_shops add column if not exists updated_at timestamptz not null default now();
alter table public.market_products add column if not exists vendor_id text;
alter table public.market_products add column if not exists shop_id text;
alter table public.market_products add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.market_products add column if not exists updated_at timestamptz not null default now();
alter table public.market_shops enable row level security;
alter table public.market_products enable row level security;
drop policy if exists "public can read active shops" on public.market_shops;
drop policy if exists "public can read active products" on public.market_products;
create policy "public can read active shops" on public.market_shops for select using (coalesce((data->>'isOpen')::boolean, true));
create policy "public can read active products" on public.market_products for select using (coalesce((data->>'active')::boolean, true));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id),
  vendor_id uuid references auth.users(id),
  delivery_partner_id uuid references auth.users(id),
  status text not null default 'pending',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Existing projects can already have an orders table. Add the shared-app fields safely.
alter table public.orders add column if not exists customer_id uuid references auth.users(id);
alter table public.orders add column if not exists vendor_id uuid references auth.users(id);
alter table public.orders add column if not exists delivery_partner_id uuid references auth.users(id);
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists created_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders enable row level security;
drop policy if exists "participants can read orders" on public.orders;
-- Order permissions are added once the customer, vendor, and delivery apps use the same order fields.
-- RLS stays enabled and denies access by default until those app-specific policies are deployed.

do $$ begin
  alter publication supabase_realtime add table public.vendor_documents;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.market_shops;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.market_products;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;
