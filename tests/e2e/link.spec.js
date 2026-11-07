// Live link: a real WebRTC pairing between a kitchen tablet and a waiter phone, in two
// separate browser profiles. Only the camera reading is faked: we hand each side the exact
// text its QR code contains. Covers: pairing, menu reaching the phone, order → kitchen,
// ready → phone alert.
//
// What this cannot prove: two real devices on a real Wi-Fi router (client isolation,
// iOS backgrounding). That needs a device test; see ROADMAP.md.
const { test, expect } = require('@playwright/test');
const { setUp, errorsOf } = require('./helpers');

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
});

// Capture QR text and the camera callback instead of reading pixels.
const tap = (page) => page.evaluate(() => {
  const svg = QR.svg; QR.svg = (txt) => { window.__lastQR = txt; return svg(txt); };
  const cam = QR.startCamera; QR.startCamera = (c, onText, f) => { window.__feed = onText; return cam(c, () => {}, f); };
  QR.scanSheet = (title, onText) => { window.__feed = onText; };
});
const lastQR = async (page, prefix) => {
  await expect.poll(() => page.evaluate(() => window.__lastQR || ''), { timeout: 8000 }).toMatch(/^RB[01]:/);
  return page.evaluate(() => window.__lastQR);
};

test('kitchen tablet and waiter phone link and stay in sync', async ({ browser }, info) => {
  test.skip(info.project.name !== 'iphone-14', 'one size is enough for the link test');

  const hubCtx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const hub = await hubCtx.newPage();
  const phone = await phoneCtx.newPage();
  const hubErrs = errorsOf(hub); const phoneErrs = errorsOf(phone);

  // Hub: full setup as kitchen tablet
  await setUp(hub, { role: 'hub' });
  await tap(hub);

  // Phone: waiter setup up to the "link" step
  await phone.goto('/');
  await phone.getByRole('button', { name: 'Skip' }).click();
  await phone.getByText('Waiter phone', { exact: true }).click();
  await phone.getByRole('button', { name: 'Continue' }).click();
  await phone.getByLabel('Phone name').fill('Ravi');
  await phone.getByRole('button', { name: 'Continue' }).click();
  await tap(phone);

  // 1. Tablet shows its code
  await hub.goto('/#links');
  await hub.getByRole('button', { name: 'Add a waiter phone' }).click();
  const offer = await lastQR(hub);
  console.log('offer QR length', offer.length);
  expect(offer.length, 'offer must fit a QR a phone can read from a screen').toBeLessThan(1200);

  // 2. Phone "scans" it and shows its answer
  await phone.getByRole('button', { name: /Scan the tablet/ }).click();
  await phone.evaluate((txt) => window.__feed(txt), offer);
  await phone.evaluate(() => { window.__lastQR = ''; });
  const answer = await lastQR(phone);
  console.log('answer QR length', answer.length);
  expect(answer.length).toBeLessThan(1200);

  // 3. Tablet "scans" the answer → linked
  await hub.evaluate((txt) => window.__feed(txt), answer);
  await expect(hub.locator('.toast')).toContainText('Ravi linked', { timeout: 15000 });
  await expect(phone.locator('.top h1')).toHaveText('Saffron House', { timeout: 15000 }); // brand arrived on the phone
  await expect(phone.locator('.pill.ok')).toContainText('Linked');

  // Phone takes an order; the tablet's kitchen gets the ticket
  await phone.locator('.table-card', { hasText: 'Table 2' }).click();
  await phone.locator('.dish', { hasText: 'Lamb mandi' }).click();
  await phone.getByRole('button', { name: 'Send 1 to kitchen' }).click();
  await hub.goto('/#kitchen');
  const ticket = hub.locator('.ticket', { hasText: 'Lamb mandi' });
  await expect(ticket).toBeVisible({ timeout: 10000 });
  await expect(ticket).toContainText('Ravi');

  // Kitchen marks it ready; the phone is told
  await ticket.getByRole('button', { name: 'All ready' }).click();
  await phone.goto('/#tables');
  await expect(phone.locator('.ready-strip')).toContainText('Table 2', { timeout: 10000 });

  expect(hubErrs.concat(phoneErrs).filter((e) => !/getUserMedia|NotAllowed/.test(e))).toEqual([]);
  await hubCtx.close(); await phoneCtx.close();
});
