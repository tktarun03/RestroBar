# Architecture

## Shape

Static files, no build. `index.html` loads scripts in order; each declares one global module object. `App.boot()` loads data, applies the look, registers routes' renderers via `UI.render`, and registers the service worker.

Rendering is plain template strings into `#view`. When data changes, `UI.softRender()` re-renders the current screen, except while the user is typing in it or a sheet is open (so inputs keep focus).

## Data

Stored in IndexedDB (`restrobar` → `kv` store), two keys. Falls back to localStorage if IndexedDB is blocked.

### `shared` (synced between devices)

```js
{
  schema: 1,
  settings: {
    brandName, logo /* data: URL, ≤256px */, accent /* #hex */, address, phone, taxNo, footer,
    currency /* ISO 4217 */, locale /* '' = device */, taxes: [{ name, rate /* % */ }],
    taxInclusive, serviceCharge /* % */, tables: [{ id, name }],
    upiId, upiName, payQr /* data: URL */, payQrOnBill,
    updatedAt, updatedBy
  },
  categories: { [id]: { id, name, sort, deleted?, updatedAt, updatedBy } },
  items:      { [id]: { id, catId, name, price /* minor units */, available, station, sort, deleted?, updatedAt, updatedBy } },
  orders:     { [id]: {
    id, tableId, status /* open | paid | void */, createdAt, createdBy,
    kotSeq, billRequested, guests, discount: { type: 'pct' | 'amt', value },
    payments: [{ method /* cash|card|online|other */, amount, at, by }],
    billNo, paidAt, totals /* frozen at payment */, reopenedFrom?,
    lines: [{
      id, itemId, name, price, qty, note, station,
      status /* draft | sent | preparing | ready | served | void */,
      addedAt, sentAt, sentBy, kot, startedAt, readyAt, servedAt, voidAt, voidBy, voidReason,
      updatedAt, updatedBy
    }],
    updatedAt, updatedBy
  } }
}
```

Dish name and price are copied onto each order line, so editing or deleting a menu item never changes past bills. Paid orders keep `totals` frozen at payment so later tax changes don't rewrite history.

### `local` (this device only)

`deviceId, deviceName, role (solo|hub|waiter), theme, textSize, pin, passkeyId, billSeq, deviceCode, setupDone, tourDone, seenVersion, checklistHidden, lastBackupAt, lang, sound, demo, everLinked, knownPeers`.

## Order lifecycle

```
draft ──send──▶ sent ──start──▶ preparing ──ready──▶ ready ──serve──▶ served
   └─remove                 └───────── void (PIN + reason) ─────────┘
order: open ──close bill──▶ paid   (reopen with PIN)   open ──cancel──▶ void
```

A "ticket" (KOT) on the kitchen screen is all lines of one order with the same `kot` number, i.e. one press of "Send to kitchen".

## Sync

All writes go through `Store`, which stamps `updatedAt` (ms, never going backwards on a record) and `updatedBy` (device id), saves in the background, notifies screens, and emits the change to sync listeners.

**Merge rule** (`Store.merge`): last writer wins per record. For orders, the order header and each line merge separately, so a waiter adding dishes and the kitchen marking a different dish ready never clobber each other. Ties break by device id, so every device converges to the same result. Merge is idempotent; replaying old data is harmless.

The same merge serves every transport:

| Transport | Code | Notes |
| --- | --- | --- |
| Live link (WebRTC data channel) | `link.js` | Star: hub relays between phones. On connect both sides send a snapshot (settings, menu, open orders, orders touched in 7 days), then stream changes. Messages over 15 KB are chunked. Ping every 10 s. |
| QR code | `qr.js`, `share.js` | JSON → deflate-raw → base64url, prefix `RB1:` (or `RB0:` uncompressed). |
| File (share sheet, Bluetooth, AirDrop) | `share.js` | `{ app: 'restrobar', type: 'changes' | 'backup', ... }` |
| Other tabs on the same device | `app.js` | BroadcastChannel. |
| Cloud (planned) | — | Same records and merge; a Supabase adapter would push/pull rows by `updatedAt`. |

### Pairing (no server)

1. Hub starts its front camera (so the browser reveals real LAN addresses instead of mDNS names), creates an offer with no ICE servers, waits for candidate gathering, and shows the SDP as a QR code.
2. Phone scans, creates an answer, shows it as a QR code.
3. Hub scans the answer. The data channel opens; both send `hello`, then `sync`.

Measured code length in tests: ~700 characters (a version ~16 QR), comfortably readable from a screen.

## Why no encryption at rest (yet)

See ROADMAP.md decisions log. Short: a shared kitchen tablet must open instantly all day; a password per launch would be skipped or written on the wall, and a forgotten password would lose the sales history. When cloud sync arrives, auth moves server-side.
