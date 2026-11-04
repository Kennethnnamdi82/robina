import {spawnSync,spawn} from 'node:child_process';
const [target,cli]=process.argv.slice(2);
if(!target||!cli)throw Error('Usage: node scripts/verify-staged-production.mjs <deployment-url> <vercel-cli-js>');
const access=spawnSync(process.execPath,[cli,'curl','/','--deployment',target,'--','--silent','--show-error','--head','--header','x-vercel-set-bypass-cookie: true'],{encoding:'utf8',maxBuffer:2*1024*1024,cwd:'..'});
if(access.status!==0)throw Error('Authenticated Vercel request failed; no credential output retained.');
const match=access.stdout.match(/^set-cookie:\s*(_vercel_jwt)=([^;\s]+)/mi);
if(!match)throw Error('Vercel did not issue the expected staging-access cookie.');
// Credentials stay in process memory/environment, never arguments or files.
const cookie={name:match[1],value:match[2],url:new URL(target).origin,secure:true,httpOnly:true,sameSite:'Lax'};
console.log('Protected staging access prepared; running the real cold-start check.');
const test=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.production.config.ts','--grep','built production 3D','--output','test-results/production-staged-final'],{stdio:'inherit',env:{...process.env,PRODUCTION_TEST_URL:target,PRODUCTION_TEST_WARM_ASSETS:'',PRODUCTION_TEST_BYPASS_COOKIE:JSON.stringify(cookie)}});
test.on('error',()=>{process.exitCode=1;});
test.on('exit',code=>{process.exitCode=code??1;});
