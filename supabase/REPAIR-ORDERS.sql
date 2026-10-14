-- Run this first in the jorra-delivery SQL Editor if JORA-SINGLE-PROJECT.sql reports "column vendor_id does not exist".
alter table public.orders add column if not exists customer_id uuid references auth.users(id);
alter table public.orders add column if not exists vendor_id uuid references auth.users(id);
alter table public.orders add column if not exists delivery_partner_id uuid references auth.users(id);
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

alter table public.orders enable row level security;
drop policy if exists "participants can read orders" on public.orders;
