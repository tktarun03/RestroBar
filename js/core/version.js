// Single source of truth for the release number.
// Must match ?v= on every CSS/JS link in index.html, VERSION in sw.js,
// and the top entry of CHANGELOG.md (tests/structure.test.mjs checks all four).
const APP_VERSION = '0.1.0';

// Newest first. Shown in Settings → Version history and the "What's new" notice.
const RELEASES = [
  {
    version: '0.1.0',
    date: '2026-11-07',
    notes: [
      'First release: tables, order taking, kitchen display, ready-to-serve alerts and billing.',
      'Setup wizard for your brand name, logo, colour, currency, taxes and tables.',
      'Link phones to the kitchen tablet over the same Wi-Fi by scanning QR codes.',
      'Send orders, bills and backups through the share sheet (Bluetooth, AirDrop).',
      'Daily sales report with CSV export, menu editor, backup and restore.'
    ]
  }
];
