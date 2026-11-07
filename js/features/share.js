// Moving data between devices without a live link: the share sheet (Bluetooth, AirDrop,
// WhatsApp, Files), QR codes, and file import. Everything merges through Store.merge.
const Share = (() => {
  const canShareFiles = (files) => { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch { return false; } };

  const copyBox = (title, text) => UI.open(`
    <h2 class="sheet-title">${Util.esc(title)}</h2>
    <p class="muted small">${t('Sharing is not available here. Copy the text instead.')}</p>
    <textarea class="input mono copybox" id="copy-text" readonly>${Util.esc(text)}</textarea>
    <div class="row end gap"><button class="btn ghost" data-close>${t('Close')}</button><button class="btn primary" data-act="copy">${t('Copy')}</button></div>`, {
    noFocus: true,
    onMount: (el) => {
      el.querySelector('[data-act=copy]').onclick = async () => {
        const ta = el.querySelector('#copy-text');
        try { await navigator.clipboard.writeText(ta.value); UI.toast(t('Copied')); } catch { ta.select(); UI.toast(t('Text selected. Use your device\'s Copy.')); }
      };
    }
  });

  // Share a file; fall back to a download, then to a copy box.
  const file = async (name, content, mime, title) => {
    const f = new File([content], name, { type: mime });
    if (canShareFiles([f])) {
      try { await navigator.share({ files: [f], title }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    try {
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      UI.toast(t('Saved {name}', { name }));
      return true;
    } catch { /* blocked */ }
    if (content.length < 200000) copyBox(title, content);
    return false;
  };

  const text = async (title, body) => {
    if (navigator.share) {
      try { await navigator.share({ title, text: body }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copyBox(title, body);
  };

  const payloadFor = (changes) => ({ app: 'restrobar', type: 'changes', version: APP_VERSION, from: Store.local.deviceName, at: Util.now(), changes });

  const qrSheet = async (title, payload, hint) => {
    const code = await QR.pack(payload);
    if (code.length > 2200) { UI.toast(t('Too much for one QR code. Use the share sheet instead.'), 'bad'); return; }
    UI.open(`
      <h2 class="sheet-title">${Util.esc(title)}</h2>
      <div class="qr-box">${QR.svg(code)}</div>
      <p class="muted small center">${Util.esc(hint)}</p>
      <button class="btn ghost block" data-close>${t('Done')}</button>`, { noFocus: true });
  };

  const sendOrder = (orderId) => {
    const o = Store.order(orderId); if (!o) return;
    const tb = Store.table(o.tableId);
    const payload = payloadFor([{ kind: 'order', rec: o }]);
    UI.open(`
      <h2 class="sheet-title">${t('Send this order')}</h2>
      <p class="muted small">${t('The other device adds it to the same table. Use this when devices are not linked.')}</p>
      <div class="stack tight">
        <button class="btn primary block" data-act="qr">${UI.icon('qr')} ${t('Show QR code to scan')}</button>
        <button class="btn ghost block" data-act="sheet">${UI.icon('share')} ${t('Share file (Bluetooth, AirDrop…)')}</button>
        <button class="btn ghost block" data-close>${t('Cancel')}</button>
      </div>`, {
      noFocus: true,
      onMount: (el, close) => {
        el.querySelector('[data-act=qr]').onclick = () => { close(); qrSheet(t('Order for {table}', { table: tb ? tb.name : '' }), payload, t('On the other device: Settings → Receive by QR code.')); };
        el.querySelector('[data-act=sheet]').onclick = () => { close(); file(`order-${(tb ? tb.name : 'table').replace(/\W+/g, '')}.restrobar.json`, JSON.stringify(payload), 'application/json', t('RestroBar order')); };
      }
    });
  };

  const sendBill = (orderId) => {
    const o = Store.order(orderId); if (!o) return;
    const s = Store.settings();
    UI.open(`
      <h2 class="sheet-title">${t('Share bill')}</h2>
      <div class="stack tight">
        <button class="btn primary block" data-act="text">${UI.icon('share')} ${t('Send receipt as text')}</button>
        <button class="btn ghost block" data-act="file">${t('Send bill to another RestroBar device')}</button>
        <button class="btn ghost block" data-close>${t('Cancel')}</button>
      </div>`, {
      noFocus: true,
      onMount: (el, close) => {
        el.querySelector('[data-act=text]').onclick = () => { close(); text(s.brandName, Bill.receiptText(o, s)); };
        el.querySelector('[data-act=file]').onclick = () => { close(); file(`bill-${o.billNo || 'open'}.restrobar.json`, JSON.stringify(payloadFor([{ kind: 'order', rec: o }])), 'application/json', t('RestroBar bill')); };
      }
    });
  };

  const backupNow = async () => {
    const day = Util.dayKey(Util.now());
    const ok = await file(`restrobar-backup-${day}.json`, JSON.stringify(Store.backup()), 'application/json', t('RestroBar backup'));
    if (ok) Store.setLocal({ lastBackupAt: Util.now() });
  };

  // Accept anything we produce: a backup, or a set of changes (orders, menu).
  const receive = async (data) => {
    if (!data || data.app !== 'restrobar') { UI.toast(t('This file is not from RestroBar.'), 'bad'); return false; }
    if (data.type === 'backup') {
      const choice = await new Promise((resolve) => {
        let done = false;
        UI.open(`
          <h2 class="sheet-title">${t('Restore backup?')}</h2>
          <p class="muted">${t('Backup from {date}.', { date: Util.dateTime(data.exportedAt) })}</p>
          <div class="stack tight">
            <button class="btn primary block" data-c="merge">${t('Merge with what is here')}</button>
            <button class="btn danger ghost block" data-c="replace">${t('Replace everything here')}</button>
            <button class="btn ghost block" data-c="">${t('Cancel')}</button>
          </div>`, {
          noFocus: true,
          onClose: () => { if (!done) resolve(''); },
          onMount: (el, close) => el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { done = true; resolve(b.dataset.c); close(); }; })
        });
      });
      if (!choice) return false;
      if (choice === 'replace') {
        if (!(await UI.requirePin(t('Manager PIN to restore')))) return false;
        await Store.restore(data); UI.toast(t('Backup restored'), 'good'); App.applyLook(); return true;
      }
      const sh = data.shared;
      const changes = [{ kind: 'settings', rec: sh.settings },
        ...Object.values(sh.categories || {}).map((rec) => ({ kind: 'category', rec })),
        ...Object.values(sh.items || {}).map((rec) => ({ kind: 'item', rec })),
        ...Object.values(sh.orders || {}).map((rec) => ({ kind: 'order', rec }))];
      const n = Store.merge(changes, { source: 'file' }).length;
      UI.toast(t('Merged {n} records', { n }), 'good');
      return true;
    }
    if (data.type === 'changes') {
      const n = Store.merge(data.changes, { source: 'file' }).length;
      UI.toast(n ? t('Received from {name}', { name: data.from || t('another device') }) : t('Already up to date'), 'good');
      return true;
    }
    UI.toast(t('Unknown file type.'), 'bad');
    return false;
  };

  const importFile = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { await receive(JSON.parse(await f.text())); } catch { UI.toast(t('Could not read that file.'), 'bad'); }
    };
    inp.click();
  };

  const scanImport = () => QR.scanSheet(t('Scan a RestroBar code'), async (txt) => {
    try {
      const data = await QR.unpack(txt);
      if (data.type === 'offer' || data.type === 'answer') { UI.toast(t('That is a device-link code. Use Settings → Linked devices.'), 'bad'); return false; }
      await receive(data); return true;
    } catch (e) { UI.toast(e.message || t('Could not read that code.'), 'bad'); return false; }
  });

  return { file, text, sendOrder, sendBill, backupNow, receive, importFile, scanImport, copyBox };
})();
