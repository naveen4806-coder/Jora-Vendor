/* Supabase implementation of the small document API used by the original UI. */
(function () {
  const config = window.JORA_SUPABASE_CONFIG || {};
  if (!config.url || config.url.startsWith('YOUR_') || !config.publishableKey || config.publishableKey.startsWith('YOUR_')) {
    throw new Error('Set JORA_SUPABASE_CONFIG with the project URL and publishable key before opening this portal.');
  }
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const marker = (type, value) => ({ __joraFieldValue: type, value });
  const FieldValue = {
    increment: value => marker('increment', Number(value) || 0),
    arrayUnion: value => marker('arrayUnion', value)
  };
  const now = () => new Date().toISOString();
  const asError = error => { if (error) throw error; };
  const isMarker = value => value && typeof value === 'object' && value.__joraFieldValue;
  const resolveMarkers = (before, patch) => Object.fromEntries(Object.entries(patch).map(([key, value]) => {
    if (!isMarker(value)) return [key, value];
    if (value.__joraFieldValue === 'increment') return [key, Number(before[key] || 0) + value.value];
    if (value.__joraFieldValue === 'arrayUnion') {
      const existing = Array.isArray(before[key]) ? before[key] : [];
      const duplicate = existing.some(item => JSON.stringify(item) === JSON.stringify(value.value));
      return [key, duplicate ? existing : [...existing, value.value]];
    }
    return [key, value];
  }));
  const snapshot = (row) => ({ id: row.id, exists: Boolean(row), data: () => row ? { ...row.data, id: row.id } : undefined });
  const querySnapshot = rows => ({
    docs: rows.map(snapshot),
    forEach: fn => rows.forEach(row => fn(snapshot(row))),
    docChanges: () => rows.map(row => ({ type: 'added', doc: snapshot(row) }))
  });

  class DocumentRef {
    constructor(collection, id) { this.collection = collection; this.id = id; }
    async get() {
      const { data, error } = await client.from('jora_documents').select('id,data').eq('collection', this.collection).eq('id', this.id).maybeSingle();
      asError(error); return snapshot(data);
    }
    async set(data) {
      const { error } = await client.from('jora_documents').upsert({ collection: this.collection, id: this.id, data, updated_at: now() }, { onConflict: 'collection,id' });
      asError(error);
    }
    async update(patch) {
      const current = await this.get();
      if (!current.exists) throw new Error('Document not found');
      const data = { ...current.data() }; delete data.id;
      const resolved = resolveMarkers(data, patch);
      const { error } = await client.from('jora_documents').update({ data: { ...data, ...resolved }, updated_at: now() }).eq('collection', this.collection).eq('id', this.id);
      asError(error);
    }
    onSnapshot(callback, onError) {
      let active = true;
      const refresh = async () => { try { if (active) callback(await this.get()); } catch (error) { if (onError) onError(error); } };
      refresh();
      const channel = client.channel(`document:${this.collection}:${this.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'jora_documents', filter: `id=eq.${this.id}` }, row => { if (row.new.collection === this.collection || row.old.collection === this.collection) refresh(); }).subscribe();
      return () => { active = false; client.removeChannel(channel); };
    }
  }
  class CollectionRef {
    constructor(name, filters = []) { this.name = name; this.filters = filters; }
    doc(id) { return new DocumentRef(this.name, id); }
    where(field, operator, value) { if (operator !== '==') throw new Error('Only equality filters are supported'); return new CollectionRef(this.name, [...this.filters, [field, value]]); }
    async rows() {
      let request = client.from('jora_documents').select('id,data').eq('collection', this.name);
      this.filters.forEach(([key, value]) => { request = request.eq(`data->>${key}`, String(value)); });
      const { data, error } = await request; asError(error); return data || [];
    }
    async get() { return querySnapshot(await this.rows()); }
    onSnapshot(callback, onError) {
      let active = true;
      const refresh = async () => { try { if (active) callback(querySnapshot(await this.rows())); } catch (error) { if (onError) onError(error); } };
      refresh();
      const channel = client.channel(`collection:${this.name}:${Math.random()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'jora_documents', filter: `collection=eq.${this.name}` }, refresh).subscribe();
      return () => { active = false; client.removeChannel(channel); };
    }
  }
  const db = {
    collection: name => new CollectionRef(name),
    async runTransaction(work) {
      /* The UI only uses this for final settlement. The function is atomic in PostgreSQL. */
      const result = await work({
        get: ref => ref.get(),
        update: (ref, patch) => ref.update(patch),
        set: (ref, data) => ref.set(data)
      });
      return result;
    }
  };
  const auth = {
    get currentUser() { return auth._wrap(auth._user); },
    async createUserWithEmailAndPassword(email, password) {
      const { data, error } = await client.auth.signUp({ email, password }); asError(error); auth._user = data.user;
      return { user: auth._wrap(data.user) };
    },
    async signInWithEmailAndPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password }); asError(error); auth._user = data.user;
      return { user: auth._wrap(data.user) };
    },
    async signOut() { const { error } = await client.auth.signOut(); asError(error); auth._user = null; },
    onAuthStateChanged(callback) {
      client.auth.getUser().then(({ data }) => { auth._user = data.user; callback(data.user ? auth._wrap(data.user) : null); });
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, user) => { auth._user = user; callback(user ? auth._wrap(user) : null); });
      return () => subscription.unsubscribe();
    },
    _wrap(user) { return user && { ...user, isAnonymous: false, updateProfile: async ({ displayName }) => { const { error } = await client.auth.updateUser({ data: { display_name: displayName } }); asError(error); }, delete: async () => { const { error } = await client.rpc('delete_my_account'); asError(error); }, getIdToken: async () => (await client.auth.getSession()).data.session?.access_token }; }
  };
  window.JoraSupabase = { client, db, auth, supabaseCompat: { FieldValue } };
})();
