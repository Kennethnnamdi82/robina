import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const source=process.argv[2],destination='public/assets/rivals/hub/menu-keyart-v1.webp';
if(!source)throw Error('Pass the generated source PNG path.');
if(existsSync(destination))throw Error('Menu artwork already exists; do not overwrite it.');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage();
  const webp=await page.evaluate(async data=>{
    const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    return canvas.toDataURL('image/webp',.83).split(',')[1];
  },readFileSync(source).toString('base64'));
  mkdirSync('public/assets/rivals/hub',{recursive:true});writeFileSync(destination,Buffer.from(webp,'base64'));
  console.log(destination+' · '+readFileSync(destination).length+' bytes');
}finally{await browser.close();}
