// Day report: sales, payment methods, best sellers, voids, every closed bill, CSV export,
// and the end-of-day close (count the cash drawer, record over/short, share the day report).
// Days are business days: a bill at 1 am counts for the night before (Admin → Restaurant details).
const Reports = (() => {
  let day = '';

  const totalsOf = (o, s) => o.totals || (() => { const b = Billing.calc(o, s); return { subtotal: b.subtotal, discount: b.discount, service: b.service, tax: b.taxTotal, total: b.total }; })();

  const bday = (ts) => Util.bizDay(ts, Store.settings().dayEndsAt);
  const today = () => bday(Util.now());

  const dayData = (key) => {
    const s = Store.settings();
    const paid = Store.orders().filter((o) => o.status === 'paid' && bday(o.paidAt) === key).sort((a, b) => b.paidAt - a.paidAt);
    const sum = { subtotal: 0, discount: 0, service: 0, tax: 0, total: 0 };
    const methods = {};
    const items = {};
    for (const o of paid) {
      const x = totalsOf(o, s);
      for (const k of Object.keys(sum)) sum[k] += x[k] || 0;
      // Cash collected = total (change was handed back), so count payments up to the total.
      let left = x.total;
      for (const p of o.payments) { const take = Math.min(left, p.amount); methods[p.method] = (methods[p.method] || 0) + take; left -= take; }
      for (const l of o.lines) {
        if (l.status === 'void') continue;
        const it = items[l.name] || (items[l.name] = { qty: 0, amount: 0 });
        it.qty += l.qty; it.amount += l.qty * l.price;
      }
    }
    const voids = [];
    for (const o of Store.orders()) for (const l of o.lines) if (l.status === 'void' && !l.removed && l.voidAt && bday(l.voidAt) === key) voids.push({ o, l });
    const open = Store.orders().filter((o) => o.status === 'open');
    return { paid, sum, methods, items: Object.entries(items).sort((a, b) => b[1].qty - a[1].qty), voids, open };
  };

  // Pure numbers for a day close. float/counted in minor units.
  const closeNumbers = (key, float, counted) => {
    const d = dayData(key);
    const cash = d.methods.cash || 0;
    const expected = (Number(float) || 0) + cash;
    return {
      bills: d.paid.length, sales: d.sum.total, tax: d.sum.tax, discount: d.sum.discount, service: d.sum.service,
      methods: Object.assign({}, d.methods), cash, float: Number(float) || 0, expected,
      counted: counted === null || counted === undefined ? null : Number(counted),
      diff: counted === null || counted === undefined ? null : Number(counted) - expected,
      voids: d.voids.reduce((a, x) => a + x.l.qty * x.l.price, 0), openTables: d.open.length
    };
  };

  const diffLabel = (diff, s) => diff === 0 ? t('Exact') : diff > 0 ? t('Over by {amt}', { amt: Util.money(diff, s) }) : t('Short by {amt}', { amt: Util.money(-diff, s) });

  const reportText = (key) => {
    const s = Store.settings(); const c = Store.closes()[key];
    const n = c || closeNumbers(key, s.cashFloat, null);
    const L = [s.brandName, t('Day report {day}', { day: key }), ''];
    L.push(`${t('Bills')}: ${n.bills}`, `${t('Sales')}: ${Util.money(n.sales, s)}`, `${t('Tax')}: ${Util.money(n.tax, s)}`);
    if (n.discount) L.push(`${t('Discounts')}: −${Util.money(n.discount, s)}`);
    if (n.service) L.push(`${t('Service charge')}: ${Util.money(n.service, s)}`);
    L.push('');
    for (const [m, v] of Object.entries(n.methods)) L.push(`${Bill.methodName(m)}: ${Util.money(v, s)}`);
    if (c) {
      L.push('', `${t('Cash at opening')}: ${Util.money(c.float, s)}`, `${t('Expected in drawer')}: ${Util.money(c.expected, s)}`,
        `${t('Counted')}: ${Util.money(c.counted, s)}`, `${t('Difference')}: ${diffLabel(c.diff, s)}`);
      L.push('', t('Closed {when} by {who}', { when: Util.dateTime(c.closedAt, s.locale), who: c.closedBy }));
      if (c.note) L.push(t('Note: {note}', { note: c.note }));
    } else L.push('', t('Day not closed yet.'));
    if (n.voids) L.push(`${t('Voided')}: ${Util.money(n.voids, s)}`);
    return L.join('\n');
  };

  const closeSheet = async (key) => {
    if (!(await Lock.verify(t('Admin PIN to close the day')))) return;
    const s = Store.settings(); const prev = Store.closes()[key];
    const n0 = closeNumbers(key, prev ? prev.float : s.cashFloat, null);
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('Close the day')} <span class="muted small">${key}</span></h2>
        ${n0.openTables ? `<p class="banner warn">${t('{n} tables are still open. Their sales are not in this close.', { n: n0.openTables })}</p>` : ''}
        <ul class="kv">
          <li><span>${t('Bills')}</span><span class="mono">${n0.bills}</span></li>
          <li><span>${t('Sales')}</span><span class="mono">${Util.money(n0.sales, s)}</span></li>
          ${Object.entries(n0.methods).filter(([m]) => m !== 'cash').map(([m, v]) => `<li><span>${Bill.methodName(m)}</span><span class="mono">${Util.money(v, s)}</span></li>`).join('')}
          <li><span>${t('Cash sales')}</span><span class="mono">${Util.money(n0.cash, s)}</span></li>
        </ul>
        <label class="field"><span>${t('Cash in the drawer at opening')}</span><input id="c-float" class="input mono" inputmode="decimal" value="${Util.amountStr(n0.float, s.currency)}"></label>
        <div class="due-box"><small>${t('Expected in the drawer')}</small><b class="mono" id="c-expected">${Util.money(n0.expected, s)}</b></div>
        <label class="field"><span>${t('Cash you counted')}</span><input id="c-counted" class="input mono" inputmode="decimal" value="${prev ? Util.amountStr(prev.counted, s.currency) : ''}" placeholder="0.00"></label>
        <p class="diff-line" id="c-diff"></p>
        <label class="field"><span>${t('Note (optional)')}</span><input id="c-note" class="input" value="${Util.esc(prev ? prev.note : '')}" placeholder="${t('e.g. 10 paid to the supplier')}"></label>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Close the day')}</button></div>
      </form>`, {
      onMount: (el, close) => {
        const val = (id) => el.querySelector('#' + id).value.trim();
        const calc = () => {
          const float = Util.toMinor(parseFloat(val('c-float')) || 0, s.currency);
          const counted = val('c-counted') === '' ? null : Util.toMinor(parseFloat(val('c-counted')) || 0, s.currency);
          return closeNumbers(key, float, counted);
        };
        const draw = () => {
          const n = calc();
          el.querySelector('#c-expected').textContent = Util.money(n.expected, s);
          const d = el.querySelector('#c-diff');
          d.textContent = n.diff === null ? t('Count the cash, then enter it above.') : diffLabel(n.diff, s);
          d.className = 'diff-line ' + (n.diff === null ? 'muted' : n.diff === 0 ? 'ok' : n.diff > 0 ? 'over' : 'short');
        };
        el.querySelectorAll('#c-float,#c-counted').forEach((i) => { i.oninput = draw; });
        draw();
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const n = calc();
          if (n.counted === null) { UI.toast(t('Enter the cash you counted'), 'bad'); return; }
          Store.putClose(Object.assign({ id: key, day: key, closedAt: Util.now(), closedBy: Store.local.deviceName, note: val('c-note') }, n));
          if (n.float !== s.cashFloat) Store.saveSettings({ cashFloat: n.float });
          close();
          UI.toast(t('Day closed'), { kind: n.diff === 0 ? 'good' : n.diff < 0 ? 'bad' : '', body: `${t('Cash')}: ${diffLabel(n.diff, s)}`, action: { label: t('Share'), fn: () => Share.text(t('Day report {day}', { day: key }), reportText(key)) } });
        };
      }
    });
  };

  const closeCard = (key, s) => {
    const c = Store.closes()[key];
    if (!c) {
      return `<section class="card close-card">
        <div class="row between center gap"><div><h2>${t('End of day')}</h2><small class="muted">${t('Count the cash drawer and lock in the day\'s numbers.')}</small></div>
        <button class="btn primary" data-act="close-day">${t('Close the day')}</button></div>
      </section>`;
    }
    const after = Store.orders().filter((o) => o.status === 'paid' && bday(o.paidAt) === key && o.paidAt > c.closedAt).length;
    return `<section class="card close-card closed">
      <div class="row between center gap"><h2>${UI.icon('check')} ${t('Day closed')}</h2><span class="chip ${c.diff === 0 ? 'st-ready' : c.diff > 0 ? 'st-preparing' : 'st-void-bad'}">${diffLabel(c.diff, s)}</span></div>
      <ul class="kv">
        <li><span>${t('Expected in drawer')}</span><span class="mono">${Util.money(c.expected, s)}</span></li>
        <li><span>${t('Counted')}</span><span class="mono">${Util.money(c.counted, s)}</span></li>
        <li class="muted"><span>${t('Closed by')}</span><span>${Util.esc(c.closedBy)} · ${Util.time(c.closedAt, s.locale)}</span></li>
        ${c.note ? `<li class="muted"><span>${t('Note')}</span><span>${Util.esc(c.note)}</span></li>` : ''}
      </ul>
      ${after ? `<p class="banner warn">${t('{n} bills were paid after the close. Close again to include them.', { n: after })}</p>` : ''}
      <div class="row gap"><button class="btn ghost grow" data-act="share-day">${UI.icon('share')} ${t('Share report')}</button><button class="btn ghost" data-act="close-day">${t('Close again')}</button></div>
    </section>`;
  };

  const toCsv = (key) => {
    const s = Store.settings();
    const { paid } = dayData(key);
    const rows = [['Bill', 'Paid at', 'Table', 'Subtotal', 'Discount', 'Service', 'Tax', 'Total', 'Payments', 'Items']];
    for (const o of paid) {
      const x = totalsOf(o, s); const tb = Store.table(o.tableId);
      const amt = (m) => Util.amountStr(m, s.currency);
      rows.push([o.billNo, new Date(o.paidAt).toISOString(), tb ? tb.name : '', amt(x.subtotal), amt(x.discount), amt(x.service), amt(x.tax), amt(x.total),
        o.payments.map((p) => p.method + ' ' + amt(p.amount)).join('; '),
        o.lines.filter((l) => l.status !== 'void').map((l) => l.qty + 'x ' + l.name).join('; ')]);
    }
    return rows.map((r) => r.map(Util.csvCell).join(',')).join('\n');
  };

  const view = (el) => {
    document.body.classList.remove('no-tabs');
    if (Lock.restricted('sales')) { Lock.lockedView(el, t('Sales'), '', () => view(el)); return; }
    if (!day) day = today();
    const s = Store.settings();
    const d = dayData(day);
    const avg = d.paid.length ? Math.round(d.sum.total / d.paid.length) : 0;
    const maxQty = d.items.length ? d.items[0][1].qty : 1;
    el.innerHTML = `
      ${UI.header(t('Sales'), { actions: `<button class="icon-btn" data-act="csv" aria-label="${t('Export CSV')}">${UI.icon('download')}</button>` })}
      <div class="page">
        <div class="row gap center">
          <input id="r-day" type="date" class="input date" value="${day}" max="${today()}">
          ${day !== today() ? `<button class="btn link" data-act="today">${t('Today')}</button>` : ''}
        </div>
        ${closeCard(day, s)}
        <section class="stats">
          <div class="stat main"><small>${t('Sales')}</small><b class="mono">${Util.money(d.sum.total, s)}</b></div>
          <div class="stat"><small>${t('Bills')}</small><b class="mono">${d.paid.length}</b></div>
          <div class="stat"><small>${t('Average bill')}</small><b class="mono">${Util.money(avg, s)}</b></div>
          <div class="stat"><small>${t('Tax collected')}</small><b class="mono">${Util.money(d.sum.tax, s)}</b></div>
        </section>
        ${d.open.length ? `<p class="banner">${t('{n} tables still open, not counted yet.', { n: d.open.length })}</p>` : ''}
        <section class="card">
          <h2>${t('By payment')}</h2>
          ${Object.keys(d.methods).length ? `<ul class="kv">${Object.entries(d.methods).map(([m, v]) => `<li><span>${Bill.methodName(m)}</span><span class="mono">${Util.money(v, s)}</span></li>`).join('')}
            ${d.sum.discount ? `<li class="muted"><span>${t('Discounts given')}</span><span class="mono">−${Util.money(d.sum.discount, s)}</span></li>` : ''}
            ${d.sum.service ? `<li class="muted"><span>${t('Service charge')}</span><span class="mono">${Util.money(d.sum.service, s)}</span></li>` : ''}</ul>` : `<p class="muted small">${t('No payments on this day.')}</p>`}
        </section>
        <section class="card">
          <h2>${t('Best sellers')}</h2>
          ${d.items.length ? `<ul class="bars">${d.items.slice(0, 10).map(([name, v]) => `
            <li><span class="bar-label">${Util.esc(name)}</span><span class="bar"><span style="width:${Math.max(4, (v.qty / maxQty) * 100)}%"></span></span><span class="mono bar-val">${v.qty}</span></li>`).join('')}</ul>` : `<p class="muted small">${t('Nothing sold yet.')}</p>`}
        </section>
        ${d.voids.length ? `
        <section class="card">
          <h2>${t('Voided items')} <span class="muted small">${d.voids.length}</span></h2>
          <ul class="kv">${d.voids.map(({ o, l }) => `<li><span>${l.qty}× ${Util.esc(l.name)} <small class="muted">${Util.esc(l.voidReason || '')}${l.voidBy ? ' · ' + Util.esc(l.voidBy) : ''}</small></span><span class="mono">${Util.money(l.qty * l.price, s)}</span></li>`).join('')}</ul>
        </section>` : ''}
        <section class="card">
          <h2>${t('Closed bills')}</h2>
          ${d.paid.length ? `<ul class="bill-list">${d.paid.map((o) => {
            const tb = Store.table(o.tableId);
            return `<li><a href="#bill-${o.id}"><span class="mono">${Util.esc(o.billNo)}</span><span>${Util.esc(tb ? tb.name : '')} · ${Util.time(o.paidAt, s.locale)}</span><span class="mono">${Util.money(totalsOf(o, s).total, s)}</span></a></li>`;
          }).join('')}</ul>` : `<p class="muted small">${t('No bills closed on this day.')}</p>`}
        </section>
      </div>`;
    el.querySelector('#r-day').onchange = (e) => { day = e.target.value || today(); view(el); };
    const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
    on('today', () => { day = today(); view(el); });
    el.querySelectorAll('[data-act=close-day]').forEach((b) => { b.onclick = () => closeSheet(day); });
    on('share-day', () => Share.text(t('Day report {day}', { day }), reportText(day)));
    on('csv', () => Share.file(`sales-${day}.csv`, toCsv(day), 'text/csv', t('Sales {day}', { day })));
  };

  UI.route('reports', view);
  return { dayData, toCsv, closeNumbers, reportText };
})();
