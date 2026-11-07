# Changelog

Newest first. Every release also gets an entry in `RELEASES` in `js/core/version.js` (shown in the app under Settings → Version history).

## 0.1.6 (2026-11-07)

- End-of-day close in Sales: opening float (remembered), expected cash = float + cash sales, counted cash, over/short, note; saved as a synced `close` record per business day; "bills paid after the close" warning; Close again; share the day report as text.
- Business day: `settings.dayEndsAt` (default 4 am) used by Sales, voids and the close (`Util.bizDay`).
- Staff roles: `staffHideSales` (Sales tab hidden and `#reports` locked while Admin is locked) and `staffLockMenu` (adding/editing dishes needs the lock; sold-out switches stay open). Shared settings, so they apply on every linked device.
- Admin PIN moved into shared settings as a salted SHA-256 hash (`settings.adminPin`), so all linked devices use one PIN. Old per-device PINs migrate on first start.
- Notices move to the top while a sheet is open.
- Tests: `tests/e2e/dayclose.spec.js`, business-day unit test, PIN sync in the link test.

## 0.1.5 (2026-11-07)

- Refresh button (BasKar pattern) in the header of main screens and as Settings → Refresh app: saves, asks the service worker to update, fetches the page uncached, reloads; a "Refreshed" notice confirms after reload. If the host blocks reloading, a fallback notice after 7 s.
- Refresh asks for confirmation when a live link is open, since a reload ends it.
- Tests in `tests/e2e/refresh.spec.js`.

## 0.1.4 (2026-11-07)

- Notices follow the BasKar pattern: `UI.toast(title, { kind, body, undo | action, duration })` with title, body, one button, ✕, 4.5 s / 7 s with a button / 6 s for errors, pause on touch, slide animation, reduced-motion aware, `role="alert"` for errors.
- Undo on: send to kitchen, remove dish, void, move table, kitchen ready/cooking, served, sold-out switch, delete dish/category, remove payment.
- New notices: link lost (Relink), not linked when sending (Send by QR), storage save failure (Back up, via `Store.onSaveError`), updated version (What's new; replaces the What's new card).
- Fixed: removing a not-sent dish deleted the line locally only, so a linked device could bring it back. It is now a hidden void line (`removed: true`) that syncs.
- New skill `.claude/skills/toasts/SKILL.md`; AGENTS.md and the UI skill point to it. Tests in `tests/e2e/toast.spec.js`.

## 0.1.3 (2026-11-07)

- Payment QR (`js/features/payqr.js`): `upi://pay` link with payee, amount and note for INR (GPay, PhonePe, Paytm), or an uploaded payment QR image for any currency. Shown under the "UPI / GPay" (or "Online / QR") payment method, full screen for the customer, and optionally printed on unpaid bills. Staff confirm receipt manually.
- New setup step "Customer payments"; validation refuses a bare phone number as a UPI ID.
- Admin screen (`#admin`) with restaurant, prices, payments, tables, menu, sales, security and data. Settings keeps everyday items.
- Admin lock (`js/features/lock.js`): passkey with platform authenticator (Face ID / Touch ID / fingerprint) checked for user verification, admin PIN as mandatory fallback, 5-minute unlock. Voids, discounts and price changes use the same lock. Renamed "manager PIN" to "admin PIN".
- New settings fields with migrate() defaults: `upiId`, `upiName`, `payQr`, `payQrOnBill`; local `passkeyId`.
- Tests: UPI link format, UPI ID validation, admin lock with Chrome's virtual authenticator (Face ID pass and fail, PIN fallback).

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
