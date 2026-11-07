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

  const hasPin = () => !!Store.local.pin;
  const hasBio = () => !!Store.local.passkeyId;
  const isSet = () => hasPin() || hasBio();
  const isOpen = () => !isSet() || Util.now() < until;
  const unlock = () => { until = Util.now() + WINDOW; };
  const lock = () => { until = 0; };
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
    if (v === Store.local.pin) return true;
    UI.toast(t('Wrong PIN'), 'bad');
    return false;
  };

  /** Resolves true if the person may continue. No lock set → always true. */
  const verify = async (why, { pinOnly = false } = {}) => {
    if (isOpen()) return true;
    if (hasBio() && !pinOnly && (await bioCheck())) { unlock(); return true; }
    if (hasPin() && (await askPin(why))) { unlock(); return true; }
    return false;
  };

  return { isSet, isOpen, hasPin, hasBio, verify, unlock, lock, minutesLeft, bioName, bioAvailable, enrollBio, disableBio };
})();
