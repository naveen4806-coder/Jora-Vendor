import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Single-project sync: vendor documents become marketplace records in this same Jora project.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405, headers: cors });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: identity, error: identityError } = await admin.auth.getUser(token);
  if (identityError || !identity.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });

  const { collection, id } = await request.json();
  if (!['shops', 'products'].includes(collection) || !id) return Response.json({ error: 'Invalid sync request' }, { status: 400, headers: cors });

  const { data: document, error: readError } = await admin.from('vendor_documents').select('data, owner_id').eq('collection', collection).eq('id', id).single();
  if (readError || !document || document.owner_id !== identity.user.id) return Response.json({ error: 'Record not found' }, { status: 404, headers: cors });

  const payload = collection === 'shops'
    ? { vendor_shop_id: id, vendor_id: document.owner_id, data: document.data, updated_at: new Date().toISOString() }
    : { vendor_product_id: id, vendor_id: document.owner_id, shop_id: document.data.shopId || document.owner_id, data: document.data, updated_at: new Date().toISOString() };
  const { error: writeError } = collection === 'shops'
    ? await admin.from('market_shops').upsert(payload)
    : await admin.from('market_products').upsert(payload);
  if (writeError) return Response.json({ error: writeError.message }, { status: 502, headers: cors });

  return Response.json({ ok: true }, { headers: cors });
});
