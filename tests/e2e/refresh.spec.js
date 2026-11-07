// Refresh button: on every main screen, reloads with data kept, warns when a live link would drop.
const { test, expect } = require('@playwright/test');
const { setUp, noSideScroll } = require('./helpers');

test.beforeEach(async ({}, info) => {
  test.skip(!['iphone-14', 'iphone-se'].includes(info.project.name), 'two phone sizes are enough');
});

test('refresh reloads the app and keeps the data', async ({ page }) => {
  await setUp(page);
  await page.locator('.table-card', { hasText: 'Table 3' }).click();
  await page.locator('.dish', { hasText: 'Karak chai' }).click();
  await page.locator('#tabs [data-go=tables]').click();
  for (const r of ['tables', 'kitchen', 'reports', 'menu', 'more']) {
    await page.locator(`#tabs [data-go=${r}]`).click();
    await expect(page.locator('.top [data-refresh]')).toBeVisible();
    await noSideScroll(page);
  }
  await page.locator('#tabs [data-go=tables]').click();
  await Promise.all([page.waitForEvent('load'), page.locator('.top [data-refresh]').click()]);
  await expect(page.locator('#toast')).toContainText('Refreshed');
  await expect(page.locator('#toast')).toContainText('Your data is still here');
  await expect(page.locator('.table-card', { hasText: 'Table 3' })).toContainText('Not sent');
});

test('refresh on a linked device asks first', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() => { Link.connected = () => [{}]; });
  await page.locator('.top [data-refresh]').click();
  await expect(page.locator('.sheet')).toContainText('This ends the live link');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.top [data-refresh]')).not.toHaveClass(/spin/);
});

test('Settings has Refresh app', async ({ page }) => {
  await setUp(page);
  await page.locator('#tabs [data-go=more]').click();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /Refresh app/ }).click()]);
  await expect(page.locator('#toast')).toContainText('Refreshed');
});
