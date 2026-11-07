// Zoom is off, and the layout holds on the smallest phones, with large text, and held sideways.
const { test, expect } = require('@playwright/test');
const { setUp, noSideScroll, onScreen } = require('./helpers');

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'iphone-14', 'sizes are set inside these tests');
});

test('pinch, double-tap and keyboard zoom are blocked', async ({ page }) => {
  await page.goto('/');
  const meta = await page.getAttribute('meta[name=viewport]', 'content');
  expect(meta).toContain('user-scalable=no');
  expect(meta).toContain('maximum-scale=1');
  const blocked = await page.evaluate(() => {
    const fire = (ev) => { document.dispatchEvent(ev); return ev.defaultPrevented; };
    const tt = (id) => new Touch({ identifier: id, target: document.body, clientX: 10 * id, clientY: 10 });
    const out = {};
    out.pinch = fire(new TouchEvent('touchmove', { touches: [tt(1), tt(2)], cancelable: true, bubbles: true }));
    out.oneFingerScroll = fire(new TouchEvent('touchmove', { touches: [tt(1)], cancelable: true, bubbles: true }));
    out.gesture = fire(new Event('gesturestart', { cancelable: true }));
    out.ctrlWheel = fire(new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, cancelable: true }));
    out.ctrlPlus = fire(new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true }));
    out.touchAction = getComputedStyle(document.documentElement).touchAction;
    return out;
  });
  expect(blocked).toEqual({ pinch: true, oneFingerScroll: false, gesture: true, ctrlWheel: true, ctrlPlus: true, touchAction: 'manipulation' });
});

test('320px phone with the largest text: nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setUp(page);
  await page.locator('#tabs [data-go=more]').click();
  await page.getByRole('button', { name: 'A++' }).click();
  for (const r of ['tables', 'menu', 'more', 'reports', 'kitchen']) {
    await page.locator(`#tabs [data-go=${r}]`).click();
    await noSideScroll(page);
  }
  await page.locator('#tabs [data-go=tables]').click();
  await page.locator('.table-card', { hasText: 'Table 1' }).click();
  await page.locator('.dish', { hasText: 'Mixed grill platter' }).click();
  await noSideScroll(page);
  await onScreen(page.getByRole('button', { name: 'Send 1 to kitchen' }));
});

test('phone held sideways: tabs move to a side rail and the order screen fits', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await setUp(page);
  const rail = await page.locator('#tabs').boundingBox();
  expect(rail.width).toBeLessThan(110);
  expect(rail.height).toBeGreaterThan(300);
  await noSideScroll(page);
  await page.locator('.table-card', { hasText: 'Table 2' }).click();
  await page.locator('.dish', { hasText: 'Lentil soup' }).click();
  await expect(page.locator('.pane-order')).toBeVisible(); // menu and order side by side
  await noSideScroll(page);
  await onScreen(page.getByRole('button', { name: 'Send 1 to kitchen' }));
  await page.getByRole('button', { name: 'Send 1 to kitchen' }).click();
  await page.locator('#tabs [data-go=kitchen]').click();
  await noSideScroll(page);
  await expect(page.locator('.ticket').first()).toBeVisible();
});

test('opening a dish sheet on a phone does not jump into the note box', async ({ page }) => {
  await setUp(page);
  await page.locator('.table-card', { hasText: 'Table 1' }).click();
  await page.locator('.dish', { hasText: 'Mango lassi' }).click();
  await page.getByRole('tab', { name: /Order/ }).click();
  await page.locator('.line', { hasText: 'Mango lassi' }).click();
  await expect(page.locator('#ls-note')).toBeVisible();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('ls-note');
  // and the sheet fits the screen width
  const box = await page.locator('.sheet').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth) + 1);
});

test('text is light: body 300, emphasis 500, no bold', async ({ page }) => {
  await setUp(page);
  const w = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontWeight,
    h1: getComputedStyle(document.querySelector('.top h1')).fontWeight,
    heaviest: Math.max(...[...document.querySelectorAll('body *')].map((e) => +getComputedStyle(e).fontWeight))
  }));
  expect(w).toEqual({ body: '300', h1: '500', heaviest: 500 });
});
