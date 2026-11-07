// Live link between devices on the same Wi-Fi, with no server and no internet.
//
// How pairing works (WebRTC data channel, signalled by QR codes):
//   1. Kitchen tablet (hub) creates an offer and shows it as a QR code.
//   2. Waiter phone scans it, creates an answer and shows that as a QR code.
//   3. The tablet scans the answer with its front camera. The link opens.
// After that both sides swap a snapshot, then every change streams live.
// The hub relays changes between phones (star layout).
//
// Known limit: a browser cannot reopen this link by itself. If a phone sleeps or the app
// is closed for a while, the link drops and the two codes must be scanned again.
// Changes made while unlinked are kept and merged on the next link. See docs/ARCHITECTURE.md.
const Link = (() => {
  const peers = new Map();  // peerId → { pc, dc, name, role, state, lastPong }
  const SNAPSHOT_DAYS = 7;
  const CHUNK = 15000;
  let started = false;

  const supported = () => typeof RTCPeerConnection !== 'undefined';
  const connected = () => [...peers.values()].filter((p) => p.state === 'open');

  // ---------- messages (chunked so large logos/menus fit) ----------
  const send = (p, obj) => {
    if (!p.dc || p.dc.readyState !== 'open') return false;
    const s = JSON.stringify(obj);
    try {
      if (s.length <= CHUNK) { p.dc.send(s); return true; }
      const id = Util.uid(); const n = Math.ceil(s.length / CHUNK);
      for (let i = 0; i < n; i++) p.dc.send(JSON.stringify({ type: 'part', id, i, n, data: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
      return true;
    } catch { return false; }
  };
  const parts = new Map();
  const onMessage = (p, raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'part') {
      const buf = parts.get(m.id) || { n: m.n, got: 0, data: [] };
      buf.data[m.i] = m.data; buf.got++; parts.set(m.id, buf);
      if (buf.got === buf.n) { parts.delete(m.id); onMessage(p, buf.data.join('')); }
      return;
    }
    p.lastPong = Util.now();
    if (m.type === 'hello') {
      p.name = m.name; p.role = m.role; p.peerId = m.id;
      const kp = Object.assign({}, Store.local.knownPeers, { [m.id]: m.name });
      Store.setLocal({ knownPeers: kp, everLinked: true });
      send(p, { type: 'sync', changes: snapshot() });
      changed();
    } else if (m.type === 'sync' || m.type === 'changes') {
      if (m.type === 'sync') p.synced = true;
      Store.merge(m.changes, { peer: p.key, source: 'link' });
    } else if (m.type === 'ping') {
      send(p, { type: 'pong' });
    }
  };

  // Recent data only: settings, menu, open orders, and orders touched in the last week.
  const snapshot = () => {
    const since = Util.now() - SNAPSHOT_DAYS * 864e5;
    return Store.allChanges().filter((c) => c.kind !== 'order' || c.rec.status === 'open' || (c.rec.updatedAt || 0) > since);
  };

  // Outgoing: every local change goes to every open peer, except the one it came from.
  const wireOutgoing = () => {
    if (started) return; started = true;
    Store.onOutgoing((changes, meta) => {
      const list = changes.filter((c) => c.kind !== 'local' && c.kind !== 'all');
      if (!list.length) return;
      for (const p of peers.values()) if (p.key !== meta.peer) send(p, { type: 'changes', changes: list });
    });
    setInterval(() => {
      for (const p of peers.values()) {
        if (p.state !== 'open') continue;
        send(p, { type: 'ping' });
        if (Util.now() - (p.lastPong || 0) > 30000) { p.state = 'lost'; changed(); }
      }
    }, 10000);
  };

  const changed = Util.debounce(() => UI.softRender(), 100);

  const attach = (p, dc) => {
    p.dc = dc;
    let greeted = false;
    const hello = () => send(p, { type: 'hello', id: Store.local.deviceId, name: Store.local.deviceName, role: Store.local.role });
    const opened = () => {
      if (greeted) return; greeted = true;
      p.state = 'open'; p.lastPong = Util.now();
      hello();
      // The first messages can be lost while the other side is still wiring up its channel.
      // Every hello is answered with a snapshot, so keep saying hello until a snapshot arrives.
      let tries = 0;
      const retry = setInterval(() => {
        if (p.synced || p.state !== 'open' || ++tries > 20) { clearInterval(retry); return; }
        hello();
      }, 1000);
      changed();
    };
    dc.onopen = opened;
    dc.onclose = () => { p.state = 'closed'; changed(); };
    // A message proves the channel is open even if the open event was missed.
    dc.onmessage = (e) => { if (!greeted && dc.readyState === 'open') opened(); onMessage(p, e.data); };
    // On the answering side the channel can already be open when it is handed over.
    if (dc.readyState === 'open') opened();
  };

  const newPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: [] }); // same Wi-Fi only, nothing leaves the network
    const p = { key: Util.uid(), pc, dc: null, name: '', role: '', state: 'pairing', lastPong: 0 };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) { p.state = 'closed'; changed(); }
      if (pc.connectionState === 'disconnected') { p.state = 'lost'; changed(); }
    };
    peers.set(p.key, p);
    return p;
  };

  const gathered = (pc) => new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', done); res(); } };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(res, 3000);
  });

  const notSupported = () => UI.toast(t('Live link is not available in this browser. Use the share sheet or QR codes instead.'), 'bad');

  // ---------- hub side ----------
  const hostFlow = () => {
    if (!supported()) return notSupported();
    wireOutgoing();
    let stopCam = () => {};
    let p = null;
    let closed = false;
    UI.open(`
      <h2 class="sheet-title">${t('Add a waiter phone')}</h2>
      <ol class="steps">
        <li>${t('On the phone: Settings → Linked devices → Link to kitchen tablet, then scan this code.')}</li>
        <li>${t('Hold the phone\'s code in front of this tablet\'s camera.')}</li>
      </ol>
      <div class="pair-grid">
        <div class="qr-box" id="offer-qr"><p class="muted small">${t('Preparing code…')}</p></div>
        <div class="cam small" id="cam"></div>
      </div>
      <p class="muted small center" id="pair-status">${t('Waiting for the phone…')}</p>
      <button class="btn ghost block" data-close>${t('Close')}</button>`, {
      noFocus: true, wide: true,
      onClose: () => { closed = true; stopCam(); if (p && p.state === 'pairing') { try { p.pc.close(); } catch { /* */ } peers.delete(p.key); } },
      onMount: async (el, close) => {
        const status = (txt) => { const x = el.querySelector('#pair-status'); if (x) x.textContent = txt; };
        // Start the camera first: browsers reveal the real local address only after camera permission.
        stopCam = await QR.startCamera(el.querySelector('#cam'), async (txt) => {
          try {
            const m = await QR.unpack(txt);
            if (m.type !== 'answer') { status(t('That is not a phone link code.')); return; }
            await p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
            status(t('Connecting to {name}…', { name: m.name }));
            const t0 = Util.now();
            const wait = setInterval(() => {
              if (p.state === 'open') { clearInterval(wait); UI.toast(t('{name} linked', { name: m.name }), 'good'); close(); }
              else if (Util.now() - t0 > 12000) { clearInterval(wait); status(t('Could not connect. Check both are on the same Wi-Fi (not guest Wi-Fi), then try again.')); }
            }, 300);
          } catch (e) { status(e.message || t('Could not read that code.')); }
        }, 'user');
        if (closed) { stopCam(); return; }
        p = newPeer();
        attach(p, p.pc.createDataChannel('restrobar', { ordered: true }));
        await p.pc.setLocalDescription(await p.pc.createOffer());
        await gathered(p.pc);
        const code = await QR.pack({ app: 'restrobar', type: 'offer', name: Store.local.deviceName, id: Store.local.deviceId, sdp: p.pc.localDescription.sdp });
        const box = el.querySelector('#offer-qr'); if (box) box.innerHTML = QR.svg(code);
      }
    });
  };

  // ---------- waiter side ----------
  const joinFlow = (onDone) => {
    if (!supported()) return notSupported();
    wireOutgoing();
    // One hub at a time: drop old links first.
    for (const old of peers.values()) { try { old.pc.close(); } catch { /* */ } }
    peers.clear();
    QR.scanSheet(t('Scan the kitchen tablet\'s code'), async (txt) => {
      let m;
      try { m = await QR.unpack(txt); } catch (e) { UI.toast(e.message, 'bad'); return false; }
      if (m.type !== 'offer') { UI.toast(t('That is not a kitchen tablet link code.'), 'bad'); return false; }
      const p = newPeer();
      p.pc.ondatachannel = (e) => attach(p, e.channel);
      await p.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      await gathered(p.pc);
      const code = await QR.pack({ app: 'restrobar', type: 'answer', name: Store.local.deviceName, id: Store.local.deviceId, sdp: p.pc.localDescription.sdp });
      setTimeout(() => showAnswer(p, code, m.name, onDone), 50);
      return true;
    });
  };

  const showAnswer = (p, code, hubName, onDone) => {
    let timer;
    UI.open(`
      <h2 class="sheet-title">${t('Show this to the tablet')}</h2>
      <div class="qr-box big">${QR.svg(code)}</div>
      <p class="muted small center" id="ans-status">${t('Hold it in front of {name}\'s camera.', { name: hubName || t('the tablet') })}</p>
      <button class="btn ghost block" data-close>${t('Cancel')}</button>`, {
      noFocus: true,
      onClose: () => clearInterval(timer),
      onMount: (el, close) => {
        const t0 = Util.now();
        timer = setInterval(() => {
          if (p.state === 'open') { clearInterval(timer); close(); UI.toast(t('Linked to {name}', { name: hubName }), 'good'); onDone && onDone(); }
          else if (Util.now() - t0 > 90000) { clearInterval(timer); const s = el.querySelector('#ans-status'); if (s) s.textContent = t('Not linked yet. Check both are on the same Wi-Fi, then try again.'); }
        }, 300);
      }
    });
  };

  const disconnectAll = () => {
    for (const p of peers.values()) { try { p.pc.close(); } catch { /* */ } }
    peers.clear(); changed();
  };

  // ---------- small UI bits ----------
  const statusPill = () => {
    const role = Store.local.role;
    if (role === 'solo') return '';
    const n = connected().length;
    if (role === 'hub') return `<a class="pill ${n ? 'ok' : ''}" href="#links">${UI.icon('wifi')} ${n ? t('{n} linked', { n }) : t('No phones')}</a>`;
    return `<a class="pill ${n ? 'ok' : 'bad'}" href="#links">${UI.icon('wifi')} ${n ? t('Linked') : t('Not linked')}</a>`;
  };

  // Called after sending to the kitchen: warn a waiter whose link is down.
  const nudge = () => {
    if (Store.local.role === 'waiter' && !connected().length) {
      UI.toast(t('Not linked: the kitchen has not received this. Relink or send by QR.'), 'bad');
    }
  };

  const view = (el) => {
    document.body.classList.remove('no-tabs');
    const role = Store.local.role;
    const list = [...peers.values()].filter((p) => p.name || p.state === 'open');
    el.innerHTML = `
      ${UI.header(t('Linked devices'), { back: 'more' })}
      <div class="page">
        ${!supported() ? `<p class="banner warn">${t('This browser cannot make live links. Use Share and QR codes instead.')}</p>` : ''}
        ${role === 'solo' ? `
          <p class="banner">${t('This device is set to "One device does everything". To link phones, change the role below.')}</p>` : ''}
        <section class="card">
          <h2>${t('This device')}</h2>
          <ul class="kv">
            <li><span>${t('Name')}</span><span>${Util.esc(Store.local.deviceName)}</span></li>
            <li><span>${t('Role')}</span><span>${t({ solo: 'One device does everything', hub: 'Main kitchen tablet', waiter: 'Waiter phone' }[role])}</span></li>
          </ul>
          <a class="btn link" href="#more">${t('Change in Settings')}</a>
        </section>
        ${role === 'hub' ? `
          <button class="btn primary block" data-act="host" ${supported() ? '' : 'disabled'}>${UI.icon('qr')} ${t('Add a waiter phone')}</button>` : ''}
        ${role === 'waiter' ? `
          <button class="btn primary block" data-act="join" ${supported() ? '' : 'disabled'}>${UI.icon('camera')} ${connected().length ? t('Relink to kitchen tablet') : t('Link to kitchen tablet')}</button>` : ''}
        ${role !== 'solo' ? `
        <section class="card">
          <h2>${t('Links')}</h2>
          ${list.length ? `<ul class="kv">${list.map((p) => `<li><span>${Util.esc(p.name || t('Connecting…'))}</span><span class="chip ${p.state === 'open' ? 'st-ready' : 'st-void'}">${p.state === 'open' ? t('Live') : p.state === 'pairing' ? t('Pairing') : t('Dropped')}</span></li>`).join('')}</ul>
            <button class="btn ghost" data-act="drop">${t('Disconnect all')}</button>` : `<p class="muted small">${t('No live links right now.')}</p>`}
        </section>` : ''}
        <section class="card tips">
          <h2>${t('Keep the link working')}</h2>
          <ul>
            <li>${t('All devices on the same Wi-Fi. Guest Wi-Fi often blocks devices from seeing each other.')}</li>
            <li>${t('Keep RestroBar open. If a phone sleeps for long or the app is closed, the link drops and you scan again.')}</li>
            <li>${t('Nothing is lost while unlinked. Changes merge on the next link.')}</li>
            <li>${t('No Wi-Fi? Use "Send this order" on the order screen to share by QR, Bluetooth or AirDrop.')}</li>
          </ul>
        </section>
      </div>`;
    const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
    on('host', hostFlow);
    on('join', () => joinFlow());
    on('drop', disconnectAll);
  };

  UI.route('links', view);
  return { hostFlow, joinFlow, statusPill, nudge, connected, supported, disconnectAll };
})();
