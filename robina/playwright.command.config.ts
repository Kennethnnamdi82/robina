import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/command',outputDir:'./test-results/command',timeout:120000,workers:1,reporter:'list',expect:{timeout:15000},
 use:{actionTimeout:15000,navigationTimeout:30000,baseURL:process.env.COMMAND_TEST_URL||'http://127.0.0.1:8086',viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
});
