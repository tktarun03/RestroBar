// Settings: restaurant details, money, tables, this device, data, appearance, version history,
// self-check and feedback. Also "Receive" for QR / file imports.
const SettingsView = (() => {
  const REPO = 'https://github.com/tktarun03/restrobar';

  const row = (act, title, sub = '', ic = 'chevron') => `
    <button class="set-row" data-act="${act}"><span class="grow"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${UI.icon(ic)}</button>`;

  // ---------- sheets ----------
  const brandSheet = () => {
    const s = Store.settings();
    let logo = s.logo;
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('Restaurant details')}</h2>
        <label class="field"><span>${t('Restaurant name')}</span><input id="b-name" class="input" value="${Util.esc(s.brandName)}" autocomplete="organization"></label>
        <div class="field"><span>${t('Logo')}</span>
          <div class="row gap center"><div class="logo-preview" id="b-logo">${logo ? `<img src="${logo}" alt="">` : '<span>?</span>'}</div>
          <label class="btn ghost">${UI.icon('upload')} ${t('Choose image')}<input type="file" id="b-file" accept="image/*" hidden></label>
          <button type="button" class="btn link" data-act="nologo">${t('Remove')}</button></div>
        </div>
        <label class="field"><span>${t('Brand colour')}</span><input id="b-accent" type="color" class="input color" value="${Util.esc(s.accent)}"></label>
        <label class="field"><span>${t('Address')}</span><input id="b-addr" class="input" value="${Util.esc(s.address)}" autocomplete="street-address"></label>
        <label class="field"><span>${t('Phone')}</span><input id="b-phone" class="input" value="${Util.esc(s.phone)}" inputmode="tel" autocomplete="tel"></label>
        <label class="field"><span>${t('Tax registration no.')}</span><input id="b-taxno" class="input" value="${Util.esc(s.taxNo)}"></label>
        <label class="field"><span>${t('Receipt footer')}</span><input id="b-foot" class="input" value="${Util.esc(s.footer)}"></label>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save')}</button></div>
      </form>`, {
      onMount: (el, close) => {
        el.querySelector('#b-file').onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          logo = await Setup.shrinkImage(f, 256);
          el.querySelector('#b-logo').innerHTML = logo ? `<img src="${logo}" alt="">` : '<span>?</span>';
        };
        el.querySelector('[data-act=nologo]').onclick = () => { logo = ''; el.querySelector('#b-logo').innerHTML = '<span>?</span>'; };
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const v = (id) => el.querySelector('#' + id).value.trim();
          Store.saveSettings({ brandName: v('b-name') || 'My Restaurant', logo, accent: v('b-accent'), address: v('b-addr'), phone: v('b-phone'), taxNo: v('b-taxno'), footer: v('b-foot') });
          App.applyLook(); close(); UI.toast(t('Saved'));
        };
      }
    });
  };

  const moneySheet = async () => {
    if (!(await UI.requirePin(t('Admin PIN to change prices and tax')))) return;
    const s = Store.settings();
    let taxes = JSON.parse(JSON.stringify(s.taxes));
    let list = []; try { list = Intl.supportedValuesOf('currency'); } catch { list = [s.currency]; }
    const draw = (el) => {
      el.querySelector('#tax-rows').innerHTML = taxes.map((x, i) => `
        <div class="row gap"><input class="input grow" data-tn="${i}" value="${Util.esc(x.name)}" placeholder="${t('Name, e.g. VAT')}">
        <input class="input w-rate" data-tr="${i}" value="${Util.esc(x.rate)}" inputmode="decimal" placeholder="%">
        <button type="button" class="icon-btn" data-td="${i}" aria-label="${t('Remove tax')}">${UI.icon('x')}</button></div>`).join('');
      el.querySelectorAll('[data-tn]').forEach((i) => { i.oninput = () => { taxes[+i.dataset.tn].name = i.value; }; });
      el.querySelectorAll('[data-tr]').forEach((i) => { i.oninput = () => { taxes[+i.dataset.tr].rate = Math.max(0, parseFloat(i.value) || 0); }; });
      el.querySelectorAll('[data-td]').forEach((b) => { b.onclick = () => { taxes.splice(+b.dataset.td, 1); draw(el); }; });
    };
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('Prices and tax')}</h2>
        <label class="field"><span>${t('Currency')}</span><select id="m-cur" class="input">${list.map((c) => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <p class="hint" id="cur-warn" hidden>${t('Menu prices are not converted. Check them after changing currency.')}</p>
        <label class="field"><span>${t('Number format (locale)')}</span><input id="m-loc" class="input" value="${Util.esc(s.locale)}" placeholder="${t('Device default, e.g. en-QA, ar-QA, en-IN')}"></label>
        <div class="field"><span>${t('Taxes')}</span><div class="stack tight" id="tax-rows"></div>
          <button type="button" class="btn ghost" data-act="addtax">${UI.icon('plus')} ${t('Add a tax')}</button></div>
        <label class="toggle"><input type="checkbox" id="m-incl" ${s.taxInclusive ? 'checked' : ''}><span>${t('Menu prices already include tax')}</span></label>
        <label class="field"><span>${t('Service charge %')}</span><input id="m-svc" class="input" inputmode="decimal" value="${s.serviceCharge || ''}" placeholder="0"></label>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save')}</button></div>
      </form>`, {
      onMount: (el, close) => {
        draw(el);
        el.querySelector('#m-cur').onchange = (e) => { el.querySelector('#cur-warn').hidden = e.target.value === s.currency || !Store.items().length; };
        el.querySelector('[data-act=addtax]').onclick = () => { taxes.push({ name: '', rate: 0 }); draw(el); };
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const loc = el.querySelector('#m-loc').value.trim();
          if (loc) { try { new Intl.NumberFormat(loc); } catch { UI.toast(t('That locale is not valid'), 'bad'); return; } }
          Store.saveSettings({
            currency: el.querySelector('#m-cur').value, locale: loc,
            taxes: taxes.filter((x) => x.name || x.rate), taxInclusive: el.querySelector('#m-incl').checked,
            serviceCharge: Math.max(0, parseFloat(el.querySelector('#m-svc').value) || 0)
          });
          close(); UI.toast(t('Saved'));
        };
      }
    });
  };

  const tablesSheet = () => {
    let tables = JSON.parse(JSON.stringify(Store.tables()));
    const draw = (el) => {
      el.querySelector('#t-rows').innerHTML = tables.map((tb, i) => {
        const busy = !!Store.openOrderFor(tb.id);
        return `<div class="row gap"><input class="input grow" data-tn="${i}" value="${Util.esc(tb.name)}">
          <button type="button" class="icon-btn" data-td="${i}" ${busy ? 'disabled title="' + t('Table has an open order') + '"' : ''} aria-label="${t('Remove table')}">${UI.icon('trash')}</button></div>`;
      }).join('');
      el.querySelectorAll('[data-tn]').forEach((i) => { i.oninput = () => { tables[+i.dataset.tn].name = i.value; }; });
      el.querySelectorAll('[data-td]').forEach((b) => { b.onclick = () => { tables.splice(+b.dataset.td, 1); draw(el); }; });
    };
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('Tables')}</h2>
        <div class="stack tight scroll-y" id="t-rows"></div>
        <button type="button" class="btn ghost" data-act="add">${UI.icon('plus')} ${t('Add a table')}</button>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save')}</button></div>
      </form>`, {
      onMount: (el, close) => {
        draw(el);
        el.querySelector('[data-act=add]').onclick = () => {
          const n = tables.length + 1;
          let id = 't' + n; while (tables.some((x) => x.id === id)) id = 't' + Util.uid().slice(0, 6);
          tables.push({ id, name: t('Table') + ' ' + n }); draw(el);
          const rows = el.querySelectorAll('[data-tn]'); rows[rows.length - 1].focus();
        };
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          Store.saveSettings({ tables: tables.map((x) => ({ id: x.id, name: x.name.trim() || x.id })) });
          close(); UI.toast(t('Saved'));
        };
      }
    });
  };

  const deviceSheet = () => {
    const L = Store.local;
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('This device')}</h2>
        <label class="field"><span>${t('Device name')}</span><input id="d-name" class="input" value="${Util.esc(L.deviceName)}"></label>
        <div class="field"><span>${t('Role')}</span>
          <select id="d-role" class="input">
            <option value="solo" ${L.role === 'solo' ? 'selected' : ''}>${t('One device does everything')}</option>
            <option value="hub" ${L.role === 'hub' ? 'selected' : ''}>${t('Main kitchen tablet')}</option>
            <option value="waiter" ${L.role === 'waiter' ? 'selected' : ''}>${t('Waiter phone')}</option>
          </select></div>
        <label class="field"><span>${t('Bill number prefix')}</span><input id="d-code" class="input mono" maxlength="4" value="${Util.esc(L.deviceCode)}"></label>
        <p class="hint">${t('Each device that takes payments needs a different prefix, so bill numbers never clash.')}</p>
        <label class="toggle"><input type="checkbox" id="d-sound" ${L.sound ? 'checked' : ''}><span>${t('Sound for new tickets and ready dishes')}</span></label>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save')}</button></div>
      </form>`, {
      onMount: (el, close) => {
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const code = el.querySelector('#d-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          Store.setLocal({ deviceName: el.querySelector('#d-name').value.trim() || 'Device', role: el.querySelector('#d-role').value, deviceCode: code || L.deviceCode, sound: el.querySelector('#d-sound').checked });
          close(); UI.toast(t('Saved'));
        };
      }
    });
  };

  const pinSheet = async () => {
    if (Store.local.pin && !(await UI.requirePin(t('Current PIN')))) return;
    const v = await UI.ask(t('New admin PIN (leave empty to turn off)'), { type: 'password', inputmode: 'numeric', placeholder: '4–8 digits' });
    if (v === null) return;
    if (v && !/^\d{4,8}$/.test(v)) { UI.toast(t('Use 4 to 8 digits'), 'bad'); return; }
    if (!v && Lock.hasBio()) {
      // The PIN is the way back in if face or fingerprint fails, so both go together.
      if (!(await UI.confirm(t('Turn off the admin lock?'), t('{name} is turned off too, because the PIN is its backup.', { name: Lock.bioName() }), t('Turn off'), true))) return;
      Lock.disableBio();
    }
    if (v) Lock.unlock(); // before saving, so the admin screen re-renders unlocked
    Store.setLocal({ pin: v });
    UI.toast(v ? t('PIN set') : t('Admin lock turned off'));
  };

  const bioToggle = async () => {
    if (Lock.hasBio()) {
      if (await UI.confirm(t('Turn off {name}?', { name: Lock.bioName() }), t('The admin PIN still works.'), t('Turn off'))) { Lock.disableBio(); UI.toast(t('Turned off')); }
      return;
    }
    await Lock.enrollBio();
  };

  const versionsSheet = () => UI.open(`
    <h2 class="sheet-title">${t('Version history')}</h2>
    <div class="stack scroll-y">${RELEASES.map((r) => `
      <section><h3>${r.version} <span class="muted small">${r.date}</span></h3><ul class="notes">${r.notes.map((n) => `<li>${Util.esc(n)}</li>`).join('')}</ul></section>`).join('')}</div>
    <button class="btn ghost block" data-close>${t('Close')}</button>`, { noFocus: true });

  // Built-in self-check: runs on the real phone from Settings.
  const selfCheck = async () => {
    const results = [];
    const check = async (name, fn) => { try { const r = await fn(); results.push([name, r === true ? true : r === false ? false : r]); } catch (e) { results.push([name, false, e.message]); } };
    await check(t('Saving works'), async () => { await Store.flush(); return true; });
    await check(t('Scripts match version {v}', { v: APP_VERSION }), () => [...document.scripts].filter((s) => s.src.includes('/js/')).every((s) => s.src.includes('v=' + APP_VERSION)));
    await check(t('Bill maths'), () => {
      const b = Billing.calc({ lines: [{ itemId: 'a', name: 'a', price: 1000, qty: 2, status: 'sent' }], discount: { type: 'pct', value: 10 } }, { taxes: [{ name: 'VAT', rate: 5 }], serviceCharge: 10, taxInclusive: false });
      return b.subtotal === 2000 && b.discount === 200 && b.service === 180 && b.taxTotal === 99 && b.total === 2079;
    });
    await check(t('Currency format'), () => Util.money(12345, Store.settings()).length > 0);
    await check(t('Works offline'), async () => !!(navigator.serviceWorker && (await navigator.serviceWorker.getRegistration())) || t('not yet: open once with internet'));
    await check(t('Live link (WebRTC)'), () => Link.supported() || t('not available here'));
    await check(t('Camera for QR codes'), () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || t('not available here'));
    await check(t('Share sheet'), () => !!navigator.share || t('not available, file download used instead'));
    await check(t('QR libraries'), () => typeof qrcode === 'function' && typeof jsQR === 'function');
    await check(t('Data compression for QR'), () => typeof CompressionStream !== 'undefined' || t('not available, larger codes'));
    UI.open(`
      <h2 class="sheet-title">${t('Self-check')}</h2>
      <ul class="checks">${results.map(([n, ok, err]) => `<li class="${ok === true ? 'ok' : ok === false ? 'bad' : 'warn'}">${ok === true ? UI.icon('check') : UI.icon('x')}<span>${Util.esc(n)}${typeof ok === 'string' ? ` <small>${Util.esc(ok)}</small>` : ''}${err ? ` <small>${Util.esc(err)}</small>` : ''}</span></li>`).join('')}</ul>
      <p class="muted small">RestroBar ${APP_VERSION} · ${Util.esc(navigator.userAgent.slice(0, 80))}</p>
      <button class="btn ghost block" data-close>${t('Close')}</button>`, { noFocus: true });
  };

  const feedbackUrl = (kind) => {
    const p = new URLSearchParams({ template: kind === 'bug' ? 'bug.yml' : 'feedback.yml', version: APP_VERSION, device: navigator.userAgent.slice(0, 120), role: Store.local.role });
    return `${REPO}/issues/new?${p}`;
  };

  const lockStatus = () => Lock.hasBio() ? t('Locked with {name} and PIN', { name: Lock.bioName() }) : Lock.hasPin() ? t('Locked with PIN') : t('Not locked: anyone can change prices');

  // Everyday settings: anyone on the device can use these.
  const view = (el) => {
    document.body.classList.remove('no-tabs');
    const s = Store.settings(); const L = Store.local;
    const lastBk = L.lastBackupAt ? Util.dateTime(L.lastBackupAt, s.locale) : t('never');
    el.innerHTML = `
      ${UI.header(t('Settings'))}
      <div class="page settings">
        <section class="set-group">
          <a class="set-row admin-row" href="#admin"><span class="grow"><b>${t('Admin')}</b><small>${t('Restaurant, prices, payments, tables, security')} · ${lockStatus()}</small></span>${UI.icon('lock')}</a>
        </section>
        <section class="set-group"><h2>${t('Devices')}</h2>
          ${row('device', t('This device'), Util.esc(L.deviceName) + ' · ' + t({ solo: 'One device does everything', hub: 'Main kitchen tablet', waiter: 'Waiter phone' }[L.role]))}
          <a class="set-row" href="#links"><span class="grow"><b>${t('Linked devices')}</b><small>${t('Live link over the same Wi-Fi')}</small></span>${UI.icon('chevron')}</a>
          ${row('scan', t('Receive by QR code'), t('Scan an order or bill from another device'), 'qr')}
          ${row('import', t('Import a file'), t('Order, bill or backup received by Bluetooth, AirDrop or chat'), 'upload')}
          ${row('backup', t('Back up now'), t('Last backup: {when}', { when: lastBk }), 'download')}
        </section>
        <section class="set-group"><h2>${t('Appearance')}</h2>
          <div class="set-inline"><span>${t('Theme')}</span>
            <div class="seg small">${[['system', t('Auto')], ['light', t('Light')], ['dark', t('Dark')]].map(([k, l]) => `<button class="${L.theme === k ? 'on' : ''}" data-theme-set="${k}">${l}</button>`).join('')}</div></div>
          <div class="set-inline"><span>${t('Text size')}</span>
            <div class="seg small">${[[90, 'A−'], [100, 'A'], [115, 'A+'], [130, 'A++']].map(([k, l]) => `<button class="${L.textSize === k ? 'on' : ''}" data-size="${k}">${l}</button>`).join('')}</div></div>
          <div class="set-inline"><span>${t('Language')}</span><span class="muted">English</span></div>
        </section>
        <section class="set-group"><h2>${t('About')}</h2>
          ${row('versions', t('Version history'), 'RestroBar ' + APP_VERSION)}
          ${row('check', t('Self-check'), t('Test this device'))}
          ${row('homescreen', t('Add to Home Screen'), t('Recommended before you start'))}
          <a class="set-row" href="${feedbackUrl('feedback')}" target="_blank" rel="noopener"><span class="grow"><b>${t('Send feedback')}</b><small>${t('Opens a form on GitHub. Nothing is sent until you submit it.')}</small></span>${UI.icon('chevron')}</a>
          <a class="set-row" href="${feedbackUrl('bug')}" target="_blank" rel="noopener"><span class="grow"><b>${t('Report a problem')}</b></span>${UI.icon('chevron')}</a>
          ${row('tour', t('Show the intro again'), '')}
        </section>
      </div>`;
    const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
    on('device', deviceSheet);
    on('scan', Share.scanImport);
    on('import', Share.importFile);
    on('backup', Share.backupNow);
    on('versions', versionsSheet);
    on('check', selfCheck);
    on('homescreen', App.homeScreenTip);
    on('tour', () => { Store.setLocal({ tourDone: false }); UI.go('tour'); });
    el.querySelectorAll('[data-theme-set]').forEach((b) => { b.onclick = () => { Store.setLocal({ theme: b.dataset.themeSet }); App.applyLook(); }; });
    el.querySelectorAll('[data-size]').forEach((b) => { b.onclick = () => { Store.setLocal({ textSize: +b.dataset.size }); App.applyLook(); }; });
  };

  // Admin: owner-only settings, behind Face ID / fingerprint or the admin PIN.
  const adminView = (el) => {
    document.body.classList.remove('no-tabs');
    const s = Store.settings(); const L = Store.local;
    if (!Lock.isOpen()) {
      el.innerHTML = `
        ${UI.header(t('Admin'), { back: 'more' })}
        <div class="page">
          <section class="card locked center">
            <div class="lock-mark">${UI.icon('lock')}</div>
            <h2>${t('Admin is locked')}</h2>
            <p class="muted">${Lock.hasBio() ? t('Use {name}, or your admin PIN.', { name: Lock.bioName() }) : t('Enter your admin PIN.')}</p>
            <button class="btn primary block" data-act="unlock">${Lock.hasBio() ? t('Unlock with {name}', { name: Lock.bioName() }) : t('Unlock')}</button>
            ${Lock.hasBio() ? `<button class="btn ghost block" data-act="unlock-pin">${t('Use PIN instead')}</button>` : ''}
          </section>
        </div>`;
      const go = (pinOnly) => Lock.verify(t('Admin PIN'), { pinOnly }).then((ok) => { if (ok) adminView(el); else if (!pinOnly && Lock.hasBio()) UI.toast(t('Not recognised. Try again or use your PIN.'), 'bad'); });
      el.querySelector('[data-act=unlock]').onclick = () => go(false);
      const p = el.querySelector('[data-act=unlock-pin]'); if (p) p.onclick = () => go(true);
      return;
    }
    const lastBk = L.lastBackupAt ? Util.dateTime(L.lastBackupAt, s.locale) : t('never');
    const payKind = PayQR.kind(s);
    el.innerHTML = `
      ${UI.header(t('Admin'), { back: 'more', actions: Lock.isSet() ? `<button class="btn ghost small" data-act="lock">${UI.icon('lock')} ${t('Lock')}</button>` : '' })}
      <div class="page settings">
        ${Lock.isSet() ? `<p class="muted small">${t('Unlocked. Locks again in {n} min.', { n: Lock.minutesLeft() })}</p>`
          : `<p class="banner warn">${t('Anyone can open this screen. Set an admin PIN below, then turn on {name}.', { name: Lock.bioName() })}</p>`}
        <section class="set-group"><h2>${t('Restaurant')}</h2>
          ${row('brand', t('Restaurant details'), Util.esc(s.brandName) + (s.address ? ' · ' + Util.esc(s.address) : ''))}
          ${row('money', t('Prices and tax'), `${Util.esc(s.currency)} · ${s.taxes.length ? s.taxes.map((x) => Util.esc(x.name) + ' ' + x.rate + '%').join(', ') : t('no tax')}${s.serviceCharge ? ' · ' + t('service') + ' ' + s.serviceCharge + '%' : ''}`)}
          ${row('payments', t('Payments'), payKind === 'upi' ? t('UPI QR to {id}', { id: Util.esc(s.upiId) }) : payKind === 'image' ? t('Your payment QR') : t('Not set: add a UPI ID or payment QR'), 'qr')}
          ${row('tables', t('Tables'), t('{n} tables', { n: s.tables.length }))}
          <a class="set-row" href="#menu"><span class="grow"><b>${t('Menu')}</b><small>${t('{n} dishes', { n: Store.items().length })}</small></span>${UI.icon('chevron')}</a>
          <a class="set-row" href="#reports"><span class="grow"><b>${t('Sales')}</b><small>${t('Daily sales, best sellers, voids')}</small></span>${UI.icon('chevron')}</a>
        </section>
        <section class="set-group"><h2>${t('Security')}</h2>
          ${row('pin', t('Admin PIN'), L.pin ? t('On · needed for admin, voids, discounts, price changes') : t('Off'), 'lock')}
          ${row('bio', Lock.bioName().replace(/^./, (c) => c.toUpperCase()), Lock.hasBio() ? t('On for this device') : L.pin ? t('Off · tap to turn on') : t('Set an admin PIN first'), 'lock')}
          <p class="hint pad">${t('This is a lock on the screen, not encryption. Each device has its own face or fingerprint setting; the PIN works everywhere.')}</p>
        </section>
        <section class="set-group"><h2>${t('Data')}</h2>
          ${row('backup', t('Back up now'), t('Last backup: {when}', { when: lastBk }), 'download')}
          ${row('restore', t('Restore from a backup'), t('Choose a backup file'), 'upload')}
          ${row('reset', t('Erase all data on this device'), '', 'trash')}
        </section>
      </div>`;
    const on = (a, fn) => { const b = el.querySelector(`[data-act=${a}]`); if (b) b.onclick = fn; };
    on('lock', () => { Lock.lock(); UI.toast(t('Admin locked')); UI.go('more'); });
    on('brand', brandSheet);
    on('money', moneySheet);
    on('payments', PayQR.settingsSheet);
    on('tables', tablesSheet);
    on('pin', pinSheet);
    on('bio', bioToggle);
    on('backup', Share.backupNow);
    on('restore', Share.importFile);
    on('reset', async () => {
      if (!(await UI.requirePin(t('Admin PIN to erase')))) return;
      if (!(await UI.confirm(t('Erase everything on this device?'), t('Menu, orders and sales on this device are deleted. Make a backup first if you need them.'), t('Erase'), true))) return;
      Link.disconnectAll(); Lock.lock(); await Store.resetAll(); Setup.restart(); App.applyLook(); UI.go('tour');
    });
  };

  UI.route('more', view); // not '#settings': claude.ai reserves that hash when mirrored as an artifact
  UI.route('admin', adminView);
  return { selfCheck };
})();
