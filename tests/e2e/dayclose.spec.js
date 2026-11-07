// Staff restrictions (shared admin PIN, Sales hidden, menu edits locked) and the end-of-day close.
const { test, expect } = require('@playwright/test');
const { setUp, noSideScroll } = require('./helpers');

test.beforeEach(async ({}, info) => {
  test.skip(!['iphone-14', 'iphone-se', 'tablet'].includes(info.project.name), 'phones and tablet');
});

async function sell(page, table, dish, method, amount) {
  await page.locator('#tabs [data-go=tables]').click();
  await page.locator('.table-card', { hasText: table }).click();
  await page.locator('.dish', { hasText: dish }).click();
  await page.getByRole('button', { name: 'Send 1 to kitchen' }).click();
  await page.getByRole('link', { name: 'Bill' }).click();
  if (method !== 'Cash') await page.locator('.methods').getByRole('button', { name: method }).click();
  if (amount) await page.locator('#p-amt').fill(amount);
  await page.getByRole('button', { name: 'Add payment' }).click();
  await page.getByRole('button', { name: 'Close bill and free table' }).click();
  await expect(page.locator('.paid-stamp')).toBeVisible();
}

test('close the day: expected cash, counted, short, bills after close', async ({ page }) => {
  await setUp(page); // QAR, service 10%, VAT 5%
  await sell(page, 'Table 1', 'Lentil soup', 'Cash', '20');   // 15 → 17.33 total, cash counted as 17.33
  await sell(page, 'Table 2', 'Water', 'Card');               // 3 → 3.47
  await page.locator('#tabs [data-go=reports]').click();
  await page.getByRole('button', { name: 'Close the day' }).click();
  await expect(page.locator('.sheet')).toContainText('Cash sales');
  await page.locator('#c-float').fill('100');
  await expect(page.locator('#c-expected')).toContainText('117.33');
  await page.locator('#c-counted').fill('115');
  await expect(page.locator('#c-diff')).toContainText('Short by');
  await expect(page.locator('#c-diff')).toContainText('2.33');
  await noSideScroll(page);
  await page.locator('.sheet').getByRole('button', { name: 'Close the day' }).click();
  await expect(page.locator('#toast')).toContainText('Day closed');
  await expect(page.locator('.close-card.closed')).toContainText('Short by');
  // the float is remembered for next time
  expect(await page.evaluate(() => Store.settings().cashFloat)).toBe(10000);
  // a bill paid after the close is flagged
  await sell(page, 'Table 3', 'Water', 'Cash');
  await page.locator('#tabs [data-go=reports]').click();
  await expect(page.locator('.close-card')).toContainText('1 bills were paid after the close');
  const text = await page.evaluate(() => Reports.reportText(Reports.dayData && Util.bizDay(Date.now(), Store.settings().dayEndsAt)));
  expect(text).toContain('Counted');
  expect(text).toContain('Short by');
});

test('staff: with a PIN, Sales disappear and menu edits need the PIN', async ({ page }) => {
  await setUp(page);
  await page.goto('/#admin');
  await page.getByRole('button', { name: /Admin PIN/ }).click();
  await page.locator('#ask-input').fill('2468');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#st-sales')).toBeChecked();
  expect(await page.evaluate(() => Store.settings().adminPin.hash.length)).toBeGreaterThan(20); // shared hash, not the PIN
  expect(await page.evaluate(() => JSON.stringify(Store.settings()).includes('2468'))).toBe(false);

  await page.locator('[data-act=lock]').click();
  await expect(page.locator('#tabs [data-go=reports]')).toHaveCount(0);
  await page.goto('/#reports');
  await expect(page.getByText('Sales is locked')).toBeVisible();
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.locator('.sheet #ask-input').fill('2468');
  await page.locator('.sheet').getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('.stat.main')).toBeVisible();
  await expect(page.locator('#tabs [data-go=reports]')).toHaveCount(1);

  // Lock again: sold-out switch still works, editing a dish asks for the PIN
  await page.evaluate(() => Lock.lock());
  await page.locator('#tabs [data-go=menu]').click();
  await page.locator('[data-avail]').first().uncheck();
  await expect(page.locator('#toast')).toContainText('marked sold out');
  await page.locator('[data-item]').first().click();
  await expect(page.locator('.sheet #ask-input')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#m-name')).toHaveCount(0);
});

test('an old per-device PIN moves into the shared settings', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() => Store.setLocal({ pin: '1357' }));
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('.top h1')).toBeVisible(); // app booted
  await expect.poll(() => page.evaluate(() => Lock.hasPin())).toBe(true);
  expect(await page.evaluate(() => Store.local.pin)).toBe('');
  expect(await page.evaluate(() => Lock.checkPin('1357'))).toBe(true);
});
