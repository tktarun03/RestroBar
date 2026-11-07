// Billing: discount, split payments, change, close the bill, print and share the receipt.
// Route: #bill-<orderId>
const Bill = (() => {
  const METHODS = () => [['cash', t('Cash')], ['card', t('Card')], ['online', PayQR.kind(Store.settings()) === 'upi' ? t('UPI / GPay') : t('Online / QR')], ['other', t('Other')]];
  const methodName = (m) => (METHODS().find((x) => x[0] === m) || [m, m])[1];

  const receiptHtml = (o, s) => {
    const b = Billing.calc(o, s);
    const tb = Store.table(o.tableId);
    const paid = o.status === 'paid';
    return `
      <div class="receipt" id="receipt">
        <div class="r-brand">
          ${s.logo ? `<img src="${s.logo}" alt="" class="r-logo">` : ''}
          <b class="r-name">${Util.esc(s.brandName)}</b>
          ${s.address ? `<div>${Util.esc(s.address)}</div>` : ''}
          ${s.phone ? `<div>${Util.esc(s.phone)}</div>` : ''}
          ${s.taxNo ? `<div>${t('Tax no.')} ${Util.esc(s.taxNo)}</div>` : ''}
        </div>
        <div class="r-meta">
          <div class="r-row"><span>${paid ? t('Bill') + ' ' + Util.esc(o.billNo) : t('Bill preview (not paid)')}</span><span>${Util.esc(tb ? tb.name : '')}</span></div>
          <div class="r-row"><span>${Util.dateTime(paid ? o.paidAt : Util.now(), s.locale)}</span><span></span></div>
        </div>
        <div class="r-lines">
          ${b.lines.map((l) => `
            <div class="r-row"><span>${l.qty} × ${Util.esc(l.name)}</span><span>${Util.money(l.total, s)}</span></div>
            ${l.note ? `<div class="r-note">${Util.esc(l.note)}</div>` : ''}`).join('')}
        </div>
        <div class="r-sums">
          <div class="r-row"><span>${t('Subtotal')}</span><span>${Util.money(b.subtotal, s)}</span></div>
          ${b.discount ? `<div class="r-row"><span>${t('Discount')}${o.discount.type === 'pct' ? ' ' + o.discount.value + '%' : ''}</span><span>−${Util.money(b.discount, s)}</span></div>` : ''}
          ${b.service ? `<div class="r-row"><span>${t('Service charge')} ${s.serviceCharge}%</span><span>${Util.money(b.service, s)}</span></div>` : ''}
          ${b.taxLines.map((x) => `<div class="r-row"><span>${Util.esc(x.name)} ${x.rate}%${s.taxInclusive ? ' (' + t('included') + ')' : ''}</span><span>${Util.money(x.amount, s)}</span></div>`).join('')}
          <div class="r-row total"><span>${t('Total')}</span><span>${Util.money(b.total, s)}</span></div>
          ${o.payments.map((p) => `<div class="r-row"><span>${methodName(p.method)}</span><span>${Util.money(p.amount, s)}</span></div>`).join('')}
          ${b.change ? `<div class="r-row"><span>${t('Change')}</span><span>${Util.money(b.change, s)}</span></div>` : ''}
        </div>
        ${!paid && s.payQrOnBill && PayQR.kind(s) && b.due > 0 ? `<div class="r-pay">${PayQR.box(s, b.due, billNote(o))}</div>` : ''}
        ${s.footer ? `<div class="r-foot">${Util.esc(s.footer)}</div>` : ''}
      </div>`;
  };
  const billNote = (o) => { const tb = Store.table(o.tableId); return (tb ? tb.name : '') + ' ' + Util.time(Util.now()); };

  // Plain-text receipt for sharing in a message.
  const receiptText = (o, s) => {
    const b = Billing.calc(o, s);
    const tb = Store.table(o.tableId);
    const L = [];
    L.push(s.brandName);
    if (s.address) L.push(s.address);
    if (s.taxNo) L.push(t('Tax no.') + ' ' + s.taxNo);
    L.push('');
    L.push((o.status === 'paid' ? t('Bill') + ' ' + o.billNo : t('Bill preview (not paid)')) + ' · ' + (tb ? tb.name : ''));
    L.push(Util.dateTime(o.paidAt || Util.now(), s.locale));
    L.push('');
    for (const l of b.lines) L.push(`${l.qty} × ${l.name}  ${Util.money(l.total, s)}`);
    L.push('');
    L.push(`${t('Subtotal')}: ${Util.money(b.subtotal, s)}`);
    if (b.discount) L.push(`${t('Discount')}: −${Util.money(b.discount, s)}`);
    if (b.service) L.push(`${t('Service charge')}: ${Util.money(b.service, s)}`);
    for (const x of b.taxLines) L.push(`${x.name} ${x.rate}%: ${Util.money(x.amount, s)}`);
    L.push(`${t('Total')}: ${Util.money(b.total, s)}`);
    if (s.footer) { L.push(''); L.push(s.footer); }
    return L.join('\n');
  };

  // Next bill number on this device. Prefix keeps numbers unique across linked devices.
  const nextBillNo = () => {
    const n = Store.local.billSeq + 1;
    Store.setLocal({ billSeq: n });
    return Store.local.deviceCode + '-' + String(n).padStart(5, '0');
  };

  const discountSheet = async (o) => {
    if (!(await UI.requirePin(t('Admin PIN for discount')))) return;
    const s = Store.settings();
    const d = o.discount || { type: 'amt', value: 0 };
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('Discount')}</h2>
        <div class="seg">
          <label><input type="radio" name="dt" value="pct" ${d.type === 'pct' ? 'checked' : ''}><span>%</span></label>
          <label><input type="radio" name="dt" value="amt" ${d.type !== 'pct' ? 'checked' : ''}><span>${Util.esc(s.currency)}</span></label>
        </div>
        <input id="d-val" class="input" inputmode="decimal" value="${d.value ? (d.type === 'pct' ? d.value : Util.amountStr(d.value, s.currency)) : ''}" placeholder="0">
        <div class="row end gap">
          <button type="button" class="btn ghost" data-act="clear">${t('Remove discount')}</button>
          <button class="btn primary">${t('Apply')}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        el.querySelector('[data-act=clear]').onclick = () => { Store.updateOrder(o.id, (x) => { x.discount = { type: 'amt', value: 0 }; }); close(); };
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const type = el.querySelector('input[name=dt]:checked').value;
          const raw = parseFloat(el.querySelector('#d-val').value) || 0;
          const value = type === 'pct' ? Math.min(100, Math.max(0, raw)) : Util.toMinor(Math.max(0, raw), s.currency);
          Store.updateOrder(o.id, (x) => { x.discount = { type, value }; });
          close();
        };
      }
    });
  };

  // Suggested cash amounts: exact, then the next round notes.
  const cashSuggestions = (due, cur) => {
    const unit = 10 ** Util.minorDigits(cur);
    const out = [due];
    for (const step of [5, 10, 50, 100, 500]) {
      const v = Math.ceil(due / (step * unit)) * step * unit;
      if (v > due && !out.includes(v)) out.push(v);
      if (out.length >= 4) break;
    }
    return out;
  };

  const payState = { method: 'cash' };

  const view = (el, orderId) => {
    document.body.classList.remove('no-tabs');
    const o = Store.order(orderId);
    const s = Store.settings();
    if (!o) { el.innerHTML = UI.header(t('Bill'), { back: 'tables' }) + `<div class="page empty">${t('This bill was not found.')}</div>`; return; }
    const tb = Store.table(o.tableId);
    const b = Billing.calc(o, s);
    const paid = o.status === 'paid';
    const unsent = o.lines.filter((l) => l.status === 'draft').reduce((a, l) => a + l.qty, 0);
    const notServed = o.lines.filter((l) => ['sent', 'preparing', 'ready'].includes(l.status)).length;

    el.innerHTML = `
      ${UI.header((tb ? tb.name : '') + ' · ' + t('Bill'), { back: paid ? 'reports' : 'table-' + o.tableId, actions: `<button class="icon-btn" data-act="share" aria-label="${t('Share bill')}">${UI.icon('share')}</button>` })}
      <div class="page bill-page">
        ${unsent ? `<p class="banner warn">${t('{n} dishes were never sent to the kitchen and are not on this bill.', { n: unsent })}</p>` : ''}
        ${notServed && !paid ? `<p class="banner">${t('{n} dishes are still in the kitchen.', { n: notServed })}</p>` : ''}
        <div class="bill-cols">
          <div class="bill-receipt">${receiptHtml(o, s)}</div>
          <div class="bill-pay">
            ${paid ? `
              <div class="paid-stamp">${UI.icon('check')} ${t('Paid')} · ${Util.esc(o.billNo)}</div>
              <div class="stack tight">
                <button class="btn primary block" data-act="print">${UI.icon('print')} ${t('Print receipt')}</button>
                <button class="btn ghost block" data-act="share2">${UI.icon('share')} ${t('Share receipt')}</button>
                <a class="btn ghost block" href="#tables">${t('Back to tables')}</a>
                <button class="btn danger ghost block" data-act="reopen">${t('Reopen bill')}</button>
              </div>` : `
              <div class="row between center">
                <h2>${t('Payment')}</h2>
                <button class="btn link" data-act="discount">${b.discount ? t('Edit discount') : t('Add discount')}</button>
              </div>
              <div class="due-box"><small>${b.paid ? t('Still to pay') : t('To pay')}</small><b class="mono">${Util.money(b.due, s)}</b></div>
              ${b.due > 0 ? `
                <div class="seg methods">${METHODS().map(([k, label]) => `<button class="${payState.method === k ? 'on' : ''}" data-method="${k}">${label}</button>`).join('')}</div>
                <label class="field"><span>${t('Amount received')}</span><input id="p-amt" class="input mono" inputmode="decimal" value="${Util.amountStr(b.due, s.currency)}"></label>
                ${payState.method === 'cash' ? `<div class="chips">${cashSuggestions(b.due, s.currency).map((v) => `<button class="chip-btn" data-cash="${v}">${Util.money(v, s)}</button>`).join('')}</div>` : ''}
                ${payState.method === 'online' ? (PayQR.kind(s) ? `
                  ${PayQR.box(s, b.due, billNote(o))}
                  <button class="btn ghost block" data-act="show-qr">${UI.icon('qr')} ${t('Show big to the customer')}</button>
                  <p class="hint">${t('Check the money arrived in your payment app before tapping Received.')}</p>`
                  : `<p class="banner">${t('No payment QR yet. Add your UPI ID or payment QR in Settings → Admin → Payments.')}</p>`) : ''}
                <button class="btn primary block" data-act="pay">${payState.method === 'online' ? t('Received') : t('Add payment')}</button>` : ''}
              ${o.payments.length ? `
                <ul class="pay-list">${o.payments.map((p, i) => `<li><span>${methodName(p.method)}</span><span class="mono">${Util.money(p.amount, s)}</span><button class="icon-btn" data-unpay="${i}" aria-label="${t('Remove payment')}">${UI.icon('x')}</button></li>`).join('')}</ul>` : ''}
              ${b.change ? `<div class="due-box change"><small>${t('Give change')}</small><b class="mono">${Util.money(b.change, s)}</b></div>` : ''}
              <button class="btn ${b.due === 0 && b.total > 0 ? 'primary' : 'ghost'} block" data-act="close" ${b.due === 0 && b.lines.length ? '' : 'disabled'}>${t('Close bill and free table')}</button>`}
          </div>
        </div>
      </div>`;

    const on = (a, fn) => { const x = el.querySelector(`[data-act=${a}]`); if (x) x.onclick = fn; };
    on('discount', () => discountSheet(o));
    el.querySelectorAll('[data-method]').forEach((x) => { x.onclick = () => { payState.method = x.dataset.method; view(el, orderId); }; });
    el.querySelectorAll('[data-cash]').forEach((x) => { x.onclick = () => { el.querySelector('#p-amt').value = Util.amountStr(+x.dataset.cash, s.currency); }; });
    on('pay', () => {
      const amt = Util.toMinor(parseFloat(el.querySelector('#p-amt').value) || 0, s.currency);
      if (amt <= 0) { UI.toast(t('Enter an amount'), 'bad'); return; }
      if (payState.method !== 'cash' && amt > b.due) { UI.toast(t('Card and online payments cannot be more than the amount due'), 'bad'); return; }
      Store.updateOrder(orderId, (d) => { d.payments.push({ method: payState.method, amount: amt, at: Util.now(), by: Store.local.deviceName }); });
    });
    el.querySelectorAll('[data-unpay]').forEach((x) => { x.onclick = () => {
      const i = +x.dataset.unpay; const p = Store.order(orderId).payments[i];
      Store.updateOrder(orderId, (d) => { d.payments.splice(i, 1); });
      UI.toast(t('Payment removed'), { body: `${methodName(p.method)} ${Util.money(p.amount, s)}`, undo: () => Store.updateOrder(orderId, (d) => { if (d.status === 'open') d.payments.splice(i, 0, p); }) });
    }; });
    on('close', () => {
      const billNo = nextBillNo();
      const fresh = Billing.calc(Store.order(orderId), s);
      Store.updateOrder(orderId, (d) => {
        d.status = 'paid'; d.paidAt = Util.now(); d.billNo = billNo; d.billRequested = false;
        d.totals = { subtotal: fresh.subtotal, discount: fresh.discount, service: fresh.service, tax: fresh.taxTotal, total: fresh.total };
        // Anything not sent never reaches the kitchen now
        d.lines = d.lines.filter((l) => l.status !== 'draft');
        for (const l of d.lines) if (['sent', 'preparing', 'ready'].includes(l.status)) { l.status = 'served'; l.servedAt = Util.now(); }
      });
      UI.toast(t('Bill {no} closed', { no: billNo }), { kind: 'good', body: t('{table} is free again.', { table: Store.table(o.tableId) ? Store.table(o.tableId).name : '' }) });
    });
    on('show-qr', () => PayQR.showToCustomer(Util.toMinor(parseFloat(el.querySelector('#p-amt').value) || 0, s.currency) || b.due, billNote(o)));
    on('print', () => print());
    on('share', () => Share.sendBill(orderId));
    on('share2', () => Share.sendBill(orderId));
    on('reopen', async () => {
      if (!(await UI.requirePin(t('Admin PIN to reopen')))) return;
      if (Store.openOrderFor(o.tableId)) { UI.toast(t('That table already has a new order'), 'bad'); return; }
      if (!(await UI.confirm(t('Reopen this bill?'), t('The table becomes busy again and the payment stays recorded.'), t('Reopen')))) return;
      Store.updateOrder(orderId, (d) => { d.status = 'open'; d.reopenedFrom = d.billNo; });
      UI.go('bill-' + orderId);
    });
  };

  const print = () => {
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch { /* blocked */ }
    setTimeout(done, 1500);
  };

  UI.route('bill', view);
  return { receiptHtml, receiptText, METHODS, methodName, cashSuggestions };
})();
