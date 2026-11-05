import { defineConfig } from '@playwright/test';
const deployedURL = process.env.PRODUCTION_TEST_URL;
export default defineConfig({
  outputDir: './test-results/production',
  // Intercepted remote browser tests re-download vendor bundles on every visit.
  // Budget for network transfer across multi-page checks, not slower game logic.
  testDir: './tests/production', testMatch: '*.spec.ts', timeout: deployedURL ? 300000 : 60000, workers: 1, reporter: 'list',
  expect: { timeout: deployedURL ? 30000 : 5000 },
  webServer: deployedURL ? undefined : { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 8082 --strictPort', url: 'http://127.0.0.1:8082', reuseExistingServer: false, timeout: 60000 },
  use: {
    baseURL: deployedURL || 'http://127.0.0.1:8082', viewport: { width: 1280, height: 800 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
