import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/rivals3d',testMatch: '*.spec.ts',outputDir: './test-results/rivals3d',workers: 1,timeout: 120000,reporter: 'list',
  expect: { timeout: 15000 },
  webServer: { command: 'node scripts/dev-rivals3d.mjs',url: 'http://127.0.0.1:8084/tests/rivals3d/index.html',reuseExistingServer: true,timeout: 120000 },
  use: { baseURL: 'http://127.0.0.1:8084',viewport: { width: 1440,height: 900 },actionTimeout: 45000,screenshot: 'only-on-failure',trace: 'retain-on-failure',launchOptions: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } },
});
