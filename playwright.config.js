const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

// En local (environnement de dev fourni), on réutilise le Chromium pré-installé.
// En CI, Playwright installe et utilise son propre navigateur.
const LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = fs.existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined;

const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 5177;
const BASE_URL = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  // L'OCR (chargement du moteur + reconnaissance) peut être lent : marge large.
  timeout: 240000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    ...devices['Pixel 7'],
    hasTouch: true,
    isMobile: true,
    permissions: ['camera'],
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
      ],
    },
  },

  // Playwright démarre le serveur statique et attend qu'il réponde.
  webServer: {
    command: 'node scripts/serve-build.js',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
