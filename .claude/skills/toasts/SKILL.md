---
name: toasts
description: Show a RestroBar notice (toast) after an action - title and body wording, Undo or one action button, when to use one, and how to test it. Use whenever an action changes data or something goes wrong.
---

# Notices (toasts) in RestroBar

One notice at a time, at the bottom, above the tab bar and the Send/Pay bar. Same pattern as BasKar.

```js
UI.toast(title)                                   // plain, 4.5 s
UI.toast(title, 'good' | 'bad')                   // tick or cross icon; errors stay 6 s
UI.toast(title, { kind, body, undo: fn })         // Undo button, stays 7 s
UI.toast(title, { kind, body, action: { label, fn } }) // one other button, stays 7 s
UI.toast(title, { duration: ms })                 // rare: override the time
```

Every notice has a ✕. A finger or mouse on it pauses the timer. A new notice replaces the old one.

## When to show one

- **After every action that changes shared data** (sent, served, voided, moved, deleted, sold out, payment removed, bill closed). Say what happened.
- **Offer Undo whenever the change can be put back safely.** Undo must re-check state first (for example only lines still `sent` go back to `draft`), because a linked device may have changed them in the 7 seconds.
- **No Undo** for things that need the admin lock to reverse (closing a bill → Reopen needs the PIN), erasing data, or restoring a backup.
- **Errors**: `kind: 'bad'`, say what went wrong and what to do, and add the fixing action as the button when there is one ("Back up", "Relink", "Send by QR").
- **Not** for validation inside a form if the field itself can show it; a short `bad` toast is fine for one-line forms.
- **Don't** stack notices from one tap. If two things happened, write one notice.

## Wording

- Title: what happened, past tense, ≤ 6 words. "Sent 3 items to the kitchen", "Marked as served", "Couldn't save".
- Body (optional): where or what it means. "Table 4 · KOT 2", "Waiters see it greyed out.", "Orders stay on this device and merge when you relink."
- Button: one or two words. "Undo", "Back up", "Relink", "View", "What's new".
- Get singular/plural right ("1 item", "3 items").
- All text through `t()`. Names (tables, dishes) only as `{placeholders}` or in the body.

## Built-in notices

- After an update: "Updated to version X" + first release note + **What's new** (once per version; not on first install).
- Storage failure: "Couldn't save" + **Back up** (`Store.onSaveError`).
- Live link dropped: "Lost link to {name}" + **Relink**.
- Waiter phone: "{table}: ready to serve" + **View**.
- Waiter phone not linked when sending: "Not received by the kitchen yet" + **Send by QR**.

## Test

Add a case to `tests/e2e/toast.spec.js`: do the action, `expect(page.locator('#toast')).toContainText(...)`, click Undo (`getByRole('button', { name: 'Undo' })`), and check the data really went back. Run `npm test`.
