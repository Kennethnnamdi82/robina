// Public client IDs only — no signing keys, deploy keys, tokens or repo creation
import {loadEnv} from 'vite';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {github} from './github-client.mjs';
const frontend=fileURLToPath(new URL('../../',import.meta.url)),rootEnv=['.env','.env.local','.env.production','.env.production.local'].some(name=>existsSync(path.join(frontend,name))),values=loadEnv('production',rootEnv?frontend:path.join(frontend,'src'),'VITE_');
for(const name of ['VITE_API_URL','VITE_PRIVY_APP_ID','VITE_REOWN_PROJECT_ID']){
 const value=values[name];if(!value)throw Error('Missing public build value '+name);
 const existing=await github('/repos/Kennethnnamdi82/robina/actions/variables/'+name,{allow404:true});
 await github('/repos/Kennethnnamdi82/robina/actions/variables'+(existing?'/'+name:''),{method:existing?'PATCH':'POST',body:{name,value}});
 console.log('Configured public build variable',name);
}
