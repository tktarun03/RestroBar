// Single source of truth for the release number.
// Must match ?v= on every CSS/JS link in index.html, VERSION in sw.js,
// and the top entry of CHANGELOG.md (tests/structure.test.mjs checks all four).
const APP_VERSION = '0.1.2';

// Newest first. Shown in Settings → Version history and the "What's new" notice.
const RELEASES = [
  {
    version: '0.1.2',
    date: '2026-11-07',
    notes: [
      'Pinch and double-tap zoom are off. Use Settings → Text size to make text bigger.',
      'Lighter text throughout the app.',
      'Tapping a dish no longer jumps into the note box, so the keyboard and iPhone zoom stay away.',
      'Phones held sideways show the tabs as a side rail, with the menu and order side by side.',
      'iPads in portrait show the menu and order side by side, and the kitchen in three columns.',
      'Messages appear just above the bottom buttons instead of over the search box.'
    ]
  },
  {
    version: '0.1.1',
    date: '2026-11-07',
    notes: [
      'Fixed: a waiter phone could link to the kitchen tablet but not receive the menu and restaurant name.',
      'Messages now appear at the top of the screen so they never cover the Send or Pay buttons.',
      'The backup reminder waits until you have a day of sales.'
    ]
  },
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
