// The data layer. Everything that is saved goes through here.
//
// Two parts:
//   shared  – synced between linked devices: settings, menu, orders.
//   local   – this device only: role, theme, PIN lock, bill counter.
//
// Every shared record carries updatedAt + updatedBy. Merging is last-writer-wins
// per record, and per line inside an order, so a waiter adding dishes and the
// kitchen marking another dish ready never overwrite each other. The same merge
// is used for live links, file imports and (later) cloud sync. See docs/ARCHITECTURE.md.
const Store = (() => {
  const SCHEMA = 1;
  const DB_NAME = 'restrobar';
  const KEY_SHARED = 'shared';
  const KEY_LOCAL = 'local';

  let shared = null;
  let local = null;
  const subs = new Set();
  const outs = new Set(); // sync listeners: fn(changes, meta)

  // ---------- persistence (IndexedDB, falls back to localStorage) ----------
  let dbp = null;
  const idb = () => {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  };
  const kvGet = async (k) => {
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
      });
    } catch {
      try { const v = localStorage.getItem(DB_NAME + '.' + k); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
    }
  };
  const kvSet = async (k, v) => {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch {
      try { localStorage.setItem(DB_NAME + '.' + k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
    }
  };

  // Saves run in the background, one at a time, in order.
  let chain = Promise.resolve();
  let dirty = false;
  const flush = () => {
    if (!dirty) return chain;
    dirty = false;
    const s = JSON.parse(JSON.stringify(shared));
    const l = JSON.parse(JSON.stringify(local));
    chain = chain.then(() => kvSet(KEY_SHARED, s)).then(() => kvSet(KEY_LOCAL, l)).catch(() => {});
    return chain;
  };
  const saveSoon = Util.debounce(flush, 250);
  const markDirty = () => { dirty = true; saveSoon(); };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  }

  // ---------- defaults + migration ----------
  // Every new saved field gets a default here. Never rename or remove a field without a migration step.
  const defaultSettings = () => ({
    brandName: 'My Restaurant',
    logo: '',            // data: URL
    accent: '#1F7A5A',
    address: '',
    phone: '',
    taxNo: '',
    footer: 'Thank you, see you again!',
    currency: 'QAR',
    locale: '',          // '' = device default
    taxes: [],           // [{name, rate}]
    taxInclusive: false,
    serviceCharge: 0,
    tables: [],          // [{id, name}]
    upiId: '',           // UPI ID for GPay/PhonePe/Paytm QR (INR only), e.g. name@okaxis
    upiName: '',         // payee name shown in the UPI app ('' = brand name)
    payQr: '',           // owner's own payment QR image (data: URL), any currency
    payQrOnBill: true,   // print the payment QR on unpaid bills
    updatedAt: 0,
    updatedBy: ''
  });

  const migrate = (sh, lo) => {
    sh = sh && typeof sh === 'object' ? sh : {};
    sh.schema = sh.schema || SCHEMA;
    sh.settings = Object.assign(defaultSettings(), sh.settings || {});
    sh.categories = sh.categories || {};
    sh.items = sh.items || {};
    sh.orders = sh.orders || {};
    for (const it of Object.values(sh.items)) {
      if (it.available === undefined) it.available = true;
      if (it.station === undefined) it.station = '';
    }
    for (const o of Object.values(sh.orders)) {
      o.lines = o.lines || [];
      o.payments = o.payments || [];
      o.discount = o.discount || { type: 'amt', value: 0 };
      o.kotSeq = o.kotSeq || 0;
      o.billRequested = !!o.billRequested;
      o.guests = o.guests || 0;
    }

    lo = lo && typeof lo === 'object' ? lo : {};
    lo.deviceId = lo.deviceId || Util.uid();
    lo.deviceName = lo.deviceName || 'This device';
    lo.role = lo.role || 'solo';          // solo | hub | waiter
    lo.theme = lo.theme || 'system';      // system | light | dark
    lo.textSize = lo.textSize || 100;     // percent
    lo.pin = lo.pin || '';                // screen lock only, not encryption
    lo.billSeq = lo.billSeq || 0;
    lo.deviceCode = lo.deviceCode || lo.deviceId.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
    lo.setupDone = !!lo.setupDone;
    lo.tourDone = !!lo.tourDone;
    lo.seenVersion = lo.seenVersion || '';
    lo.checklistHidden = !!lo.checklistHidden;
    lo.lastBackupAt = lo.lastBackupAt || 0;
    lo.lang = lo.lang || 'en';
    lo.sound = lo.sound !== false;
    lo.demo = !!lo.demo;
    lo.everLinked = !!lo.everLinked;
    lo.knownPeers = lo.knownPeers || {};  // deviceId → name, for reconnect hints
    lo.passkeyId = lo.passkeyId || '';    // Face ID / fingerprint credential for the admin lock (this device only)
    return { sh, lo };
  };

  // ---------- load ----------
  const load = async () => {
    const [sh, lo] = await Promise.all([kvGet(KEY_SHARED), kvGet(KEY_LOCAL)]);
    const m = migrate(sh, lo);
    shared = m.sh; local = m.lo;
    return { shared, local };
  };

  // ---------- notify ----------
  const notify = (changes, meta) => {
    for (const fn of subs) { try { fn(changes, meta); } catch (e) { console.error(e); } }
  };
  const emit = (changes, meta) => {
    for (const fn of outs) { try { fn(changes, meta); } catch (e) { console.error(e); } }
  };
  const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  const onOutgoing = (fn) => { outs.add(fn); return () => outs.delete(fn); };

  // ---------- merge ----------
  const newer = (a, b) => {
    // true if a should replace b
    if (!b) return true;
    if ((a.updatedAt || 0) !== (b.updatedAt || 0)) return (a.updatedAt || 0) > (b.updatedAt || 0);
    return String(a.updatedBy || '') > String(b.updatedBy || '');
  };

  const mergeOrder = (cur, inc) => {
    if (!cur) return { rec: JSON.parse(JSON.stringify(inc)), changed: true };
    let changed = false;
    const head = newer(inc, cur) ? Object.assign({}, cur, inc) : Object.assign({}, cur);
    if (head.updatedAt !== cur.updatedAt || head.updatedBy !== cur.updatedBy) changed = true;
    const byId = new Map(cur.lines.map((l) => [l.id, l]));
    for (const l of inc.lines || []) {
      const mine = byId.get(l.id);
      if (!mine || newer(l, mine)) { byId.set(l.id, Object.assign({}, l)); if (!mine || JSON.stringify(mine) !== JSON.stringify(l)) changed = true; }
    }
    head.lines = [...byId.values()].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    return { rec: head, changed };
  };

  /** Merge records from another device or a file. Returns the records that changed here. */
  const merge = (changes, meta = {}) => {
    const applied = [];
    for (const c of changes || []) {
      if (!c || !c.rec || !c.kind) continue;
      if (c.kind === 'settings') {
        if (newer(c.rec, shared.settings)) {
          shared.settings = Object.assign(defaultSettings(), c.rec);
          applied.push({ kind: 'settings', rec: shared.settings });
        }
      } else if (c.kind === 'order') {
        const { rec, changed } = mergeOrder(shared.orders[c.rec.id], c.rec);
        if (changed) {
          shared.orders[rec.id] = migrate({ orders: { [rec.id]: rec } }).sh.orders[rec.id];
          applied.push({ kind: 'order', rec: shared.orders[rec.id] });
        }
      } else if (c.kind === 'item' || c.kind === 'category') {
        const bag = c.kind === 'item' ? shared.items : shared.categories;
        if (newer(c.rec, bag[c.rec.id])) { bag[c.rec.id] = Object.assign({}, c.rec); applied.push(c); }
      }
    }
    if (applied.length) {
      markDirty();
      notify(applied, Object.assign({ remote: true }, meta));
      emit(applied, Object.assign({ remote: true }, meta)); // the hub relays to its other peers
    }
    return applied;
  };

  // ---------- local writes ----------
  const stamp = (rec) => { rec.updatedAt = Math.max(Util.now(), (rec.updatedAt || 0) + 1); rec.updatedBy = local.deviceId; return rec; };

  const commit = (changes) => {
    markDirty();
    notify(changes, { remote: false });
    emit(changes, { remote: false, from: local.deviceId });
  };

  const saveSettings = (patch) => {
    shared.settings = stamp(Object.assign({}, shared.settings, patch));
    commit([{ kind: 'settings', rec: shared.settings }]);
  };

  const putItem = (rec) => { stamp(rec); shared.items[rec.id] = rec; commit([{ kind: 'item', rec }]); return rec; };
  const putCategory = (rec) => { stamp(rec); shared.categories[rec.id] = rec; commit([{ kind: 'category', rec }]); return rec; };

  /** Change an order through a draft; only lines you actually changed get a new stamp. */
  const updateOrder = (id, fn) => {
    const before = shared.orders[id];
    const draft = before ? JSON.parse(JSON.stringify(before)) : null;
    const res = fn(draft);
    const next = res || draft;
    if (!next) return null;
    const oldLines = new Map((before ? before.lines : []).map((l) => [l.id, JSON.stringify(l)]));
    for (const l of next.lines) {
      if (oldLines.get(l.id) !== JSON.stringify(l)) stamp(l);
    }
    const headOf = (o) => { if (!o) return ''; const { lines, updatedAt, updatedBy, ...h } = o; return JSON.stringify(h); };
    const lineChanged = next.lines.some((l) => oldLines.get(l.id) !== JSON.stringify(l));
    if (!before || headOf(before) !== headOf(next) || lineChanged) stamp(next);
    shared.orders[next.id] = next;
    commit([{ kind: 'order', rec: next }]);
    return next;
  };

  const newOrder = (tableId) => {
    const o = {
      id: Util.uid(), tableId, status: 'open', createdAt: Util.now(),
      lines: [], payments: [], discount: { type: 'amt', value: 0 }, kotSeq: 0,
      billRequested: false, guests: 0, createdBy: local.deviceId, billNo: '', paidAt: 0
    };
    return updateOrder(o.id, () => o);
  };

  const setLocal = (patch) => { Object.assign(local, patch); markDirty(); notify([{ kind: 'local', rec: local }], { remote: false }); };

  // ---------- reads ----------
  const settings = () => shared.settings;
  const orders = () => Object.values(shared.orders);
  const order = (id) => shared.orders[id];
  const openOrderFor = (tableId) => orders().find((o) => o.tableId === tableId && o.status === 'open');
  const items = () => Object.values(shared.items).filter((x) => !x.deleted);
  const categories = () => Object.values(shared.categories).filter((x) => !x.deleted).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const tables = () => shared.settings.tables || [];
  const table = (id) => tables().find((x) => x.id === id);

  // Everything shared, as merge-ready changes (used for link handshakes, exports, backups).
  const allChanges = () => [
    { kind: 'settings', rec: shared.settings },
    ...Object.values(shared.categories).map((rec) => ({ kind: 'category', rec })),
    ...Object.values(shared.items).map((rec) => ({ kind: 'item', rec })),
    ...Object.values(shared.orders).map((rec) => ({ kind: 'order', rec }))
  ];

  const backup = () => ({
    app: 'restrobar', type: 'backup', version: APP_VERSION, exportedAt: Util.now(),
    schema: SCHEMA, shared: JSON.parse(JSON.stringify(shared))
  });

  /** Restore replaces shared data entirely (local device settings are kept). */
  const restore = (data) => {
    if (!data || data.app !== 'restrobar' || !data.shared) throw new Error('This file is not a RestroBar backup.');
    shared = migrate(data.shared, local).sh;
    markDirty();
    notify([{ kind: 'all' }], { remote: false });
    return flush();
  };

  const resetAll = async () => {
    const keepId = local.deviceId;
    const m = migrate({}, { deviceId: keepId });
    shared = m.sh; local = m.lo;
    markDirty();
    await flush();
    notify([{ kind: 'all' }], { remote: false });
  };

  return {
    SCHEMA, load, flush, migrate, merge, subscribe, onOutgoing,
    get shared() { return shared; }, get local() { return local; },
    settings, saveSettings, putItem, putCategory, updateOrder, newOrder, setLocal, stamp,
    orders, order, openOrderFor, items, categories, tables, table, allChanges, backup, restore, resetAll,
    _newer: newer, _mergeOrder: mergeOrder
  };
})();
