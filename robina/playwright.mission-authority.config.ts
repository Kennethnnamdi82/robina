import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/mission-authority',testMatch:'*.spec.ts',workers:1,timeout:420000,reporter:'list',outputDir:'./test-results/mission-authority',
  webServer:[
    {command:'node ../backend/scripts/mission-browser-fixture.mjs',url:'http://127.0.0.1:4106/__test/ready',timeout:240000,reuseExistingServer:false},
    {command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8086 --strictPort',url:'http://127.0.0.1:8086/tests/mission-authority/index.html',timeout:120000,reuseExistingServer:false,env:{VITE_API_URL:'http://127.0.0.1:4106'}},
  ],
  use:{baseURL:'http://127.0.0.1:8086',viewport:{width:960,height:540},actionTimeout:15000,screenshot:'only-on-failure',trace:{mode:'retain-on-failure',screenshots:false},
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:process.env.RIVALS_SOFTWARE_RENDERER==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]}},
});
