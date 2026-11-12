import { defineConfig } from '@playwright/test';
export default defineConfig({
  // First local Vite navigation transforms the existing wallet SDK graph. Allow
  // cold-start time separately from the short, unchanged interaction assertions.
  testDir: './tests/bounties', outputDir: './test-results/bounties', workers: 1, timeout: 300000,
  expect: { timeout: 25000 }, reporter: 'list',
  webServer: [
    { command: 'node ../backend/scripts/bounty-browser-fixture.mjs', url: 'http://127.0.0.1:4012/ping', timeout: 180000, reuseExistingServer: false,
      env: { NODE_ENV: 'test', RIVALS_BOUNTY_BROWSER_QA: '1' } },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8086 --strictPort', url: 'http://127.0.0.1:8086', timeout: 120000, reuseExistingServer: false,
      env: { VITE_API_URL: 'http://127.0.0.1:4012' } },
  ],
  use: { baseURL: 'http://127.0.0.1:8086', navigationTimeout: 180000, actionTimeout: 20000, viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
