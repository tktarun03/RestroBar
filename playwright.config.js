// Browser flow tests. Locally uses installed Chrome; CI installs Playwright's Chromium.
const { defineConfig } = require('@playwright/test');

const browser = process.env.CI ? {} : { channel: 'chrome' };
const phone = (name, width, height) => ({
  name, use: { ...browser, viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
});

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  webServer: { command: 'python3 -m http.server 4173', port: 4173, reuseExistingServer: true },
  projects: [
    phone('iphone-se', 375, 667),
    phone('iphone-14', 390, 844),
    phone('iphone-pro-max', 430, 932),
    { name: 'tablet', use: { ...browser, viewport: { width: 1024, height: 768 }, hasTouch: true } }
  ]
});
