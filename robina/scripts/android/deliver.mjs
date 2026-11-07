import {mkdtemp,writeFile,readFile,mkdir,chmod} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
if(process.env.CI!=='true'||!process.env.RUNNER_TEMP)throw Error('Delivery runs only on GitHub-hosted runners');
const repository=process.env.ANDROID_DISTRIBUTION_REPOSITORY;
if(repository!=='Kennethnnamdi82/rivals-heist-android')throw Error('Unexpected public distribution repository');
if(!process.env.ANDROID_DISTRIBUTION_SSH_KEY)throw Error('The distribution deploy key is missing');
const directory=await mkdtemp(path.join(process.env.RUNNER_TEMP,'rivals-delivery-')),keyFile=path.join(directory,'key'),hosts=path.join(directory,'known_hosts'),work=path.join(directory,'repository');
await writeFile(keyFile,process.env.ANDROID_DISTRIBUTION_SSH_KEY,{mode:0o600});await chmod(keyFile,0o600);
const keys=await(await fetch('https://api.github.com/meta',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)})).json();
if(!Array.isArray(keys.ssh_keys)||!keys.ssh_keys.length)throw Error('Could not verify GitHub SSH host keys');
await writeFile(hosts,keys.ssh_keys.map(key=>'github.com '+key).join('\n')+'\n');
const env={...process.env,GIT_SSH_COMMAND:`ssh -i "${keyFile}" -o UserKnownHostsFile="${hosts}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes`};
function git(args,cwd=directory){const result=spawnSync('git',args,{cwd,env,encoding:'utf8'});if(result.status!==0)throw Error('Distribution Git operation failed: '+args[0]+' '+result.stderr);return result.stdout.trim();}
try{
 git(['clone','--depth','1','git@github.com:'+repository+'.git',work]);
 const apk=await readFile('release/RIVALS-RIVAL-HEIST.apk'),manifest=JSON.parse(await readFile('release/android-release.json','utf8'));
 if(createHash('sha256').update(apk).digest('hex')!==manifest.sha256)throw Error('APK changed after verification');
 const branch=`delivery/android-${manifest.versionCode}-${String(process.env.GITHUB_SHA).slice(0,12)}`;
 if(!/^delivery\/android-\d+-[a-f0-9]{12}$/.test(branch))throw Error('Invalid delivery branch');
 git(['checkout','--orphan',branch],work);await mkdir(path.join(work,'payload'));
 // Separate public binary-only branches avoid putting private source or large
 // APK history on main. Chunks stay below GitHub's per-file Git size limit.
 for(let offset=0,index=0;offset<apk.length;offset+=32*1024*1024,index++)await writeFile(path.join(work,'payload',String(index).padStart(4,'0')+'.part'),apk.subarray(offset,offset+32*1024*1024));
 await writeFile(path.join(work,'payload','android-release.json'),JSON.stringify(manifest,null,2)+'\n');
 git(['config','user.name','RIVALS Android Release'],work);git(['config','user.email','android-release@users.noreply.github.com'],work);
 git(['add','--','payload'],work);git(['commit','-m','Deliver verified Android '+manifest.versionName],work);git(['push','origin','HEAD:refs/heads/'+branch],work);
 console.log('Delivered verified APK to public release workflow',branch);
}finally{await writeFile(keyFile,'');}
