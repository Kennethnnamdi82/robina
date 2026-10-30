import { defineConfig } from '@playwright/test';

const externalURL = process.env.RIVALS_TEST_URL;
const softwareGraphics = process.env.RIVALS_SOFTWARE_RENDERER === '1';

export default defineConfig({
  testDir: './tests/rivals', testMatch: '*.spec.ts', outputDir: './test-results/rivals',
  timeout: 120000, workers: 1, reporter: 'list',
  webServer: externalURL ? undefined : { command: 'node node_modules/vite/bin/vite.js --config vite.rivals.config.ts', url: 'http://127.0.0.1:8082/tests/rivals/index.html', reuseExistingServer: true, timeout: 120000 },
  use: {
    actionTimeout: 15000,
    baseURL: externalURL || 'http://127.0.0.1:8082', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'on-first-retry',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: softwareGraphics ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] },
  },
});
