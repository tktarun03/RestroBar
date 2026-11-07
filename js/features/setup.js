// First run: a short skippable tour, then setup in small steps with a progress bar.
// Values live in `draft` so going back keeps them. Nothing is saved until "Start".
const Setup = (() => {
  const REGION_CURRENCY = { QA: 'QAR', AE: 'AED', SA: 'SAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', IN: 'INR', PK: 'PKR', LK: 'LKR', BD: 'BDT', NP: 'NPR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', MY: 'MYR', PH: 'PHP', ID: 'IDR', TH: 'THB', JP: 'JPY', KR: 'KRW', CN: 'CNY', EG: 'EGP', JO: 'JOD', NG: 'NGN', KE: 'KES', ZA: 'ZAR', TR: 'TRY', BR: 'BRL', MX: 'MXN', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', IE: 'EUR' };
  const guessCurrency = () => {
    try {
      const loc = new Intl.Locale(navigator.language || 'en');
      const region = loc.maximize().region;
      return REGION_CURRENCY[region] || 'USD';
    } catch { return 'USD'; }
  };
  const ACCENTS = ['#1F7A5A', '#B5381F', '#2747D6', '#8A3FB8', '#C77D0A', '#0F7C8C', '#1D1D1F'];

  let draft = null;
  let step = 0;
  let slide = 0;

  const freshDraft = () => {
    const s = Store.settings();
    const L = Store.local;
    return {
      role: L.role || 'solo',
      deviceName: L.deviceName === 'This device' ? '' : L.deviceName,
      brandName: s.brandName === 'My Restaurant' ? '' : s.brandName,
      logo: s.logo, accent: s.accent,
      currency: s.updatedAt ? s.currency : guessCurrency(),
      taxes: s.taxes.length ? JSON.parse(JSON.stringify(s.taxes)) : [],
      taxInclusive: s.taxInclusive, serviceCharge: s.serviceCharge,
      tableCount: s.tables.length || 8, tablePrefix: 'Table ',
      upiId: s.upiId, payQr: s.payQr
    };
  };

  const stepsFor = (role) => role === 'waiter' ? ['role', 'device', 'join'] : ['role', 'brand', 'money', 'payments', 'tables', 'review'];

  // ---------- tour ----------
  const SLIDES = [
    { title: 'Take orders at the table', body: 'Tap a table, add dishes with notes, and send them to the kitchen in one tap.', art: 'tables' },
    { title: 'The kitchen sees every ticket', body: 'Tickets show up on the kitchen screen with a timer. The cook marks each dish ready.', art: 'kitchen' },
    { title: 'Serve, bill and close', body: 'Waiters get a "ready" alert, serve, then print or share the bill and take payment.', art: 'receipt' }
  ];

  const tour = (view) => {
    document.body.classList.add('no-tabs');
    view.innerHTML = `
      <div class="tour">
        <div class="tour-top"><button class="btn link" data-act="skip">${t('Skip')}</button></div>
        <div class="tour-track" id="tour-track">
          ${SLIDES.map((s) => `
            <section class="tour-slide">
              <div class="tour-art">${UI.icon(s.art, 'big')}</div>
              <h1>${t(s.title)}</h1>
              <p>${t(s.body)}</p>
            </section>`).join('')}
        </div>
        <div class="tour-foot">
          <div class="dots">${SLIDES.map((_, i) => `<span class="dot ${i === slide ? 'on' : ''}"></span>`).join('')}</div>
          <button class="btn primary block" data-act="next">${slide === SLIDES.length - 1 ? t('Set up my restaurant') : t('Next')}</button>
        </div>
      </div>`;
    const track = UI.$('#tour-track', view);
    track.scrollLeft = slide * track.clientWidth;
    const sync = () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== slide) {
        slide = i;
        UI.$$('.dot', view).forEach((d, k) => d.classList.toggle('on', k === i));
        UI.$('[data-act=next]', view).textContent = slide === SLIDES.length - 1 ? t('Set up my restaurant') : t('Next');
      }
    };
    track.addEventListener('scroll', Util.debounce(sync, 60));
    view.querySelector('[data-act=skip]').onclick = finishTour;
    view.querySelector('[data-act=next]').onclick = () => {
      if (slide >= SLIDES.length - 1) return finishTour();
      slide++; track.scrollTo({ left: slide * track.clientWidth, behavior: 'smooth' });
      setTimeout(sync, 400);
    };
  };
  const finishTour = () => { Store.setLocal({ tourDone: true }); UI.go('setup'); };

  // ---------- wizard ----------
  const progress = (steps) => `<div class="progress" aria-label="${t('Step {n} of {total}', { n: step + 1, total: steps.length })}"><span style="width:${((step + 1) / steps.length) * 100}%"></span></div>`;

  const currencyOptions = (sel) => {
    let list = [];
    try { list = Intl.supportedValuesOf('currency'); } catch { list = Object.values(REGION_CURRENCY); }
    let dn = null; try { dn = new Intl.DisplayNames([navigator.language || 'en'], { type: 'currency' }); } catch { /* old browser */ }
    return [...new Set(list)].map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}${dn ? ' — ' + Util.esc(dn.of(c)) : ''}</option>`).join('');
  };

  const sampleBill = (d) => {
    const cur = d.currency;
    const fake = { lines: [{ id: 'a', itemId: 'x', name: t('Sample dish'), price: Util.toMinor(50, cur), qty: 2, status: 'sent' }], discount: { type: 'amt', value: 0 }, payments: [] };
    const b = Billing.calc(fake, { taxes: d.taxes, taxInclusive: d.taxInclusive, serviceCharge: d.serviceCharge });
    const s = { currency: cur };
    return `
      <div class="receipt mini">
        <div class="r-row"><span>2 × ${t('Sample dish')} @ ${Util.money(fake.lines[0].price, s)}</span><span>${Util.money(b.subtotal, s)}</span></div>
        ${b.service ? `<div class="r-row"><span>${t('Service charge')} ${d.serviceCharge}%</span><span>${Util.money(b.service, s)}</span></div>` : ''}
        ${b.taxLines.map((x) => `<div class="r-row"><span>${Util.esc(x.name)} ${x.rate}%${d.taxInclusive ? ' (' + t('included') + ')' : ''}</span><span>${Util.money(x.amount, s)}</span></div>`).join('')}
        <div class="r-row total"><span>${t('Total')}</span><span>${Util.money(b.total, s)}</span></div>
      </div>
      <p class="hint">${d.taxInclusive ? t('Menu prices already include tax; tax is shown as part of the total.') : t('Service charge is added to the food total, then tax is added on top of both.')}</p>`;
  };

  const roleCard = (val, title, body, ic) => `
    <label class="choice">
      <input type="radio" name="role" value="${val}" ${draft.role === val ? 'checked' : ''}>
      <span class="choice-box">${UI.icon(ic)}<span><b>${t(title)}</b><small>${t(body)}</small></span></span>
    </label>`;

  const bodyFor = (name) => {
    const d = draft;
    switch (name) {
      case 'role': return `
        <h1>${t('How will this device be used?')}</h1>
        <div class="stack">
          ${roleCard('solo', 'One device does everything', 'Orders, kitchen and billing on this phone or tablet.', 'tables')}
          ${roleCard('hub', 'Main kitchen tablet', 'Holds the menu and settings. Waiter phones link to it over Wi-Fi.', 'kitchen')}
          ${roleCard('waiter', 'Waiter phone', 'Takes orders and gets "ready" alerts from the kitchen tablet.', 'bell')}
        </div>`;
      case 'device': return `
        <h1>${t('Name this phone')}</h1>
        <p class="muted">${t('The kitchen sees this name on each ticket.')}</p>
        <label class="field"><span>${t('Phone name')}</span><input id="f-device" class="input" value="${Util.esc(d.deviceName)}" placeholder="${t('e.g. Ravi')}" autocomplete="off"></label>`;
      case 'join': return `
        <h1>${t('Link to the kitchen tablet')}</h1>
        <p class="muted">${t('Menu, tables and prices come from the kitchen tablet. Both devices must be on the same Wi-Fi.')}</p>
        <ol class="steps">
          <li>${t('On the kitchen tablet, open Settings → Linked devices → Add a phone.')}</li>
          <li>${t('Tap "Scan" below and point this phone at the code on the tablet.')}</li>
          <li>${t('Show the code that appears here to the tablet\'s camera.')}</li>
        </ol>
        <button class="btn primary block" data-act="scan">${UI.icon('camera')} ${t('Scan the tablet\'s code')}</button>
        <p class="hint">${t('You can also do this later from Settings.')}</p>`;
      case 'brand': return `
        <h1>${t('Your restaurant')}</h1>
        <label class="field"><span>${t('Restaurant name')}</span><input id="f-brand" class="input" value="${Util.esc(d.brandName)}" placeholder="${t('e.g. Saffron House')}" autocomplete="organization"></label>
        <div class="field"><span>${t('Logo')}</span>
          <div class="row gap center">
            <div class="logo-preview">${d.logo ? `<img src="${d.logo}" alt="">` : `<span>${Util.esc((d.brandName || 'R').slice(0, 1).toUpperCase())}</span>`}</div>
            <label class="btn ghost">${UI.icon('upload')} ${t('Choose image')}<input type="file" id="f-logo" accept="image/*" hidden></label>
            ${d.logo ? `<button class="btn link" data-act="nologo">${t('Remove')}</button>` : ''}
          </div>
        </div>
        <div class="field"><span>${t('Brand colour')}</span>
          <div class="swatches">
            ${ACCENTS.map((c) => `<button class="swatch ${c.toLowerCase() === (d.accent || '').toLowerCase() ? 'on' : ''}" data-accent="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
            <label class="swatch custom" aria-label="${t('Custom colour')}"><input type="color" id="f-accent" value="${Util.esc(d.accent)}"></label>
          </div>
        </div>`;
      case 'money': return `
        <h1>${t('Prices and tax')}</h1>
        <label class="field"><span>${t('Currency')}</span><select id="f-currency" class="input">${currencyOptions(d.currency)}</select></label>
        <div class="field"><span>${t('Taxes')}</span>
          <div class="stack tight" id="tax-rows">
            ${d.taxes.map((x, i) => `
              <div class="row gap">
                <input class="input grow" data-tax-name="${i}" value="${Util.esc(x.name)}" placeholder="${t('Name, e.g. VAT')}">
                <input class="input w-rate" data-tax-rate="${i}" value="${Util.esc(x.rate)}" inputmode="decimal" placeholder="%">
                <button class="icon-btn" data-tax-del="${i}" aria-label="${t('Remove tax')}">${UI.icon('x')}</button>
              </div>`).join('')}
          </div>
          <button class="btn ghost" data-act="addtax">${UI.icon('plus')} ${t('Add a tax')}</button>
        </div>
        <label class="toggle"><input type="checkbox" id="f-incl" ${d.taxInclusive ? 'checked' : ''}><span>${t('Menu prices already include tax')}</span></label>
        <label class="field"><span>${t('Service charge %')}</span><input id="f-service" class="input" inputmode="decimal" value="${Util.esc(d.serviceCharge || '')}" placeholder="0"></label>`;
      case 'payments': return `
        <h1>${t('Customer payments')}</h1>
        <p class="muted">${t('Optional. Customers scan a QR code on the bill to pay. You can add or change this later in Settings → Admin.')}</p>
        ${d.currency === 'INR' ? `
          <label class="field"><span>${t('UPI ID for GPay, PhonePe, Paytm')}</span>
            <input id="f-upi" class="input" value="${Util.esc(d.upiId)}" placeholder="98xxxxxx@okaxis" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="email"></label>
          <p class="hint">${t('Find it in GPay → your profile → UPI ID. A phone number alone is not a UPI ID. The bill QR fills in the amount for the customer.')}</p>`
        : `<p class="hint">${t('UPI (GPay, PhonePe) works only with INR prices. You can upload your bank or wallet payment QR instead.')}</p>`}
        <div class="field"><span>${d.currency === 'INR' ? t('Or upload your own payment QR') : t('Upload your payment QR')}</span>
          <div class="row gap center">
            <div class="logo-preview qr-thumb">${d.payQr ? `<img src="${d.payQr}" alt="">` : UI.icon('qr')}</div>
            <label class="btn ghost">${UI.icon('upload')} ${t('Upload image')}<input type="file" id="f-payqr" accept="image/*" hidden></label>
            ${d.payQr ? `<button class="btn link" data-act="nopayqr">${t('Remove')}</button>` : ''}
          </div>
        </div>`;
      case 'tables': return `
        <h1>${t('Tables')}</h1>
        <p class="muted">${t('You can rename, add or remove tables later in Settings.')}</p>
        <div class="field"><span>${t('Number of tables')}</span>
          <div class="stepper">
            <button class="icon-btn" data-act="tminus" aria-label="${t('Fewer')}">${UI.icon('minus')}</button>
            <output id="f-tcount">${d.tableCount}</output>
            <button class="icon-btn" data-act="tplus" aria-label="${t('More')}">${UI.icon('plus')}</button>
          </div>
        </div>
        <label class="field"><span>${t('Name tables as')}</span><input id="f-tprefix" class="input" value="${Util.esc(d.tablePrefix)}"></label>
        <p class="hint">${t('Preview')}: ${Util.esc(d.tablePrefix)}1, ${Util.esc(d.tablePrefix)}2 … ${Util.esc(d.tablePrefix)}${d.tableCount}</p>`;
      case 'review': return `
        <h1>${t('Check and start')}</h1>
        <div class="review">
          <div class="review-brand">
            <div class="logo-preview sm" style="--a:${Util.esc(d.accent)}">${d.logo ? `<img src="${d.logo}" alt="">` : `<span>${Util.esc((d.brandName || 'R').slice(0, 1).toUpperCase())}</span>`}</div>
            <div><b>${Util.esc(d.brandName || t('My Restaurant'))}</b><small>${t({ solo: 'One device does everything', hub: 'Main kitchen tablet', waiter: 'Waiter phone' }[d.role])} · ${d.tableCount} ${t('tables')} · ${Util.esc(d.currency)}</small></div>
          </div>
          <h3>${t('How a bill is worked out')}</h3>
          ${sampleBill(d)}
        </div>
        <div class="stack tight">
          <button class="btn primary block" data-act="start-demo">${t('Start with a sample menu')}</button>
          <button class="btn ghost block" data-act="start-empty">${t('Start with an empty menu')}</button>
        </div>`;
    }
    return '';
  };

  const readStep = (view) => {
    const v = (id) => { const el = view.querySelector('#' + id); return el ? el.value : undefined; };
    const r = view.querySelector('input[name=role]:checked'); if (r) draft.role = r.value;
    if (v('f-device') !== undefined) draft.deviceName = v('f-device').trim();
    if (v('f-brand') !== undefined) draft.brandName = v('f-brand').trim();
    if (v('f-currency') !== undefined) draft.currency = v('f-currency');
    if (v('f-service') !== undefined) draft.serviceCharge = Math.max(0, parseFloat(v('f-service')) || 0);
    const incl = view.querySelector('#f-incl'); if (incl) draft.taxInclusive = incl.checked;
    view.querySelectorAll('[data-tax-name]').forEach((el) => { draft.taxes[+el.dataset.taxName].name = el.value.trim(); });
    view.querySelectorAll('[data-tax-rate]').forEach((el) => { draft.taxes[+el.dataset.taxRate].rate = Math.max(0, parseFloat(el.value) || 0); });
    if (v('f-tprefix') !== undefined) draft.tablePrefix = v('f-tprefix');
    if (v('f-upi') !== undefined) draft.upiId = v('f-upi').trim();
  };

  const wizard = (view) => {
    if (!draft) draft = freshDraft();
    document.body.classList.add('no-tabs');
    const steps = stepsFor(draft.role);
    step = Math.min(step, steps.length - 1);
    const name = steps[step];
    const last = step === steps.length - 1;
    view.innerHTML = `
      <div class="wizard">
        <div class="wizard-top">
          ${step > 0 ? `<button class="icon-btn" data-act="back" aria-label="${t('Back')}">${UI.icon('back')}</button>` : '<span></span>'}
          ${progress(steps)}
          <span class="muted small">${step + 1}/${steps.length}</span>
        </div>
        <div class="wizard-body">${bodyFor(name)}</div>
        ${last ? '' : `<div class="wizard-foot"><button class="btn primary block" data-act="next">${t('Continue')}</button></div>`}
      </div>`;
    wire(view, name);
  };

  const wire = (view, name) => {
    const on = (act, fn) => { const el = view.querySelector(`[data-act=${act}]`); if (el) el.onclick = fn; };
    on('back', () => { readStep(view); step--; wizard(view); });
    on('next', () => {
      readStep(view);
      if (name === 'brand' && !draft.brandName) { UI.toast(t('Enter your restaurant name'), 'bad'); return; }
      if (name === 'money' && draft.taxes.some((x) => !x.name && x.rate)) { UI.toast(t('Give each tax a name'), 'bad'); return; }
      if (name === 'payments' && draft.upiId && !PayQR.validUpi(draft.upiId)) { UI.toast(t('That is not a UPI ID. It looks like name@bank.'), 'bad'); return; }
      if (name === 'device' && !draft.deviceName) { UI.toast(t('Enter a name for this phone'), 'bad'); return; }
      step++; wizard(view);
    });
    view.querySelectorAll('input[name=role]').forEach((r) => { r.onchange = () => { draft.role = r.value; }; });
    view.querySelectorAll('[data-accent]').forEach((b) => { b.onclick = () => { readStep(view); draft.accent = b.dataset.accent; wizard(view); }; });
    const ac = view.querySelector('#f-accent'); if (ac) ac.onchange = () => { readStep(view); draft.accent = ac.value; wizard(view); };
    const logo = view.querySelector('#f-logo');
    if (logo) logo.onchange = async () => { readStep(view); const f = logo.files[0]; if (f) { draft.logo = await shrinkImage(f, 256); wizard(view); } };
    on('nologo', () => { readStep(view); draft.logo = ''; wizard(view); });
    const pq = view.querySelector('#f-payqr');
    if (pq) pq.onchange = async () => { readStep(view); const f = pq.files[0]; if (f) { draft.payQr = await shrinkImage(f, 600); wizard(view); } };
    on('nopayqr', () => { readStep(view); draft.payQr = ''; wizard(view); });
    on('addtax', () => { readStep(view); draft.taxes.push({ name: '', rate: 0 }); wizard(view); });
    view.querySelectorAll('[data-tax-del]').forEach((b) => { b.onclick = () => { readStep(view); draft.taxes.splice(+b.dataset.taxDel, 1); wizard(view); }; });
    on('tminus', () => { readStep(view); draft.tableCount = Math.max(1, draft.tableCount - 1); wizard(view); });
    on('tplus', () => { readStep(view); draft.tableCount = Math.min(200, draft.tableCount + 1); wizard(view); });
    view.querySelectorAll('#f-tprefix').forEach((el) => { el.oninput = Util.debounce(() => { readStep(view); const h = view.querySelector('.hint'); if (h) h.textContent = `${t('Preview')}: ${draft.tablePrefix}1, ${draft.tablePrefix}2 … ${draft.tablePrefix}${draft.tableCount}`; }, 150); });
    on('start-demo', () => finish(true));
    on('start-empty', () => finish(false));
    on('scan', () => {
      readStep(view);
      Store.setLocal({ role: 'waiter', deviceName: draft.deviceName || 'Waiter' });
      Link.joinFlow(() => { Store.setLocal({ setupDone: true, tourDone: true }); draft = null; step = 0; UI.go('tables'); });
    });
  };

  const finish = (withDemo) => {
    const d = draft;
    const tables = Array.from({ length: d.tableCount }, (_, i) => ({ id: 't' + (i + 1), name: (d.tablePrefix || '') + (i + 1) }));
    Store.saveSettings({
      brandName: d.brandName || 'My Restaurant', logo: d.logo, accent: d.accent,
      currency: d.currency, taxes: d.taxes.filter((x) => x.name || x.rate), taxInclusive: d.taxInclusive,
      serviceCharge: d.serviceCharge, tables,
      upiId: d.currency === 'INR' ? d.upiId : '', payQr: d.payQr
    });
    Store.setLocal({ role: d.role, deviceName: d.deviceName || ({ hub: 'Kitchen tablet', solo: 'Main device' }[d.role] || 'Device'), setupDone: true, tourDone: true, seenVersion: APP_VERSION, demo: withDemo });
    if (withDemo) Demo.loadMenu();
    draft = null; step = 0;
    App.applyLook();
    UI.toast(t('All set'), { kind: 'good', body: d.role === 'hub' ? t('New orders will appear here as tickets.') : t('Tap a table to take an order.') });
    UI.go(App.homeRoute());
  };

  // Resize an uploaded image to a small square-ish PNG data URL.
  const shrinkImage = (file, max) => new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => res('');
      img.src = fr.result;
    };
    fr.onerror = () => res('');
    fr.readAsDataURL(file);
  });

  UI.route('tour', tour);
  UI.route('setup', wizard);
  return { shrinkImage, restart: () => { draft = null; step = 0; } };
})();

