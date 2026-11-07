// Floor view: every table with its state, plus the "ready to serve" list for waiters.
const Tables = (() => {
  const LIVE = (l) => l.status !== 'void';

  // One status per table, most urgent first.
  const statusOf = (o) => {
    if (!o) return { key: 'free', label: t('Free') };
    const lines = o.lines.filter(LIVE);
    if (lines.some((l) => l.status === 'ready')) return { key: 'ready', label: t('Ready to serve') };
    if (o.billRequested) return { key: 'bill', label: t('Bill asked') };
    if (lines.some((l) => l.status === 'sent' || l.status === 'preparing')) return { key: 'kitchen', label: t('In kitchen') };
    if (lines.some((l) => l.status === 'draft')) return { key: 'open', label: t('Not sent') };
    if (lines.length && lines.every((l) => l.status === 'served')) return { key: 'served', label: t('Eating') };
    return { key: 'open', label: t('Ordering') };
  };

  const runningTotal = (o) => o.lines.filter((l) => l.status !== 'void').reduce((s, l) => s + l.price * l.qty, 0);

  const readyList = () => {
    const out = [];
    for (const o of Store.orders()) {
      if (o.status !== 'open') continue;
      const ready = o.lines.filter((l) => l.status === 'ready');
      if (ready.length) out.push({ o, ready, at: Math.min(...ready.map((l) => l.readyAt || l.updatedAt)) });
    }
    return out.sort((a, b) => a.at - b.at);
  };

  const markServed = (orderId, lineIds) => {
    Store.updateOrder(orderId, (o) => {
      for (const l of o.lines) if (lineIds.includes(l.id) && l.status === 'ready') { l.status = 'served'; l.servedAt = Util.now(); }
    });
    UI.toast(t('Marked as served'), 'good');
  };

  const checklist = () => {
    const L = Store.local;
    if (L.checklistHidden) return '';
    const orders = Store.orders();
    const steps = [
      [t('Add your menu'), Store.items().length > 0, '#menu'],
      [t('Take a first order'), orders.some((o) => o.lines.length), ''],
      [t('Send an order to the kitchen'), orders.some((o) => o.lines.some((l) => l.status !== 'draft')), ''],
      [t('Take a first payment'), orders.some((o) => o.status === 'paid'), ''],
      ...(L.role === 'solo' ? [] : [[t('Link a phone to the kitchen tablet'), L.everLinked, '#links']]),
      [t('Make a backup'), !!L.lastBackupAt, '#settings']
    ];
    const done = steps.filter((s) => s[1]).length;
    if (done === steps.length) return '';
    return `
      <section class="card checklist">
        <div class="row between center">
          <h2>${t('Get started')} <span class="muted small">${done}/${steps.length}</span></h2>
          <button class="btn link small" data-act="hide-check">${t('Hide')}</button>
        </div>
        <ul>${steps.map(([label, ok, href]) => `<li class="${ok ? 'ok' : ''}">${ok ? UI.icon('check') : '<span class="box"></span>'}${href && !ok ? `<a href="${href}">${label}</a>` : `<span>${label}</span>`}</li>`).join('')}</ul>
      </section>`;
  };

  const view = (el) => {
    document.body.classList.remove('no-tabs');
    const s = Store.settings();
    const tables = Store.tables();
    const ready = readyList();
    const openCount = Store.orders().filter((o) => o.status === 'open').length;

    el.innerHTML = `
      ${UI.header(s.brandName, { actions: Link.statusPill() })}
      <div class="page">
        ${App.notices()}
        ${ready.length ? `
          <section class="ready-strip" aria-live="polite">
            <h2>${UI.icon('bell')} ${t('Ready to serve')}</h2>
            ${ready.map(({ o, ready: lines }) => {
              const tb = Store.table(o.tableId);
              return `
                <div class="ready-card">
                  <div class="grow">
                    <b>${Util.esc(tb ? tb.name : t('Table'))}</b>
                    <div class="small">${lines.map((l) => `${l.qty}× ${Util.esc(l.name)}`).join(', ')}</div>
                  </div>
                  <button class="btn primary" data-served="${o.id}" data-lines="${lines.map((l) => l.id).join(',')}">${t('Served')}</button>
                </div>`;
            }).join('')}
          </section>` : ''}
        ${checklist()}
        ${tables.length ? '' : `<div class="empty">${t('No tables yet.')} <a href="#settings">${t('Add tables in Settings')}</a></div>`}
        <div class="table-grid">
          ${tables.map((tb) => {
            const o = Store.openOrderFor(tb.id);
            const st = statusOf(o);
            const mins = o ? Util.minutesSince(o.createdAt) : 0;
            return `
              <a class="table-card st-${st.key}" href="#table-${Util.esc(tb.id)}">
                <span class="tc-name">${Util.esc(tb.name)}</span>
                <span class="chip st-${st.key}">${st.label}</span>
                ${o ? `<span class="tc-meta mono">${Util.money(runningTotal(o), s)} · ${mins}′</span>` : '<span class="tc-meta">&nbsp;</span>'}
              </a>`;
          }).join('')}
        </div>
        <p class="muted small center">${t('{n} open orders', { n: openCount })}</p>
      </div>`;

    el.querySelectorAll('[data-served]').forEach((b) => { b.onclick = () => markServed(b.dataset.served, b.dataset.lines.split(',')); });
    const h = el.querySelector('[data-act=hide-check]'); if (h) h.onclick = () => Store.setLocal({ checklistHidden: true });
    App.wireNotices(el);
  };

  UI.route('tables', view);
  return { statusOf, runningTotal, readyList, markServed };
})();
