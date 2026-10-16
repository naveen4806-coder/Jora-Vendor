-- Shared Supabase backend for Jora customer, vendor, and delivery-partner sites.
-- Run this in the Supabase SQL editor before deploying the portal.
create table if not exists public.jora_documents (
  collection text not null check (collection in (
    'delivery_partners', 'vendor_profiles', 'customer_profiles', 'orders', 'delivery_wallet_transactions',
    'delivery_payout_requests', 'delivery_owner_settlements'
  )),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists jora_documents_collection_idx on public.jora_documents (collection);
create index if not exists jora_documents_partner_idx on public.jora_documents ((data->>'deliveryPartnerId')) where collection = 'orders';
create index if not exists jora_documents_partner_profile_idx on public.jora_documents ((data->>'uid')) where collection = 'delivery_partners';

alter table public.jora_documents enable row level security;

create or replace function public.jora_is_delivery_partner(document_data jsonb)
returns boolean language sql stable as $$
  select coalesce(document_data->>'uid', document_data->>'deliveryPartnerId', document_data->>'partnerId') = auth.uid()::text
$$;

create policy "partners read their profile and assigned workflow" on public.jora_documents
for select to authenticated using (
  (collection = 'delivery_partners' and data->>'uid' = auth.uid()::text)
  or (collection = 'orders' and data->>'deliveryPartnerId' = auth.uid()::text)
  or (collection in ('delivery_wallet_transactions', 'delivery_payout_requests', 'delivery_owner_settlements') and data->>'partnerId' = auth.uid()::text)
);

create policy "customers read their own orders" on public.jora_documents
for select to authenticated using (
  collection = 'orders' and data->>'userId' = auth.uid()::text
);

create policy "vendors read their own orders" on public.jora_documents
for select to authenticated using (
  collection = 'orders' and data->>'vendorId' = auth.uid()::text
);

create policy "partners create their own profile" on public.jora_documents
for insert to authenticated with check (
  collection = 'delivery_partners' and id = auth.uid()::text and data->>'uid' = auth.uid()::text
);

create policy "partners update their profile" on public.jora_documents
for update to authenticated using (
  collection = 'delivery_partners' and data->>'uid' = auth.uid()::text
) with check (
  collection = 'delivery_partners' and data->>'uid' = auth.uid()::text
);

-- The partner can only update an order that was already assigned to that same partner.
-- Vendor assignment and customer confirmation must be performed by server-side RPCs.
create policy "partners update their assigned orders" on public.jora_documents
for update to authenticated using (
  collection = 'orders' and data->>'deliveryPartnerId' = auth.uid()::text
) with check (
  collection = 'orders' and data->>'deliveryPartnerId' = auth.uid()::text
);

create policy "vendors update their own orders" on public.jora_documents
for update to authenticated using (
  collection = 'orders' and data->>'vendorId' = auth.uid()::text
) with check (
  collection = 'orders' and data->>'vendorId' = auth.uid()::text
);

create policy "customers create their own orders" on public.jora_documents
for insert to authenticated with check (
  collection = 'orders' and data->>'userId' = auth.uid()::text
);

create policy "partners write their settlement records" on public.jora_documents
for insert to authenticated with check (
  collection in ('delivery_payout_requests', 'delivery_owner_settlements') and data->>'partnerId' = auth.uid()::text
);

-- Atomic vendor action: assign an accepted vendor order to a delivery partner.
-- Call this from the vendor app; the vendor's own policy should additionally verify shop ownership.
create or replace function public.assign_delivery_partner(order_id text, partner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  partner jsonb;
begin
  if not exists (
    select 1 from jora_documents
     where collection = 'orders' and id = order_id and data->>'vendorId' = auth.uid()::text
  ) then raise exception 'Only the owning vendor can assign this order'; end if;
  select data into partner from jora_documents where collection = 'delivery_partners' and id = partner_id::text;
  if partner is null or coalesce(partner->>'accountStatus','active') <> 'active' then raise exception 'Delivery partner is unavailable'; end if;
  update jora_documents
     set data = data || jsonb_build_object(
       'deliveryPartnerId', partner_id::text,
       'deliveryPartnerUid', partner_id::text,
       'deliveryPartnerName', trim(coalesce(partner->>'firstName','') || ' ' || coalesce(partner->>'lastName','')),
       'deliveryPartnerPhone', coalesce(partner->>'phone',''),
       'deliveryPartnerVehicle', coalesce(partner->>'vehicle','bike'),
       'status', 'Assigned', 'assignedAt', now()::text, 'updatedAt', now()::text
     ), updated_at = now()
   where collection = 'orders' and id = order_id and coalesce(data->>'status','') in ('Packed','Ready for Pickup');
  if not found then raise exception 'Order is not available for assignment'; end if;
end $$;

-- Customer confirmation ends a delivery. The server, rather than a browser, owns final status.
create or replace function public.confirm_order_delivery(order_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update jora_documents
     set data = data || jsonb_build_object('customerConfirmed', true, 'deliveryAwaitingCustomer', false, 'status', 'Delivered', 'customerConfirmedAt', now()::text, 'updatedAt', now()::text),
         updated_at = now()
   where collection = 'orders' and id = order_id and data->>'userId' = auth.uid()::text and coalesce(data->>'deliveryAwaitingCustomer','false') = 'true';
  if not found then raise exception 'This order is not awaiting your confirmation'; end if;
end $$;

-- The portal calls this during sign-out cleanup only when account deletion is explicitly requested.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.jora_documents where collection = 'delivery_partners' and id = auth.uid()::text;
end $$;

grant execute on function public.assign_delivery_partner(text, uuid) to authenticated;
grant execute on function public.confirm_order_delivery(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

alter table public.jora_documents replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.jora_documents;
exception when duplicate_object then null;
end $$;
