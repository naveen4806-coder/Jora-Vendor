import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const vendorUrl = Deno.env.get('SUPABASE_URL')!;
const vendorKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const userUrl = Deno.env.get('USER_SUPABASE_URL')!;
const userKey = Deno.env.get('USER_SUPABASE_SERVICE_ROLE_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const bearer = request.headers.get('Authorization') || '';
  const vendor = createClient(vendorUrl, vendorKey);
  const token = bearer.replace(/^Bearer\s+/i, '');
  const { data: identity } = await vendor.auth.getUser(token);
  if (!identity.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  const { collection, id } = await request.json();
  if (!['shops', 'products'].includes(collection) || !id) return Response.json({ error: 'Invalid sync request' }, { status: 400, headers: cors });
  const { data: document, error } = await vendor.from('vendor_documents').select('data,owner_id').eq('collection', collection).eq('id', id).single();
  if (error || !document || document.owner_id !== identity.user.id) return Response.json({ error: 'Record not found' }, { status: 404, headers: cors });
  const user = createClient(userUrl, userKey);
  const data = document.data;
  if (collection === 'shops') await user.from('market_shops').upsert({ vendor_shop_id:id, vendor_id:document.owner_id, data, updated_at:new Date().toISOString() });
  else await user.from('market_products').upsert({ vendor_product_id:id, vendor_id:document.owner_id, shop_id:data.shopId || document.owner_id, data, updated_at:new Date().toISOString() });
  return Response.json({ ok:true }, { headers: cors });
});
