// Small helpers shared by every feature. No DOM rendering here except escaping.
const Util = (() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const uid = () => {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };

  const now = () => Date.now();

  // Minor-unit digits for a currency (QAR → 2, JPY → 0, KWD → 3).
  const minorDigits = (currency) => {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
    } catch { return 2; }
  };

  // Money is stored as integer minor units (fils, cents, paise) to avoid float drift.
  const toMinor = (amount, currency) => Math.round(Number(amount || 0) * 10 ** minorDigits(currency));
  const fromMinor = (minor, currency) => minor / 10 ** minorDigits(currency);

  const money = (minor, s) => {
    const cur = (s && s.currency) || 'QAR';
    const loc = (s && s.locale) || undefined;
    try {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(fromMinor(minor, cur));
    } catch {
      return fromMinor(minor, cur).toFixed(2) + ' ' + cur;
    }
  };

  // Plain number for inputs, e.g. 1250 minor QAR → "12.50"
  const amountStr = (minor, currency) => fromMinor(minor, currency).toFixed(minorDigits(currency));

  const time = (ts, loc) => new Date(ts).toLocaleTimeString(loc || undefined, { hour: '2-digit', minute: '2-digit' });
  const dateTime = (ts, loc) => new Date(ts).toLocaleString(loc || undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const dayKey = (ts) => {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const minutesSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / 60000));

  // Text colour that reads on a given hex background.
  const onColor = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.4 ? '#141814' : '#ffffff';
  };

  const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const debounce = (fn, ms) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  return { esc, uid, now, minorDigits, toMinor, fromMinor, money, amountStr, time, dateTime, dayKey, minutesSince, onColor, csvCell, debounce };
})();
