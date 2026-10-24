/* Supabase-only compatibility layer for the Jora vendor portal.
   Catalogue settings remain in vendor_documents; live customer orders and
   delivery-partner availability use the shared, real-time tables. */
(function () {
  const URL = 'https://yilxsvrldltcaozaonlt.supabase.co', KEY = 'sb_publishable_9CzxOhalkMB3k9VD7d3oDg_ynjDUwg4';
  const pricingNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0, pricingMoney = value => Math.round((pricingNumber(value) + Number.EPSILON) * 100) / 100;
  window.JoraPricing = window.JoraPricing || { DELIVERY_RATE_PER_KM: 10, calculateTax(items, settings) { settings = settings || {}; if (!settings.enabled) return 0; return pricingMoney((items || []).reduce((sum, item) => { const qty = Math.max(0, pricingNumber(item && item.qty)), base = pricingMoney(pricingNumber(item && item.price) * qty), rule = (settings.perCategory || {})[item && item.category] || settings; return sum + (rule && rule.mode === 'flat' ? pricingNumber(rule.value) * qty : base * pricingNumber(rule && rule.value) / 100); }, 0)); }, getOrderTotals(input) { input = input || {}; const amount = pricingMoney((input.items || []).reduce((sum, item) => sum + pricingNumber(item && item.price) * Math.max(0, pricingNumber(item && item.qty)), 0)), distanceKm = Math.round(Math.max(0, pricingNumber(input.distanceKm)) * 10) / 10, deliveryCharge = Math.round(distanceKm * 10), productTax = this.calculateTax(input.items, input.taxSettings); return { productAmount: amount, distanceKm, deliveryCharge, productTax, total: pricingMoney(amount + deliveryCharge + productTax) }; } };
  const client = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.joraSupabase = client;
  const stamp = () => new Date().toISOString(), clone = value => JSON.parse(JSON.stringify(value || {}));
  const err = error => { const value = new Error(error && error.message || 'Supabase request failed'); value.code = error && error.code; return value; };
  const user = value => value ? { uid: value.id, email: value.email, displayName: (value.user_metadata || {}).display_name || '', updateProfile: async profile => { const result = await client.auth.updateUser({ data: { display_name: profile.displayName || '' } }); if (result.error) throw err(result.error); } } : null;
  const auth = {
    currentUser: null, setPersistence: async () => {},
    createUserWithEmailAndPassword: async (email, password) => { const result = await client.auth.signUp({ email, password, options: { emailRedirectTo: 'https://joravendor.vercel.app' } }); if (result.error) throw err(result.error); if (!result.data.session) { const value = new Error('Account created. Check your email, confirm the account, then log in.'); value.code = 'auth/email-confirmation-required'; throw value; } auth.currentUser = user(result.data.user); return { user: auth.currentUser }; },
    signInWithEmailAndPassword: async (email, password) => { const result = await client.auth.signInWithPassword({ email, password }); if (result.error) throw err(result.error); auth.currentUser = user(result.data.user); return { user: auth.currentUser }; },
    signOut: async () => { const result = await client.auth.signOut(); if (result.error) throw err(result.error); auth.currentUser = null; },
    onAuthStateChanged: callback => { client.auth.getUser().then(result => { auth.currentUser = user(result.data.user); callback(auth.currentUser); }); return client.auth.onAuthStateChange((_, session) => { auth.currentUser = user(session && session.user); callback(auth.currentUser); }).data.subscription.unsubscribe; }
  };
  const statusToLegacy = { placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed', handed_to_delivery_partner: 'Ready for Pickup', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' };
  function statusToShared(value) {
    const key = String(value || 'placed').toLowerCase().replace(/\s+/g, '_');
    return { ready_for_pickup: 'handed_to_delivery_partner', picked_up: 'handed_to_delivery_partner', handovered: 'handed_to_delivery_partner', handed_over: 'handed_to_delivery_partner', confirmed: 'confirmed', packed: 'packed', out_for_delivery: 'out_for_delivery', delivered: 'delivered', cancelled: 'cancelled', refunded: 'refunded', placed: 'placed' }[key] || 'placed';
  }
  function legacyOrder(row) {
    if (!row) return row;
    const first = Array.isArray(row.items) && row.items[0] || {};
    return Object.assign({}, row.data || {}, row, {
      customerUid: row.customer_id, vendorUid: row.vendor_id, shopId: row.shop_id, shopName: row.shop_name,
      shopLat: row.shop_lat, shopLng: row.shop_lng, deliveryAddress: row.delivery_address,
      deliveryLat: row.delivery_lat, deliveryLng: row.delivery_lng, deliveryFee: row.delivery_charge == null ? row.delivery_fee : row.delivery_charge, deliveryCharge: row.delivery_charge == null ? row.delivery_fee : row.delivery_charge, productAmount: row.product_amount == null ? row.subtotal : row.product_amount, productTax: row.product_tax || 0, distanceKm: row.distance_km,
      paymentMethod: row.payment_method, paymentStatus: row.payment_status, deliveryPartnerId: row.rider_id,
      deliveryPartnerUid: row.rider_id, riderLat: row.rider_lat, riderLng: row.rider_lng,
      riderLocationAccuracy: row.rider_location_accuracy, riderLocationUpdatedAt: row.rider_location_updated_at,
      productName: row.product_name || first.name || 'Customer order', category: row.category || first.category || '',
      image: row.image || first.image || '', price: Number(row.price == null ? first.price : row.price) || 0,
      qty: Number(row.qty == null ? first.qty : row.qty) || 1, orderedAt: row.created_at, createdAt: row.created_at,
      updatedAt: row.updated_at, deliveredAt: row.delivered_at, cancelledAt: row.cancelled_at,
      status: statusToLegacy[row.status] || row.status
    });
  }
  function sharedOrderPatch(data) {
    const patch = { updated_at: stamp() };
    const fields = { shopId: 'shop_id', shopName: 'shop_name', shopLat: 'shop_lat', shopLng: 'shop_lng', deliveryAddress: 'delivery_address', deliveryLat: 'delivery_lat', deliveryLng: 'delivery_lng', deliveryPartnerId: 'rider_id', deliveryPartnerUid: 'rider_id', riderLat: 'rider_lat', riderLng: 'rider_lng', riderLocationAccuracy: 'rider_location_accuracy', riderLocationUpdatedAt: 'rider_location_updated_at', paymentStatus: 'payment_status', deliveredAt: 'delivered_at', cancelledAt: 'cancelled_at' };
    Object.keys(fields).forEach(key => { if (data[key] !== undefined) patch[fields[key]] = data[key]; });
    if (data.status !== undefined) patch.status = statusToShared(data.status);
    return patch;
  }
  function legacyPresence(row) {
    if (!row) return row;
    const name = String(row.full_name || '').trim().split(/\s+/).filter(Boolean);
    return Object.assign({}, row, {
      firstName: row.first_name || name[0] || '',
      lastName: row.last_name || name.slice(1).join(' '),
      lat: row.latitude,
      lng: row.longitude,
      photo: row.photo_url,
      activeOrderId: row.active_order_id,
      isOnline: row.is_online,
      locationUpdatedAt: row.location_updated_at
    });
  }
  class Snap { constructor(id, data) { this.id = id; this._data = data; this.exists = !!data; } data() { return clone(this._data); } }
  function isShared(collection) { return collection === 'orders' || collection === 'delivery_partners'; }
  function sharedTable(collection) { return collection === 'orders' ? 'orders' : 'delivery_partner_presence'; }
  function mapShared(collection, row) { return collection === 'orders' ? legacyOrder(row) : legacyPresence(row); }
  class Ref {
    constructor(collection, id) { this.c = collection; this.id = id; }
    async get() {
      if (isShared(this.c)) { const result = await client.from(sharedTable(this.c)).select('*').eq('id', this.id).maybeSingle(); if (result.error) throw err(result.error); return new Snap(this.id, mapShared(this.c, result.data)); }
      const result = await client.from('vendor_documents').select('data').eq('collection', this.c).eq('id', this.id).maybeSingle(); if (result.error) throw err(result.error); return new Snap(this.id, result.data && result.data.data);
    }
    async set(data, options) {
      if (this.c === 'orders') { const current = options && options.merge ? (await this.get()).data() || {} : {}; const result = await client.from('orders').upsert(Object.assign({ id: this.id }, sharedOrderPatch(Object.assign({}, current, data))), { onConflict: 'id' }); if (result.error) throw err(result.error); return; }
      if (this.c === 'delivery_partners') { const result = await client.from('delivery_partner_presence').upsert(Object.assign({ id: this.id, updated_at: stamp() }, data), { onConflict: 'id' }); if (result.error) throw err(result.error); return; }
      const owner = auth.currentUser && auth.currentUser.uid || data.ownerUid || data.vendorId; if (!owner) throw new Error('Sign in required'); const payload = options && options.merge ? Object.assign({}, (await this.get()).data() || {}, clone(data)) : clone(data); const result = await client.from('vendor_documents').upsert({ collection: this.c, id: this.id, owner_id: owner, data: payload, updated_at: stamp() }); if (result.error) throw err(result.error);
    }
    async update(data) {
      if (this.c === 'orders') { const result = await client.from('orders').update(sharedOrderPatch(data)).eq('id', this.id); if (result.error) throw err(result.error); return; }
      if (this.c === 'delivery_partners') { const result = await client.from('delivery_partner_presence').update(Object.assign({}, data, { updated_at: stamp() })).eq('id', this.id); if (result.error) throw err(result.error); return; }
      const old = (await this.get()).data(); if (!old) throw new Error('Document not found'); return this.set(Object.assign(old, clone(data)));
    }
    async delete() { const result = isShared(this.c) ? await client.from(sharedTable(this.c)).delete().eq('id', this.id) : await client.from('vendor_documents').delete().eq('collection', this.c).eq('id', this.id); if (result.error) throw err(result.error); }
  }
  class Query {
    constructor(collection) { this.c = collection; this.filters = []; }
    where(key, op, value) { this.filters.push([key, op, value]); return this; }
    doc(id) { return new Ref(this.c, id); }
    async get() {
      let result, rows;
      if (isShared(this.c)) { result = await client.from(sharedTable(this.c)).select('*'); if (result.error) throw err(result.error); rows = (result.data || []).map(row => mapShared(this.c, row)); }
      else { result = await client.from('vendor_documents').select('id,data').eq('collection', this.c); if (result.error) throw err(result.error); rows = (result.data || []).map(row => Object.assign({ id: row.id }, row.data)); }
      rows = rows.filter(row => this.filters.every(filter => filter[1] === '==' ? row && row[filter[0]] === filter[2] : true));
      return { forEach: callback => rows.forEach(row => callback(new Snap(row.id, row))), docs: rows.map(row => new Snap(row.id, row)) };
    }
    async add(data) { if (this.c === 'orders') { const result = await client.from('orders').insert(sharedOrderPatch(data)).select('id').single(); if (result.error) throw err(result.error); return { id: result.data.id }; } const id = 'd_' + crypto.randomUUID(); await this.doc(id).set(data); return { id }; }
    onSnapshot(success, failure) {
      let live = true, channel, run = () => this.get().then(value => live && success(value)).catch(error => failure && failure(error));
      run();
      if (isShared(this.c)) channel = client.channel('jora-' + this.c + '-' + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: sharedTable(this.c) }, run).subscribe();
      else channel = client.channel('jora-' + this.c + '-' + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_documents', filter: 'collection=eq.' + this.c }, run).subscribe();
      return () => { live = false; client.removeChannel(channel); };
    }
  }
  const db = { collection: collection => new Query(collection), runTransaction: async callback => callback({ get: ref => ref.get(), update: (ref, data) => ref.update(data) }) }, storage = {};
  const ordersApi = {
    async assignDeliveryPartner(orderId, partnerId) {
      const result = await client.rpc('assign_delivery_partner', {
        order_id: String(orderId),
        partner_id: partnerId
      });
      if (result.error) throw err(result.error);
    }
  };
  window.auth = auth; window.db = db; window.storage = storage; window.JoraOrdersApi = ordersApi;
}());
