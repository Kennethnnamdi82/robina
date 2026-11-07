import {spawnSync} from 'node:child_process';

export function githubToken(){
  if(process.env.GH_TOKEN||process.env.GITHUB_TOKEN)return process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
  const result=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\npath=Kennethnnamdi82/robina.git\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});
  const fields=Object.fromEntries((result.stdout||'').trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
  if(!fields.password)throw Error('GitHub authentication is required — credentials were not printed or stored');
  return fields.password;
}
export async function github(path,{method='GET',body,token=githubToken(),allow404=false}={}){
  if(!path.startsWith('/')||path.startsWith('//'))throw Error('GitHub API path must be relative');
  const response=await fetch('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  if(allow404&&response.status===404)return null;
  const value=response.status===204?null:await response.json();
  if(!response.ok)throw Error('GitHub '+method+' '+path+': '+response.status+' '+String(value?.message||'request failed'));
  return value;
}
