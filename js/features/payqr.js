// Customer payment QR: a UPI code with the amount filled in (GPay, PhonePe, Paytm…; INR only),
// or the owner's own payment QR image for any other currency or wallet.
// The app cannot see whether money arrived: staff confirm it on their phone, then tap "Received".
const PayQR = (() => {
  const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;
  const validUpi = (id) => UPI_RE.test(String(id || '').trim());

  // upi://pay link. `pa` is left unencoded (UPI apps expect the plain @), the rest is encoded.
  const upiUrl = (s, amountMinor, note) => {
    if (s.currency !== 'INR' || !validUpi(s.upiId)) return '';
    const p = [
      'pa=' + s.upiId.trim(),
      'pn=' + encodeURIComponent((s.upiName || s.brandName || 'Restaurant').slice(0, 50)),
      amountMinor > 0 ? 'am=' + (amountMinor / 100).toFixed(2) : '',
      'cu=INR',
      note ? 'tn=' + encodeURIComponent(String(note).slice(0, 50)) : ''
    ].filter(Boolean);
    return 'upi://pay?' + p.join('&');
  };

  /** 'upi' (code with amount), 'image' (owner's own QR), or '' (nothing set up). */
  const kind = (s) => (upiUrl(s, 0) ? 'upi' : s.payQr ? 'image' : '');

  const box = (s, amountMinor, note, big = false) => {
    const k = kind(s);
    if (k === 'upi') {
      return `<div class="pay-qr ${big ? 'big' : ''}">
        <div class="qr-box">${QR.svg(upiUrl(s, amountMinor, note))}</div>
        <b class="mono">${Util.money(amountMinor, s)}</b>
        <small>${t('Scan with GPay, PhonePe, Paytm or any UPI app. The amount is filled in.')}</small>
        <small class="muted">${t('Pay to')} ${Util.esc(s.upiId)}</small>
      </div>`;
    }
    if (k === 'image') {
      return `<div class="pay-qr ${big ? 'big' : ''}">
        <div class="qr-box"><img src="${s.payQr}" alt="${t('Payment QR code')}"></div>
        <b class="mono">${Util.money(amountMinor, s)}</b>
        <small>${t('Scan to pay. Enter this amount in your payment app.')}</small>
      </div>`;
    }
    return '';
  };

  const showToCustomer = (amountMinor, note) => {
    const s = Store.settings();
    UI.open(`
      <h2 class="sheet-title center">${Util.esc(s.brandName)}</h2>
      ${box(s, amountMinor, note, true)}
      <button class="btn ghost block" data-close>${t('Done')}</button>`, { noFocus: true });
  };

  // Edit in Admin → Payments (and asked during setup).
  const settingsSheet = () => {
    const s = Store.settings();
    let img = s.payQr;
    UI.open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${t('Payments')}</h2>
        <label class="field"><span>${t('UPI ID for GPay, PhonePe, Paytm')}</span>
          <input id="p-upi" class="input" value="${Util.esc(s.upiId)}" placeholder="98xxxxxx@okaxis" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="email"></label>
        <p class="hint">${t('Find it in GPay → your profile → UPI ID. A phone number alone is not a UPI ID. UPI works only when your prices are in INR.')}${s.currency !== 'INR' ? ' <b>' + t('Your currency is {c}, so the UPI code will not be shown.', { c: Util.esc(s.currency) }) + '</b>' : ''}</p>
        <label class="field"><span>${t('Name shown in the payment app')}</span><input id="p-name" class="input" value="${Util.esc(s.upiName)}" placeholder="${Util.esc(s.brandName)}"></label>
        <div class="field"><span>${t('Or your own payment QR (any bank or wallet)')}</span>
          <div class="row gap center">
            <div class="logo-preview qr-thumb" id="p-img">${img ? `<img src="${img}" alt="">` : UI.icon('qr')}</div>
            <label class="btn ghost">${UI.icon('upload')} ${t('Upload image')}<input type="file" id="p-file" accept="image/*" hidden></label>
            <button type="button" class="btn link" data-act="noimg">${t('Remove')}</button>
          </div>
        </div>
        <label class="toggle"><input type="checkbox" id="p-onbill" ${s.payQrOnBill ? 'checked' : ''}><span>${t('Print the payment QR on unpaid bills')}</span></label>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save')}</button></div>
      </form>`, {
      onMount: (el, close) => {
        el.querySelector('#p-file').onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          img = await Setup.shrinkImage(f, 600); // keep enough detail for phones to scan
          el.querySelector('#p-img').innerHTML = img ? `<img src="${img}" alt="">` : UI.icon('qr');
        };
        el.querySelector('[data-act=noimg]').onclick = () => { img = ''; el.querySelector('#p-img').innerHTML = UI.icon('qr'); };
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault();
          const upi = el.querySelector('#p-upi').value.trim();
          if (upi && !validUpi(upi)) { UI.toast(t('That is not a UPI ID. It looks like name@bank.'), 'bad'); return; }
          Store.saveSettings({ upiId: upi, upiName: el.querySelector('#p-name').value.trim(), payQr: img, payQrOnBill: el.querySelector('#p-onbill').checked });
          close(); UI.toast(t('Saved'));
        };
      }
    });
  };

  return { validUpi, upiUrl, kind, box, showToCustomer, settingsSheet };
})();
