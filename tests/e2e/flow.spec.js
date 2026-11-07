// Full service flow: set up → order → kitchen → ready → served → bill → paid → sales.
// Runs at iPhone SE, 14 and Pro Max sizes plus a tablet. Checks for horizontal scroll and
// that footer buttons stay on screen.
const { test, expect } = require('@playwright/test');

const { noSideScroll, onScreen, errorsOf, setUp } = require('./helpers');

test('order to kitchen to bill', async ({ page }) => {
  const errs = errorsOf(page);
  await setUp(page);

  // Floor
  await expect(page.locator('.top h1')).toHaveText('Saffron House');
  await expect(page.locator('.table-card')).toHaveCount(7);
  await noSideScroll(page);

  // Take an order
  await page.locator('.table-card', { hasText: 'Table 1' }).click();
  await page.locator('.dish', { hasText: 'Chicken biryani' }).click();
  await page.locator('.dish', { hasText: 'Chicken biryani' }).click();
  await page.locator('.dish', { hasText: 'Karak chai' }).click();
  await noSideScroll(page);
  const send = page.getByRole('button', { name: 'Send 3 to kitchen' });
  await onScreen(send);

  // Add a note to the chai
  const orderTab = page.getByRole('tab', { name: /Order/ });
  if (await orderTab.isVisible()) await orderTab.click(); // phones: one pane at a time
  await page.locator('.line', { hasText: 'Karak chai' }).click();
  await page.getByRole('button', { name: 'Less spicy' }).click(); // quick note chip
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.line', { hasText: 'Karak chai' })).toContainText('Less spicy');

  await send.click();
  await expect(page.locator('.toast')).toContainText('Sent 3 items to the kitchen');

  // Kitchen
  await page.locator('#tabs [data-go=kitchen]').click();
  const ticket = page.locator('.ticket').first();
  await expect(ticket).toContainText('Table 1');
  await expect(ticket).toContainText('KOT 1');
  await expect(ticket).toContainText('Less spicy');
  await noSideScroll(page);
  await ticket.getByRole('button', { name: 'All ready' }).click();

  // Waiter sees it ready
  await page.locator('#tabs [data-go=tables]').click();
  await expect(page.locator('.ready-strip')).toContainText('Table 1');
  await page.locator('.ready-strip').getByRole('button', { name: 'Served' }).click();
  await expect(page.locator('.ready-strip')).toHaveCount(0);

  // Bill: 2×38 + 5 = 81.00; service 10% = 8.10; VAT 5% of 89.10 = 4.46 (4.455 rounds half up) → 93.56
  await page.locator('.table-card', { hasText: 'Table 1' }).click();
  await page.getByRole('link', { name: 'Bill' }).click();
  await expect(page.locator('.r-row.total')).toContainText('93.56');
  await noSideScroll(page);
  await page.locator('#p-amt').fill('100');
  await page.getByRole('button', { name: 'Add payment' }).click();
  await expect(page.locator('.due-box.change')).toContainText('6.44');
  const close = page.getByRole('button', { name: 'Close bill and free table' });
  await close.click();
  await expect(page.locator('.paid-stamp')).toBeVisible();

  // Table is free again, sales show the bill
  await page.locator('#tabs [data-go=tables]').click();
  await expect(page.locator('.table-card', { hasText: 'Table 1' })).toContainText('Free');
  await page.locator('#tabs [data-go=reports]').click();
  await expect(page.locator('.stat.main')).toContainText('93.56');
  await expect(page.locator('.bill-list li')).toHaveCount(1);
  await noSideScroll(page);

  // Settings and self-check render
  await page.locator('#tabs [data-go=more]').click();
  await noSideScroll(page);
  await page.getByRole('button', { name: /Self-check/ }).click();
  await expect(page.locator('.checks li.ok', { hasText: 'Bill maths' })).toHaveCount(1);

  expect(errs, errs.join('\n')).toEqual([]);
});

test('data survives a reload and a received order merges', async ({ page }) => {
  await setUp(page, { role: 'hub' });
  await expect(page.locator('.top h1')).toHaveText('Kitchen'); // kitchen tablet opens on Kitchen
  await page.locator('#tabs [data-go=tables]').click();
  await page.locator('.table-card', { hasText: 'Table 2' }).click();
  await page.locator('.dish', { hasText: 'Lentil soup' }).click();
  await page.waitForTimeout(500); // background save
  await page.reload();
  await page.locator('#tabs [data-go=tables]').click();
  await expect(page.locator('.table-card', { hasText: 'Table 2' })).toContainText('Not sent');

  // An order arriving from a waiter phone (same shape as a QR/Bluetooth file)
  await page.evaluate(() => {
    const now = Date.now();
    Share.receive({ app: 'restrobar', type: 'changes', from: 'Ravi', changes: [{ kind: 'order', rec: {
      id: 'remote-1', tableId: 't3', status: 'open', createdAt: now, updatedAt: now, updatedBy: 'phone',
      lines: [{ id: 'l1', itemId: 'x', name: 'Kunafa', price: 2400, qty: 1, note: '', status: 'sent', kot: 1, sentAt: now, addedAt: now, updatedAt: now, updatedBy: 'phone' }],
      payments: [], discount: { type: 'amt', value: 0 }, kotSeq: 1 } }] });
  });
  await expect(page.locator('.toast')).toContainText('Received from Ravi');
  await expect(page.locator('.table-card', { hasText: 'Table 3' })).toContainText('In kitchen');
  await page.locator('#tabs [data-go=kitchen]').click();
  await expect(page.locator('.ticket', { hasText: 'Kunafa' })).toBeVisible();
});
