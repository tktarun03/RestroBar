// The bottom notice: title + body, Undo / action button, dismiss, timing, and the undo paths.
const { test, expect } = require('@playwright/test');
const { setUp, noSideScroll } = require('./helpers');

test.beforeEach(async ({}, info) => {
  test.skip(!['iphone-14', 'iphone-se', 'tablet'].includes(info.project.name), 'phones and tablet');
});

const toast = (page) => page.locator('#toast');

test('send to kitchen can be undone from the notice', async ({ page }) => {
  await setUp(page);
  await page.locator('.table-card', { hasText: 'Table 4' }).click();
  await page.locator('.dish', { hasText: 'Kunafa' }).click();
  await page.getByRole('button', { name: 'Send 1 to kitchen' }).click();
  await expect(toast(page)).toContainText('Sent 1 item to the kitchen');
  await expect(toast(page)).toContainText('Table 4 · KOT 1');
  await noSideScroll(page);
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(toast(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Send 1 to kitchen' })).toBeVisible(); // back to "not sent"
});

test('removing a dish can be undone, and stays removed on other devices', async ({ page }) => {
  await setUp(page);
  await page.locator('.table-card', { hasText: 'Table 2' }).click();
  await page.locator('.dish', { hasText: 'Water' }).click();
  const tab = page.getByRole('tab', { name: /Order/ }); if (await tab.isVisible()) await tab.click();
  await page.locator('.line', { hasText: 'Water' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(toast(page)).toContainText('Removed Water');
  await expect(page.locator('.line', { hasText: 'Water' })).toHaveCount(0);
  // The removal is a hidden void line, so it syncs instead of vanishing locally only
  expect(await page.evaluate(() => Store.orders()[0].lines[0].removed)).toBe(true);
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.line', { hasText: 'Water' })).toBeVisible();
});

test('kitchen "All ready" and "Served" can be undone; dismiss closes the notice', async ({ page }) => {
  await setUp(page);
  await page.locator('.table-card', { hasText: 'Table 1' }).click();
  await page.locator('.dish', { hasText: 'Lentil soup' }).click();
  await page.getByRole('button', { name: 'Send 1 to kitchen' }).click();
  await page.locator('#tabs [data-go=kitchen]').click();
  await page.locator('.ticket').first().getByRole('button', { name: 'All ready' }).click();
  await expect(toast(page)).toContainText('Waiter notified');
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.ticket.stage-new')).toHaveCount(1);
  await page.locator('.ticket').first().getByRole('button', { name: 'All ready' }).click();
  await page.locator('#tabs [data-go=tables]').click();
  await page.locator('.ready-strip').getByRole('button', { name: 'Served' }).click();
  await expect(toast(page)).toContainText('Marked as served');
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.ready-strip')).toContainText('Table 1');
  await page.locator('#tabs [data-go=menu]').click();
  await page.locator('[data-avail]').first().uncheck();
  await expect(toast(page)).toContainText('marked sold out');
  await toast(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(toast(page)).toBeHidden();
});

test('notice stays 4.5 s, longer with an Undo', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() => UI.toast('Plain'));
  await page.waitForTimeout(3500);
  await expect(toast(page)).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(toast(page)).toBeHidden();
  await page.evaluate(() => UI.toast('With undo', { undo: () => {} }));
  await page.waitForTimeout(5500);
  await expect(toast(page)).toBeVisible();
});

test('after an update, a notice offers What\'s new', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() => Store.setLocal({ seenVersion: '0.0.1' }));
  await page.waitForTimeout(400);
  await page.reload();
  await expect(toast(page)).toContainText('Updated to version');
  await toast(page).getByRole('button', { name: 'What\'s new' }).click();
  await expect(page.locator('.sheet')).toContainText('Version history');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.reload();
  await page.waitForTimeout(900);
  await expect(toast(page)).toBeHidden(); // only once
});
