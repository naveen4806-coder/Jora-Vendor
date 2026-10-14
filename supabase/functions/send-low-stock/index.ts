import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const e164 = (value: unknown) => {
  const number = String(value ?? '').replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
};

const twilioRequest = async (path: string, body: URLSearchParams) => {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!sid || !token) throw new Error('Twilio secrets are not configured.');
  const auth = btoa(`${sid}:${token}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`Twilio request failed (${response.status}).`);
  return response.json();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: cors });
  try {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    if (identityError || !identity.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const { vendorPhone, message } = await request.json();
    const to = e164(vendorPhone);
    if (!to) return new Response(JSON.stringify({ error: 'A valid E.164 vendor phone is required.' }), { status: 400, headers: cors });
    const text = String(message || 'Low stock alert from Jora.').slice(0, 1500);
    const smsFrom = Deno.env.get('TWILIO_SMS_FROM');
    const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM');
    const result: Record<string, string> = {};

    if (smsFrom) {
      try { result.sms = (await twilioRequest('/Messages.json', new URLSearchParams({ To: to, From: smsFrom, Body: text }))).sid; }
      catch (error) { result.sms = `failed: ${error.message}`; }
    }
    if (whatsappFrom) {
      try { result.whatsapp = (await twilioRequest('/Messages.json', new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${whatsappFrom.replace(/^whatsapp:/, '')}`, Body: text }))).sid; }
      catch (error) { result.whatsapp = `failed: ${error.message}`; }
    }
    if (!smsFrom && !whatsappFrom) throw new Error('Twilio sender secrets are not configured.');
    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Unable to send low-stock alert.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
