// Boot, look (theme/brand colour/text size), tab bar, notices, alerts, offline.
// Loaded last. Feature files register their routes with UI.route before this runs.
const App = (() => {
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const homeRoute = () => {
    const L = Store.local;
    if (!L.tourDone && !L.setupDone) return 'tour';
    if (!L.setupDone) return 'setup';
    return L.role === 'hub' ? 'kitchen' : 'tables';
  };

  const applyLook = () => {
    const root = document.documentElement;
    const L = Store.local; const s = Store.settings();
    if (L.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', L.theme);
    root.style.setProperty('--accent', s.accent || '#1F7A5A');
    root.style.setProperty('--on-accent', Util.onColor(s.accent));
    root.style.setProperty('--text-scale', (L.textSize || 100) / 100);
    I18n.setLang(L.lang);
    document.title = s.brandName && s.brandName !== 'My Restaurant' ? s.brandName + ' · RestroBar' : 'RestroBar';
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = s.accent;
  };

  const tabs = () => {
    const role = Store.local.role;
    const list = [
      ['tables', t('Tables'), 'tables', 'table bill'],
      ['kitchen', t('Kitchen'), 'kitchen', ''],
      ['reports', t('Sales'), 'receipt', ''],
      ['menu', t('Menu'), 'menu', ''],
      ['more', t('Settings'), 'settings', 'links admin']
    ];
    // Kitchen tablet starts on Kitchen; waiter phones rarely need the kitchen tab but keep it reachable.
    let ordered = role === 'hub' ? [list[1], list[0], list[2], list[3], list[4]] : list;
    // Staff see no Sales tab while Admin is locked (Admin → Security → Hide Sales from staff).
    if (Lock.restricted('sales')) ordered = ordered.filter((x) => x[0] !== 'reports');
    UI.$('#tabs').innerHTML = ordered.map(([r, label, ic, alt]) => `
      <a class="tab" href="#${r}" data-go="${r}" data-alt="${alt}">${UI.icon(ic)}<span>${label}</span>${r === 'kitchen' ? '<span class="badge" id="k-badge" hidden></span>' : ''}${r === 'tables' ? '<span class="badge" id="r-badge" hidden></span>' : ''}</a>`).join('');
    badges();
  };

  const badges = () => {
    const kb = UI.$('#k-badge'); const rb = UI.$('#r-badge');
    if (kb) { const n = Kitchen.tickets().filter((x) => x.stage === 'new').length; kb.hidden = !n; kb.textContent = n; }
    if (rb) { const n = Tables.readyList().length; rb.hidden = !n; rb.textContent = n; }
  };

  // ---------- notices on the home screens ----------
  const notices = () => {
    const L = Store.local; const out = [];
    if (!isStandalone() && !sessionDismiss.home && L.setupDone) {
      out.push(`<div class="notice"><div class="grow"><b>${t('Add RestroBar to your Home Screen')}</b><small>${t('Opens full screen and works offline. Set up from the Home Screen icon: it keeps its own data.')}</small></div><button class="btn link small" data-notice="how">${t('How')}</button><button class="icon-btn" data-notice="home" aria-label="${t('Dismiss')}">${UI.icon('x')}</button></div>`);
    }
    // Backup reminder: only once there is a day's worth of real sales to lose.
    const week = 6 * 864e5;
    const firstSale = Math.min(...Store.orders().filter((o) => o.status === 'paid').map((o) => o.paidAt), Infinity);
    const hasData = Util.now() - firstSale > 864e5;
    if (hasData && Util.now() - (L.lastBackupAt || 0) > week && !sessionDismiss.backup) {
      out.push(`<div class="notice warn"><div class="grow"><b>${L.lastBackupAt ? t('Last backup was over a week ago') : t('No backup yet')}</b><small>${t('Your sales live only on this device. Some browsers delete site data after about 7 days without a visit.')}</small></div><button class="btn primary small" data-notice="backup-now">${t('Back up')}</button><button class="icon-btn" data-notice="backup" aria-label="${t('Dismiss')}">${UI.icon('x')}</button></div>`);
    }
    return out.join('');
  };
  const sessionDismiss = {};
  const wireNotices = (el) => {
    el.querySelectorAll('[data-notice]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.notice;
        if (k === 'seen') Store.setLocal({ seenVersion: APP_VERSION });
        else if (k === 'how') homeScreenTip();
        else if (k === 'backup-now') Share.backupNow();
        else { sessionDismiss[k] = true; UI.render(); }
      };
    });
  };

  const homeScreenTip = () => UI.open(`
    <h2 class="sheet-title">${t('Add to Home Screen')}</h2>
    ${isIOS() ? `<ol class="steps"><li>${t('Open this page in Safari.')}</li><li>${t('Tap the Share button, then "Add to Home Screen".')}</li><li>${t('Open RestroBar from the new icon and set it up there.')}</li></ol>`
      : `<ol class="steps"><li>${t('Open the browser menu (⋮).')}</li><li>${t('Tap "Install app" or "Add to Home screen".')}</li><li>${t('Open RestroBar from the new icon.')}</li></ol>`}
    <p class="hint">${t('On iPhone, the Home Screen app keeps separate data from Safari. If you already set up in Safari, back up there and import the file in the Home Screen app.')}</p>
    <button class="btn ghost block" data-close>${t('Close')}</button>`, { noFocus: true });

  // ---------- alerts for waiters when the kitchen marks dishes ready ----------
  let audio = null;
  const ding = () => {
    if (!Store.local.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((d, i) => {
        const o = audio.createOscillator(); const g = audio.createGain();
        o.connect(g); g.connect(audio.destination); o.frequency.value = i ? 1320 : 990;
        g.gain.setValueAtTime(0.0001, audio.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.3);
        o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.32);
      });
    } catch { /* blocked until the user taps once */ }
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
  };
  const lastStatus = new Map();
  const seedStatus = () => { for (const o of Store.orders()) for (const l of o.lines) lastStatus.set(l.id, l.status); };
  const watchReady = (changes, meta) => {
    for (const c of changes) {
      if (c.kind !== 'order') continue;
      for (const l of c.rec.lines) {
        const was = lastStatus.get(l.id);
        lastStatus.set(l.id, l.status);
        if (meta.remote && l.status === 'ready' && was && was !== 'ready' && Store.local.role !== 'hub') {
          const tb = Store.table(c.rec.tableId);
          UI.toast(t('{table}: ready to serve', { table: tb ? tb.name : '' }), { kind: 'good', body: `${l.qty}× ${l.name}`, action: { label: t('View'), fn: () => UI.go('tables') } });
          ding();
        }
      }
    }
  };

  // ---------- other tabs on this same device stay in sync ----------
  const tabSync = () => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel('restrobar');
    const me = Util.uid();
    Store.onOutgoing((changes, meta) => {
      if (meta.source === 'tab') return;
      const list = changes.filter((c) => c.kind !== 'local' && c.kind !== 'all');
      if (list.length) try { bc.postMessage({ me, changes: list }); } catch { /* */ }
    });
    bc.onmessage = (e) => { if (e.data && e.data.me !== me) Store.merge(e.data.changes, { source: 'tab' }); };
  };

  const registerSW = () => {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js?v=' + APP_VERSION).catch(() => { /* blocked in some hosts */ });
  };

  // Pinch and double-tap zoom are off (owner's choice for shared work devices).
  // Settings → Text size is the way to make text bigger. iOS Safari ignores user-scalable=no,
  // so its gesture events are blocked here too; ctrl+wheel covers laptop trackpads.
  const noZoom = () => {
    const stop = (e) => e.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault();
    });
  };

  // Refresh: save, fetch the latest version, reload. Data stays (it lives on the device).
  // A reload ends live links, so on a linked device we ask first.
  const refresh = async (btn) => {
    if (btn && btn.classList.contains('spin')) return;
    if (Link.connected().length && !(await UI.confirm(t('Refresh the app?'), t('This ends the live link. Scan the codes again afterwards. Nothing is lost.'), t('Refresh')))) return;
    if (btn) { btn.classList.add('spin'); btn.setAttribute('aria-busy', 'true'); }
    try { sessionStorage.setItem('rb_refreshed', '1'); } catch { /* private mode */ }
    let gone = false;
    const go = () => { if (gone) return; gone = true; try { location.reload(); } catch { /* blocked */ } };
    try { await Store.flush(); } catch { /* still reload */ }
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg) await Promise.race([reg.update(), new Promise((r) => setTimeout(r, 2500))]);
    } catch { /* offline or blocked */ }
    try { fetch(location.href.split('#')[0], { cache: 'reload', credentials: 'same-origin' }).then(go, go); } catch { go(); }
    setTimeout(go, 3000);
    // If this host blocks reloading (some previews), say so instead of spinning forever.
    setTimeout(() => {
      if (btn) { btn.classList.remove('spin'); btn.removeAttribute('aria-busy'); }
      try { sessionStorage.removeItem('rb_refreshed'); } catch { /* */ }
      UI.render(); UI.toast(t('Refreshed'), { body: t('Your data was reloaded from this device.') });
    }, 7000);
  };

  const hideSplash = () => { const sp = UI.$('#splash'); if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 400); } };

  const boot = async () => {
    // The splash can never get stuck: it goes after 4 s whatever happens.
    const failsafe = setTimeout(hideSplash, 4000);
    noZoom();
    try {
      await Store.load();
      applyLook();
      await Lock.migrateLocalPin();
      seedStatus();
      tabs();
      Store.subscribe((changes, meta) => {
        if (changes.some((c) => c.kind === 'settings' || c.kind === 'all' || c.kind === 'local')) { applyLook(); tabs(); }
        watchReady(changes, meta);
        badges();
        UI.softRender();
      });
      tabSync();
      UI.wireToast();
      document.addEventListener('click', (e) => { const b = e.target.closest('[data-refresh]'); if (b) refresh(b); });
      try {
        if (sessionStorage.getItem('rb_refreshed')) {
          sessionStorage.removeItem('rb_refreshed');
          setTimeout(() => UI.toast(t('Refreshed'), { kind: 'good', body: t('Version {v}. Your data is still here.', { v: APP_VERSION }) }), 300);
        }
      } catch { /* private mode */ }
      Store.onSaveError = Util.debounce(() => UI.toast(t('Couldn\'t save'), {
        kind: 'bad', body: t('This device\'s storage is full or blocked. Back up now so today\'s orders are not lost.'),
        action: { label: t('Back up'), fn: Share.backupNow }
      }), 1000);
      // After an update: say so once, with the release notes one tap away (BasKar pattern).
      if (Store.local.setupDone && Store.local.seenVersion !== APP_VERSION && RELEASES[0]) {
        const first = !Store.local.seenVersion;
        Store.setLocal({ seenVersion: APP_VERSION });
        if (!first) setTimeout(() => UI.toast(t('Updated to version {v}', { v: APP_VERSION }), { body: RELEASES[0].notes[0], action: { label: t('What\'s new'), fn: SettingsView.versionsSheet } }), 500);
      }
      window.addEventListener('hashchange', UI.render);
      if (!location.hash) history.replaceState(null, '', '#' + homeRoute());
      if (!Store.local.setupDone && !['tour', 'setup'].includes(UI.current().name)) location.hash = homeRoute();
      UI.render();
      registerSW();
    } catch (e) {
      console.error(e);
      UI.$('#view').innerHTML = `<div class="page"><p class="banner warn">${t('RestroBar could not start: {msg}', { msg: Util.esc(e.message) })}</p><button class="btn primary" onclick="location.reload()">${t('Try again')}</button></div>`;
    } finally {
      clearTimeout(failsafe);
      hideSplash();
    }
  };

  // Called when Admin locks or unlocks: rebuild the tabs and re-check the open screen.
  let wasOpen = null;
  const tabsChanged = () => {
    tabs();
    if (['reports', 'admin', 'menu'].includes(UI.current().name)) UI.softRender();
  };
  setInterval(() => {
    const open = typeof Lock !== 'undefined' && Lock.isOpen();
    if (wasOpen !== null && open !== wasOpen) tabsChanged(); // Admin re-locked after 5 minutes
    wasOpen = open;
  }, 5000);

  return { boot, refresh, tabsChanged, applyLook, homeRoute, notices, wireNotices, homeScreenTip, badges, isStandalone };
})();

App.boot();
