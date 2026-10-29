import Phaser from 'phaser';
import './style.css';

type Kind = 'terminal' | 'core' | 'extraction' | 'enemy' | 'boss' | 'laser' | 'spawn' | 'crate';
type LevelObject = { name: string; type: Kind; x: number; y: number; properties?: { name: string; value: unknown }[] };
type MapData = { width: number; height: number; tilewidth: number; tileheight: number; layers: { name: string; data?: number[]; objects?: LevelObject[] }[] };

type DemoControls = { dx: number; dy: number; dash: boolean; attack: boolean; interact: boolean };
const touch: DemoControls = {dx:0,dy:0,dash:false,attack:false,interact:false};
const el = (id: string) => document.getElementById(id) as HTMLElement;
const toast = (msg: string) => {el('toast').textContent = msg;};

function bindTouch() {
  const pad=el('stick'); const knob=el('knob');
  const reset=()=>{touch.dx=0;touch.dy=0;knob.style.transform='translate(0px,0px)';};
  const update=(ev:PointerEvent)=>{const r=pad.getBoundingClientRect();const x=ev.clientX-(r.left+r.width/2), y=ev.clientY-(r.top+r.height/2);const s=Math.min(1,54/Math.max(1,Math.hypot(x,y)));touch.dx=x*s/54;touch.dy=y*s/54;knob.style.transform=`translate(${x*s}px,${y*s}px)`;};
  pad.addEventListener('pointerdown',e=>{pad.setPointerCapture(e.pointerId);update(e);});
  pad.addEventListener('pointermove',e=>{if(pad.hasPointerCapture(e.pointerId))update(e);});
  pad.addEventListener('pointerup',reset); pad.addEventListener('pointercancel',reset);
  document.querySelectorAll<HTMLButtonElement>('[data-btn]').forEach(button=>{const k=button.dataset.btn as 'dash'|'attack'|'interact';button.addEventListener('pointerdown',event=>{event.preventDefault();touch[k]=true;});button.addEventListener('pointerup',()=>{touch[k]=false;});button.addEventListener('pointercancel',()=>{touch[k]=false;});button.addEventListener('pointerleave',()=>{touch[k]=false;});});
}
bindTouch();

