-- Run in the USER Supabase project.
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
alter table public.market_shops enable row level security;
alter table public.market_products enable row level security;
create policy "public can read active shops" on public.market_shops for select using ((data->>'isOpen') is distinct from 'false');
create policy "public can read active products" on public.market_products for select using (coalesce((data->>'active')::boolean,true));
alter publication supabase_realtime add table public.market_shops, public.market_products;
