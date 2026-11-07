// Day report: sales, payment methods, best sellers, voids, and every closed bill. CSV export.
const Reports = (() => {
  let day = '';

  const totalsOf = (o, s) => o.totals || (() => { const b = Billing.calc(o, s); return { subtotal: b.subtotal, discount: b.discount, service: b.service, tax: b.taxTotal, total: b.total }; })();

  const dayData = (key) => {
    const s = Store.settings();
    const paid = Store.orders().filter((o) => o.status === 'paid' && Util.dayKey(o.paidAt) === key).sort((a, b) => b.paidAt - a.paidAt);
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
    for (const o of Store.orders()) for (const l of o.lines) if (l.status === 'void' && !l.removed && l.voidAt && Util.dayKey(l.voidAt) === key) voids.push({ o, l });
    const open = Store.orders().filter((o) => o.status === 'open');
    return { paid, sum, methods, items: Object.entries(items).sort((a, b) => b[1].qty - a[1].qty), voids, open };
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
    if (!day) day = Util.dayKey(Util.now());
    const s = Store.settings();
    const d = dayData(day);
    const avg = d.paid.length ? Math.round(d.sum.total / d.paid.length) : 0;
    const maxQty = d.items.length ? d.items[0][1].qty : 1;
    el.innerHTML = `
      ${UI.header(t('Sales'), { actions: `<button class="icon-btn" data-act="csv" aria-label="${t('Export CSV')}">${UI.icon('download')}</button>` })}
      <div class="page">
        <div class="row gap center">
          <input id="r-day" type="date" class="input date" value="${day}" max="${Util.dayKey(Util.now())}">
          ${day !== Util.dayKey(Util.now()) ? `<button class="btn link" data-act="today">${t('Today')}</button>` : ''}
        </div>
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
    el.querySelector('#r-day').onchange = (e) => { day = e.target.value || Util.dayKey(Util.now()); view(el); };
    const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
    on('today', () => { day = Util.dayKey(Util.now()); view(el); });
    on('csv', () => Share.file(`sales-${day}.csv`, toCsv(day), 'text/csv', t('Sales {day}', { day })));
  };

  UI.route('reports', view);
  return { dayData, toCsv };
})();
