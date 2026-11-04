// Resize/encode the selected generated bitmap assets; retain source alpha.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));
const [sky,foliage]=process.argv.slice(2);
if(!sky||!foliage)throw new Error('Usage: node scripts/prepare-city-textures.mjs <sky.png> <foliage.png>');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const page=await browser.newPage();
  for(const [file,name,width,height]of [[sky,'sunset-sky.webp',1536,768],[foliage,'oak-foliage.webp',768,768]]) {
    const input='data:image/png;base64,'+(await fs.readFile(file)).toString('base64');
    const output=await page.evaluate(async({input,width,height})=>{const image=await createImageBitmap(await(await fetch(input)).blob()),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0,width,height);image.close();return canvas.toDataURL('image/webp',.88).split(',')[1];},{input,width,height});
    const bytes=Buffer.from(output,'base64');await fs.writeFile(path.join(root,'public/assets/rivals/city',name),bytes);console.log(name,bytes.length,'bytes');
  }
}finally{await browser.close();}
