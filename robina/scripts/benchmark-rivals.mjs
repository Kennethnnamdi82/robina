import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const combined04 = process.argv.includes('--combined04');
const combined03 = combined04 || process.argv.includes('--combined03');
const combined02 = combined03 || process.argv.includes('--combined02');
const output = path.join(root, combined04 ? 'docs/rivals-combined04' : combined03 ? 'docs/rivals-combined03' : combined02 ? 'docs/rivals-combined02' : process.argv.includes('--combined01') ? 'docs/rivals-combined01' : 'docs/rivals-phase02');
await fs.mkdir(output, { recursive: true });
const softwareGraphics = process.env.RIVALS_SOFTWARE_RENDERER === '1';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: softwareGraphics ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const smoke = process.argv.includes('--smoke');
const baseURL = smoke ? 'http://127.0.0.1:8082' : process.env.RIVALS_BENCHMARK_URL || 'http://127.0.0.1:8083';
const scenarios = smoke ? [{ name: 'smoke', width: 1440, height: 1000, quality: 'balanced', character: 'vex' }] : [
  { name: 'desktop-high', width: 1440, height: 1000, quality: 'high', character: 'vex' },
  ...(combined03 ? [{ name: 'mobile-unthrottled', width: 390, height: 844, quality: 'balanced', character: 'nyx', mobile: true }] : []),
  { name: 'mobile-balanced', width: 390, height: 844, quality: 'balanced', character: 'nyx', mobile: true, throttle: 4 },
  { name: 'mobile-low', width: 390, height: 844, quality: 'low', character: 'rook', mobile: true, throttle: 4 },
];
const reports = [];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, hasTouch: Boolean(scenario.mobile), isMobile: Boolean(scenario.mobile), deviceScaleFactor: scenario.mobile ? 2 : 1 });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    const errors = [], start = Date.now(), requests = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
    page.on('requestfailed', request => console.log('REQUEST FAILED', request.url(), request.failure()));
    if (smoke) {
      page.on('request', request => { if (/createGame|phaser|assets\/rivals\/phase02/.test(request.url())) console.log(Date.now() - start, 'REQUEST', request.url()); });
      page.on('response', response => { if (/createGame|phaser|assets\/rivals\/phase02/.test(response.url())) console.log(Date.now() - start, 'RESPONSE', response.status(), response.url()); });
    }
    await cdp.send('Performance.enable');
    if (scenario.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.throttle });
    await page.goto(baseURL + '/tests/rivals/index.html');
    if (!smoke) await page.screenshot({ path: path.join(output, scenario.name + '-menu.png'), fullPage: true });
    await page.getByRole('button', { name: 'PLAY', exact: true }).click();
    await page.getByLabel('Lobby graphics quality').selectOption(scenario.quality);
    await page.getByRole('button', { name: `Select ${scenario.character.toUpperCase()}` }).click();
    await page.getByRole('button', { name: 'START MISSION', exact: true }).click();
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = await page.locator('.rivals-game-view').getAttribute('data-status');
      if (state === 'playing') break;
      if (state === 'error') throw new Error(await page.getByRole('alert').innerText());
      if (attempt % 5 === 0) console.log(scenario.name, Date.now() - start, await page.locator('.rivals-loading-mark p').evaluateAll(nodes => nodes[0]?.textContent ?? 'Scene ready'));
      await page.waitForTimeout(1000);
    }
    if (await page.locator('.rivals-game-view').getAttribute('data-status') !== 'playing') throw new Error('Scene did not start');
    await page.waitForTimeout(smoke ? 1200 : 6500);
    if (!smoke) await page.waitForFunction(() => Number(document.querySelector('[data-testid="arena-position"]')?.getAttribute('data-fps')) > 0, null, { timeout: 20000 });
    if (!smoke) {
      await page.keyboard.down('s'); await page.waitForTimeout(750); await page.keyboard.up('s');
      await page.waitForTimeout(1500);
    }
    if (combined03) {
      // Traverse the real door into an active guard/camera/laser area before sampling.
      const move = async (axis, destination) => page.evaluate(({ axis, destination }) => new Promise((resolve, reject) => {
        const n = document.querySelector('[data-testid="arena-position"]'), sign = Math.sign(destination - Number(n.dataset[axis]));
        if (Math.abs(destination - Number(n.dataset[axis])) < 18) return resolve();
        const code = axis === 'x' ? sign > 0 ? 'KeyD' : 'KeyA' : sign > 0 ? 'KeyS' : 'KeyW';
        const stop = () => window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        const observer = new MutationObserver(() => { if ((Number(n.dataset[axis]) - destination) * sign >= -18) { stop(); observer.disconnect(); clearTimeout(timer); resolve(); } });
        const timer = setTimeout(() => { stop(); observer.disconnect(); reject(new Error('Benchmark traversal blocked at ' + n.dataset[axis])); }, 45000);
        observer.observe(n,{ attributes: true,attributeFilter: ['data-' + axis] }); window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      }), { axis,destination });
      await move('y',576); await move('x',576); await page.keyboard.press('e');
      await page.waitForTimeout(500); await move('x',800); await move('y',720);
    }
    let combatMetrics;
    if (combined02) {
      // Fire into nearby cover using actual input. Samples include effects, reload and pool activity.
      await page.mouse.move(scenario.width * .8, scenario.height * .5); await page.mouse.down();
      await page.waitForTimeout(7000);
      combatMetrics = await page.getByTestId('arena-position').evaluate(element => ({ ...element.dataset }));
      await page.mouse.up();
      await page.waitForTimeout(1200);
    }
    const metrics = await page.getByTestId('arena-position').evaluate(element => ({ ...element.dataset }));
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ url: entry.name, transferBytes: entry.transferSize, decodedBytes: entry.decodedBodySize })));
    requests.push(...resources.filter(entry => entry.url.includes('/assets/rivals/phase02/') || combined02 && /\/assets\/rivals\/combat\/.*\.png/.test(entry.url)));
    const memory = (await cdp.send('Performance.getMetrics')).metrics;
    const canvas = await page.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight }));
    await page.screenshot({ path: path.join(output, `${scenario.name}.png`) });
    const report = { scenario, browser: browser.version(), metrics, combatMetrics, canvas,
      visualTransferBytes: requests.reduce((sum, item) => sum + item.transferBytes, 0),
      visualDecodedFileBytes: requests.reduce((sum, item) => sum + item.decodedBytes, 0),
      totalTransferBytes: resources.reduce((sum, item) => sum + (item.transferBytes || 0), 0),
      jsHeapBytes: memory.find(metric => metric.name === 'JSHeapUsedSize')?.value, resources: requests, errors };
    if (scenario.name === 'desktop-high') {
      const leave = async () => {
        await page.getByRole('button', { name: 'Pause game', exact: true }).click();
        await page.getByRole('button', { name: 'RETURN TO MAIN MENU', exact: true }).click();
        await page.getByRole('button', { name: 'EXIT / BACK', exact: true }).click();
        await page.getByRole('button', { name: 'CONFIRM', exact: true }).click();
        await page.waitForTimeout(350); await cdp.send('HeapProfiler.collectGarbage');
      };
      await leave();
      const first = (await cdp.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value;
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'Gaming', exact: true }).click();
        await page.getByRole('button', { name: 'PLAY', exact: true }).click();
        await page.getByRole('button', { name: 'START MISSION', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.rivals-game-view')?.getAttribute('data-status') === 'playing', null, { timeout: 90000 });
        await leave();
      }
      const last = (await cdp.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value;
      report.teardown = { firstPostExitHeapBytes: first, afterThreeMoreExitsHeapBytes: last, differenceBytes: last - first, remainingCanvases: await page.locator('canvas').count() };
    }
    reports.push(report);
    console.log('MEASURED', scenario.name, JSON.stringify({ fps: metrics.fps, p95: metrics.p95, startupMs: metrics.startupMs, imageBytes: metrics.essentialBytes, heapBytes: report.jsHeapBytes }));
    await context.close();
  }
  await fs.writeFile(path.join(output, smoke ? 'smoke.json' : 'performance.json'), JSON.stringify({ measuredAt: new Date().toISOString(), baseURL, softwareGraphics, methodology: `${combined03 ? 'Active guard/security area and sustained player fire; ' : ''}Local Chrome; actual Phaser renderer recorded in metrics; ${smoke ? 'development entry' : 'minified isolated QA build'}; CPU throttling is recorded per scenario; mobile uses browser emulation, not physical Android/iOS hardware. JS heap excludes GPU/native memory. Active frame stalls are retained.`, reports }, null, 2) + '\n');
} finally { await browser.close(); }