class Heist extends Phaser.Scene {
  private actor!: Phaser.Physics.Arcade.Sprite;
  private keys!: Record<string,Phaser.Input.Keyboard.Key>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private objects: {kind:Kind; name:string; sprite:Phaser.GameObjects.Image; done:boolean}[] = [];
  private obstacles:Phaser.GameObjects.Rectangle[]=[];
  private hp=100;private terminals=0;private hasCore=false;private finished=false;private startedAt=0;private lastDamage=0;private lastAttack=0;private lastDash=0;private remaining=210;private accumulatedDamage=0;private enemiesKilled=0;
  private facing=0;private missionMap!:MapData;
  constructor(){super('Heist');}
  preload(){
    this.load.json('level','/assets/maps/neon_district.json');
    this.load.spritesheet('tiles','/assets/tilesets/neon_atlas_4x4.png',{frameWidth:64,frameHeight:64});
    for(const n of ['terminal_off','terminal_on','vault_core','extraction_portal','laser_emitter','crate'])this.load.image(n,`/assets/props/${n}.png`);
    this.load.spritesheet('vex','/assets/characters/vex_base_walk_6x4.png',{frameWidth:96,frameHeight:96});
    this.load.spritesheet('vex_idle','/assets/characters/vex_base_idle_4x4.png',{frameWidth:96,frameHeight:96});
    this.load.spritesheet('vex_attack','/assets/characters/vex_base_attack_6x4.png',{frameWidth:96,frameHeight:96});
    this.load.spritesheet('drone','/assets/enemies/drone_idle_4x1.png',{frameWidth:96,frameHeight:96});
    for(const s of ['player_swing','player_hit','player_dash','terminal_success','vault_open','extract_success','drone_alert'])this.load.audio(s,`/assets/audio/sfx/${s}.wav`);
  }
  create(){
    el('result').classList.add('hidden');this.finished=false;this.hp=100;this.terminals=0;this.hasCore=false;this.accumulatedDamage=0;this.enemiesKilled=0;
    this.remaining=210;this.startedAt=this.time.now;this.lastDamage=0;this.lastAttack=0;this.lastDash=0;this.objects=[];this.obstacles=[];
    this.missionMap=this.cache.json.get('level') as MapData;
    const data=this.missionMap, ground=data.layers.find(l=>l.name==='Ground')?.data ?? [], solid=data.layers.find(l=>l.name==='Solid')?.data ?? [], hazard=data.layers.find(l=>l.name==='Hazard')?.data ?? [];
    this.walls=this.physics.add.staticGroup();
    // Directly render the Tiled atlas GIDs (0 = empty). No dependency on Tiled tileset property conventions.
    for(let y=0;y<data.height;y++)for(let x=0;x<data.width;x++){
      const i=y*data.width+x,gid=ground[i];if(gid){this.add.image(x*64+32,y*64+32,'tiles',gid-1).setOrigin(.5).setDepth(0);}
      // Correct atlas frame extraction handled with separate 64x64 images below; sprite-sheet registration in preload.
      if(solid[i]){const wall=this.add.zone(x*64+32,y*64+32,64,64);this.physics.add.existing(wall,true);this.walls.add(wall);}
      if(hazard[i]){const strip=this.add.rectangle(x*64+32,y*64+32,47,47,0xff5163,.22).setDepth(1);this.obstacles.push(strip);}
    }
    this.physics.world.setBounds(0,0,data.width*64,data.height*64);
    const named=data.layers.find(l=>l.name==='Objects')?.objects ?? [];
    const spawn=named.find(o=>o.type==='spawn')?? {x:128,y:128};
    this.actor=this.physics.add.sprite(spawn.x+32,spawn.y+32,'vex',0).setDepth(11);
    this.actor.body?.setSize(36,48).setOffset(30,35);
    this.actor.setCollideWorldBounds(true);
    this.physics.add.collider(this.actor,this.walls);
    for(let dir=0;dir<4;dir++)for(const [mode,frames,key] of [['walk',6,'vex'],['idle',4,'vex_idle'],['attack',6,'vex_attack']] as const){
      this.anims.create({key:`${mode}_${dir}`,frames:this.anims.generateFrameNumbers(key,{start:dir*frames,end:dir*frames+frames-1}),frameRate:mode==='walk'?10:7,repeat:mode==='attack'?0:-1});
    }
    this.anims.create({key:'drone_hover',frames:this.anims.generateFrameNumbers('drone',{start:0,end:3}),frameRate:6,repeat:-1});
    this.enemies=this.physics.add.group();
    for(const o of named){
      if(o.type==='enemy'){
        const e=this.physics.add.sprite(o.x+32,o.y+32,'drone').setDepth(10);
        e.body?.setSize(42,42).setOffset(27,27);e.play('drone_hover');e.setData('hp',60);e.setData('startX',e.x);e.setData('startY',e.y);e.setData('lastHit',-1000);this.enemies.add(e);this.physics.add.collider(e,this.walls);
      } else if(['terminal','core','extraction','laser','crate'].includes(o.type)){
        const key=o.type==='terminal'?'terminal_off':o.type==='core'?'vault_core':o.type==='extraction'?'extraction_portal':o.type==='laser'?'laser_emitter':'crate';
        const spr=this.add.image(o.x+32,o.y+32,key).setDisplaySize(74,74).setDepth(8);
        this.objects.push({kind:o.type,name:o.name,sprite:spr,done:false});
      }
    }
    this.cameras.main.setBounds(0,0,data.width*64,data.height*64);this.cameras.main.startFollow(this.actor,true,.12,.12);this.cameras.main.setZoom(1.05);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,E,R') as Record<string,Phaser.Input.Keyboard.Key>;
    toast('Hack both terminals, recover the Vault Core, and escape.');this.updateHUD();
  }
  private soundCue(name:string){try{this.sound.play(name,{volume:.25});}catch{/* browser may block until input gesture */}}
  private currentTime(){return Math.max(0,this.remaining-Math.floor((this.time.now-this.startedAt)/1000));}
  private updateHUD(){
    el('hp').textContent=`HP ${Math.max(0,Math.ceil(this.hp))}`;(el('hp-bar') as HTMLElement).style.width=`${this.hp}%`;
    const t=this.currentTime();el('clock').textContent=`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
    el('objective').textContent=`TERMINALS ${this.terminals}/2 • CORE ${this.hasCore?'✓':'–'}`;
    el('score').textContent=`SCORE ${this.calculateScore()}`;
  }
  private calculateScore(){return Math.max(0,1000+this.terminals*250+(this.hasCore?450:0)+this.currentTime()*15-this.accumulatedDamage*3+this.enemiesKilled*100);}
  private nearestInteract(){let nearest:typeof this.objects[number]|undefined;let dist=95;
    for(const ob of this.objects){if(ob.done)continue;const d=Phaser.Math.Distance.Between(this.actor.x,this.actor.y,ob.sprite.x,ob.sprite.y);if(d<dist && ob.kind!=='laser' && ob.kind!=='crate'){nearest=ob;dist=d;}}
    return nearest;
  }
  private interact(){
    const ob=this.nearestInteract();if(!ob){toast('Move closer to a terminal, core, or extraction point.');return;}
    if(ob.kind==='terminal'){ob.done=true;ob.sprite.setTexture('terminal_on');this.terminals++;this.soundCue('terminal_success');toast(`Security terminal hacked (${this.terminals}/2).`);}
    if(ob.kind==='core'){if(this.terminals<2){toast('Hack BOTH terminals to unlock the Vault Core.');return;}this.hasCore=true;ob.done=true;ob.sprite.setVisible(false);this.soundCue('vault_open');toast('Vault Core acquired! Run to extraction.');}
    if(ob.kind==='extraction'){if(!this.hasCore){toast('You need the Vault Core before extraction.');return;}this.end(true);}
  }
  private end(won:boolean){if(this.finished)return;this.finished=true;this.physics.pause();this.actor.setTint(won?0x58ffe1:0xff5279);this.soundCue(won?'extract_success':'player_hit');
    el('result-title').textContent=won?'MISSION COMPLETE':'MISSION FAILED';
    el('result-stats').textContent=won?`LOCAL DEMO SCORE ${this.calculateScore()} • TERMINALS 2/2 • CORE SECURED • ${this.currentTime()}s LEFT`:'Retry the mission and improve your approach.';
    el('result').classList.remove('hidden');
  }
  private hit(damage:number){if(this.time.now-this.lastDamage<950 ||this.finished)return;this.lastDamage=this.time.now;this.hp=Math.max(0,this.hp-damage);this.accumulatedDamage+=damage;this.actor.setTint(0xff6177);this.time.delayedCall(200,()=>{if(this.actor.active)this.actor.clearTint();});this.soundCue('player_hit');if(this.hp<=0)this.end(false);}
  private attack(){if(this.time.now-this.lastAttack<430)return;this.lastAttack=this.time.now;this.actor.play(`attack_${this.facing}`,true);this.soundCue('player_swing');
    for(const obj of this.enemies.getChildren()){
      const e=obj as Phaser.Physics.Arcade.Sprite;if(!e.active)continue;
      const d=Phaser.Math.Distance.Between(this.actor.x,this.actor.y,e.x,e.y);
      if(d<=100){const hp=(e.getData('hp') as number)-25;e.setData('hp',hp);e.setTint(0xffa77b);this.time.delayedCall(80,()=>{if(e.active)e.clearTint();});if(hp<=0){this.enemiesKilled++;e.destroy();}}
    }
  }
  update(_time:number,delta:number){
    if(this.finished||!this.actor?.active)return;
    const v=new Phaser.Math.Vector2();const key=this.keys;
    if(key.A.isDown||key.LEFT.isDown)v.x--;if(key.D.isDown||key.RIGHT.isDown)v.x++;if(key.W.isDown||key.UP.isDown)v.y--;if(key.S.isDown||key.DOWN.isDown)v.y++;
    v.x+=touch.dx;v.y+=touch.dy;if(v.length()>1)v.normalize();
    if(v.lengthSq()>0.01){this.facing=Math.abs(v.x)>Math.abs(v.y)?(v.x<0?1:2):(v.y>0?0:3);if(!this.actor.anims.currentAnim||!this.actor.anims.currentAnim.key.startsWith('attack')||!this.actor.anims.isPlaying){this.actor.play(`walk_${this.facing}`,true);}}
    else if(!this.actor.anims.currentAnim||!this.actor.anims.currentAnim.key.startsWith('attack')||!this.actor.anims.isPlaying){this.actor.play(`idle_${this.facing}`,true);}
    const dashDown=key.SHIFT.isDown||touch.dash;let speed=205;
    if(dashDown&&this.time.now-this.lastDash>1900){this.lastDash=this.time.now;this.soundCue('player_dash');}
    if(this.time.now-this.lastDash<210)speed*=2.8;
    this.actor.setVelocity(v.x*speed,v.y*speed);
    if(Phaser.Input.Keyboard.JustDown(key.SPACE)||touch.attack){this.attack();touch.attack=false;}
    if(Phaser.Input.Keyboard.JustDown(key.E)||touch.interact){this.interact();touch.interact=false;}
    if(this.currentTime()<=0){this.end(false);return;}
    for(const obj of this.enemies.getChildren()){
      const e=obj as Phaser.Physics.Arcade.Sprite;if(!e.active)continue;
      const dx=this.actor.x-e.x,dy=this.actor.y-e.y,d=Math.hypot(dx,dy);
      if(d<270&&d>2){e.setVelocity(dx/d*95,dy/d*95);}else e.setVelocity(0,0);
      if(d<48)this.hit(12);
    }
    // Hazard collisions are authored in the Tiled map and checked locally. Production must validate them server-side.
    for(const h of this.obstacles){if(Phaser.Math.Distance.Between(this.actor.x,this.actor.y,h.x,h.y)<34){this.hit(9);break;}}
    for(const ob of this.objects){if(ob.kind==='laser'&&Phaser.Math.Distance.Between(this.actor.x,this.actor.y,ob.sprite.x,ob.sprite.y)<40)this.hit(8);}
    this.updateHUD();
  }
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#0a132a',width:1080,height:680,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'arcade',arcade:{debug:false}},scene:[Heist],render:{pixelArt:false,antialias:true}});
el('restart').addEventListener('click',()=>{touch.attack=false;touch.interact=false;touch.dash=false;game.scene.stop('Heist');game.scene.start('Heist');});
