// Shared UI pieces: router, toast, dialogs, icons. Features render into #view.
// Never use alert/confirm/prompt: they are blocked in some hosts. Use UI.confirm / UI.ask.
const UI = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- icons (inline SVG, stroke = currentColor) ----------
  const P = {
    tables: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    kitchen: '<path d="M6 13.9V20h12v-6.1"/><path d="M6 14a4 4 0 1 1 1.4-7.8A5 5 0 0 1 16.6 6.2 4 4 0 1 1 18 14Z"/><path d="M6 17h12"/>',
    receipt: '<path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3Z"/><path d="M9 9h6M9 13h6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4z"/>',
    wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevron: '<path d="M9 18l6-6-6-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  // ---------- toast ----------
  let toastTimer;
  const toast = (msg, kind = '') => {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
  };

  // ---------- modal sheet ----------
  // open(html, {onMount}) → returns {close, el}. Resolves via your own buttons.
  const open = (html, opts = {}) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop" data-close></div>
      <div class="sheet ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); opts.onClose && opts.onClose(); };
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    requestAnimationFrame(() => wrap.classList.add('in'));
    opts.onMount && opts.onMount(wrap, close);
    const first = wrap.querySelector('input,select,textarea');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 60);
    return { close, el: wrap };
  };

  const confirm = (title, body = '', okLabel = t('Confirm'), danger = false) => new Promise((resolve) => {
    let done = false;
    const m = open(`
      <h2 class="sheet-title">${Util.esc(title)}</h2>
      ${body ? `<p class="muted">${Util.esc(body)}</p>` : ''}
      <div class="row end gap">
        <button class="btn ghost" data-act="no">${t('Cancel')}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${Util.esc(okLabel)}</button>
      </div>`, {
      noFocus: true,
      onClose: () => { if (!done) resolve(false); },
      onMount: (el, close) => {
        el.querySelector('[data-act=yes]').onclick = () => { done = true; resolve(true); close(); };
        el.querySelector('[data-act=no]').onclick = () => { done = true; resolve(false); close(); };
      }
    });
    return m;
  });

  // Ask for one text value. type: text | number | password
  const ask = (title, { value = '', type = 'text', placeholder = '', okLabel = t('Save'), inputmode = '' } = {}) => new Promise((resolve) => {
    let done = false;
    open(`
      <form class="stack" data-form>
        <h2 class="sheet-title">${Util.esc(title)}</h2>
        <input id="ask-input" class="input" type="${type}" ${inputmode ? `inputmode="${inputmode}"` : ''} value="${Util.esc(value)}" placeholder="${Util.esc(placeholder)}" autocomplete="off">
        <div class="row end gap">
          <button type="button" class="btn ghost" data-close>${t('Cancel')}</button>
          <button class="btn primary">${Util.esc(okLabel)}</button>
        </div>
      </form>`, {
      onClose: () => { if (!done) resolve(null); },
      onMount: (el, close) => {
        el.querySelector('[data-form]').onsubmit = (e) => {
          e.preventDefault(); done = true; resolve(el.querySelector('#ask-input').value); close();
        };
      }
    });
  });

  // Manager PIN gate. Resolves true when no PIN is set.
  const requirePin = async (why) => {
    const pin = Store.local.pin;
    if (!pin) return true;
    const v = await ask(why || t('Manager PIN'), { type: 'password', inputmode: 'numeric', okLabel: t('Unlock') });
    if (v === null) return false;
    if (v === pin) return true;
    toast(t('Wrong PIN'), 'bad');
    return false;
  };

  // ---------- router (hash) ----------
  const routes = {};
  const route = (name, fn) => { routes[name] = fn; };
  const go = (hash) => { if (location.hash === '#' + hash) render(); else location.hash = hash; };
  const current = () => {
    const h = (location.hash || '').replace(/^#/, '');
    const [name, ...rest] = h.split('-');
    return { name: name || '', arg: rest.join('-') };
  };
  let lastName = null;
  const render = () => {
    const { name, arg } = current();
    if (!Store.local.setupDone && !['tour', 'setup'].includes(name)) { go(App.homeRoute()); return; }
    const fn = routes[name] || routes[App.homeRoute()];
    const view = $('#view');
    const keepScroll = name === lastName;
    const y = view.scrollTop;
    fn(view, arg);
    if (keepScroll) view.scrollTop = y; else view.scrollTop = 0;
    lastName = name;
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.go === (routes[name] ? name : App.homeRoute()) || (b.dataset.alt || '').split(' ').includes(name)));
  };

  // Re-render only when not typing, so inputs keep focus.
  const softRender = () => {
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $('#view').contains(a)) return;
    if (document.querySelector('.sheet-wrap')) { pending = true; return; }
    render();
  };
  let pending = false;
  setInterval(() => { if (pending && !document.querySelector('.sheet-wrap')) { pending = false; softRender(); } }, 500);

  const header = (title, { back = '', actions = '' } = {}) => `
    <header class="top">
      ${back ? `<a class="icon-btn" href="#${back}" aria-label="${t('Back')}">${icon('back')}</a>` : ''}
      <h1>${Util.esc(title)}</h1>
      <div class="top-actions">${actions}</div>
    </header>`;

  return { $, $$, icon, toast, open, confirm, ask, requirePin, route, go, render, softRender, current, header };
})();
