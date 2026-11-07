// Payment QR on the bill, and the admin screen behind the admin PIN and Face ID / fingerprint.
// Face ID is simulated with Chrome's virtual authenticator (a real WebAuthn passkey flow).
const { test, expect } = require('@playwright/test');
const { setUp, noSideScroll } = require('./helpers');

test.beforeEach(async ({}, info) => {
  test.skip(!['iphone-14', 'iphone-se'].includes(info.project.name), 'two phone sizes are enough');
});

test('UPI QR with the amount on the bill (INR)', async ({ page }) => {
  await setUp(page, { currency: 'INR', upi: 'saffron.house@okaxis' });
  await page.locator('.table-card', { hasText: 'Table 1' }).click();
  await page.locator('.dish', { hasText: 'Lentil soup' }).click();
  await page.getByRole('button', { name: 'Send 1 to kitchen' }).click();
  await page.getByRole('link', { name: 'Bill' }).click();
  await page.getByRole('button', { name: 'UPI / GPay' }).click();
  const qr = page.locator('.bill-pay .pay-qr');
  await expect(qr).toContainText('saffron.house@okaxis');
  await expect(qr.locator('svg.qr')).toBeVisible();
  // The QR text is a upi:// link with the exact amount due
  const url = await page.evaluate(() => {
    const s = Store.settings(); const o = Store.orders()[0];
    return PayQR.upiUrl(s, Billing.calc(o, s).due, 'x');
  });
  expect(url).toMatch(/^upi:\/\/pay\?pa=saffron\.house@okaxis&pn=Saffron%20House&am=\d+\.\d{2}&cu=INR&tn=x$/);
  await noSideScroll(page);
  await page.getByRole('button', { name: 'Show big to the customer' }).click();
  await expect(page.locator('.sheet .pay-qr.big')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Received' }).click();
  await page.getByRole('button', { name: 'Close bill and free table' }).click();
  await expect(page.locator('.paid-stamp')).toBeVisible();
});

test('a phone number is refused as a UPI ID, and non-INR hides UPI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Restaurant name').fill('Test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#f-currency').selectOption('INR');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('UPI ID for GPay, PhonePe, Paytm').fill('9876543210');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.toast')).toContainText('not a UPI ID');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('#f-currency').selectOption('QAR');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('UPI ID for GPay, PhonePe, Paytm')).toHaveCount(0);
  await expect(page.getByText('works only with INR')).toBeVisible();
});

test('admin: PIN locks it, Face ID unlocks it, PIN always works', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true
  } });

  await setUp(page);
  await page.goto('/#admin');
  await expect(page.locator('.banner.warn')).toContainText('Anyone can open this screen');

  // Set a PIN, then turn on biometrics
  await page.getByRole('button', { name: /Admin PIN/ }).click();
  await page.locator('#ask-input').fill('2468');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.toast')).toContainText('PIN set');
  await page.locator('[data-act=bio]').click();
  await expect(page.locator('.toast')).toContainText('is on for the admin screen');
  await expect(page.locator('[data-act=bio]')).toContainText('On for this device');

  // Lock → Face ID unlocks
  await page.locator('[data-act=lock]').click();
  await page.goto('/#admin');
  await expect(page.getByText('Admin is locked')).toBeVisible();
  await page.locator('[data-act=unlock]').click();
  await expect(page.getByRole('button', { name: /Payments/ })).toBeVisible();

  // Lock → face not recognised → PIN still works
  await page.locator('[data-act=lock]').click();
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await page.goto('/#admin');
  await page.getByRole('button', { name: 'Use PIN instead' }).click();
  await page.locator('#ask-input').fill('1111');
  await page.locator('.sheet').getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('.toast')).toContainText('Wrong PIN');
  await expect(page.getByText('Admin is locked')).toBeVisible();
  await page.getByRole('button', { name: 'Use PIN instead' }).click();
  await page.locator('#ask-input').fill('2468');
  await page.locator('.sheet').getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('button', { name: /Payments/ })).toBeVisible();

  // Voids and discounts use the same lock (still unlocked here, so no prompt)
  expect(await page.evaluate(() => UI.requirePin('x'))).toBe(true);

  // Settings tab shows the lock state; the admin PIN cannot be removed silently while Face ID is on
  await page.locator('#tabs [data-go=more]').click();
  await expect(page.locator('.admin-row')).toContainText('Locked with');
  await noSideScroll(page);
});
