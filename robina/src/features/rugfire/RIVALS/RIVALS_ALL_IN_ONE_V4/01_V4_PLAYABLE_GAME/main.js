import {initBuilder,validateVault} from './builder.js';
const $=(s)=>document.querySelector(s), $$=(s)=>Array.from(document.querySelectorAll(s));
const asset=(p)=>`assets/${p}`;
let selectedZone='neon',selectedHero='vex',audioEnabled=true,game=null,raf=0,hackraf=0;
const IMAGE_CACHE=new Map();const SOUND_CACHE=new Map();const assetLoads=[];
const mapFiles={neon:'neon_district',phantom:'phantom_fortress',reactor:'reactor_siege'};
const mapNames={neon:'NEON DISTRICT',phantom:'PHANTOM FORTRESS',reactor:'REACTOR SIEGE',custom:'CREATOR VAULT'};
const zoneColors={neon:['#31dfff','#7e62fe'],phantom:['#b471ff','#fb489b'],reactor:['#62ffbc','#ffb058'],custom:['#31dfff','#ffc35b']};
function loadImage(k,path){const img=new Image();const p=new Promise(resolve=>{img.onload=()=>resolve(true);img.onerror=()=>resolve(false)});img.src=asset(path);IMAGE_CACHE.set(k,img);assetLoads.push(p);}
for(const hero of ['vex','nyx','rook'])for(const anim of ['walk','idle','attack','dash','hurt']){const frames=anim==='idle'?4:anim==='attack'||anim==='walk'?6:anim==='dash'?4:3;loadImage(`${hero}_${anim}`,`characters/${hero}_base_${anim}_${frames}x4.png`);}
for(const obj of ['terminal_off','terminal_on','vault_core','extraction_portal','laser_emitter','crate','vault_door','heal_station','loot_chest'])loadImage(obj,`props/${obj}.png`);
for(const z of ['neon','phantom','reactor'])loadImage('tiles_'+z,`tilesets/${z}_atlas_4x4.png`);
loadImage('drone','enemies/drone_idle_4x1.png');loadImage('guardian','bosses/guardian_idle_6x1.png');
const audioMap={hit:'player_hit',dash:'player_dash',slash:'player_swing',hack:'terminal_success',core:'vault_open',win:'extract_success'};
function sound(name){if(!audioEnabled)return;const n=audioMap[name];if(!n)return;let s=SOUND_CACHE.get(n);if(!s){s=new Audio(asset('audio/sfx/'+n+'.wav'));SOUND_CACHE.set(n,s)}try{const c=s.cloneNode();c.volume=.27;c.play().catch(()=>{});}catch{}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function switchScreen(s){$$('.screen').forEach(el=>el.classList.toggle('active',el.id===s));$$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===s));if(s!=='mission'){cancelAnimationFrame(raf);if(game){game.running=false;game=null;}$('#hack').classList.add('hidden');$('#modal').classList.add('hidden')}window.scrollTo({top:0,behavior:'instant'});}
$$('[data-nav]').forEach(b=>b.addEventListener('click',()=>switchScreen(b.dataset.nav)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>switchScreen(b.dataset.jump)));
$$('[data-zone]').forEach(b=>b.addEventListener('click',()=>{$$('[data-zone]').forEach(x=>x.classList.toggle('selected',x===b));selectedZone=b.dataset.zone}));
$$('[data-hero]').forEach(b=>b.addEventListener('click',()=>{$$('[data-hero]').forEach(x=>x.classList.toggle('selected',x===b));selectedHero=b.dataset.hero;$('#hero-name').textContent=`${selectedHero.toUpperCase()} / ${selectedHero==='vex'?'SHADOW RUNNER':selectedHero==='nyx'?'SPECTRE':'VANGUARD'}`;let portrait=$('#portrait');portrait.src=`art/${selectedHero}_premium_portrait.png`}));
$('#showbuilder').addEventListener('click',()=>switchScreen('builder'));$('#soundtoggle').addEventListener('click',()=>{audioEnabled=!audioEnabled;$('#soundtoggle').style.color=audioEnabled?'#c7e6fa':'#778092'});
const canvas=$('#gamecanvas');if(window.matchMedia('(max-width:720px)').matches){canvas.width=480;canvas.height=600;}const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;
const mini=$('#minicanvas'),mctx=mini.getContext('2d');
const KEYS=new Set();window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();KEYS.add(e.code);if(e.repeat)return;if(game?.running){if($('#hack').classList.contains('hidden')){if(e.code==='Escape'){game.paused=!game.paused;toast(game.paused?'PAUSED • ESC TO RESUME':'RESUMED');}if(e.code==='KeyE')interact();if(e.code==='Space')attack();if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash()}else{if(e.code==='Space')hackHit();if(e.code==='Escape')stopHack()}}});window.addEventListener('keyup',e=>KEYS.delete(e.code));window.addEventListener('blur',()=>{KEYS.clear();if(game?.running)game.paused=true});
let stick={x:0,y:0};const stickEl=$('#joystick'),thumb=$('#thumb');
function stickMove(e){const r=stickEl.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,m=Math.hypot(x,y)||1,k=Math.min(1,45/m);stick.x=x*k/45;stick.y=y*k/45;thumb.style.transform=`translate(${x*k}px,${y*k}px)`}
stickEl.addEventListener('pointerdown',e=>{stickEl.setPointerCapture(e.pointerId);stickMove(e)});stickEl.addEventListener('pointermove',e=>{if(stickEl.hasPointerCapture(e.pointerId))stickMove(e)});for(const k of ['pointerup','pointercancel'])stickEl.addEventListener(k,()=>{stick={x:0,y:0};thumb.style.transform=''});
$$('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();if(b.dataset.action==='attack')attack();if(b.dataset.action==='dash')dash();if(b.dataset.action==='interact')interact()}));
let lastToast=0;function toast(message){$('#toast').textContent=message;lastToast=performance.now()}
const COLLIDERADIUS=18;
function parseLevel(map,zone){const W=map.width,H=map.height,TILE=64;
 const cells=map.layers.find(l=>l.name==='Ground').data;
 const solid=map.layers.find(l=>l.name==='Solid').data;
 const hazard=map.layers.find(l=>l.name==='Hazard').data;
 const objects=map.layers.find(l=>l.name==='Objects').objects.map(o=>({...o,x:o.x/TILE+.5,y:o.y/TILE+.5,done:false,hp:o.type==='boss'?300:65}));
 return {width:W,height:H,tile:TILE,cells,solid,hazard,objects,zone};}
function parseBuilder(v){const W=v.width,H=v.height;const ground=v.cells.map(c=>c==='wall'?6:1);const solid=v.cells.map(c=>c==='wall'?1:0);return {width:W,height:H,tile:64,cells:ground,solid,hazard:new Array(W*H).fill(0),objects:v.objects.map((o,i)=>({name:`custom_${o.type}_${i}`,type:o.type,x:o.x+.5,y:o.y+.5,done:false,hp:65})),zone:'custom'};}
// Keep screen navigation and new session transitions atomic.
async function launch(custom=null){await Promise.all(assetLoads);let z=custom?'custom':selectedZone,map;
 try{if(custom)map=parseBuilder(custom);else{const response=await fetch(asset('maps/'+mapFiles[z]+'.json'));if(!response.ok)throw Error('Unable to load map');map=parseLevel(await response.json(),z)}}catch(e){alert('Could not load operation: '+e.message);return}
 switchScreen('mission');const spawn=map.objects.find(o=>o.type==='spawn')||{x:2,y:2};const now=performance.now();let ghost=null;try{ghost=JSON.parse(localStorage.getItem('rivals_best_'+z)||'null')}catch{}
 game={map,zone:z,hero:selectedHero,x:spawn.x*64,y:spawn.y*64,spawn:[spawn.x*64,spawn.y*64],vx:0,vy:0,face:0,hp:100,hurtTime:0,invUntil:0,dashUntil:0,dashCooldown:0,attackAt:0,attackUntil:0,kills:0,core:false,terminalCount:0,damage:0,elapsed:0,limit:210,running:true,paused:false,win:false,cameraX:0,cameraY:0,particles:[],shots:[],trace:[],ghost,lastFrame:now,lastHud:0,lastTrace:0,shotShots:0};
 map.objects.forEach((o,i)=>{o.done=false;o.hp=o.type==='boss'?250:70;o.phase=i*2.17;o.patrolX=o.x*64;o.patrolY=o.y*64;o.nextAttack=0;o.alarm=0;o.flash=0});
 $('#mission-zone').textContent=mapNames[z];$('#ghost-state').textContent=ghost?'GHOST: COMPETE WITH YOUR BEST RUN':'GHOST: FINISH A RAID TO RECORD ONE';toast('ACCESS GRANTED • Disable 2 terminals, steal the core, extract.');drawHUD();raf=requestAnimationFrame(frame);
}
$('#play').addEventListener('click',()=>launch());$('#exitmission').addEventListener('click',()=>switchScreen('lobby'));
const builder=initBuilder({onPlay:(v)=>launch(v)});
function canMove(x,y){const g=game;if(!g)return false;const m=g.map,T=m.tile;for(const ox of [-COLLIDERADIUS,COLLIDERADIUS])for(const oy of [-COLLIDERADIUS,COLLIDERADIUS]){const tx=Math.floor((x+ox)/T),ty=Math.floor((y+oy)/T);if(tx<0||ty<0||tx>=m.width||ty>=m.height||m.solid[ty*m.width+tx])return false;}return true}
function fireParticles(x,y,color,count=12){const g=game;if(!g)return;for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=30+Math.random()*175,life=.25+Math.random()*.55;g.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life,max:life,size:1+Math.random()*3,color});}if(g.particles.length>260)g.particles.splice(0,g.particles.length-260)}
function dash(){const g=game;if(!g||g.paused||g.finished||performance.now()<g.dashCooldown)return;g.dashUntil=performance.now()+185;g.dashCooldown=performance.now()+1750;g.invUntil=performance.now()+230;sound('dash');fireParticles(g.x,g.y,'#45dfff',16)}
function attack(){const g=game;if(!g||g.paused||g.finished||performance.now()<g.attackUntil)return;g.attackUntil=performance.now()+330;g.shotShots++;sound('slash');let didHit=false;for(const o of g.map.objects){if(!['enemy','boss'].includes(o.type)||o.done)continue;const dx=o.x*64-g.x,dy=o.y*64-g.y,d=Math.hypot(dx,dy),dir=Math.atan2(dy,dx),aim=[Math.PI/2,Math.PI,0,-Math.PI/2][g.face],diff=Math.abs(Math.atan2(Math.sin(dir-aim),Math.cos(dir-aim)));if(d<110&&diff<1.28){o.hp-=o.type==='boss'?34:39;o.flash=performance.now()+140;fireParticles(o.x*64,o.y*64,'#ffbc58',16);didHit=true;if(o.hp<=0){o.done=true;g.kills++;fireParticles(o.x*64,o.y*64,'#ff587a',28);}}}if(didHit){g.attackUntil=performance.now()+440}}
function damage(amount){const g=game;if(!g||g.finished||performance.now()<g.invUntil)return;g.hp=Math.max(0,g.hp-amount);g.damage+=amount;g.invUntil=performance.now()+800;g.hurtTime=performance.now()+280;sound('hit');fireParticles(g.x,g.y,'#ff607b',15);if(g.hp<=0)finish(false)}
function nearby(){const g=game;if(!g)return null;let best=null,dist=95;for(const o of g.map.objects){if(o.done||!['terminal','core','extraction','heal_station'].includes(o.type))continue;const d=Math.hypot(o.x*64-g.x,o.y*64-g.y);if(d<dist){best=o;dist=d}}return best}
let hacking=null;
function interact(){const g=game;if(!g||g.paused||g.finished||hacking)return;const o=nearby();if(!o){toast('Approach a terminal, the Vault Core, or extraction');return}
 if(o.type==='terminal')return openHack(o);
 if(o.type==='core'){if(g.terminalCount<2){toast('SECURITY LOCKED • Disable both terminals first');return}o.done=true;g.core=true;fireParticles(o.x*64,o.y*64,'#ffdc56',35);sound('core');toast('VAULT CORE ACQUIRED • Escape to the extraction zone!')}
 if(o.type==='extraction'){if(!g.core){toast('Secure the Vault Core before extracting');return}finish(true)}
 if(o.type==='heal_station'){o.done=true;g.hp=Math.min(100,g.hp+35);toast('Health restored +35')}
}
function openHack(o){if(!game||game.paused)return;game.paused=true;hacking={object:o,start:performance.now(),progress:0,speed:1.7,center:.3,window:.24,phase:0};$('#hack').classList.remove('hidden');$('#hackprogress').textContent='0 / 3 CALIBRATIONS';$('#hacktarget').style.left='30%';$('#hacktarget').style.width='24%';hackraf=requestAnimationFrame(hackFrame)}
function hackFrame(){if(!hacking)return;let h=hacking;h.phase=(Math.sin((performance.now()-h.start)/1000*h.speed)+1)/2;$('#hackmarker').style.left=(h.phase*99)+'%';hackraf=requestAnimationFrame(hackFrame)}
function hackHit(){if(!hacking||!game)return;const h=hacking;if(Math.abs(h.phase-(h.center+h.window/2))<=h.window/2){h.progress++;$('#hackprogress').textContent=`${h.progress} / 3 CALIBRATIONS`;sound('hack');if(h.progress===3){h.object.done=true;game.terminalCount++;fireParticles(h.object.x*64,h.object.y*64,'#38f4bb',24);stopHack();toast(`SECURITY NODE BREACHED • ${game.terminalCount}/2 terminals`);return;}h.start=performance.now();h.center=.15+Math.random()*.57;h.window=.19-Math.min(.06,h.progress*.02);$('#hacktarget').style.left=(h.center*100)+'%';$('#hacktarget').style.width=(h.window*100)+'%';}
 else {damage(7);toast('BREACH FAILED • CALIBRATE AND TRY AGAIN');}}
