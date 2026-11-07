# RestroBar – guide for whoever maintains this (person or AI)

RestroBar is a restaurant ordering, kitchen display and billing app. It is a static PWA (plain HTML/CSS/JS, no build step, no framework) deployed to GitHub Pages from `main`. Data lives on each device (IndexedDB). Devices on the same Wi-Fi sync live over WebRTC, paired by QR codes. There is no server.

Typical setup: one kitchen tablet (role `hub`), several waiter phones (role `waiter`). A small place can run on one device (role `solo`).

## Repo map

| Path | What |
| --- | --- |
| `index.html` | Shell. Loads every script in order with `?v=<version>`. |
| `css/app.css` | All styles. Colour tokens at the top, light + dark. |
| `js/core/version.js` | `APP_VERSION` and `RELEASES` (in-app version history). |
| `js/core/util.js` | Escaping, ids, money (integer minor units), dates. |
| `js/core/i18n.js` | `t()` translation table. English text is the key. |
| `js/core/billing.js` | Bill maths. Pure functions. |
| `js/core/store.js` | All saved data, `migrate()`, merge rules, backup/restore. |
| `js/ui/ui.js` | Router (hash), toast, sheets, `UI.confirm/ask/requirePin`, icons. |
| `js/features/*.js` | One file per screen or capability (see table below). |
| `js/app.js` | Boot, theme/brand colour, tab bar, notices, ready alerts. Loads last. |
| `lib/` | Vendored, pinned QR libraries (MIT). |
| `fonts/` | Vendored Barlow + IBM Plex Mono (OFL). |
| `sw.js` | Service worker: page network-first, versioned assets cache-first. |
| `tests/*.test.mjs` | Node tests: structure, bill maths, merge rules. |
| `tests/e2e/*.spec.js` | Playwright flows at 375×667, 390×844, 430×932 and a tablet. |
| `docs/ARCHITECTURE.md` | Data shape and sync design. |
| `ROADMAP.md` | Decisions log and what's next. |

## Where things are

| I want to change… | Go to |
| --- | --- |
| How a bill is calculated | `js/core/billing.js` (+ `tests/billing.test.mjs`) |
| A saved field | `js/core/store.js` → add a default in `migrate()` |
| How devices merge changes | `js/core/store.js` → `merge`, `mergeOrder` (+ `tests/merge.test.mjs`) |
| QR pairing / live link | `js/features/link.js`, `js/features/qr.js` |
| Share sheet, import, backup file | `js/features/share.js` |
| First-run tour and setup wizard | `js/features/setup.js` |
| Tables / floor | `js/features/tables.js` |
| Taking an order | `js/features/order.js` |
| Kitchen display | `js/features/kitchen.js` |
| Bill and payment, receipt | `js/features/bill.js` |
| Menu editor | `js/features/menu.js` |
| Sales report | `js/features/reports.js` |
| Settings, self-check, feedback | `js/features/settings.js` |
| Colours, fonts, spacing | top of `css/app.css` |

## Golden rules

1. **Money is integer minor units** (fils, cents). Never store floats. Use `Util.toMinor/money`.
2. **Every new saved field gets a default in `Store.migrate()`.** Never rename or remove a field without a migration.
3. **All writes go through `Store`** (`updateOrder`, `putItem`, `saveSettings`, `setLocal`) so they are stamped, saved, and synced.
4. **Escape all user and external text** with `Util.esc` before it goes into HTML.
5. **No `alert/confirm/prompt`.** Use `UI.confirm`, `UI.ask`. A test enforces this.
6. **One global scope.** Each file declares one top-level name (`const Feature = (() => {…})()`). A test checks names are unique.
7. **Never send data off the device** except through a link or share the user starts. No analytics, no CDNs at runtime (libraries are vendored).
8. **Mobile Safari first:** inputs ≥16px, tap targets ≥44px, no text <11px, safe areas via `env()`, no `100vh` for full-screen views. Zoom is disabled (owner's choice), so every screen must work at Settings → Text size A++ on a 320px phone; `tests/e2e/responsive.spec.js` checks it.
9. **Wrap UI text in `t()`.** English is the key; keep user data out of the sentence, use `{placeholders}`.

## Test

```
npm ci
npx playwright install --with-deps chromium   # first time, CI does this
npm test                                      # unit + browser flows
npm run serve                                 # http://localhost:4173
```

The in-app self-check (Settings → Self-check) runs on the phone itself.

## Release and deploy

Follow `.claude/skills/release/SKILL.md`. Short version: add release notes (RELEASES + CHANGELOG), bump the version everywhere (`version.js`, every `?v=` in `index.html`, `sw.js` VERSION, `package.json`), run tests, commit, push to `main`, and confirm both the "Tests" and "Deploy" GitHub Actions runs succeed. Pages deploys only after tests pass. A one-device preview is mirrored as a Claude artifact (https://claude.ai/artifact/Mi2gRj4TZ8okfmjkQQv5j3); republish it after every release with `tools/artifact.mjs`.

## Known sharp edges

- **Live link drops when a phone sleeps or the app is closed.** Browsers cannot reconnect WebRTC without signalling, so the user re-scans. Data made while unlinked merges on relink.
- **Same Wi-Fi only.** Guest networks with client isolation block the link. There are no STUN/TURN servers on purpose (nothing leaves the network).
- **Clocks matter.** Merge is last-writer-wins by timestamp. Devices with very wrong clocks can lose edits.
- **Bill numbers** are per device (`<prefix>-00001`). Two payment devices need different prefixes (Settings → This device).
- **iPhone Home Screen apps keep their own storage**, separate from Safari. Set up inside the Home Screen app, or move data with backup/import.
- **Safari may delete site data after ~7 days unused.** The app reminds users to back up.
- **Changing currency does not convert prices.**
- **Data is not encrypted at rest** (decision in ROADMAP.md). The manager PIN is a lock on actions, not encryption.
- **Printing** uses the browser print dialog. Direct Bluetooth thermal printers are not supported yet.
