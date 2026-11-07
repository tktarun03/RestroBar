// Menu editor: categories and dishes, prices, and "sold out" switches.
// Deletes are soft (deleted: true) so they sync to linked devices.
const MenuView = (() => {
  // With "Only admin edits the menu" on, adding or changing dishes needs the admin lock.
  const guard = (fn) => async (...a) => {
    if (Lock.restricted('menu') && !(await Lock.verify(t('Admin PIN to edit the menu')))) return;
    fn(...a);
  };
  const itemSheet = (item) => {
    const s = Store.settings();
    const cats = Store.categories();
    const isNew = !item.id;
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${isNew ? t('New dish') : t('Edit dish')}</h2>
        <label class="field"><span>${t('Name')}</span><input id="m-name" class="input" value="${Util.esc(item.name || '')}" required autocomplete="off"></label>
        <label class="field"><span>${t('Price')} (${Util.esc(s.currency)})</span><input id="m-price" class="input mono" inputmode="decimal" value="${item.price !== undefined ? Util.amountStr(item.price, s.currency) : ''}" required></label>
        <label class="field"><span>${t('Category')}</span>
          <select id="m-cat" class="input">${cats.map((c) => `<option value="${c.id}" ${c.id === item.catId ? 'selected' : ''}>${Util.esc(c.name)}</option>`).join('')}</select>
        </label>
        <label class="toggle"><input type="checkbox" id="m-avail" ${item.available !== false ? 'checked' : ''}><span>${t('Available today')}</span></label>
        <div class="row between gap">
          ${isNew ? '<span></span>' : `<button type="button" class="btn danger ghost" data-act="del">${UI.icon('trash')} ${t('Delete')}</button>`}
          <button class="btn primary">${t('Save')}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const name = el.querySelector('#m-name').value.trim();
          const price = parseFloat(el.querySelector('#m-price').value);
          if (!name) { UI.toast(t('Enter a name'), 'bad'); return; }
          if (!(price >= 0)) { UI.toast(t('Enter a price'), 'bad'); return; }
          Store.putItem(Object.assign({}, item, {
            id: item.id || Util.uid(), name, price: Util.toMinor(price, s.currency),
            catId: el.querySelector('#m-cat').value, available: el.querySelector('#m-avail').checked,
            station: item.station || '', sort: item.sort ?? Store.items().length
          }));
          close();
        };
        const del = el.querySelector('[data-act=del]');
        if (del) del.onclick = async () => {
          close();
          if (await UI.confirm(t('Delete {name}?', { name: item.name }), t('Past bills keep the dish name and price.'), t('Delete'), true)) {
            Store.putItem(Object.assign({}, item, { deleted: true }));
            UI.toast(t('Deleted {name}', { name: item.name }), { undo: () => Store.putItem(Object.assign({}, Store.shared.items[item.id], { deleted: false })) });
          }
        };
      }
    });
  };

  const catSheet = (cat) => {
    const isNew = !cat.id;
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${isNew ? t('New category') : t('Edit category')}</h2>
        <label class="field"><span>${t('Name')}</span><input id="c-name" class="input" value="${Util.esc(cat.name || '')}" placeholder="${t('e.g. Starters')}" autocomplete="off"></label>
        <div class="row between gap">
          ${isNew ? '<span></span>' : `<button type="button" class="btn danger ghost" data-act="del">${UI.icon('trash')} ${t('Delete')}</button>`}
          <button class="btn primary">${t('Save')}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const name = el.querySelector('#c-name').value.trim();
          if (!name) { UI.toast(t('Enter a name'), 'bad'); return; }
          Store.putCategory(Object.assign({}, cat, { id: cat.id || Util.uid(), name, sort: cat.sort ?? Store.categories().length }));
          close();
        };
        const del = el.querySelector('[data-act=del]');
        if (del) del.onclick = async () => {
          const n = Store.items().filter((i) => i.catId === cat.id).length;
          close();
          if (n) { UI.toast(t('Move or delete its {n} dishes first', { n }), 'bad'); return; }
          if (await UI.confirm(t('Delete {name}?', { name: cat.name }), '', t('Delete'), true)) {
            Store.putCategory(Object.assign({}, cat, { deleted: true }));
            UI.toast(t('Deleted {name}', { name: cat.name }), { undo: () => Store.putCategory(Object.assign({}, Store.shared.categories[cat.id], { deleted: false })) });
          }
        };
      }
    });
  };

  const view = (el) => {
    document.body.classList.remove('no-tabs');
    const s = Store.settings();
    const cats = Store.categories();
    const items = Store.items().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const waiter = Store.local.role === 'waiter';
    el.innerHTML = `
      ${UI.header(t('Menu'), { actions: `<button class="btn primary small" data-act="add-item" ${cats.length ? '' : 'disabled'}>${UI.icon('plus')} ${t('Dish')}</button>` })}
      <div class="page">
        ${waiter ? `<p class="banner">${t('Changes here are sent to the kitchen tablet when linked.')}</p>` : ''}
        ${!cats.length ? `
          <div class="empty stack">
            <p>${t('Start by adding a category such as Starters or Drinks.')}</p>
            <div class="row gap center-x">
              <button class="btn primary" data-act="add-cat">${UI.icon('plus')} ${t('Add a category')}</button>
              <button class="btn ghost" data-act="demo">${t('Load sample menu')}</button>
            </div>
          </div>` : ''}
        ${cats.map((c) => {
          const list = items.filter((i) => i.catId === c.id);
          return `
            <section class="menu-sec">
              <button class="menu-sec-head" data-cat="${c.id}"><h2>${Util.esc(c.name)}</h2><span class="muted small">${list.length} · ${t('Edit')}</span></button>
              <ul class="menu-rows">
                ${list.map((i) => `
                  <li class="menu-row ${i.available ? '' : 'off'}">
                    <button class="grow left" data-item="${i.id}"><span>${Util.esc(i.name)}</span><span class="mono muted">${Util.money(i.price, s)}</span></button>
                    <label class="switch" title="${t('Available')}"><input type="checkbox" data-avail="${i.id}" ${i.available ? 'checked' : ''} aria-label="${t('Available')}: ${Util.esc(i.name)}"><span></span></label>
                  </li>`).join('') || `<li class="muted small pad">${t('No dishes in this category.')}</li>`}
              </ul>
            </section>`;
        }).join('')}
        ${cats.length ? `<button class="btn ghost block" data-act="add-cat">${UI.icon('plus')} ${t('Add a category')}</button>` : ''}
      </div>`;

    const on = (a, fn) => el.querySelectorAll(`[data-act=${a}]`).forEach((b) => { b.onclick = fn; });
    on('add-item', guard(() => itemSheet({ catId: (cats[0] || {}).id, available: true })));
    on('add-cat', guard(() => catSheet({})));
    on('demo', guard(() => { Demo.loadMenu(); UI.toast(t('Sample menu added'), { kind: 'good', body: t('Edit prices or switch dishes off any time.') }); }));
    el.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = guard(() => catSheet(Store.shared.categories[b.dataset.cat])); });
    el.querySelectorAll('[data-item]').forEach((b) => { b.onclick = guard(() => itemSheet(Store.shared.items[b.dataset.item])); });
    el.querySelectorAll('[data-avail]').forEach((b) => {
      b.onchange = () => {
        const it = Store.shared.items[b.dataset.avail];
        Store.putItem(Object.assign({}, it, { available: b.checked }));
        UI.toast(b.checked ? t('{name} is back on', { name: it.name }) : t('{name} marked sold out', { name: it.name }), {
          body: b.checked ? undefined : t('Waiters see it greyed out.'),
          undo: () => Store.putItem(Object.assign({}, Store.shared.items[it.id], { available: !b.checked }))
        });
      };
    });
  };

  UI.route('menu', view);
  return {};
})();
