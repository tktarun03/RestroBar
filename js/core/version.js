// Single source of truth for the release number.
// Must match ?v= on every CSS/JS link in index.html, VERSION in sw.js,
// and the top entry of CHANGELOG.md (tests/structure.test.mjs checks all four).
const APP_VERSION = '0.1.5';

// Newest first. Shown in Settings → Version history and the "What's new" notice.
const RELEASES = [
  {
    version: '0.1.5',
    date: '2026-11-07',
    notes: [
      'Refresh button at the top of every main screen and in Settings: loads the latest version, your data stays.',
      'On a linked phone or tablet, Refresh asks first, because it ends the live link.'
    ]
  },
  {
    version: '0.1.4',
    date: '2026-11-07',
    notes: [
      'New notices with Undo: sending to the kitchen, marking ready or served, removing or voiding a dish, moving a table, sold-out switches and payments.',
      'A notice tells you when a phone loses its link to the kitchen tablet, with a Relink button.',
      'If this device cannot save, a notice asks you to back up straight away.',
      'After an update, a notice shows what\'s new.',
      'Fixed: a dish removed before sending could come back after syncing with another device.'
    ]
  },
  {
    version: '0.1.3',
    date: '2026-11-07',
    notes: [
      'Customers can pay by scanning a QR on the bill: a UPI code for GPay, PhonePe and Paytm with the amount filled in (INR), or your own payment QR for any currency.',
      'Setup asks for your UPI ID or payment QR; change it later in Settings → Admin → Payments.',
      'New Admin screen for restaurant details, prices, payments, tables, menu, sales and data.',
      'Lock Admin with Face ID, Touch ID or fingerprint, with your admin PIN as the backup.'
    ]
  },
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
