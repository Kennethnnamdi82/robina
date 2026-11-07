// One-time owner-authorized setup. Never prints credentials and never copies a
// personal GitHub token into CI. CI gets only a deploy key for the public APK repo
import forge from 'node-forge';
import sodium from 'libsodium-wrappers';
import {createHash,generateKeyPairSync,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadEnv} from 'vite';
import {github,githubToken} from './github-client.mjs';
const SOURCE='Kennethnnamdi82/robina',PUBLIC='Kennethnnamdi82/rivals-heist-android',token=githubToken();
const api=(url,options={})=>github(url,{...options,token});
const frontend=fileURLToPath(new URL('../../',import.meta.url)),repo=path.resolve(frontend,'..'),directory=path.join(repo,'.android-tools','signing'),backupFile=path.join(directory,'recovery.json');
const source=await api('/repos/'+SOURCE);if(!source.permissions?.admin)throw Error('Repository administrator permission is required');
await mkdir(directory,{recursive:true,mode:0o700});
if(process.platform==='win32'){
 const escaped=directory.replaceAll("'","''"),script=`$p='${escaped}';$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false);$id=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl.SetOwner($id);$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule);Set-Acl -LiteralPath $p -AclObject $acl`;
 const secured=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8'});
 if(secured.status!==0)throw Error('Could not protect the local signing recovery folder — no keys were generated');
}
const secretList=await api('/repos/'+SOURCE+'/actions/secrets'),names=new Set(secretList.secrets.map(s=>s.name));
const signingNames=['ANDROID_KEYSTORE_BASE64','ANDROID_STORE_PASSWORD','ANDROID_KEY_PASSWORD','ANDROID_KEY_ALIAS'];
let recovery=existsSync(backupFile)?JSON.parse(await readFile(backupFile,'utf8')):null;
if(!recovery){
 if(signingNames.some(name=>names.has(name)))throw Error('Existing Android signing secrets detected; refusing to replace an unrecoverable signing identity');
 const keys=forge.pki.rsa.generateKeyPair(4096),certificate=forge.pki.createCertificate(),password=randomBytes(36).toString('base64url'),alias='rivals-production';
 certificate.publicKey=keys.publicKey;certificate.serialNumber='01'+randomBytes(16).toString('hex');certificate.validity.notBefore=new Date(Date.now()-86400000);certificate.validity.notAfter=new Date();certificate.validity.notAfter.setFullYear(certificate.validity.notAfter.getFullYear()+30);
 const identity=[{name:'commonName',value:'RIVALS RIVAL HEIST Android Release'},{name:'organizationName',value:'RIVALS'}];certificate.setSubject(identity);certificate.setIssuer(identity);certificate.setExtensions([{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true}]);certificate.sign(keys.privateKey,forge.md.sha256.create());
 const p12=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[certificate],password,{algorithm:'3des',count:200000,friendlyName:alias})).getBytes(),der=Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes(),'binary');
 const ssh=generateKeyPairSync('rsa',{modulusLength:4096,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const {createPublicKey}=await import('node:crypto'),jwk=createPublicKey(ssh.publicKey).export({format:'jwk'}),part=value=>{const size=Buffer.alloc(4);size.writeUInt32BE(value.length);return Buffer.concat([size,value]);},integer=value=>{let bytes=Buffer.from(value,'base64url');if(bytes[0]&128)bytes=Buffer.concat([Buffer.from([0]),bytes]);return part(bytes);};
 const publicKey='ssh-rsa '+Buffer.concat([part(Buffer.from('ssh-rsa')),integer(jwk.e),integer(jwk.n)]).toString('base64')+' rivals-android-distribution';
 recovery={version:1,applicationId:'com.venomee.rivalsheist',keystore:Buffer.from(p12,'binary').toString('base64'),password,alias,certificateSha256:createHash('sha256').update(der).digest('hex'),distributionPrivateKey:ssh.privateKey,distributionPublicKey:publicKey};
 await writeFile(backupFile,JSON.stringify(recovery),{mode:0o600,flag:'wx'});
 console.log('Generated persistent signing identity; protected recovery backup saved locally (contents not displayed)');
}
let distribution=await api('/repos/'+PUBLIC,{allow404:true});
if(!distribution){distribution=await api('/user/repos',{method:'POST',body:{name:'rivals-heist-android',description:'Official signed RIVALS Android binary distribution — source code is not included',private:false,auto_init:true,has_issues:false,has_projects:false,has_wiki:false}});console.log('Created public binary-only distribution repository');}
if(distribution.private||!distribution.permissions?.admin)throw Error('Distribution repository must be public and owned by this account; visibility was not changed');
if(distribution.fork||!distribution.description?.startsWith('Official signed RIVALS Android binary distribution'))throw Error('Existing repository is not the expected APK distribution repository — refusing to overwrite unrelated files');
const publicKey=await api('/repos/'+SOURCE+'/actions/secrets/public-key');await sodium.ready;
async function secret(name,value){const encrypted=sodium.crypto_box_seal(sodium.from_string(value),sodium.from_base64(publicKey.key,sodium.base64_variants.ORIGINAL));await api('/repos/'+SOURCE+'/actions/secrets/'+name,{method:'PUT',body:{key_id:publicKey.key_id,encrypted_value:sodium.to_base64(encrypted,sodium.base64_variants.ORIGINAL)}});}
const values={ANDROID_KEYSTORE_BASE64:recovery.keystore,ANDROID_STORE_PASSWORD:recovery.password,ANDROID_KEY_PASSWORD:recovery.password,ANDROID_KEY_ALIAS:recovery.alias,ANDROID_DISTRIBUTION_SSH_KEY:recovery.distributionPrivateKey};
for(const [name,value]of Object.entries(values))if(!names.has(name))await secret(name,value);
const deployKeys=await api('/repos/'+PUBLIC+'/keys');if(!deployKeys.some(key=>key.key.split(' ').slice(0,2).join(' ')===recovery.distributionPublicKey.split(' ').slice(0,2).join(' ')))await api('/repos/'+PUBLIC+'/keys',{method:'POST',body:{title:'RIVALS private build to public APK delivery',key:recovery.distributionPublicKey,read_only:false}});
const hasRootEnv=['.env','.env.local','.env.production','.env.production.local'].some(name=>existsSync(path.join(frontend,name))),env=loadEnv('production',hasRootEnv?frontend:path.join(frontend,'src'),'VITE_');
const variables={VITE_API_URL:env.VITE_API_URL,VITE_PRIVY_APP_ID:env.VITE_PRIVY_APP_ID,VITE_REOWN_PROJECT_ID:env.VITE_REOWN_PROJECT_ID,ANDROID_CERT_SHA256:recovery.certificateSha256,ANDROID_DISTRIBUTION_REPOSITORY:PUBLIC};
for(const [name,value]of Object.entries(variables)){
 if(!value)throw Error('Missing public build setting '+name);
 const existing=await api('/repos/'+SOURCE+'/actions/variables/'+name,{allow404:true});
 if(name==='ANDROID_CERT_SHA256'&&existing?.value&&existing.value!==value)throw Error('Signing certificate mismatch — refusing to rotate the update identity');
 await api('/repos/'+SOURCE+'/actions/variables'+(existing?'/'+name:''),{method:existing?'PATCH':'POST',body:{name,value}});
}
async function publicFile(name,content){const existing=await api('/repos/'+PUBLIC+'/contents/'+name,{allow404:true});await api('/repos/'+PUBLIC+'/contents/'+name,{method:'PUT',body:{message:'Configure verified Android binary distribution',content:Buffer.from(content).toString('base64'),...(existing?{sha:existing.sha}:{})}});}
const workflow=(await readFile(new URL('./distribution-workflow.yml',import.meta.url),'utf8')).replace('__CERT_SHA256__',recovery.certificateSha256);
await publicFile('.github/workflows/publish.yml',workflow);
await publicFile('README.md','# RIVALS: RIVAL HEIST — Android\n\nOfficial signed Android binary distribution only — no game source in this repository\n\nDownload the newest production APK from [GitHub Releases](../../releases/latest) or the [official game website](https://rivals-heist.vercel.app)\n\nAndroid 7.0 or later — install updates over the previous official version to keep app data\n\nGame code, third-party libraries and supplied assets retain their respective ownership and licenses\n');
console.log(JSON.stringify({source:SOURCE,distribution:PUBLIC,certificateSha256:recovery.certificateSha256,signingBackup:backupFile,personalTokenCopiedToCI:false}));