// Sample menu for demo mode and trying the app.
const Demo = (() => {
  const SCALE = { INR: 20, PKR: 60, LKR: 80, BDT: 25, NPR: 30, JPY: 40, KRW: 300, IDR: 3000, VND: 6000, KWD: 0.1, BHD: 0.1, OMR: 0.1, JOD: 0.2, EGP: 10, NGN: 400, KES: 30, PHP: 12, THB: 8, TRY: 7, ZAR: 4, MXN: 4, BRL: 1.2, CNY: 1.6 };
  const MENU = [
    ['Starters', [['Hummus & warm bread', 18], ['Lentil soup', 15], ['Chicken samosa (3)', 16], ['Fattoush salad', 22]]],
    ['Mains', [['Chicken biryani', 38], ['Mixed grill platter', 65], ['Paneer butter masala', 34], ['Grilled hammour', 58], ['Lamb mandi', 55]]],
    ['Breads & sides', [['Butter naan', 6], ['Garlic naan', 8], ['Saffron rice', 12], ['French fries', 10]]],
    ['Drinks', [['Karak chai', 5], ['Fresh lime mint', 14], ['Mango lassi', 16], ['Water', 3], ['Turkish coffee', 12]]],
    ['Desserts', [['Kunafa', 24], ['Gulab jamun', 14], ['Umm Ali', 20]]]
  ];
  const loadMenu = () => {
    const cur = Store.settings().currency;
    const k = SCALE[cur] || 1;
    MENU.forEach(([cat, items], ci) => {
      const c = Store.putCategory({ id: Util.uid(), name: cat, sort: ci });
      items.forEach(([name, price], ii) => {
        const p = k >= 1 ? Math.round(price * k) : Math.round(price * k * 100) / 100;
        Store.putItem({ id: Util.uid(), catId: c.id, name, price: Util.toMinor(p, cur), available: true, station: '', sort: ii });
      });
    });
  };
  return { loadMenu };
})();
