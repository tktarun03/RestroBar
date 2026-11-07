// Shared steps for browser tests.
const { expect } = require('@playwright/test');

const noSideScroll = async (page) => {
  const over = await page.evaluate(() => {
    const v = document.getElementById('view');
    return Math.max(document.documentElement.scrollWidth, v.scrollWidth) - window.innerWidth;
  });
  expect(over, 'page scrolls sideways').toBeLessThanOrEqual(0);
};

const onScreen = async (locator) => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const vh = await locator.page().evaluate(() => window.innerHeight);
  expect(box.y + box.height, 'button is below the screen').toBeLessThanOrEqual(vh + 1);
};

const errorsOf = (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  return errs;
};

async function setUp(page, { role = 'solo' } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('How will this device be used?')).toBeVisible();
  await noSideScroll(page);
  if (role === 'hub') await page.getByText('Main kitchen tablet').click();
  await onScreen(page.getByRole('button', { name: 'Continue' }));
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Restaurant name').fill('Saffron House');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#f-currency').selectOption('QAR');
  await page.getByRole('button', { name: 'Add a tax' }).click();
  await page.locator('[data-tax-name="0"]').fill('VAT');
  await page.locator('[data-tax-rate="0"]').fill('5');
  await page.getByLabel('Service charge %').fill('10');
  await noSideScroll(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Fewer' }).click(); // 8 → 7
  await expect(page.locator('#f-tcount')).toHaveText('7');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-tax-name="0"]')).toHaveValue('VAT'); // values kept going back
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#f-tcount')).toHaveText('7');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('How a bill is worked out')).toBeVisible();
  await noSideScroll(page);
  await page.getByRole('button', { name: 'Start with a sample menu' }).click();
}

module.exports = { noSideScroll, onScreen, errorsOf, setUp };