function stopHack(){hacking=null;cancelAnimationFrame(hackraf);$('#hack').classList.add('hidden');if(game){game.paused=false;game.lastFrame=performance.now()}}
$('#hackhit').addEventListener('click',hackHit);$('#hackcancel').addEventListener('click',stopHack);
const maxWorld=()=>[game.map.width*64,game.map.height*64];
function update(dt,now){const g=game;if(!g||g.finished||g.paused)return;g.elapsed+=dt;if(g.elapsed>=g.limit){finish(false);return}
 const ix=(KEYS.has('KeyD')||KEYS.has('ArrowRight')?1:0)-(KEYS.has('KeyA')||KEYS.has('ArrowLeft')?1:0)+stick.x;
 const iy=(KEYS.has('KeyS')||KEYS.has('ArrowDown')?1:0)-(KEYS.has('KeyW')||KEYS.has('ArrowUp')?1:0)+stick.y;let l=Math.hypot(ix,iy),vx=l?ix/l:0,vy=l?iy/l:0;
 if(l>.1){g.face=Math.abs(vx)>Math.abs(vy)?(vx<0?1:2):(vy>0?0:3)}
 const speed=228*(now<g.dashUntil?3.1:1),mx=vx*speed*dt,my=vy*speed*dt;
 if(canMove(g.x+mx,g.y))g.x+=mx;if(canMove(g.x,g.y+my))g.y+=my;
 if(now<g.dashUntil&&l>.1&&Math.random()>.57)fireParticles(g.x,g.y,'#39d6ff',2);
 for(const o of g.map.objects){if(o.done)continue;const ex=o.x*64,ey=o.y*64,dist=Math.hypot(ex-g.x,ey-g.y);
  if(o.type==='enemy'){const tick=(now/1000)+o.phase;const d=dist; if(d<295&&d>50){const nx=ex+(g.x-ex)/d*58*dt,ny=ey+(g.y-ey)/d*58*dt;if(canMove(nx,ey))o.x=nx/64;if(canMove(o.x*64,ny))o.y=ny/64;}else if(d>=295){const nx=o.patrolX+Math.sin(tick*.8)*36,ny=o.patrolY+Math.cos(tick*.7)*32;if(canMove(nx,ny)){o.x=nx/64;o.y=ny/64;}}if(d<42)damage(12);if(d<300&&now>o.nextAttack){o.nextAttack=now+1900;o.alarm=now+450;const angle=Math.atan2(g.y-ey,g.x-ex);setTimeout(()=>{if(game!==g||g.finished||o.done)return;const v=205;g.shots.push({x:o.x*64,y:o.y*64,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,life:2.6,r:9,color:'#ff527e'});},430)}}
  if(o.type==='laser'&&dist<51&&Math.sin(now*.002+o.phase)>.1)damage(8);
  if(o.type==='boss'){if(dist<110)damage(17);if(dist<550&&now>o.nextAttack){o.nextAttack=now+2750;o.alarm=now+630;setTimeout(()=>{if(game!==g||g.finished||o.done)return;const angle=Math.atan2(g.y-o.y*64,g.x-o.x*64);for(let s=-2;s<=2;s++){const a=angle+s*.22;g.shots.push({x:o.x*64,y:o.y*64,vx:Math.cos(a)*175,vy:Math.sin(a)*175,life:3,r:13,color:'#ffab5b'})}},620)}}
 }
 g.shots=g.shots.filter(s=>s.life>0);for(const s of g.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;const tx=Math.floor(s.x/64),ty=Math.floor(s.y/64);if(tx<0||ty<0||tx>=g.map.width||ty>=g.map.height||g.map.solid[ty*g.map.width+tx]){s.life=0;continue}if(Math.hypot(s.x-g.x,s.y-g.y)<s.r+17){s.life=0;damage(s.r>10?17:10);fireParticles(s.x,s.y,s.color,10)}}
 const cx=Math.floor(g.x/64),cy=Math.floor(g.y/64);if(g.map.hazard[cy*g.map.width+cx])damage(8);
 g.particles=g.particles.filter(p=>p.life>0);for(const p of g.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=.965;p.vy*=.965;}
 if(now-g.lastTrace>=160){g.trace.push([Math.round(g.x),Math.round(g.y),Math.round(g.elapsed*100)/100]);g.lastTrace=now;if(g.trace.length>2500)g.trace.shift();}
 if(now-g.lastHud>150){drawHUD();g.lastHud=now;}
}
function drawHUD(){const g=game;if(!g)return;$('#health').textContent=Math.ceil(g.hp);$('#health-fill').style.width=g.hp+'%';$('#health-fill').style.background=g.hp<35?'linear-gradient(90deg,#fe6078,#ffbd65)':'linear-gradient(90deg,#43d9a0,#99ff77)';const t=Math.max(0,g.limit-g.elapsed);$('#time').textContent=`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;$('#score').textContent=score(g).toLocaleString();$('#tasks').innerHTML=`<div class="task"><span class="${g.terminalCount>=2?'done':'pending'}">${g.terminalCount>=2?'✓':'◇'}</span> Hack terminals ${g.terminalCount}/2</div><div class="task"><span class="${g.core?'done':'pending'}">${g.core?'✓':'◇'}</span> Recover Vault Core</div><div class="task"><span class="${g.core?'done':'pending'}">${g.core?'✓':'◇'}</span> Reach extraction</div>`;}
function score(g){return Math.max(0,Math.round(g.terminalCount*500+(g.core?650:0)+g.kills*180+(g.win?Math.max(0,g.limit-g.elapsed)*25:0)+500-g.damage*4));}
function finish(win){const g=game;if(!g||g.finished)return;g.finished=true;g.win=win;const s=score(g);if(win){const k='rivals_best_'+g.zone;const old=g.ghost;if(!old||s>old.score){const record={score:s,time:+g.elapsed.toFixed(2),trace:g.trace.slice(0,2200),zone:g.zone};try{localStorage.setItem(k,JSON.stringify(record))}catch{};$('#modaltitle').textContent='NEW PERSONAL BEST';}else $('#modaltitle').textContent='MISSION COMPLETE';sound('win')}else $('#modaltitle').textContent='MISSION FAILED';
 $('#modalover').textContent=win?'VAULT BREACHED // EXTRACTION SUCCESSFUL':'OPERATION INTERRUPTED';$('#modalmessage').innerHTML=`<strong style="color:#ffe077;font-size:29px">${s.toLocaleString()} POINTS</strong><br><span>${Math.floor(g.elapsed)}s elapsed • ${g.terminalCount}/2 terminals • ${g.kills} drones defeated</span><br><small>Local demonstration score only — not an onchain reward, rank, or payout.</small>`;$('#modal').classList.remove('hidden');}
$('#retry').addEventListener('click',()=>{if(game?.zone==='custom'){switchScreen('builder')}else launch()});$('#backlobby').addEventListener('click',()=>switchScreen('lobby'));
const ZOOM=.9;function drawSprite(name,frame,sx,sy,sw,sh,dx,dy,dw,dh){const img=IMAGE_CACHE.get(name);if(!img?.complete||!img.naturalWidth)return false;ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);return true;}
function render(now){const g=game;if(!g)return;const w=canvas.width,h=canvas.height;const m=g.map,worldW=m.width*64,worldH=m.height*64,scale=ZOOM;
 g.cameraX=clamp(g.x-w/2/scale,0,Math.max(0,worldW-w/scale));g.cameraY=clamp(g.y-h/2/scale,0,Math.max(0,worldH-h/scale));
 const [tint1,tint2]=zoneColors[g.zone];ctx.clearRect(0,0,w,h);ctx.fillStyle='#070d19';ctx.fillRect(0,0,w,h);ctx.save();ctx.scale(scale,scale);ctx.translate(-g.cameraX,-g.cameraY);
 const left=Math.max(0,Math.floor(g.cameraX/64)-1),top=Math.max(0,Math.floor(g.cameraY/64)-1),right=Math.min(m.width-1,Math.ceil((g.cameraX+w/scale)/64)+1),bottom=Math.min(m.height-1,Math.ceil((g.cameraY+h/scale)/64)+1);
 const img=IMAGE_CACHE.get('tiles_'+(g.zone==='custom'?'neon':g.zone));
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const i=y*m.width+x,gid=m.cells[i]||1,frame=Math.max(0,gid-1);if(img?.complete&&img.naturalWidth){ctx.drawImage(img,(frame%4)*64,Math.floor(frame/4)*64,64,64,x*64,y*64,64,64)}else{ctx.fillStyle=(x+y)%2?'#142336':'#132135';ctx.fillRect(x*64,y*64,64,64)}
  if(m.hazard[i]){ctx.fillStyle='#ff476522';ctx.fillRect(x*64+4,y*64+4,56,56);ctx.strokeStyle='#ff536b99';ctx.strokeRect(x*64+4,y*64+4,56,56)}
 }
 for(const o of m.objects){if(o.done)continue;const x=o.x*64,y=o.y*64;if(x<g.cameraX-150||y<g.cameraY-150||x>g.cameraX+w/scale+150||y>g.cameraY+h/scale+150)continue;
  if(o.type==='spawn')continue;
  if(['terminal','core','extraction','laser','crate','heal_station'].includes(o.type)){
   const im= o.type==='terminal'?'terminal_off':o.type==='core'?'vault_core':o.type==='extraction'?'extraction_portal':o.type==='laser'?'laser_emitter':o.type;
   if(o.type==='core'&&g.terminalCount<2){ctx.fillStyle='#000b';ctx.fillRect(x-35,y-37,70,74)}
   const floating=o.type==='core'?Math.sin(now*.004)*5:0;drawSprite(im,0,0,0,96,96,x-41,y-43+floating,82,82);
   if(o.type==='laser'){ctx.lineWidth=4;ctx.shadowBlur=18;ctx.shadowColor='#ff3d68';ctx.strokeStyle=Math.sin(now*.002+o.phase)>.1?'#ff507f':'#8c274555';ctx.beginPath();ctx.moveTo(x-20,y-24);ctx.lineTo(x+21,y+24);ctx.stroke();ctx.shadowBlur=0;}
   if(o.type==='extraction'){ctx.strokeStyle='#ad74ff77';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,34+Math.sin(now*.005)*6,0,Math.PI*2);ctx.stroke();}
   if(o.type==='terminal'&&Math.hypot(x-g.x,y-g.y)<95){ctx.font='800 10px Arial';ctx.fillStyle='#70ffdd';ctx.fillText('[ E ] HACK',x-27,y-58)}
  }
  if(['enemy','boss'].includes(o.type)){
   const size=o.type==='boss'?140:78;if(o.type==='boss'){drawSprite('guardian',0,Math.floor(now/180%6)*192,0,192,192,x-size/2,y-size*.65,size,size)}else{drawSprite('drone',0,Math.floor(now/150%4)*96,0,96,96,x-size/2,y-size*.57,size,size);}
   if(o.flash>now){ctx.fillStyle='#ffffff88';ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fill()}
   if(o.alarm>now){ctx.strokeStyle='#ff446e99';ctx.fillStyle='#ff466b15';ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,135,Math.atan2(g.y-y,g.x-x)-.35,Math.atan2(g.y-y,g.x-x)+.35);ctx.closePath();ctx.fill();ctx.stroke();}
   if(o.hp<(o.type==='boss'?250:70)){const width=o.type==='boss'?100:49;ctx.fillStyle='#0b1728';ctx.fillRect(x-width/2,y-53,width,5);ctx.fillStyle='#ff667b';ctx.fillRect(x-width/2,y-53,width*clamp(o.hp/(o.type==='boss'?250:70),0,1),5)}
  }
 }
 if(g.ghost?.trace){const sample=g.ghost.trace.findLast(a=>a[2]<=g.elapsed);if(sample){ctx.globalAlpha=.32;const frame=Math.floor(now/145)%6;const row=g.face;drawSprite(g.hero+'_walk',0,frame*96,row*96,96,96,sample[0]-50,sample[1]-72,100,100);ctx.globalAlpha=1;}}
 // player contact shadow and trail
 ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(g.x,g.y+18,27,10,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=tint1;ctx.globalAlpha=.75;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(g.x,g.y+16,28,13,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
 const attacking=now<g.attackUntil;const moving=KEYS.has('KeyW')||KEYS.has('KeyA')||KEYS.has('KeyS')||KEYS.has('KeyD')||KEYS.has('ArrowUp')||KEYS.has('ArrowDown')||KEYS.has('ArrowLeft')||KEYS.has('ArrowRight')||Math.hypot(stick.x,stick.y)>.1;const mode=attacking?'attack':moving?'walk':'idle';const frames=mode==='idle'?4:6;const frame=Math.floor(now/(mode==='attack'?65:110))%frames;
 ctx.save();if(now<g.invUntil&&Math.floor(now/65)%2)ctx.globalAlpha=.5;const used=drawSprite(g.hero+'_'+mode,0,frame*96,g.face*96,96,96,g.x-53,g.y-77,106,106);if(!used){ctx.fillStyle=tint1;ctx.beginPath();ctx.arc(g.x,g.y,19,0,Math.PI*2);ctx.fill()};ctx.restore();
 if(attacking){const angles=[Math.PI/2,Math.PI,0,-Math.PI/2];ctx.strokeStyle='#fcd36f';ctx.lineWidth=7;ctx.shadowColor='#ffd866';ctx.shadowBlur=25;ctx.beginPath();ctx.arc(g.x,g.y,67,angles[g.face]-.62,angles[g.face]+.62);ctx.stroke();ctx.shadowBlur=0}
 for(const sh of g.shots){ctx.shadowBlur=22;ctx.shadowColor=sh.color;ctx.fillStyle=sh.color;ctx.beginPath();ctx.arc(sh.x,sh.y,sh.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sh.x,sh.y,sh.r*.52,0,Math.PI*2);ctx.stroke();}
 for(const p of g.particles){ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.shadowBlur=0;
 ctx.restore();
 // Dynamic artistic lighting and color accents; world-space light pools follow objectives.
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const o of m.objects){if(o.done||!['core','terminal','extraction','boss','laser'].includes(o.type))continue;
  const ox=(o.x*64-g.cameraX)*scale,oy=(o.y*64-g.cameraY)*scale;
  if(ox<-240||oy<-240||ox>w+240||oy>h+240)continue;
  const col=o.type==='boss'?'255,65,56':o.type==='core'?'255,174,48':o.type==='terminal'?'27,190,255':o.type==='extraction'?'185,76,255':'251,55,85';
  let light=ctx.createRadialGradient(ox,oy,0,ox,oy,o.type==='boss'?210:115);light.addColorStop(0,`rgba(${col},.19)`);light.addColorStop(.37,`rgba(${col},.09)`);light.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=light;ctx.fillRect(ox-220,oy-220,440,440);
 }
 const px=(g.x-g.cameraX)*scale,py=(g.y-g.cameraY)*scale;let aura=ctx.createRadialGradient(px,py,0,px,py,130);aura.addColorStop(0,'rgba(48,171,255,.18)');aura.addColorStop(1,'rgba(48,171,255,0)');ctx.fillStyle=aura;ctx.fillRect(px-130,py-130,260,260);ctx.restore();
 // cinematic vignette and scanlines: low cost graphics over canvas
 const vignette=ctx.createRadialGradient(w/2,h/2,h*.12,w/2,h/2,w*.82);vignette.addColorStop(0,'#01040a00');vignette.addColorStop(1,'#02040aba');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='rgba(3,8,21,.055)';for(let y=0;y<h;y+=5)ctx.fillRect(0,y,w,1);
 if(g.paused){ctx.fillStyle='#050a18b9';ctx.fillRect(0,0,w,h);ctx.font='bold 50px Arial';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('PAUSED',w/2,h/2);ctx.font='16px Arial';ctx.fillText('Press ESC to resume',w/2,h/2+40);ctx.textAlign='left'}
 drawMini();
}
function drawMini(){const g=game;if(!g)return;const m=g.map,w=mini.width,h=mini.height,cw=w/m.width,ch=h/m.height;mctx.fillStyle='#0a182c';mctx.fillRect(0,0,w,h);for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){if(m.solid[y*m.width+x]){mctx.fillStyle='#54708b';mctx.fillRect(x*cw,y*ch,cw,ch)}}for(const o of m.objects){if(o.done)continue;if(o.type==='terminal')mctx.fillStyle='#29d9ff';else if(o.type==='core')mctx.fillStyle='#ffc94d';else if(o.type==='enemy'||o.type==='boss')mctx.fillStyle='#ff476b';else if(o.type==='extraction')mctx.fillStyle='#b57cff';else continue;mctx.beginPath();mctx.arc(o.x*cw,o.y*ch,2.2,0,Math.PI*2);mctx.fill()}mctx.fillStyle='#fff';mctx.beginPath();mctx.arc(g.x/64*cw,g.y/64*ch,3.6,0,Math.PI*2);mctx.fill();}
function frame(now){const g=game;if(!g||!g.running)return;const dt=Math.min(.033,(now-g.lastFrame)/1000||0);g.lastFrame=now;update(dt,now);render(now);raf=requestAnimationFrame(frame)}
const nftNames=['shadow_vex','neon_nyx','solar_rook','phantom_vault','guardian_core','genesis_badge','crimson_sentry','echo_relic','void_emblem'];for(const n of nftNames){let card=document.createElement('div');card.className='nftcard';card.innerHTML=`<img src="${asset('nft/cards/'+n+'.png')}" alt="${n.replaceAll('_',' ')}" loading="lazy"/><div><b>${n.replaceAll('_',' ').toUpperCase()}</b><small>Preview only • Not minted</small></div>`;$('#nftgrid').appendChild(card)}
window.__RIVALS_QA__={launch:()=>launch(),builder:()=>builder.getVault(),validate:()=>builder.validate(),state:()=>game&&{zone:game.zone,player:{x:game.x,y:game.y},health:game.hp,terminals:game.terminalCount,core:game.core,elapsed:game.elapsed,running:game.running},finish:()=>{if(game){game.core=true;finish(true)}},openBuilder:()=>switchScreen('builder')};
