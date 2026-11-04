import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const output = path.resolve('docs/rivals-3d/city'); await fs.mkdir(output,{ recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const reports = [];
try {
  for (const scenario of ([{ name: 'desktop-low',width: 1440,height: 900,quality: 'low',cpu: 1 },{ name: 'mobile-low',width: 390,height: 844,quality: 'low',cpu: 1 },{ name: 'mobile-stress',width: 390,height: 844,quality: 'low',cpu: 4 }]).slice(0,process.argv.includes('--quick') ? 1 : 3)) {
    const context = await browser.newContext({ viewport: { width: scenario.width,height: scenario.height },isMobile: scenario.width < 600,hasTouch: scenario.width < 600,deviceScaleFactor: scenario.width < 600 ? 2 : 1 });
    const page = await context.newPage(),cdp = await context.newCDPSession(page),errors = [];
    page.on('pageerror',e => errors.push(e.message)); await cdp.send('Performance.enable');
    if (scenario.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate',{ rate: scenario.cpu });
    await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html'); await page.getByRole('button',{ name: 'ENTER 3D RAID' }).click();
    await page.locator('.r3-game[data-status=playing]').waitFor({ timeout: 90000 });
    const driver = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'); if (!gl) return 'unavailable';
      const extension = gl.getExtension('WEBGL_debug_renderer_info'); return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    const measurements = [];
    for (const [pov] of [['tactical','TACTICAL / TOP-DOWN'],['side','ACTION / SIDE-VIEW'],['third','THIRD-PERSON / TPS'],['first','FIRST-PERSON / FPS']]) {
      for (let i = 0; i < 4 && await page.getByTestId('three-state').getAttribute('data-pov') !== pov; i++) { const before = await page.getByTestId('three-state').getAttribute('data-pov'); await page.getByRole('button',{ name: 'Cycle camera view' }).click(); await page.waitForFunction(value => document.querySelector('[data-testid=three-state]')?.getAttribute('data-pov') !== value,before); }
      await page.waitForTimeout(3500); await page.mouse.move(scenario.width / 2,scenario.height / 2); await page.mouse.down(); await page.waitForTimeout(4000); await page.mouse.up();
      const data = await page.getByTestId('three-state').evaluate(n => ({ ...n.dataset })); measurements.push({ pov,...data });
      if (scenario.name !== 'mobile-stress') await page.screenshot({ path: path.join(output,scenario.name + '-' + pov + '.png') });
    }
    await page.getByRole('button',{ name: 'Pause game',exact: true }).click(); await page.getByRole('button',{ name: 'EXIT SANDBOX' }).click();
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = (await cdp.send('Performance.getMetrics')).metrics;
    reports.push({ scenario,driver,measurements,errors,remainingCanvases: await page.locator('canvas').count(),postExitJSHeapBytes: metrics.find(m => m.name === 'JSHeapUsedSize')?.value });
    console.log('MEASURED',scenario.name,measurements.map(m => ({ pov: m.pov,fps: m.fps,calls: m.drawCalls,triangles: m.triangles,dpr: m.dpr })));
    await context.close();
  }
  await fs.writeFile(path.join(output,'performance.json'),JSON.stringify({ date: new Date().toISOString(),browser: browser.version(),methodology: 'Local development server; spawned raid, four camera views, sustained player firing. GPU renderer is WebGL. CPU throttle and mobile emulation are explicit. These are not physical-device results or an active full-boss benchmark. HUD FPS uses the rolling FrameMetrics window; JS heap excludes native/GPU allocations.',reports },null,2));
} finally { await browser.close(); }
