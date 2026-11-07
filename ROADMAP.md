# Roadmap

## Before real service (must do)

- [ ] **Test on real devices**: one Android tablet + one iPhone + one Android phone on the restaurant Wi-Fi. Check pairing, the link surviving 30+ minutes of normal use, what happens when a phone locks, and reconnect.
- [ ] Check the restaurant Wi-Fi does not isolate clients (guest networks often do).
- [ ] Run one real lunch service with 3–5 staff and collect feedback.
- [ ] Print a receipt from the tablet to the restaurant's printer.

## Next

- [ ] Cloud sync option (Supabase) using the same records and merge, for links that survive phones sleeping.
- [ ] Takeaway and delivery orders (no table), with token numbers.
- [ ] Split a bill by seat or by item.
- [ ] Kitchen stations (grill, bar) with separate screens; `station` field already exists on items and lines.
- [ ] Bluetooth / network thermal printer support (ESC/POS) for KOT and receipts.
- [ ] Arabic translation with right-to-left layout (CSS already uses logical properties). Mark machine translation as needing native review.
- [ ] Archive paid orders older than N months to keep storage small.
- [ ] Staff accounts with roles instead of one admin PIN.
- [ ] Modifiers and add-ons with prices (extra cheese +3).

## Decisions log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-07 | Static PWA on GitHub Pages, no framework, no build | Easy to maintain by a person or an AI; matches the owner's other apps. |
| 2026-11-07 | Start offline, design for sync later | Owner chose this over cloud sync for v0.1. Every record carries `updatedAt/updatedBy` so a cloud adapter can reuse the merge. |
| 2026-11-07 | Live link = WebRTC paired by QR codes, same Wi-Fi only | Owner asked for Bluetooth/AirDrop/Wi-Fi. Browsers cannot do phone-to-phone Bluetooth, and cannot discover devices on a network. WebRTC with QR signalling needs no server or internet. Accepted trade-off: re-scan after a phone sleeps. |
| 2026-11-07 | Share sheet + QR as the fallback transport | Covers Bluetooth (Android), AirDrop (iPhone) and no-Wi-Fi cases with the same merge. |
| 2026-11-07 | No STUN/TURN servers | Nothing should leave the restaurant network. |
| 2026-11-07 | Money in integer minor units, currency from `Intl` | Supports every currency the browser knows (QAR 2 decimals, KWD 3, JPY 0) without float errors. |
| 2026-11-07 | Bill numbers per device with a prefix | Devices may be offline from each other when billing; a shared counter could collide. |
| 2026-11-07 | Not encrypting local data (deviates from the house template) | Shared tablet must open instantly; a lost password would lose the sales history; cloud auth is the long-term answer. PIN is labelled as an action lock only. |
| 2026-11-07 | Vendor QR libraries and fonts instead of CDN | Must work offline and send nothing to third parties. Versions pinned in file names. |
| 2026-11-07 | English only in v0.1 | Owner did not choose languages; translation table and logical CSS are in place. |
| 2026-11-07 | Pinch and double-tap zoom disabled | Owner's request for shared work devices. Trade-off: worse for low vision; mitigated by the in-app Text size setting, tested at 320px. |
| 2026-11-07 | Payment QR: UPI link for INR, uploaded image otherwise | Owner asked for GPay. UPI only works in INR; restaurant may bill in QAR. No payment gateway, so payment is confirmed by staff. |
| 2026-11-07 | Admin lock = device passkey (Face ID / fingerprint) + PIN fallback | Owner asked for face lock. No server to verify signatures, so it is a screen lock; the PIN must always work. |
