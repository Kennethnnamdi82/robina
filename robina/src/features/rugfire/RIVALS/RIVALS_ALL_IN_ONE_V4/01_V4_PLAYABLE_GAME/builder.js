// RIVALS VAULT ARCHITECT - local authoring demo (not a secure publishing backend)
export const BWIDTH = 24, BHEIGHT = 14;
const SOLIDS = new Set(['wall']);
const SINGLE = new Set(['spawn','core','extraction']);
const LIMITS = {wall:85,enemy:8,laser:20,terminal:2,core:1,spawn:1,extraction:1};
export function starterVault(){
 const cells=Array.from({length:BWIDTH*BHEIGHT},()=> 'floor');
 for(let y=0;y<BHEIGHT;y++) for(let x=0;x<BWIDTH;x++){
  if(x===0||y===0||x===BWIDTH-1||y===BHEIGHT-1)cells[y*BWIDTH+x]='wall';
 }
 for(let y=3;y<11;y++){if(y!==6)cells[y*BWIDTH+9]='wall';}
 return {name:'My First Vault',version:1,width:BWIDTH,height:BHEIGHT,cells,objects:[
 {type:'spawn',x:2,y:6},{type:'terminal',x:6,y:3},{type:'terminal',x:17,y:10},
 {type:'core',x:20,y:3},{type:'extraction',x:2,y:11},{type:'enemy',x:13,y:6},{type:'enemy',x:17,y:5},
 {type:'laser',x:11,y:6},{type:'laser',x:15,y:8}]};
}
function key(x,y){return y*BWIDTH+x}
export function validateVault(v){
 const errors=[],counts={};
 if(v.width!==BWIDTH||v.height!==BHEIGHT||!Array.isArray(v.cells)||v.cells.length!==BWIDTH*BHEIGHT||!Array.isArray(v.objects))return {valid:false,errors:['Invalid vault JSON structure. Require 24×14 grid and objects array.']};
 for(const cell of v.cells) if(!['floor','wall'].includes(cell))errors.push('Unknown tile present.');
 for(const c of v.cells)counts[c]=(counts[c]??0)+1;
 if(counts.wall>LIMITS.wall)errors.push(`Wall budget exceeded: ${counts.wall}/${LIMITS.wall}.`);
 for(const o of v.objects){
  if(!o||!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<1||o.y<1||o.x>=BWIDTH-1||o.y>=BHEIGHT-1||!Object.keys(LIMITS).includes(o.type)||o.type==='wall') {errors.push('Invalid object coordinates/type.');continue;}
  counts[o.type]=(counts[o.type]??0)+1;
  if(v.cells[key(o.x,o.y)]==='wall')errors.push(`${o.type} overlaps a wall.`);
 }
 for(const [type,limit] of Object.entries(LIMITS))if((counts[type]??0)>limit)errors.push(`Too many ${type}: ${counts[type]}/${limit}.`);
 for(const t of ['spawn','core','extraction'])if((counts[t]??0)!==1)errors.push(`Exactly one ${t} is required.`);
 if((counts.terminal??0)!==2)errors.push('Exactly two terminals are required.');
 const unique=new Set();for(const o of v.objects){if(!o||!Number.isInteger(o.x)||!Number.isInteger(o.y))continue;const k=`${o.x},${o.y}`;if(unique.has(k))errors.push('Overlapping objects detected.');unique.add(k)}
 if(errors.length)return {valid:false,errors:[...new Set(errors)]};
 const start=v.objects.find(o=>o.type==='spawn');const q=[[start.x,start.y]], seen=new Set([`${start.x},${start.y}`]);
 for(let h=0;h<q.length;h++){const [x,y]=q[h];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;
  if(nx<0||ny<0||nx>=BWIDTH||ny>=BHEIGHT||seen.has(k)||v.cells[key(nx,ny)]==='wall')continue;
  seen.add(k);q.push([nx,ny]);
 }}
 for(const o of v.objects.filter(o=>['core','terminal','extraction'].includes(o.type)))if(!seen.has(`${o.x},${o.y}`))errors.push(`${o.type} at (${o.x}, ${o.y}) is unreachable.`);
 return {valid:errors.length===0,errors,reachable:seen.size,counts};
}
export function initBuilder({onPlay}){
 const canvas=document.getElementById('buildercanvas'),ctx=canvas.getContext('2d');let vault=starterVault();let tile='floor',drawing=false;
 const colors={floor:'#18263d',wall:'#32435b',laser:'#ff4e78',enemy:'#ef973f',terminal:'#50d7fb',core:'#ffda59',spawn:'#58ecb6',extraction:'#ad76ff'};
 function draw(){
  const w=canvas.width/BWIDTH,h=canvas.height/BHEIGHT;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0c1729';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<BHEIGHT;y++)for(let x=0;x<BWIDTH;x++){
    const px=x*w,py=y*h,cell=vault.cells[key(x,y)];ctx.fillStyle=(x+y)%2?'#16263b':'#132236';ctx.fillRect(px,py,w,h);
    ctx.strokeStyle='#304a61';ctx.lineWidth=.65;ctx.strokeRect(px+.2,py+.2,w-.4,h-.4);
    if(cell==='wall'){ctx.fillStyle='#263951';ctx.fillRect(px+3,py+3,w-6,h-6);ctx.strokeStyle='#6d83ac';ctx.lineWidth=1.5;ctx.strokeRect(px+5,py+5,w-10,h-10);ctx.fillStyle='#071c2d';ctx.fillRect(px+9,py+9,w-18,h-18);}
  }
  for(const o of vault.objects){const cx=(o.x+.5)*w,cy=(o.y+.5)*h,c=colors[o.type]||'#fff';ctx.shadowColor=c;ctx.shadowBlur=17;ctx.fillStyle=c;ctx.strokeStyle=c;ctx.lineWidth=3;
   if(o.type==='laser'){ctx.beginPath();ctx.moveTo(cx-11,cy-12);ctx.lineTo(cx+11,cy+12);ctx.moveTo(cx+11,cy-12);ctx.lineTo(cx-11,cy+12);ctx.stroke();}
   else if(o.type==='terminal'){ctx.fillRect(cx-10,cy-10,20,20);ctx.fillStyle='#173044';ctx.fillRect(cx-6,cy-6,12,12)}
   else if(o.type==='spawn'){ctx.beginPath();ctx.moveTo(cx+12,cy);ctx.lineTo(cx-9,cy-9);ctx.lineTo(cx-9,cy+9);ctx.fill()}
   else if(o.type==='core'){ctx.beginPath();ctx.moveTo(cx,cy-14);ctx.lineTo(cx+12,cy);ctx.lineTo(cx,cy+14);ctx.lineTo(cx-12,cy);ctx.closePath();ctx.fill()}
   else if(o.type==='extraction'){ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.stroke()}
   else {ctx.beginPath();ctx.arc(cx,cy,9,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
  }
 }
 function key(x,y){return y*BWIDTH+x}
 function place(e){const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*BWIDTH),y=Math.floor((e.clientY-r.top)/r.height*BHEIGHT);
  if(x<=0||x>=BWIDTH-1||y<=0||y>=BHEIGHT-1)return;
  if(tile==='floor'){vault.cells[key(x,y)]='floor';vault.objects=vault.objects.filter(o=>o.x!==x||o.y!==y)}
  else if(tile==='wall'){vault.cells[key(x,y)]='wall';vault.objects=vault.objects.filter(o=>o.x!==x||o.y!==y)}
  else {vault.cells[key(x,y)]='floor';vault.objects=vault.objects.filter(o=>o.x!==x||o.y!==y);if(SINGLE.has(tile))vault.objects=vault.objects.filter(o=>o.type!==tile);vault.objects.push({type:tile,x,y});}
  document.getElementById('build-status').textContent='Vault modified • validate before testing';draw();
 }
 canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);place(e)});
 canvas.addEventListener('pointermove',e=>{if(drawing&&['wall','floor'].includes(tile))place(e)});
 ['pointerup','pointercancel'].forEach(n=>canvas.addEventListener(n,()=>drawing=false));
 document.querySelectorAll('[data-tile]').forEach(b=>b.addEventListener('click',()=>{tile=b.dataset.tile;document.querySelectorAll('[data-tile]').forEach(x=>x.classList.toggle('selected',x===b))}));
 document.getElementById('builder-reset').addEventListener('click',()=>{vault=starterVault();draw();document.getElementById('validation-details').textContent='Reset to the original sample vault.'});
 document.getElementById('builder-validate').addEventListener('click',()=>{const r=validateVault(vault);document.getElementById('validation-details').textContent=r.valid?`✓ VALID VAULT\n${r.reachable} reachable cells\n${vault.objects.length} interactive objects`:`✕ FIX THESE:\n${r.errors.join('\n')}`;document.getElementById('build-status').textContent=r.valid?'Vault is structurally valid. Test-run required for publication.':'Validation found issues.'});
 document.getElementById('builder-export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...vault,exportedAt:new Date().toISOString(),securityNote:'Client-only data, must be server-validated'},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='rivals-custom-vault.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
 document.getElementById('builder-import').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!Array.isArray(obj.cells)||obj.cells.length!==BWIDTH*BHEIGHT||!Array.isArray(obj.objects)||obj.objects.length>200||JSON.stringify(obj).length>100000)throw new Error('Invalid file');vault={name:String(obj.name||'Imported Vault').slice(0,60),version:1,width:BWIDTH,height:BHEIGHT,cells:obj.cells,objects:obj.objects};draw();document.getElementById('builder-validate').click()}catch(err){document.getElementById('validation-details').textContent='Import rejected: '+err.message}e.target.value=''});
 document.getElementById('builder-test').addEventListener('click',()=>{const r=validateVault(vault);document.getElementById('builder-validate').click();if(r.valid)onPlay(structuredClone(vault));});
 draw();return {getVault:()=>structuredClone(vault),validate:()=>validateVault(vault),draw};
}
