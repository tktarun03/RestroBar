---
name: ui-change
description: Change or add a RestroBar screen safely - mobile Safari rules, tokens, text, escaping, and the tests to run.
---

# Change the RestroBar UI

1. Find the screen in the "Where things are" table in `AGENTS.md`. One feature per file in `js/features/`.
2. Colours only from the tokens at the top of `css/app.css`. If you need a new colour, add it to all three blocks (light `:root`, dark media query, `[data-theme="dark"]`).
3. Mobile Safari rules: inputs ≥16px font, tap targets ≥44px, no text under 11px, `env(safe-area-inset-*)` for edges, flex + inner scroll instead of `100vh`.
4. All visible text through `t('English text', { vars })`. User data (dish, table names) goes in through `Util.esc`, never inside the translated sentence.
5. Use `UI.open`, `UI.confirm`, `UI.ask`, `UI.requirePin` for dialogs. Never `alert/confirm/prompt`.
6. Re-renders replace the DOM. If a field updates live while typing, update that element in place (see the search box in `order.js`).
7. Use logical CSS (`margin-inline`, `inset-inline-start`) so right-to-left works later.
8. Run `npm test`. For a new screen, add steps to `tests/e2e/flow.spec.js` and call `noSideScroll(page)` on it.
9. Look at it at 375×667 and on a tablet, light and dark.
