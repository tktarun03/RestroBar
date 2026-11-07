// Taking an order at a table: pick dishes, add notes, send to kitchen, void, move table.
// Route: #table-<tableId>. The order is created when the first dish is added.
const OrderView = (() => {
  const QUICK_NOTES = ['No onion', 'Less spicy', 'Extra spicy', 'No ice', 'Well done', 'Takeaway', 'Allergy – see waiter'];
  const ui = { tab: 'menu', cat: '', q: '', tableId: '' };

  const LINE_LABEL = () => ({ draft: t('Not sent'), sent: t('Sent'), preparing: t('Cooking'), ready: t('Ready'), served: t('Served'), void: t('Void') });

  const orderFor = (tableId) => Store.openOrderFor(tableId);
  const ensureOrder = (tableId) => orderFor(tableId) || Store.newOrder(tableId);

  const addItem = (tableId, item) => {
    if (!item.available) { UI.toast(t('{name} is sold out', { name: item.name }), 'bad'); return; }
    const o = ensureOrder(tableId);
    Store.updateOrder(o.id, (d) => {
      const same = d.lines.find((l) => l.status === 'draft' && l.itemId === item.id && !l.note);
      if (same) same.qty += 1;
      else d.lines.push({ id: Util.uid(), itemId: item.id, name: item.name, price: item.price, qty: 1, note: '', status: 'draft', addedAt: Util.now(), station: item.station || '' });
    });
  };

  const sendToKitchen = (orderId) => {
    const by = Store.local.deviceName;
    let n = 0;
    Store.updateOrder(orderId, (d) => {
      const drafts = d.lines.filter((l) => l.status === 'draft');
      if (!drafts.length) return;
      d.kotSeq += 1;
      for (const l of drafts) { l.status = 'sent'; l.sentAt = Util.now(); l.kot = d.kotSeq; l.sentBy = by; n += l.qty; }
    });
    if (n) { UI.toast(t('Sent {n} items to the kitchen', { n }), 'good'); Link.nudge(); }
  };

  const qtyOf = (o, itemId) => o ? o.lines.filter((l) => l.itemId === itemId && l.status !== 'void').reduce((s, l) => s + l.qty, 0) : 0;

  const lineSheet = (orderId, lineId) => {
    const o = Store.order(orderId); const l = o && o.lines.find((x) => x.id === lineId);
    if (!l) return;
    const draft = l.status === 'draft';
    UI.open(`
      <h2 class="sheet-title">${Util.esc(l.name)}</h2>
      <p class="muted">${LINE_LABEL()[l.status]}${l.kot ? ' · KOT ' + l.kot : ''}</p>
      ${draft ? `
        <div class="stepper big">
          <button class="icon-btn" data-q="-1" aria-label="${t('Fewer')}">${UI.icon('minus')}</button>
          <output id="ls-qty">${l.qty}</output>
          <button class="icon-btn" data-q="1" aria-label="${t('More')}">${UI.icon('plus')}</button>
        </div>
        <label class="field"><span>${t('Note for the kitchen')}</span><input id="ls-note" class="input" value="${Util.esc(l.note)}" placeholder="${t('e.g. no onion')}" autocomplete="off"></label>
        <div class="chips">${QUICK_NOTES.map((n) => `<button class="chip-btn" data-note="${Util.esc(t(n))}">${Util.esc(t(n))}</button>`).join('')}</div>
        <div class="row between gap">
          <button class="btn danger ghost" data-act="remove">${UI.icon('trash')} ${t('Remove')}</button>
          <button class="btn primary" data-act="save">${t('Done')}</button>
        </div>` : `
        ${l.note ? `<p><b>${t('Note')}:</b> ${Util.esc(l.note)}</p>` : ''}
        <div class="stack tight">
          ${l.status === 'ready' ? `<button class="btn primary block" data-act="served">${t('Mark served')}</button>` : ''}
          ${l.status !== 'void' && l.status !== 'served' ? '' : ''}
          ${l.status !== 'void' ? `<button class="btn danger ghost block" data-act="void">${UI.icon('x')} ${t('Void this item')}</button>` : ''}
          <button class="btn ghost block" data-close>${t('Close')}</button>
        </div>`}
    `, {
      onMount: (el, close) => {
        let qty = l.qty;
        el.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => { qty = Math.max(1, qty + +b.dataset.q); el.querySelector('#ls-qty').textContent = qty; }; });
        el.querySelectorAll('[data-note]').forEach((b) => { b.onclick = () => { const i = el.querySelector('#ls-note'); i.value = i.value ? i.value + ', ' + b.dataset.note : b.dataset.note; }; });
        const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
        on('save', () => {
          const note = el.querySelector('#ls-note').value.trim();
          Store.updateOrder(orderId, (d) => { const x = d.lines.find((y) => y.id === lineId); if (x) { x.qty = qty; x.note = note; } });
          close();
        });
        on('remove', () => { Store.updateOrder(orderId, (d) => { d.lines = d.lines.filter((y) => y.id !== lineId); }); close(); });
        on('served', () => { Tables.markServed(orderId, [lineId]); close(); });
        on('void', async () => {
          close();
          if (!(await UI.requirePin(t('Admin PIN to void')))) return;
          const why = await UI.ask(t('Reason for voiding'), { placeholder: t('e.g. customer changed mind'), okLabel: t('Void item') });
          if (why === null) return;
          Store.updateOrder(orderId, (d) => { const x = d.lines.find((y) => y.id === lineId); if (x) { x.status = 'void'; x.voidReason = why.trim(); x.voidAt = Util.now(); x.voidBy = Store.local.deviceName; } });
          UI.toast(t('Item voided'));
        });
      }
    });
  };

  const actionsSheet = (orderId) => {
    const o = Store.order(orderId);
    UI.open(`
      <h2 class="sheet-title">${t('Order options')}</h2>
      <div class="stack tight">
        <button class="btn ghost block" data-act="move">${t('Move to another table')}</button>
        <button class="btn ghost block" data-act="bill">${o.billRequested ? t('Cancel bill request') : t('Customer asked for the bill')}</button>
        <button class="btn ghost block" data-act="share">${UI.icon('share')} ${t('Send this order to another device')}</button>
        <button class="btn danger ghost block" data-act="cancel">${t('Cancel whole order')}</button>
        <button class="btn ghost block" data-close>${t('Close')}</button>
      </div>`, {
      onMount: (el, close) => {
        const on = (a, fn) => { el.querySelector(`[data-act=${a}]`).onclick = () => { close(); fn(); }; };
        on('move', () => moveSheet(orderId));
        on('bill', () => Store.updateOrder(orderId, (d) => { d.billRequested = !d.billRequested; }));
        on('share', () => Share.sendOrder(orderId));
        on('cancel', async () => {
          const sent = o.lines.some((l) => l.status !== 'draft' && l.status !== 'void');
          if (sent && !(await UI.requirePin(t('Admin PIN to cancel')))) return;
          if (!(await UI.confirm(t('Cancel this order?'), sent ? t('Dishes already sent to the kitchen will be voided.') : '', t('Cancel order'), true))) return;
          Store.updateOrder(orderId, (d) => {
            d.status = 'void';
            for (const l of d.lines) if (l.status !== 'void') { l.status = 'void'; l.voidReason = 'Order cancelled'; l.voidAt = Util.now(); }
          });
          UI.go('tables');
        });
      }
    });
  };

  const moveSheet = (orderId) => {
    const free = Store.tables().filter((tb) => !Store.openOrderFor(tb.id));
    UI.open(`
      <h2 class="sheet-title">${t('Move to')}</h2>
      ${free.length ? `<div class="table-grid small">${free.map((tb) => `<button class="table-card st-free" data-to="${Util.esc(tb.id)}"><span class="tc-name">${Util.esc(tb.name)}</span></button>`).join('')}</div>` : `<p class="muted">${t('Every table is busy.')}</p>`}
      <button class="btn ghost block" data-close>${t('Close')}</button>`, {
      onMount: (el, close) => {
        el.querySelectorAll('[data-to]').forEach((b) => { b.onclick = () => {
          Store.updateOrder(orderId, (d) => { d.tableId = b.dataset.to; });
          close(); UI.go('table-' + b.dataset.to);
          UI.toast(t('Order moved'));
        }; });
      }
    });
  };

  const menuPane = (o, s) => {
    const cats = Store.categories();
    const q = ui.q.trim().toLowerCase();
    let items = Store.items().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    if (q) items = items.filter((i) => i.name.toLowerCase().includes(q));
    else if (ui.cat) items = items.filter((i) => i.catId === ui.cat);
    const catName = (id) => (cats.find((c) => c.id === id) || {}).name || '';
    const groups = q || ui.cat ? [[null, items]] : cats.map((c) => [c, items.filter((i) => i.catId === c.id)]).concat([[{ name: t('Other') }, items.filter((i) => !cats.some((c) => c.id === i.catId))]]);
    if (!Store.items().length) {
      return `<div class="empty">${t('Your menu is empty.')} <a href="#menu">${t('Add dishes')}</a></div>`;
    }
    return `
      <div class="menu-tools">
        <input id="o-search" class="input" type="search" placeholder="${t('Search dishes')}" value="${Util.esc(ui.q)}" autocomplete="off">
        <div class="cat-chips" role="tablist">
          <button class="chip-btn ${!ui.cat ? 'on' : ''}" data-cat="">${t('All')}</button>
          ${cats.map((c) => `<button class="chip-btn ${ui.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${Util.esc(c.name)}</button>`).join('')}
        </div>
      </div>
      <div class="menu-list">
        ${groups.filter(([, list]) => list.length).map(([c, list]) => `
          ${c ? `<h3 class="menu-cat">${Util.esc(c.name)}</h3>` : ''}
          ${list.map((i) => {
            const n = qtyOf(o, i.id);
            return `
            <button class="dish ${i.available ? '' : 'off'} ${n ? 'has' : ''}" data-add="${i.id}">
              <span class="dish-name">${Util.esc(i.name)}${q ? `<small>${Util.esc(catName(i.catId))}</small>` : ''}${i.available ? '' : `<small>${t('Sold out')}</small>`}</span>
              <span class="dish-price mono">${Util.money(i.price, s)}</span>
              <span class="dish-qty">${n ? n : UI.icon('plus')}</span>
            </button>`;
          }).join('')}`).join('')}
      </div>`;
  };

  const orderPane = (o, s) => {
    if (!o || !o.lines.length) return `<div class="empty">${t('No dishes yet. Add from the menu.')}</div>`;
    const drafts = o.lines.filter((l) => l.status === 'draft');
    const sent = o.lines.filter((l) => l.status !== 'draft');
    const L = LINE_LABEL();
    const row = (l) => `
      <button class="line st-${l.status}" data-line="${l.id}">
        <span class="line-qty mono">${l.qty}×</span>
        <span class="line-name">${Util.esc(l.name)}${l.note ? `<small>${UI.icon('note')} ${Util.esc(l.note)}</small>` : ''}${l.voidReason ? `<small>${t('Void')}: ${Util.esc(l.voidReason)}</small>` : ''}</span>
        ${l.status !== 'draft' ? `<span class="chip st-${l.status}">${L[l.status]}</span>` : ''}
        <span class="line-amt mono">${Util.money(l.price * l.qty, s)}</span>
      </button>`;
    return `
      ${drafts.length ? `<h3 class="sub">${t('Not sent yet')}</h3><div class="lines">${drafts.map(row).join('')}</div>` : ''}
      ${sent.length ? `<h3 class="sub">${t('Sent to kitchen')}</h3><div class="lines">${sent.map(row).join('')}</div>` : ''}`;
  };

  const view = (el, tableId) => {
    document.body.classList.remove('no-tabs');
    const tb = Store.table(tableId);
    if (!tb) { el.innerHTML = UI.header(t('Table'), { back: 'tables' }) + `<div class="page empty">${t('This table no longer exists.')}</div>`; return; }
    if (ui.tableId !== tableId) { ui.tableId = tableId; ui.tab = orderFor(tableId) ? 'order' : 'menu'; ui.q = ''; ui.cat = ''; }
    const s = Store.settings();
    const o = orderFor(tableId);
    const drafts = o ? o.lines.filter((l) => l.status === 'draft') : [];
    const draftQty = drafts.reduce((a, l) => a + l.qty, 0);
    const lineCount = o ? o.lines.filter((l) => l.status !== 'void').reduce((a, l) => a + l.qty, 0) : 0;
    const total = o ? Tables.runningTotal(o) : 0;
    const st = Tables.statusOf(o);

    el.innerHTML = `
      ${UI.header(tb.name, { back: 'tables', actions: o ? `<button class="icon-btn" data-act="more" aria-label="${t('Order options')}">${UI.icon('menu')}</button>` : '' })}
      <div class="order-layout">
        <div class="seg" role="tablist">
          <button role="tab" class="${ui.tab === 'menu' ? 'on' : ''}" data-tab="menu">${t('Menu')}</button>
          <button role="tab" class="${ui.tab === 'order' ? 'on' : ''}" data-tab="order">${t('Order')} ${lineCount ? `<span class="count">${lineCount}</span>` : ''}</button>
        </div>
        <div class="pane pane-menu ${ui.tab === 'menu' ? 'on' : ''}">${menuPane(o, s)}</div>
        <div class="pane pane-order ${ui.tab === 'order' ? 'on' : ''}">
          ${o ? `<div class="order-head"><span class="chip st-${st.key}">${st.label}</span><span class="muted small">${t('Opened')} ${Util.time(o.createdAt, s.locale)}</span></div>` : ''}
          ${orderPane(o, s)}
        </div>
      </div>
      <footer class="action-bar">
        <div class="ab-total"><small>${t('Total so far')}</small><b class="mono">${Util.money(total, s)}</b></div>
        ${draftQty
          ? `<button class="btn primary grow" data-act="send">${UI.icon('kitchen')} ${t('Send {n} to kitchen', { n: draftQty })}</button>`
          : o && lineCount ? `<a class="btn primary grow" href="#bill-${o.id}">${UI.icon('receipt')} ${t('Bill')}</a>` : `<button class="btn primary grow" disabled>${t('Add dishes')}</button>`}
      </footer>`;

    el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { ui.tab = b.dataset.tab; view(el, tableId); }; });
    el.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { ui.cat = b.dataset.cat; ui.q = ''; view(el, tableId); }; });
    const wireDishes = () => el.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => {
        const it = Store.shared.items[b.dataset.add];
        if (it) addItem(tableId, it);
      };
    });
    wireDishes();
    el.querySelectorAll('[data-line]').forEach((b) => { b.onclick = () => lineSheet(orderFor(tableId).id, b.dataset.line); });
    const search = el.querySelector('#o-search');
    if (search) search.oninput = Util.debounce(() => {
      // Swap only the list so the search box keeps focus and the keyboard stays up.
      ui.q = search.value;
      const tmp = document.createElement('div');
      tmp.innerHTML = menuPane(orderFor(tableId), s);
      const fresh = tmp.querySelector('.menu-list');
      const list = el.querySelector('.menu-list');
      if (fresh && list) { list.replaceWith(fresh); wireDishes(); }
    }, 150);
    const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
    on('send', () => sendToKitchen(o.id));
    on('more', () => actionsSheet(o.id));
  };

  UI.route('table', view);
  return { sendToKitchen, addItem };
})();
