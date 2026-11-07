# Changelog

Newest first. Every release also gets an entry in `RELEASES` in `js/core/version.js` (shown in the app under Settings → Version history).

## 0.1.2 (2026-11-07)

- Zoom disabled: viewport `user-scalable=no`, plus blocked iOS gesture events, two-finger touchmove, ctrl+wheel and ctrl +/-; `touch-action: manipulation` stops double-tap zoom. Text size setting is the replacement.
- Lighter type: Barlow 300 for text, 400 for small print, 500 for headings and buttons (was 400/600/700); IBM Plex Mono 400 for numbers.
- Sheets no longer auto-focus a text box on touch screens (keyboard covered the sheet; older iOS zoomed into it). PIN and short-answer prompts still focus.
- Sideways phones (landscape, height ≤ 500px): tab bar becomes a side rail, shorter header and action bar.
- Tablet layout (menu and order side by side, three kitchen columns, two-column bill) now starts at 700px instead of 820px.
- Toasts sit above the bottom bars; tab labels keep a fixed size at large text settings.
- New tests: zoom blocking, 320px with the largest text, sideways phone.

## 0.1.1 (2026-11-07)

- Fixed: a waiter phone could link to the kitchen tablet but miss the first snapshot (menu, restaurant name). Each side now repeats its hello until a snapshot arrives.
- Toasts moved to the top of the screen so they never cover the Send or Pay buttons.
- The backup reminder waits until there is a day of sales.
- Settings route renamed to `#more` (claude.ai reserves `#settings` in artifact previews).
- Added `tools/artifact.mjs` to build a preview copy.

## 0.1.0 (2026-11-07)

- First release: tables, order taking with notes, kitchen display with timers, ready-to-serve alerts, billing with discount, service charge, taxes and split payments.
- Setup wizard for brand name, logo, colour, any currency, taxes and tables. Sample menu for trying it out.
- Live link between a kitchen tablet and waiter phones on the same Wi-Fi, paired by scanning QR codes (no server, no internet).
- Send orders, bills and backups through the share sheet (Bluetooth, AirDrop) or a QR code.
- Day sales report with best sellers, voids and CSV export. Menu editor with sold-out switches.
- Offline PWA, backup and restore, manager PIN for voids/discounts/price changes, self-check, light and dark themes, text size.
