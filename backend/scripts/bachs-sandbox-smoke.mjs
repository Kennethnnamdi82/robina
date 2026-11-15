// Explicit opt-in integration check. Never auto-discovered by node --test.
// Refuses live keys; ignores MONGODB_URI; all application data is ephemeral.
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {env} from '../src/config/env.js';
import {createBachsProvider} from '../src/payments/provider.js';
import {createPaymentService} from '../src/payments/service.js';
import {StoreLedger} from '../src/payments/storeModels.js';
if(!process.argv.includes('--create-checkout'))throw new Error('Explicit --create-checkout is required.');
if(!env.bachsApiKey?.startsWith('sk_sandbox_'))throw new Error('Sandbox key required. This script never accepts live keys.');
env.siweUri='https://rivals-heist.vercel.app';
const binary=fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe',import.meta.url));
const mongo=await MongoMemoryReplSet.create({binary:{version:'7.0.24',...(process.platform==='win32'&&existsSync(binary)?{systemBinary:binary}:{})},replSet:{count:1,storageEngine:'wiredTiger'},instanceOpts:[{ip:'127.0.0.1'}]});
let browser,stage='create_checkout';
try{
  await mongoose.connect(mongo.getUri(),{dbName:'rivals-isolated-sandbox-smoke'});
  for(const model of Object.values(mongoose.models)){await model.createCollection();await model.createIndexes();}
  const service=createPaymentService(createBachsProvider()),playerId=new mongoose.Types.ObjectId(),key=randomUUID();
  const order=await service.checkout(playerId,'mp5',key);
  console.log(JSON.stringify({check:'sandbox-checkout',status:order.status,hasHostedCheckout:Boolean(order.checkoutUrl),cents:order.cents,environment:order.environment}));
  if(!order.checkoutUrl)throw new Error('checkout_not_confirmed');
  if(process.argv.includes('--browser-test')||process.argv.includes('--complete-bank-transfer')){
    const {chromium}=await import('../../robina/node_modules/playwright/index.mjs');
    browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage();page.setDefaultTimeout(60000);stage='open_hosted_checkout';
    await page.goto(order.checkoutUrl,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByText('Contact information',{exact:true}).waitFor();
    if(!await page.getByText('Sandbox mode',{exact:true}).count())throw new Error('sandbox_banner_required');
    console.log(JSON.stringify({check:'hosted-sandbox-ui',ready:true}));
    if(process.argv.includes('--complete-bank-transfer')){
      stage='choose_ngn_billing';await page.getByText('USD',{exact:true}).first().click();
      await page.getByText('NGN',{exact:true}).first().click();
      await page.getByText('Nigerian Naira',{exact:true}).waitFor({state:'hidden'});
      await page.locator('input[type=email]').fill('rivals-sandbox@example.com');
      await page.locator('input[type=text]').first().fill('RIVALS Sandbox');
      stage='contact_confirmation';await page.getByRole('button',{name:'Continue to payment',exact:true}).click();
      await page.getByRole('button',{name:'Get account details',exact:true}).waitFor({timeout:120000});
      stage='simulated_bank_payment';await page.getByRole('button',{name:'Get account details',exact:true}).click();
      // Sandbox bank payments simulate success; no actual bank transfer is sent.
      await page.waitForURL(url=>url.origin===env.siweUri,{timeout:120000});
      stage='provider_verification_and_delivery';let result;
      for(let attempt=0;attempt<12;attempt++){
        try{result=await service.reconcile(playerId,order.id);}catch{/* Eventual consistency: same order, no new checkout. */}
        if(['fulfilled','review','refunded','disputed'].includes(result?.status))break;
        await new Promise(resolve=>setTimeout(resolve,2000));
      }
      if(result?.status!=='fulfilled')throw new Error('fulfillment_not_confirmed');
      await service.reconcile(playerId,order.id);
      const state=await service.snapshot(playerId),grants=await StoreLedger.countDocuments({orderId:order.id,kind:'grant'});
      console.log(JSON.stringify({check:'genuine-sandbox-payment-and-delivery',status:result.status,chargedAmount:result.chargedAmount,chargedCurrency:result.chargedCurrency,owned:state.ownedIds.includes('mp5'),grants}));
      if(grants!==1||!state.ownedIds.includes('mp5'))throw new Error('grant_not_exactly_once');
    }
  }
}catch(error){
  // Never print SDK errors, headers, URLs, contact details, secrets or raw responses.
  console.error(JSON.stringify({check:'sandbox-smoke',stage,error:'check_not_confirmed',type:error?.constructor?.name}));process.exitCode=1;
}finally{await browser?.close();await mongoose.disconnect();await mongo.stop();}
