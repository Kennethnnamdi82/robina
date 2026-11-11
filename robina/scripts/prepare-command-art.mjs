// Lossy format conversion only. Keep the full-resolution generated original.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
if(!process.argv[2])throw Error('Pass the approved key-art PNG path');
const input=await readFile(process.argv[2]);
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();
 const image=await page.evaluate(async src=>{
  const picture=new Image();picture.src=src;await picture.decode();
  const canvas=document.createElement('canvas');canvas.width=picture.width;canvas.height=picture.height;
  canvas.getContext('2d').drawImage(picture,0,0);return canvas.toDataURL('image/webp',.91).split(',')[1];
 },'data:image/png;base64,'+input.toString('base64'));
 await mkdir('public/assets/rivals/hub',{recursive:true});
 const bytes=Buffer.from(image,'base64');await writeFile('public/assets/rivals/hub/command-keyart-v2.webp',bytes);console.log('Prepared original command key art:',bytes.length,'bytes');
}finally{await browser.close();}
