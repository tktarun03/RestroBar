// Kitchen display: tickets (one per "send to kitchen") with timers.
// New → Cooking → Ready. The waiter's screen shows "Ready to serve" as soon as a dish is ready.
const Kitchen = (() => {
  let filter = 'new';            // phone only: which column to show
  let known = null;              // ticket keys seen, for the new-ticket sound
  let audio = null;
  let wakeLock = null;

  const tickets = () => {
    const out = [];
    for (const o of Store.orders()) {
      if (o.status !== 'open') continue;
      const byKot = new Map();
      for (const l of o.lines) {
        if (!l.kot) continue;
        if (!byKot.has(l.kot)) byKot.set(l.kot, []);
        byKot.get(l.kot).push(l);
      }
      for (const [kot, lines] of byKot) {
        const live = lines.filter((l) => l.status !== 'void');
        if (!live.length) continue;
        if (live.every((l) => l.status === 'served')) continue;
        let stage = 'new';
        if (live.every((l) => l.status === 'ready' || l.status === 'served')) stage = 'ready';
        else if (live.some((l) => l.status !== 'sent')) stage = 'cooking';
        const sentAt = Math.min(...lines.map((l) => l.sentAt || l.addedAt));
        out.push({ key: o.id + ':' + kot, o, kot, lines, stage, sentAt, by: lines[0].sentBy || '' });
      }
    }
    return out.sort((a, b) => a.sentAt - b.sentAt);
  };

  const setLines = (orderId, ids, status) => {
    Store.updateOrder(orderId, (d) => {
      for (const l of d.lines) {
        if (!ids.includes(l.id) || l.status === 'void' || l.status === 'served') continue;
        l.status = status;
        if (status === 'ready') l.readyAt = Util.now();
        if (status === 'preparing') l.startedAt = Util.now();
      }
    });
  };

  const beep = () => {
    if (!Store.local.sound || !audio) return;
    try {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.connect(g); g.connect(audio.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.5);
      o.start(); o.stop(audio.currentTime + 0.55);
      if (navigator.vibrate) navigator.vibrate(150);
    } catch { /* audio blocked */ }
  };
  const unlockAudio = () => {
    if (audio) return;
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  };

  const keepAwake = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch { wakeLock = null; }
  };

  const ticketCard = (tk, s) => {
    const tb = Store.table(tk.o.tableId);
    const mins = Util.minutesSince(tk.sentAt);
    const late = mins >= 20 ? 'late' : mins >= 10 ? 'warn' : '';
    return `
      <article class="ticket stage-${tk.stage} ${late}" data-ticket="${tk.key}">
        <header class="tk-head">
          <b class="tk-table">${Util.esc(tb ? tb.name : '?')}</b>
          <span class="tk-kot mono">KOT ${tk.kot}</span>
          <span class="tk-time mono">${UI.icon('clock')} ${mins}′</span>
        </header>
        <div class="tk-meta small">${Util.time(tk.sentAt, s.locale)}${tk.by ? ' · ' + Util.esc(tk.by) : ''}</div>
        <ul class="tk-lines">
          ${tk.lines.map((l) => `
            <li class="tk-line ls-${l.status}">
              <button data-line="${l.id}" data-order="${tk.o.id}" ${l.status === 'void' ? 'disabled' : ''}>
                <span class="mono q">${l.qty}</span>
                <span class="n">${Util.esc(l.name)}${l.note ? `<em>${Util.esc(l.note)}</em>` : ''}${l.status === 'void' ? `<em>${t('VOID')}${l.voidReason ? ': ' + Util.esc(l.voidReason) : ''}</em>` : ''}</span>
                <span class="tick">${l.status === 'ready' || l.status === 'served' ? UI.icon('check') : ''}</span>
              </button>
            </li>`).join('')}
        </ul>
        <footer class="tk-foot">
          ${tk.stage === 'new' ? `<button class="btn ghost" data-stage="preparing" data-key="${tk.key}">${t('Start')}</button><button class="btn primary" data-stage="ready" data-key="${tk.key}">${t('All ready')}</button>` : ''}
          ${tk.stage === 'cooking' ? `<button class="btn primary block" data-stage="ready" data-key="${tk.key}">${t('All ready')}</button>` : ''}
          ${tk.stage === 'ready' ? `<span class="muted small grow">${t('Waiting for waiter')}</span><button class="btn link" data-stage="preparing" data-key="${tk.key}">${t('Undo')}</button>` : ''}
        </footer>
      </article>`;
  };

  const view = (el) => {
    document.body.classList.remove('no-tabs');
    const s = Store.settings();
    const all = tickets();

    // New-ticket alert
    const keys = new Set(all.filter((x) => x.stage === 'new').map((x) => x.key));
    if (known) for (const k of keys) if (!known.has(k)) { beep(); break; }
    known = keys;

    const cols = [['new', t('New')], ['cooking', t('Cooking')], ['ready', t('Ready')]];
    const counts = Object.fromEntries(cols.map(([k]) => [k, all.filter((x) => x.stage === k).length]));

    el.innerHTML = `
      ${UI.header(t('Kitchen'), { actions: `${Link.statusPill()}<button class="icon-btn ${Store.local.sound && audio ? 'on' : ''}" data-act="sound" aria-label="${t('Sound')}">${UI.icon('bell')}</button>` })}
      <div class="kitchen">
        ${App.notices()}
        ${Store.local.sound && !audio ? `<button class="banner" data-act="sound-on">${UI.icon('bell')} ${t('Tap to turn on the new-ticket sound')}</button>` : ''}
        <div class="seg k-seg" role="tablist">
          ${cols.map(([k, label]) => `<button class="${filter === k ? 'on' : ''}" data-filter="${k}">${label} <span class="count">${counts[k]}</span></button>`).join('')}
        </div>
        <div class="k-cols">
          ${cols.map(([k, label]) => `
            <section class="k-col ${filter === k ? 'on' : ''}">
              <h2 class="k-col-title">${label} <span class="count">${counts[k]}</span></h2>
              ${all.filter((x) => x.stage === k).map((tk) => ticketCard(tk, s)).join('') || `<p class="muted small k-empty">${k === 'new' ? t('No new tickets') : k === 'cooking' ? t('Nothing cooking') : t('Nothing waiting')}</p>`}
            </section>`).join('')}
        </div>
      </div>`;

    el.querySelectorAll('[data-filter]').forEach((b) => { b.onclick = () => { filter = b.dataset.filter; view(el); }; });
    el.querySelectorAll('[data-line]').forEach((b) => {
      b.onclick = () => {
        const o = Store.order(b.dataset.order); const l = o && o.lines.find((x) => x.id === b.dataset.line);
        if (!l) return;
        setLines(o.id, [l.id], l.status === 'ready' ? 'preparing' : 'ready');
      };
    });
    el.querySelectorAll('[data-stage]').forEach((b) => {
      b.onclick = () => {
        const tk = all.find((x) => x.key === b.dataset.key); if (!tk) return;
        const before = Object.fromEntries(tk.lines.map((l) => [l.id, l.status]));
        setLines(tk.o.id, tk.lines.map((l) => l.id), b.dataset.stage);
        const tb = Store.table(tk.o.tableId);
        const undo = () => Store.updateOrder(tk.o.id, (d) => { for (const l of d.lines) if (before[l.id] && l.status === b.dataset.stage) l.status = before[l.id]; });
        if (b.dataset.stage === 'ready') UI.toast(t('Waiter notified'), { kind: 'good', body: `${tb ? tb.name : ''} · KOT ${tk.kot}`, undo });
        else UI.toast(t('Cooking {table}', { table: tb ? tb.name : '' }), { undo });
      };
    });
    const snd = el.querySelector('[data-act=sound]');
    if (snd) snd.onclick = () => { unlockAudio(); Store.setLocal({ sound: !(Store.local.sound && audio) }); if (Store.local.sound) beep(); };
    const on = el.querySelector('[data-act=sound-on]');
    if (on) on.onclick = () => { unlockAudio(); beep(); view(el); };
    App.wireNotices(el);
    keepAwake();
  };

  // Keep timers fresh
  setInterval(() => { if (UI.current().name === 'kitchen') UI.softRender(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (UI.current().name === 'kitchen') keepAwake(); });
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  UI.route('kitchen', view);
  return { tickets };
})();
