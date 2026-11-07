// Admin lock: Face ID / Touch ID / fingerprint through a passkey on this device, with the
// admin PIN as the fallback that always works. Unlocking lasts 5 minutes.
//
// This is a lock on the screen, not encryption: the data itself is not encrypted (see ROADMAP.md).
// There is no server, so the passkey's signature is not checked against a stored key; we rely on
// the device confirming the user (the "user verified" flag). Someone with developer tools on an
// unlocked device could get round it.
const Lock = (() => {
  const WINDOW = 5 * 60 * 1000;
  let until = 0;

  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));

  // The admin PIN is shared by all linked devices (stored as a salted SHA-256 hash in settings),
  // so a waiter phone asks for the same PIN as the kitchen tablet. Face ID stays per device.
  const pinRec = () => Store.settings().adminPin;
  const hasPin = () => !!(pinRec() && pinRec().hash);
  const hashPin = async (salt, pin) => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)));
  const checkPin = async (pin) => { const r = pinRec(); return !!r && !!pin && (await hashPin(r.salt, pin)) === r.hash; };
  const setPin = async (pin) => {
    if (!pin) { Store.saveSettings({ adminPin: '' }); return; }
    const salt = b64u(random(16));
    Store.saveSettings({ adminPin: { salt, hash: await hashPin(salt, pin) } });
  };
  // 0.1.5 and older kept the PIN on each device; move it into the shared settings once.
  const migrateLocalPin = async () => {
    const old = Store.local.pin;
    if (!old) return;
    if (!hasPin()) await setPin(old);
    Store.setLocal({ pin: '' });
  };
  const hasBio = () => !!Store.local.passkeyId;
  const isSet = () => hasPin() || hasBio();
  const isOpen = () => !isSet() || Util.now() < until;
  const changed = () => { if (typeof App !== 'undefined' && App.tabsChanged) App.tabsChanged(); };
  const unlock = () => { until = Util.now() + WINDOW; changed(); };
  const lock = () => { until = 0; changed(); };
  const minutesLeft = () => Math.max(0, Math.ceil((until - Util.now()) / 60000));

  const apple = () => /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  const bioName = () => (apple() ? t('Face ID or Touch ID') : t('fingerprint or face unlock'));

  const bioAvailable = async () => {
    try {
      if (window.RESTROBAR_PREVIEW || !window.PublicKeyCredential || !window.isSecureContext) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
  };

  // Create a passkey on this device. Needs the PIN first, so there is always a way back in.
  const enrollBio = async () => {
    if (!hasPin()) { UI.toast(t('Set an admin PIN first. It is the backup if face or fingerprint fails.'), 'bad'); return false; }
    if (!(await bioAvailable())) { UI.toast(t('This device or browser cannot use {name} here.', { name: bioName() }), 'bad'); return false; }
    try {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: random(32),
        rp: { name: 'RestroBar' },
        user: { id: random(16), name: 'restrobar-admin-' + Store.local.deviceCode, displayName: 'RestroBar admin' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        attestation: 'none', timeout: 60000
      } });
      if (!cred) return false;
      Store.setLocal({ passkeyId: b64u(cred.rawId) });
      unlock();
      UI.toast(t('{name} is on for the admin screen', { name: bioName() }), 'good');
      return true;
    } catch (e) {
      UI.toast(e && e.name === 'NotAllowedError' ? t('Cancelled') : t('Could not turn on {name}.', { name: bioName() }), 'bad');
      return false;
    }
  };

  const disableBio = () => { Store.setLocal({ passkeyId: '' }); };

  // Ask the device to confirm the owner. True only when the device says the user was verified.
  const bioCheck = async () => {
    try {
      const res = await navigator.credentials.get({ publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: unb64u(Store.local.passkeyId), transports: ['internal'] }],
        userVerification: 'required', timeout: 60000
      } });
      if (!res || b64u(res.rawId) !== Store.local.passkeyId) return false;
      const flags = new Uint8Array(res.response.authenticatorData)[32];
      return (flags & 0x04) !== 0; // UV: the person was verified (face, fingerprint or device code)
    } catch { return false; }
  };

  const askPin = async (why) => {
    const v = await UI.ask(why || t('Admin PIN'), { type: 'password', inputmode: 'numeric', okLabel: t('Unlock') });
    if (v === null) return false;
    if (await checkPin(v)) return true;
    UI.toast(t('Wrong PIN'), 'bad');
    return false;
  };

  // Staff restrictions (Admin → Security). Only bite when a PIN exists and Admin is locked.
  const restricted = (what) => {
    if (!hasPin() || isOpen()) return false;
    const s = Store.settings();
    return what === 'sales' ? !!s.staffHideSales : what === 'menu' ? !!s.staffLockMenu : true;
  };

  // A full-screen "locked" page with Face ID / PIN buttons; calls after() once unlocked.
  const lockedView = (el, title, back, after) => {
    el.innerHTML = `
      ${UI.header(title, { back })}
      <div class="page">
        <section class="card locked center">
          <div class="lock-mark">${UI.icon('lock')}</div>
          <h2>${t('{title} is locked', { title })}</h2>
          <p class="muted">${hasBio() ? t('Use {name}, or the admin PIN.', { name: bioName() }) : t('Enter the admin PIN.')}</p>
          <button class="btn primary block" data-act="unlock">${hasBio() ? t('Unlock with {name}', { name: bioName() }) : t('Unlock')}</button>
          ${hasBio() ? `<button class="btn ghost block" data-act="unlock-pin">${t('Use PIN instead')}</button>` : ''}
        </section>
      </div>`;
    const go = (pinOnly) => verify(t('Admin PIN'), { pinOnly }).then((ok) => {
      if (ok) after(); else if (!pinOnly && hasBio()) UI.toast(t('Not recognised. Try again or use the PIN.'), 'bad');
    });
    el.querySelector('[data-act=unlock]').onclick = () => go(false);
    const p = el.querySelector('[data-act=unlock-pin]'); if (p) p.onclick = () => go(true);
  };

  /** Resolves true if the person may continue. No lock set → always true. */
  const verify = async (why, { pinOnly = false } = {}) => {
    if (isOpen()) return true;
    if (hasBio() && !pinOnly && (await bioCheck())) { unlock(); return true; }
    if (hasPin() && (await askPin(why))) { unlock(); return true; }
    return false;
  };

  return { restricted, lockedView, isSet, isOpen, hasPin, hasBio, setPin, checkPin, migrateLocalPin, verify, unlock, lock, minutesLeft, bioName, bioAvailable, enrollBio, disableBio };
})();
