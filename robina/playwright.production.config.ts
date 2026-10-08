import { defineConfig } from '@playwright/test';
export default defineConfig({
  outputDir: './test-results/production',
  testDir: './tests/production', testMatch: '*.spec.ts', timeout: 60000, workers: 1, reporter: 'list',
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 8082 --strictPort', url: 'http://127.0.0.1:8082', reuseExistingServer: false, timeout: 60000 },
  use: {
    baseURL: 'http://127.0.0.1:8082', viewport: { width: 1280, height: 800 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
