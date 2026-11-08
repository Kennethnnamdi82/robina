import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createActor, mountActor, disposeActor, type Actor } from '../../rugfire/actors';
import { RaidAssets } from './RaidAssets';
import { CameraRig, type POV } from './CameraRig';
import { WorldArt } from './WorldArt';
import { BODY, moveKinematic, traceSolids,horizontalContact, type Body3D } from './physics3d';
import { convertSolids, METRES, point3, validateConversion, type Solid3D } from './world3d';
import { Projectile3D, type Target3D } from './Projectile3D';
import type { SandboxSession } from './SandboxSession';
import { CharacterController } from '../characters/CharacterController';
import { emptyCommand } from '../input/InputBuffer';
import { InputManager } from '../input/InputManager';
import { WorldState } from '../world/WorldState';
import { VENUES } from './Operations';
import { NavigationGrid } from '../ai/navigation';
import { TacticalEnemy as EnemyController } from './TacticalEnemy';
import { BossController } from '../boss/BossController';
import type { DamageEvent } from '../combat/Health';
import { SecurityController } from '../security/SecurityController';
import { FrameMetrics } from '../rendering/FrameMetrics';
import type { GameAudio } from '../audio/GameAudio';
import type { QualityId } from '../core/presentation';
import { HumanoidAnimator, type HumanoidFrame } from './HumanoidAnimator';
import { dodgeMotionScale } from './dodgeMotion';
import { WeaponRig, FirstPersonWeapon, safeMuzzleOrigin } from './WeaponRig';
import { SecurityPresentation } from './SecurityPresentation';
import { CombatAudio } from './CombatAudio';
import { CombatEffects, MuzzleFlash } from './CombatEffects';
import { Loadout, EQUIPMENT, type EquipmentId } from './Loadout';
import { FieldItems, ENEMY_DROPS, HEALTH_BOXES, meleeStrike } from './FieldItems';
import { FieldArt } from './FieldArt';
import { CityAtmosphere } from './CityAtmosphere';
import { cityPlan, type CityWeather } from './LivingCityPlan';
import type { CityEnvironment } from './CityEnvironment';
import { CityPostProcess } from './CityPostProcess';
import {CameraFeedback} from './CameraFeedback';
import {AdaptiveResolution} from './AdaptiveResolution';
import {FrameSurface} from './FrameSurface';
import { assignmentAt } from '../missions/assignments';
import { addAssignmentWalls,AssignmentSite } from './AssignmentSite';
import { VehicleController,vehicleOverlap } from './VehicleController';
import { PolicePursuit } from './PolicePursuit';
import { CampaignGameplay } from './CampaignGameplay';
import type { EnemySpawn } from '../ai/definitions';
import { CityPeople } from './CityPeople';
import type { Civilian } from './CityCrowd';
import { MissionNavigation } from './MissionNavigation';
import { RoadGuide, routeBearing } from './RoadGuide';
import {WorldFires} from './WorldFires';
import {frameTiming} from './frameTiming';

interface CombatDiagnostics {
  inventory: ReturnType<Loadout['snapshot']>; field: ReturnType<FieldItems['snapshot']>; flashError: number;
  ready: boolean;
  fires?:WorldFires['snapshot'];
  view: { ads: boolean; fov: number; visible: boolean; hands: boolean; sight: number[]; yaw: number; pitch: number;feedback:CameraFeedback['snapshot'] };
  grip: number; support: number; supported: boolean; alignment: number; muzzle: number[];
  lastShot: { origin: number[]; muzzle: number[]; direction: number[]; blocked: boolean; serial: number } | null;
  audio: ReturnType<CombatAudio['snapshot']>; effects?: ReturnType<CombatEffects['snapshot']>;
  enemies: { id: string; dead: boolean; transitions: number; age: number; height: number; floorError: number; collider: boolean; visible: boolean; hits: number }[];
  boss: { dead: boolean; transitions: number; age: number; height: number; floorError: number } | null;
}

export interface Diagnostics3D { navigation?:{route:{x:number;y:number}[];distance:number;goal?:{x:number;y:number};bearing?:number;roadArrows?:number};vehicle?:VehicleController['snapshot'];pursuit?:PolicePursuit['snapshot'];campaign?:CampaignGameplay['snapshot'];environment?: CityEnvironment['stats']; combat?: CombatDiagnostics; pov: POV; zoom: number; fps: number; frameMs: number; calls: number; triangles: number; geometries: number; textures: number; dpr: number; quality: QualityId; x: number; y: number; z: number; grounded: boolean; enemies: number; runId: string; targets: { id: string; x: number; y: number; visible: boolean }[]; character?: { motion: string; clip: string; history: string[]; transition: string; speed: number; time: number; yaw: number; actions: number; leg: number[]; socket: number[]; visible: boolean; mixerTime: number } }
interface NPC { model: EnemyController; actor: Actor; target: Target3D; collider: Solid3D; presentation?: SecurityPresentation }
export class RaidRuntime {
  vehicles?:VehicleController;pursuit?:PolicePursuit;campaign?:CampaignGameplay;
  gps?:MissionNavigation;private roadGuide=new RoadGuide();private burning=new Map<string,number>();
  private assignmentSite?:AssignmentSite;private witnessArt?:CityPeople;private witnessPose?:Civilian;
  private vehicleTargets:Target3D[]=[];private drivingInput={throttle:0,steer:0,brake:false,stickX:0,stickY:0};private burnClock=0;
  private recoveryAge=0;private evidenceDropped=false;private recoveryPath:{x:number;y:number}[]=[];private recoveryRouteAge=1;
  private alertedShots=0;
  private vehicleBurnAge=0;private vehicleEventSerial=0;
  private fires?:WorldFires;private carriedCase?:T.Object3D;
  readonly scene = new T.Scene(); readonly renderer: T.WebGLRenderer; readonly rig = new CameraRig();
  readonly world: WorldState; readonly controller = new CharacterController(true); readonly loadout = new Loadout(); readonly field = new FieldItems();
  get weapon() { return this.loadout.current.controller; }
  readonly security: SecurityController; readonly pool = new Projectile3D(); readonly assets = new RaidAssets();
  readonly body: Body3D = { position: point3(288,288),vertical: 0,grounded: true };
  readonly solids: Solid3D[]; readonly navigation: NavigationGrid; readonly boss: BossController;
  private art: WorldArt; private player = createActor('player'); private bossActor = createActor('boss'); private npcs: NPC[] = [];
  private atmosphere:CityAtmosphere;
  private post:CityPostProcess;private surface:FrameSurface;private firstFrameReady?:()=>void;
  private humanoid?: HumanoidAnimator;
  private gun?: WeaponRig; private bossPresentation?: SecurityPresentation; private viewGun?: FirstPersonWeapon; private effects?: CombatEffects;
  private combatAudio: CombatAudio; private viewScene = new T.Scene(); private viewCamera = new T.PerspectiveCamera(72,1,.025,8);
  private flash?: MuzzleFlash; private viewFlash?: MuzzleFlash; private securityFlashes = new Map<string,MuzzleFlash>(); private cameraFeedback=new CameraFeedback();private resolution=new AdaptiveResolution(1,1);private shadowClock=1;
  private previousPosition=this.body.position.clone();private renderPosition=new T.Vector3();
  private playerModels = new Map<EquipmentId,T.Object3D>(); private viewModels = new Map<EquipmentId,T.Object3D>(); private equipped?: EquipmentId;
  private fieldArt?: FieldArt; private touchWasMoving = false; private throwRelease = -1;
  private noticeAge = 0; private notice = '';
  private weaponEnvironment?: T.WebGLRenderTarget;
  private lastShot: CombatDiagnostics['lastShot'] = null;
  private humanoidFrame: HumanoidFrame = { vx: 0, vz: 0, vertical: 0, grounded: true, sprinting: false, aiming: false, angle: -Math.PI / 2, pov: 'tactical', dodgeRemaining: 0, dodgeSerial: 0, health: 100, hitSerial: 0, shots: 0, reload: 0 };
  private socketPoint = new T.Vector3(); private viewAim = new T.Vector3();
  private targets: Target3D[] = []; private occupants: Solid3D[] = []; private modelsReady = false;
  private bossBox = new T.Box3(); private audio: GameAudio;
  private resizeObserver: ResizeObserver; private input: InputManager; private removers: (() => void)[] = [];
  private unsubscribe: () => void; private disposed = false; private raf = 0; private last = 0; private accumulator = 0; private hudClock = 0; private elapsed = 0;
  private frames = new FrameMetrics(); private fpsClock = 0; private fps = 0; private p95 = 0; private quality: QualityId; private slow = 0; private dpr = 1;
  private command = emptyCommand(); private legacy = { x: 288,y: 288 }; private revision = -1;
  // Touch has separate movement/aim sticks from the first frame. Camera POV
  // changes must not start a delayed idle body turn before the first aim touch.
  private independentAim = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  private mouse = new T.Vector2(); private ray = new T.Raycaster(); private aim = new T.Vector3(); private direction = new T.Vector3(); private origin = new T.Vector3();
  private jump = false; private jumpHeld = false; private drag = false; private lookPointer: number | null = null; private touchLook = false; private lookX = 0; private lookY = 0; private collisions = 0; private distance = 0; private hits = 0; private hitSerial = 0; private damageSerial = 0; private alarmSerial = 0;
  private geometry = new Set<T.BufferGeometry>(); private materials = new Set<T.Material>(); private needsDraw = true;
  private securityMeshes: T.Mesh[] = []; private bossWarning: T.Mesh;
  private cameraNodes: { head: T.Mesh; fan: T.Mesh }[] = []; private securityRenderClock = 0;
  private bossLines: T.LineSegments;
  private lockdown = { id: 'guardian-lockdown',x: 1088,y: 480,width: 128,height: 64,enabled: false };
  constructor(private host: HTMLElement,readonly session: SandboxSession,private diagnostics: (data: Diagnostics3D) => void) {
    this.world = new WorldState(session.operation.level); this.security = new SecurityController(this.world,this.world.level.security);
    if(session.operation.assignment!==undefined)addAssignmentWalls(this.world,assignmentAt(session.operation.assignment));
    this.body.position.copy(point3(this.world.level.spawn.x,this.world.level.spawn.y));this.previousPosition.copy(this.body.position);
    this.quality = session.getSnapshot().quality;
    this.renderer = new T.WebGLRenderer({ antialias: this.quality !== 'low',powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.35;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.tabIndex = 0; this.renderer.domElement.setAttribute('aria-label','RIVALS experimental unified 3D raid'); host.appendChild(this.renderer.domElement);
    const weather=session.operation.assignment!==undefined?(['golden','daylight','night','daylight','golden','night','daylight'] as const)[session.operation.assignment]:session.operation.ordinal===1?'golden':cityPlan(session.operation.venue,session.operation.seed).weather;
    this.atmosphere=new CityAtmosphere(this.scene,this.renderer,weather);
    this.post=new CityPostProcess(this.renderer,this.scene,this.rig.camera);
    this.surface=new FrameSurface(this.renderer,(w,h,dpr)=>{this.post.resize(w,h,dpr);this.rig.resize(w,h);});
    this.rig.setPOV('third');this.rig.yaw=-Math.PI;
    session.cityLighting=weather;session.onCityLighting=preset=>this.setEnvironmentLighting(preset);
    this.rig.perspective.far=this.rig.orthographic.far=300;
    this.world.blockers.push(this.lockdown); this.solids = convertSolids(this.world); validateConversion(this.solids,this.world.level);
    this.art = new WorldArt(this.world,this.solids,session.operation.venue,session.operation.seed); this.scene.add(this.art.root);
    const navigationTile=session.operation.assignment!==undefined?32:64;
    this.navigation = new NavigationGrid(this.world.level.width*64/navigationTile,this.world.level.height*64/navigationTile,navigationTile,this.world.blockers);
    this.boss = new BossController(new NavigationGrid(this.world.level.width,this.world.level.height,64,this.world.blockers,24));
    this.scene.add(this.player.root,this.bossActor.root,this.rig.perspective); this.bossActor.root.visible = false;
    const playerTarget: Target3D = { id: 'operative',team: 'operative',box: new T.Box3(),alive: () => this.controller.health > 0&&!this.vehicles?.current,damage: this.damage };
    this.targets.push(playerTarget);
    this.world.level.enemies.forEach((spawn,index) => {
      const model = new EnemyController(spawn,this.navigation,index * .05),actor = createActor(spawn.type === 'guard' ? 'kol' : spawn.type === 'enforcer' ? 'rugger' : 'whale');
      this.scene.add(actor.root);
      const target: Target3D = { id: spawn.id,team: 'security',box: new T.Box3(),alive: () => model.alive,damage: event => this.damageEnemy(spawn.id,event) };
      const collider: Solid3D = { id: spawn.id,box: target.box,enabled: true,kind: 'cover' };
      this.npcs.push({ model,actor,target,collider }); this.targets.push(target); this.occupants.push(collider);
    });
    this.targets.push({ id: 'vault-guardian',team: 'security',box: this.bossBox,alive: () => this.boss.active,damage: this.damageBoss });
    this.occupants.push({ id: 'vault-guardian',box: this.bossBox,enabled: false,kind: 'cover' });
    for (const laser of this.security.definition.lasers) {
      const mesh = new T.Mesh(this.ownGeometry(new T.PlaneGeometry(Math.hypot(laser.b.x - laser.a.x,laser.b.y - laser.a.y) * METRES,1.45)),this.ownMaterial(new T.MeshBasicMaterial({ color: 0xff625e,transparent: true,opacity: .4,side: T.DoubleSide,depthWrite: false })));
      mesh.position.copy(point3((laser.a.x + laser.b.x) / 2,(laser.a.y + laser.b.y) / 2,.725)); mesh.rotation.y = -Math.atan2(laser.b.y - laser.a.y,laser.b.x - laser.a.x); this.scene.add(mesh); this.securityMeshes.push(mesh);
    }
    this.bossWarning = new T.Mesh(this.ownGeometry(new T.RingGeometry(.06,this.boss.definition.abilities.pulse.radius * METRES,32)),this.ownMaterial(new T.MeshBasicMaterial({ color: 0xffb55b,transparent: true,opacity: .45,side: T.DoubleSide,depthWrite: false }))); this.bossWarning.rotation.x = -Math.PI / 2; this.bossWarning.visible = false; this.scene.add(this.bossWarning);
    const lineGeometry = this.ownGeometry(new T.BufferGeometry()); lineGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(30),3));
    this.bossLines = new T.LineSegments(lineGeometry,this.ownMaterial(new T.LineBasicMaterial({ color: 0xffd27d,transparent: true,opacity: .9 }))); this.bossLines.frustumCulled = false; this.scene.add(this.bossLines);
    for (const camera of this.security.definition.cameras) {
      const head = new T.Mesh(this.ownGeometry(new T.BoxGeometry(.22,.18,.4)),this.ownMaterial(new T.MeshStandardMaterial({ color: 0xd5b468,emissive: 0x805213 }))); head.position.copy(point3(camera.x,camera.y,1.6)); this.scene.add(head);
      const geometry = this.ownGeometry(new T.BufferGeometry()); geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(16 * 9),3));
      const fan = new T.Mesh(geometry,this.ownMaterial(new T.MeshBasicMaterial({ color: 0xffcf73,transparent: true,opacity: .11,side: T.DoubleSide,depthWrite: false }))); fan.frustumCulled = false; this.scene.add(fan); this.cameraNodes.push({ head,fan });
    }
    session.startAudio(); this.audio = session.audio!; this.combatAudio = session.combatAudio!;
    this.input = new InputManager(session,host,() => !this.disposed);
    this.listen(window,'keydown',this.key); this.listen(window,'blur',() => session.pause()); this.listen(document,'visibilitychange',() => { if (document.hidden) session.pause(); });
    this.listen(window,'keyup',e => { if ((e as KeyboardEvent).code === 'KeyJ') this.holdJump(false); });
    this.listen(host,'contextmenu',e => e.preventDefault());
    this.listen(host,'pointerdown',e => {
      const p = e as PointerEvent,touch = p.pointerType === 'touch';
      if (!session.canControl() || this.lookPointer !== null || (touch ? !['first','third'].includes(this.rig.pov) : p.button !== 2)) return;
      this.lookPointer = p.pointerId; this.touchLook = touch; this.lookX = p.clientX; this.lookY = p.clientY; this.drag = true;
      if (touch) { p.preventDefault(); host.setPointerCapture(p.pointerId); } else this.rig.ads = this.loadout.definition.kind === 'firearm';
    });
    const releaseLook = (e: Event) => { if ((e as PointerEvent).pointerId === this.lookPointer) { this.lookPointer = null; this.drag = false; if (!this.touchLook) this.rig.ads = false; } };
    this.listen(window,'pointerup',releaseLook); this.listen(window,'pointercancel',releaseLook); this.listen(host,'lostpointercapture',releaseLook);
    this.listen(host,'pointermove',e => { const p = e as PointerEvent; if (this.drag && p.pointerId === this.lookPointer && session.canControl()) { this.rig.rotate(this.touchLook ? p.clientX - this.lookX : p.movementX,this.touchLook ? p.clientY - this.lookY : p.movementY); this.lookX = p.clientX; this.lookY = p.clientY; } });
    this.listen(this.renderer.domElement,'webglcontextlost',e => { e.preventDefault(); session.fail('The 3D graphics context was lost. Restart this sandbox or use Phaser fallback.'); });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.setQuality(this.quality); this.resize();
    session.attach({ pause: () => { this.last = 0; this.accumulator = 0; this.audio.pause(true); this.combatAudio.pause(true);session.cityAudio?.pause(true); this.needsDraw = true; },resume: () => { this.last = 0; this.audio.pause(false); this.combatAudio.pause(false);session.cityAudio?.pause(false); this.needsDraw = true; },mute: () => { this.audio.configure(session.getSnapshot().settings); this.combatAudio.configure(session.getSnapshot().settings);session.cityAudio?.configure(session.getSnapshot().settings); },settings: settings => { this.audio.configure(settings); this.combatAudio.configure(settings);session.cityAudio?.configure(settings); },quality: q => this.setQuality(q),stopMovement: () => { this.drivingInput={throttle:0,steer:0,brake:false,stickX:0,stickY:0};this.controller.stop(); this.jump = false; this.jumpHeld = false; this.drag = false; this.lookPointer = null; this.rig.ads = false; },interact: () => session.input.queueInteract(),hackPad: this.hackPad,hackRetry: this.hackRetry,hackClose: this.closeHack,skipBossIntro: () => this.boss.skipIntro() });
    this.unsubscribe = session.subscribe(() => { this.needsDraw = true; });
    this.aim.copy(this.body.position).add(new T.Vector3(0,1,-10));
    this.raf = requestAnimationFrame(this.frame);
    void this.prepare();
  }
  private ownGeometry<G extends T.BufferGeometry>(g: G) { this.geometry.add(g); return g; }
  private deployOfficer=(spawn:EnemySpawn)=>{
    if(this.disposed||this.npcs.length>=14)return;
    const model=new EnemyController(spawn,this.navigation,.05),actor=createActor(spawn.type==='guard'?'kol':'rugger');mountActor(actor,this.assets);
    const presentation=new SecurityPresentation(actor,this.assets.instance(spawn.type==='guard'?'pistol':'smg').root,this.assets.models.get(actor.role)!.animations);
    const target:Target3D={id:spawn.id,team:'security',box:new T.Box3(),alive:()=>model.alive,damage:event=>this.damageEnemy(spawn.id,event)};
    const collider:Solid3D={id:spawn.id,kind:'cover',box:target.box,enabled:true};this.npcs.push({model,actor,presentation,target,collider});this.targets.push(target);this.occupants.splice(this.occupants.length-1,0,collider);this.scene.add(actor.root);this.securityFlashes.set(spawn.id,new MuzzleFlash(presentation.weapon.muzzle,this.assets.textures.get('combat-flash')!));model.alarm(1,this.legacy);
  };
  private ownMaterial<M extends T.Material>(m: M) { this.materials.add(m); return m; }
  private listen(target: EventTarget,type: string,handler: EventListener) { target.addEventListener(type,handler); this.removers.push(() => target.removeEventListener(type,handler)); }
  private async prepare() {
    try {
      await this.assets.load((loaded,total) => this.session.loading('Preparing supplied 3D models',loaded / total*.9)); if (this.disposed) return;
      // A tiny shared reflection atlas gives dark metal readable highlights.
      // Apply it only to equipment; the existing city lighting stays intact.
      const studio = new RoomEnvironment(),generator = new T.PMREMGenerator(this.renderer);
      try { this.weaponEnvironment = generator.fromScene(studio,.04,.1,100,{ size: 64 }); } finally { studio.dispose(); generator.dispose(); }
      for (const id of ['rifle','smg','pistol'] as const) this.assets.models.get(id)!.scene.traverse(node => { if (node instanceof T.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof T.MeshStandardMaterial) { material.envMap = this.weaponEnvironment!.texture; material.envMapIntensity = 1.5; } });
      const operative = this.assets.instance('player');
      this.humanoid = new HumanoidAnimator(this.player,operative.root,operative.clips);
      for (const id of Object.keys(EQUIPMENT) as EquipmentId[]) { this.playerModels.set(id,this.assets.equipment(id)); this.viewModels.set(id,this.assets.equipment(id)); }
      this.equip();
      mountActor(this.bossActor,this.assets); this.bossPresentation = new SecurityPresentation(this.bossActor,this.assets.instance('rifle').root,this.assets.models.get('boss')!.animations);
      this.npcs.forEach(n => { mountActor(n.actor,this.assets); n.presentation = new SecurityPresentation(n.actor,this.assets.instance(n.model.spawn.type === 'guard' ? 'pistol' : n.model.spawn.type === 'enforcer' ? 'smg' : 'rifle').root,this.assets.models.get(n.actor.role)!.animations); });
      for (const n of this.npcs) this.securityFlashes.set(n.model.spawn.id,new MuzzleFlash(n.presentation!.weapon.muzzle,this.assets.textures.get('combat-flash')!));
      this.securityFlashes.set('vault-guardian',new MuzzleFlash(this.bossPresentation.weapon.muzzle,this.assets.textures.get('combat-flash')!));
      this.art.attachAssets(this.assets); this.art.setQuality(this.quality);
      if(this.art.city){
        this.vehicles=new VehicleController(this.art.city.traffic.simulation.cars);
        this.art.city.traffic.simulation.blocked=car=>this.solids.some(s=>!s.id.startsWith('city-traffic-')&&vehicleOverlap(car,car.x,car.z,Math.atan2(car.dx,car.dz),s));
        this.vehicleTargets=this.vehicles.cars.map(car=>({id:'vehicle-'+car.id,team:'security',box:this.art.city!.traffic.colliders[car.id].box,alive:()=>(car.health??200)>0,damage:event=>this.vehicles!.damage(car,event.amount)}));this.targets.push(...this.vehicleTargets);
        this.targets.push(...this.art.city.crowd.combat.targets);this.art.city.crowd.combat.onCrime=()=>this.pursuit?.alert();
        if(this.session.operation.assignment!==undefined){
          const a=assignmentAt(this.session.operation.assignment);this.assignmentSite=new AssignmentSite(a,this.world);this.scene.add(this.assignmentSite.root);
          this.pursuit=new PolicePursuit(this.vehicles.cars,new NavigationGrid(this.world.level.width,this.world.level.height,64,this.world.blockers,46),this.solids,a.response,this.deployOfficer,this.shootFromVehicle,this.vehicles.collision);
          this.campaign=new CampaignGameplay(this.session.operation.assignment,this.session.mission,this.world,this.vehicles,this.pursuit,this.navigation);
          if(a.hostage){this.witnessArt=new CityPeople(this.assets.city.humanoid!);this.witnessArt.setQuality(this.quality);this.scene.add(this.witnessArt.root);this.witnessPose={x:a.site.x,z:a.site.z-2,route:[],target:0,speed:0,yaw:0,crossing:false,panicUntil:0,idleUntil:0,distance:0,moving:false,motion:0};}
        }
      }
      this.gps=new MissionNavigation(this.navigation,new NavigationGrid(this.world.level.width,this.world.level.height,64,this.world.blockers,46));
      this.scene.add(this.roadGuide.root);
      this.art.city?.setLighting(this.atmosphere.preset);
      this.effects = new CombatEffects({ flash: this.assets.textures.get('combat-flash')!,smoke: this.assets.textures.get('combat-smoke')!,blast: this.assets.textures.get('combat-blast')! }); this.effects.setQuality(this.quality); this.scene.add(this.effects.root);
      this.fires=new WorldFires({smoke:this.assets.textures.get('combat-smoke')!,blast:this.assets.textures.get('combat-blast')!});this.fires.setQuality(this.quality);this.scene.add(this.fires.root);
      const caseModel=this.art.devices.get('cargo-recovered')?.getObjectByName('recovery-hard-case');if(caseModel&&this.campaign&&!this.campaign.assignment.hostage){this.carriedCase=caseModel.clone(true);this.carriedCase.position.set(.02,-.22,-.08);this.carriedCase.scale.setScalar(.8);this.carriedCase.visible=false;this.humanoid.sockets.leftHand.add(this.carriedCase);}
      this.viewScene.add(this.viewCamera,new T.HemisphereLight(0xb9e3ff,0x233346,2.5));
      const viewLight = new T.DirectionalLight(0xffffff,2); viewLight.position.set(2,3,2); this.viewScene.add(viewLight);
      this.field.add('supply-charge',point3(224,576),{ kind: 'bomb',amount: 2 });
      this.field.add('supply-med',point3(288,704),{ kind: 'health',amount: HEALTH_BOXES.medium });
      this.field.add('supply-smg',point3(416,576),{ kind: 'weapon',weapon: 'smg' });
      this.fieldArt = new FieldArt(this.assets,this.field); this.scene.add(this.fieldArt.root);
      this.humanoid.sockets.leftHand.add(this.fieldArt.held); this.fieldArt.held.position.set(0,.01,-.06);
      this.viewScene.add(this.fieldArt.viewHeld); this.fieldArt.viewHeld.position.set(-.18,-.15,-.55);
      this.rig.resize(this.host.clientWidth,this.host.clientHeight);this.rig.update(this.body.position,this.solids,0,true);this.atmosphere.follow(this.body.position,this.rig.pov);
      this.session.loading('Warming graphics',.98);await this.renderer.compileAsync(this.scene,this.rig.camera);if(this.disposed)return;
      // Keep the loading overlay until a complete world frame has been drawn.
      const firstFrame=new Promise<void>(resolve=>{this.firstFrameReady=resolve;});
      this.modelsReady=true;this.last=0;this.needsDraw=true;await firstFrame;if(this.disposed)return;
      this.session.mission.start(); this.session.update({ status: 'playing',progress: 1,metrics: { ...this.session.getSnapshot().metrics,renderer: 'webgl',startupMs: performance.now() - this.session.startedAt } }); this.session.publishMission(); this.audio.playMusic(); this.publish(); this.renderer.domElement.focus(); if (document.hidden) this.session.pause();
    } catch (error) { if (!this.disposed) this.session.fail(error instanceof Error ? error.message : '3D assets could not load.'); }
  }
  setPOV(pov: POV) { this.cameraFeedback.restore();this.cameraFeedback.clear();if (pov !== this.rig.pov) { this.rig.yaw = -this.controller.aimAngle - Math.PI / 2; this.rig.setPOV(pov); } this.needsDraw = true; this.publish(); }
  cyclePOV = () => this.setPOV((['tactical','side','third','first'] as POV[])[(['tactical','side','third','first'].indexOf(this.rig.pov) + 1) % 4]);
  private equip() {
    const id = this.loadout.current.id; if (this.equipped === id && this.gun) return;
    this.flash?.dispose(); this.viewFlash?.dispose(); this.gun?.model.removeFromParent(); this.viewGun?.model.removeFromParent(); this.viewGun?.dispose(); this.viewGun?.root.removeFromParent();
    const playerModel=this.playerModels.get(id),viewModel=this.viewModels.get(id);
    if (!playerModel || !viewModel) throw new Error(`Selected weapon model is unavailable: ${id}`);
    // Each loadout slot owns two independent instances: a hand-mounted world
    // model and an overlay model. Re-parenting one must never steal the other.
    playerModel.visible=true; playerModel.traverse(node=>{node.frustumCulled=false;});
    viewModel.visible=true; viewModel.traverse(node=>{node.frustumCulled=false;});
    this.gun = new WeaponRig(this.player,playerModel,this.humanoid); this.viewGun = new FirstPersonWeapon(viewModel); this.viewScene.add(this.viewGun.root);
    this.player.root.updateMatrixWorld(true); this.viewGun.root.updateMatrixWorld(true);
    this.flash = new MuzzleFlash(this.gun.muzzle,this.assets.textures.get('combat-flash')!); this.viewFlash = new MuzzleFlash(this.viewGun.model.getObjectByName('weapon-muzzle')!,this.assets.textures.get('combat-flash')!); this.equipped = id;
  }
  switchWeapon = (index?: number) => { if (this.vehicles?.current||!this.session.canControl() || !this.controller.canAttack) return; const changed = index === undefined ? this.loadout.cycle(true) : this.loadout.switchTo(index,true); if (changed) { this.equip(); this.publish(); } };
  throwBomb = () => { if (this.vehicles?.current||!this.session.canControl() || !this.controller.canAttack || this.loadout.busy || this.weapon.reloadRemaining > 0 || this.field.quantity <= 0) return; this.loadout.start('throw',.55); this.throwRelease = .18; this.publish(); };
  menu(open: boolean) { this.session.block(open); this.last = 0; this.accumulator = 0; const silent = open || this.session.getSnapshot().status !== 'playing'; this.audio.pause(silent); this.combatAudio.pause(silent); this.needsDraw = true; this.publish(); }
  replacePickup = (index?: number) => {
    const item = this.field.pickups.find(p => p.id === this.field.pending); if (!item) return;
    if (index !== undefined && (this.session.getSnapshot().status !== 'playing' || this.controller.health <= 0 || this.field.nearby(this.body.position,this.solids)?.id !== item.id || !this.field.take(item,this.loadout,this.controller.vitality,true,index))) return;
    if (index === undefined) this.field.cancel(); else if (!this.loadout.busy) this.loadout.start('pickup',.35); this.menu(false); this.equip(); this.publish();
  };
  zoom(value?: number) { if (value === undefined) this.rig.cycleZoom(); else this.rig.setZoom(value); this.needsDraw = true; }
  private lastJump=-Infinity;private highJump=false;
  requestJump = () => { if (this.session.canControl()&&!this.vehicles?.current) {const now=performance.now();this.highJump=now-this.lastJump<300;this.lastJump=now;this.jump = true;} };
  holdJump = (held: boolean) => { if (held && !this.jumpHeld) this.requestJump(); this.jumpHeld = held && this.session.canControl(); };
  private key = (e: Event) => {
    const event = e as KeyboardEvent; if (event.repeat || !this.session.canControl() || (event.target instanceof Element && event.target.closest('input,select,textarea,[role=dialog]'))) return;
    if (event.code === 'KeyJ') this.holdJump(true);
    if (event.code === 'KeyV') this.setPOV((['tactical','side','third','first'] as POV[])[(['tactical','side','third','first'].indexOf(this.rig.pov) + 1) % 4]);
    if (event.code === 'KeyC') this.setPOV(this.rig.pov === 'first' ? 'third' : 'first');
    if (event.code === 'KeyZ') this.zoom();
    if (event.code === 'KeyQ') { event.preventDefault(); this.switchWeapon(); }
    if (event.code === 'KeyG') { event.preventDefault(); this.throwBomb(); }
    if (event.code === 'KeyF') {event.preventDefault();this.vehicleInteract();}
    if (['Digit1','Digit2','Digit3'].includes(event.code)) this.switchWeapon(Number(event.code.slice(-1)) - 1);
  };
  private setQuality(quality:QualityId){this.quality=quality;this.art?.setQuality(quality);this.effects?.setQuality(quality);this.fires?.setQuality(quality);this.atmosphere.quality(quality);this.post.quality(quality);const mobile=navigator.maxTouchPoints>0;this.dpr=Math.min(devicePixelRatio,quality==='low'?.85:quality==='balanced'?(mobile?1:1.15):(mobile?1.15:1.5));this.resolution=new AdaptiveResolution(this.dpr,this.dpr,Math.min(.65,this.dpr));this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.shadowClock=1;this.resize();if(this.modelsReady)this.publish();}
  setEnvironmentLighting(preset:CityWeather) { this.atmosphere.set(preset);this.art.city?.setLighting(preset);this.needsDraw=true;if(this.modelsReady)this.publish(); }
  // Queue only. Writing canvas dimensions here could clear the last image
  // between animation frames (including a paused frame).
  private resize(){this.needsDraw=true;}
  private damage = (event: DamageEvent) => {
    const amount = this.controller.receiveDamage(event); if (!amount) return 0;
    this.session.mission.damage(amount); const previous = this.session.getSnapshot().damage;
    this.session.update({ health: this.controller.health,damage: { serial: previous.serial + 1,amount,angle: event.angle } }); this.combatAudio.hit(true);
    if (this.controller.health <= 0) { this.session.mission.fail('Operative defeated before extraction.'); this.pool.clear(); this.session.clearInput();this.session.publishMission(); }
    return amount;
  };
  private spatial(point: T.Vector3) { const dx = point.x - this.body.position.x,dz = point.z - this.body.position.z,distance = Math.hypot(dx,dz); return { distance,pan: (dx * Math.cos(this.rig.yaw) - dz * Math.sin(this.rig.yaw)) / Math.max(2,distance) }; }
  private shootFromVehicle=(window:{x:number;y:number},car:import('./CitySimulation').CityCar)=>{
    if(this.controller.health<=0)return;const origin=point3(window.x,window.y,1.22),driving=this.vehicles?.current;
    const lead=Math.min(.5,origin.distanceTo(this.body.position)/90),vx=driving?driving.dx*driving.speed:this.controller.vx*METRES,vz=driving?driving.dz*driving.speed:this.controller.vy*METRES;
    const direction=new T.Vector3(this.body.position.x+vx*lead-origin.x,this.body.position.y+1-origin.y,this.body.position.z+vz*lead-origin.z).normalize();
    // A passenger shoots from the facing window. The owning car is excluded
    // from this shot only; all walls, traffic and other cars still block it.
    direction.applyAxisAngle(new T.Vector3(0,1,0),Math.sin(this.elapsed*13+car.id)*.018);
    if(this.pool.fire(origin,direction,90,1,46,4,'police-car-'+car.id,'security')){const s=this.spatial(origin);this.effects?.muzzle(origin,true);this.combatAudio.shot('smg',s.distance,s.pan);}
  };
  private vehicleFeedback(dt:number){
    const vehicles=this.vehicles;if(!vehicles)return;
    for(const event of vehicles.drainEvents()){
      const point=new T.Vector3(event.car.x,.65,event.car.z),spatial=this.spatial(point);
      if(event.kind==='crash'){this.session.cityAudio?.crash(event.speed,spatial.distance,spatial.pan);this.pursuit?.alert();continue;}
      this.effects?.blast(point,5,this.solids);this.fires?.blast(point,5,this.solids);this.combatAudio.blast(spatial.distance,spatial.pan);this.art.city?.threat(point);
      vehicles.blast(point,4.5,75);
      const trapped=vehicles.current===event.car,distance=Math.hypot(point.x-this.body.position.x,point.z-this.body.position.z);
      if(trapped||distance<5&&traceSolids(point,new T.Vector3().subVectors(this.body.position,point).normalize(),this.solids.filter(s=>s.id!=='city-traffic-'+event.car.id),distance)>=distance-.1){
        if(trapped)this.controller.vitality.invulnerable=0;
        this.damage({id:'vehicle-explosion:'+this.vehicleEventSerial++,sourceId:'vehicle-'+event.car.id,team:'security',amount:trapped?200:Math.round(85*(1-distance/5)),angle:Math.atan2(this.body.position.z-point.z,this.body.position.x-point.x)});
      }
    }
    if(vehicles.current&&(vehicles.current.fire??0)>0&&!vehicles.current.exploded){this.vehicleBurnAge+=dt;if(this.vehicleBurnAge>=.65){this.vehicleBurnAge=0;this.damage({id:'engine-fire:'+this.vehicleEventSerial++,sourceId:'engine-fire',team:'security',amount:5,angle:0});}}else this.vehicleBurnAge=0;
  }
  private damageEnemy(id: string,event: DamageEvent) {
    const n = this.npcs.find(n => n.model.spawn.id === id)!; const amount = n.model.damage(event); if (!amount) return 0;
    const died = n.presentation?.hit(event.angle,n.model.alive); n.collider.enabled = n.model.alive;
    if(event.id.startsWith('pulse-bomb:'))this.burning.set(id,3);
    if (died) {
      const s = this.spatial(n.actor.root.position); this.combatAudio.death(s.distance,s.pan);
      this.field.add(id + ':weapon',point3(n.model.x,n.model.y),{ kind: 'weapon',weapon: ENEMY_DROPS[n.model.spawn.type] });
      this.field.add(id + ':health',point3(n.model.x + 22,n.model.y + 14),{ kind: 'health',amount: HEALTH_BOXES.small });
    } else {const s=this.spatial(n.actor.root.position);this.combatAudio.hurt(s.distance,s.pan);} return amount;
  }
  private damageBoss = (event: DamageEvent) => {
    const amount = this.boss.damage(event); if (!amount) return 0;
    const died = this.bossPresentation?.hit(event.angle,this.boss.state !== 'DEFEATED');
    if (died) { const point = point3(this.boss.x,this.boss.y,1),s = this.spatial(point); this.combatAudio.blast(s.distance,s.pan); this.effects?.blast(point,1.6); } return amount;
  };
  private syncGeometry() {
    if (this.revision === this.world.revision) return; this.revision = this.world.revision;
    for (const solid of this.solids) { const original = this.world.blockers.find(b => b.id === solid.id); if (original) solid.enabled = original.enabled; }
    this.navigation.rebuild(); this.boss.navigation.rebuild();
    for (const id of this.world.active) this.session.mission.event(id);
  }
  private interact() {
    if(this.campaign&&this.campaign.interact(this.body.position)){this.publish();return;}
    // Collect is never vehicle entry. Vehicles have their own explicit F/button
    // action, so a parked car cannot steal a medkit or weapon pickup request.
    if(this.vehicles?.current)return;
    const item = this.field.nearby(this.body.position,this.solids);
    if (item) { const collected = this.field.take(item,this.loadout,this.controller.vitality,this.controller.health > 0); if (collected) { this.loadout.start('pickup',.35); this.audio.effect('terminal_success'); } else if (this.field.pending) this.menu(true); this.equip(); this.publish(); return; }
    if(this.campaign)return;
    const object = this.world.nearest(this.legacy); if (!object) return;
    if (object.id === 'med-station' && this.controller.health === this.controller.maxHealth) { this.field.message = 'Health Full.'; this.publish(); return; }
    if (object.hack && this.security.beginHack(object,this.legacy)) { this.session.openHack(this.security.hack!.getSnapshot()); return; }
    if (this.security.timedInteract(object,this.legacy)) return;
    this.world.occupants = [...this.npcs.filter(n => n.model.alive).map(n => n.model),...(this.boss.active ? [this.boss] : [])];
    const event = this.world.interact(object,this.legacy,this.controller.health); if (!event) return;
    if (event.objectId === 'med-station') this.controller.vitality.heal(25);
    this.controller.interacted(); this.session.mission.event(event.objectId); this.audio.effect(event.kind === 'extraction' ? 'extract_success' : event.kind === 'vault' ? 'vault_open' : 'terminal_success');
  }
  vehicleInteract=()=>{if(!this.session.canControl()||!this.vehicles)return;const v=this.vehicles;this.controller.stop();this.jump=false;if(v.current)v.exit(this.body.position,this.solids);else{v.scan(this.body.position,this.art.city?.traffic.active??28);if(v.nearby)v.enter(v.nearby,this.body.position,this.solids,car=>this.art.city?.crowd.ejectDriver(car));}if(v.current)this.body.position.set(v.current.x,.55,v.current.z);this.previousPosition.copy(this.body.position);this.session.clearInput();this.publish();};
  setDriving=(patch:Partial<typeof this.drivingInput>)=>{if(this.session.canControl()||Object.values(patch).every(value=>!value))Object.assign(this.drivingInput,patch);};
  private recoverEvidence(dt:number){
    const campaign=this.campaign;if(!campaign?.carrying||campaign.recoveredByPolice||this.recoveryAge>=15)return;
    this.recoveryAge+=dt;
    const device=this.art.devices.get('cargo-recovered');
    if(!this.evidenceDropped){this.evidenceDropped=true;this.world.active.delete('cargo-recovered');const evidence=this.world.level.objects.find(o=>o.id==='cargo-recovered');if(evidence){evidence.x=this.body.position.x*40;evidence.y=this.body.position.z*40;}device?.position.copy(this.body.position).setY(0);}
    this.pursuit?.step(dt,this.legacy,[]);
    let officer:NPC|undefined,distance=Infinity;for(const n of this.npcs){if(!n.model.alive||!n.model.spawn.id.startsWith('police-'))continue;const d=Math.hypot(n.model.x-this.legacy.x,n.model.y-this.legacy.y);if(d<distance){officer=n;distance=d;}}
    if(!officer)return;
    if(distance<80){campaign.recoveredByPolice=true;campaign.carrying=false;this.world.grantFlag('cargo-recovered');return;}
    this.recoveryRouteAge+=dt;if(this.recoveryRouteAge>.8){this.recoveryPath=this.navigation.path(officer.model,this.legacy);this.recoveryRouteAge=0;}
    while(this.recoveryPath.length&&Math.hypot(this.recoveryPath[0].x-officer.model.x,this.recoveryPath[0].y-officer.model.y)<12)this.recoveryPath.shift();
    const goal=this.recoveryPath[0];if(goal){const x=goal.x-officer.model.x,y=goal.y-officer.model.y,d=Math.hypot(x,y);this.navigation.move(officer.model,x/d*Math.min(d,140*dt),y/d*Math.min(d,140*dt));officer.model.vx=x/d*140;officer.model.vy=y/d*140;officer.model.angle=Math.atan2(y,x);}
  }
  private hackPad = (pad: number) => { if (!this.security.hack) return; this.security.submitHack(pad,this.legacy); this.session.update({ hack: this.security.hack.getSnapshot() }); this.syncGeometry(); this.publish(); };
  private hackRetry = () => { this.security.hack?.retry(); if (this.security.hack) this.session.update({ hack: this.security.hack.getSnapshot() }); };
  private closeHack = (resume = true) => { this.security.hack = null; this.session.finishHack(resume); this.last = 0; this.publish(); };
  private shootSecurity = (owner: string,x: number,z: number,angle: number,damage: number,speed = 340) => {
    const npc = this.npcs.find(n => n.model.spawn.id === owner),actor = owner === 'vault-guardian' ? this.bossActor : npc?.actor,presentation = owner === 'vault-guardian' ? this.bossPresentation : npc?.presentation;
    const origin = point3(x,z,1.22),direction = new T.Vector3(Math.cos(angle),0,Math.sin(angle));
    const horizontal = Math.hypot(this.body.position.x - origin.x,this.body.position.z - origin.z);
    if(owner.startsWith('police-')){direction.set(this.body.position.x-origin.x+this.controller.vx*METRES*.09,this.body.position.y+1.05-origin.y,this.body.position.z-origin.z+this.controller.vy*METRES*.09).normalize();}
    else{direction.y = (this.body.position.y + 1.05 - origin.y) / Math.max(.1,horizontal); direction.normalize();}
    if (actor && presentation) {
      actor.root.position.copy(point3(x,z)); actor.root.rotation.y = -angle - Math.PI / 2; actor.recoil = 1;
      presentation.weapon.pose(origin.clone().addScaledVector(direction,30)); presentation.weapon.muzzleWorld(this.socketPoint);
      safeMuzzleOrigin(origin,this.socketPoint,this.solids,origin); presentation.weapon.fire();
    }
    if (this.pool.fire(origin,direction,owner.startsWith('police-')?75:speed * METRES,2,owner.startsWith('police-')?32:640 * METRES,damage,owner,'security')) { const s = this.spatial(origin); this.effects?.muzzle(origin,true); this.securityFlashes.get(owner)?.fire(); const kind = presentation?.weapon.metadata.id; this.combatAudio.shot(kind === 'pistol' || kind === 'smg' ? kind : 'rifle',s.distance,s.pan); }
  };
  private step(dt: number) {
    this.legacy.x = this.body.position.x / METRES; this.legacy.y = this.body.position.z / METRES; this.syncGeometry();
    const mission = this.session.mission;
    if (this.notice !== this.field.message) { this.notice = this.field.message; this.noticeAge = 0; } else if (this.field.message && (this.noticeAge += dt) > 3) this.field.message = '';
    if (!this.campaign&&this.legacy.x > 720 && this.legacy.y > 500) mission.event('compound-entered');
    if (this.world.active.has('vault-gate') && this.legacy.x > 1010 && this.legacy.y < 410) mission.event('vault-sector-entered');
    if (!this.campaign&&this.boss.state === 'DORMANT' && this.legacy.y < 410 && this.legacy.x > 1150 && mission.definition.boss.prerequisites.every(id => mission.completed.has(id))) {
      this.boss.activate(this.session.getSnapshot().reducedMotion); this.lockdown.enabled = true; this.world.revision++; this.session.clearInput(); this.jump = false; this.pool.clear(); this.syncGeometry();
    }
    this.boss.step(dt,this.legacy,{
      projectile: (angle,damage,speed) => this.shootSecurity('vault-guardian',this.boss.x,this.boss.y,angle,damage,speed),
      pulse: (point,radius,damage,serial) => { const centre = point3(point.x,point.y,.3),s = this.spatial(centre); this.effects?.blast(centre,radius * METRES); this.combatAudio.blast(s.distance,s.pan); if (Math.hypot(point.x - this.legacy.x,point.y - this.legacy.y) <= radius + 14) this.damage({ id: 'guardian-pulse:' + serial,sourceId: 'vault-guardian',team: 'security',amount: damage,angle: Math.atan2(this.legacy.y - point.y,this.legacy.x - point.x) }); },
      defeated: () => { this.lockdown.enabled = false; this.world.grantFlag('guardian-defeated'); this.field.add('guardian:med',point3(this.boss.x,this.boss.y),{ kind: 'health',amount: HEALTH_BOXES.large }); mission.event('guardian-defeated'); this.pool.clear(); this.syncGeometry(); this.audio.effect('vault_open'); },
    });
    if (this.boss.state === 'INTRO') { this.controller.stop(); return; }
    const command = this.session.input.read(this.command);
    const throttle=-command.y,steer=command.x;
    if(this.vehicles?.current){command.fire=false;command.dodge=false;command.aiming=false;}
    if(this.session.input.touchAiming)this.independentAim=true;
    // Aim uses the latest unshaken render camera. Updating the follow rig in
    // every fixed substep AND again in render doubled its damping and jitter.
    this.updateAim();
    const move = this.rig.movement(command.x,command.y,this.body.grounded); command.x = move.x; command.y = move.y;
    const aimDirection = this.direction.subVectors(this.aim,this.body.position).setY(0).normalize();
    // A left-stick-only move is locomotion, not an implicit aim command. In
    // TPS/FPS the old camera-mode override held the torso on the crosshair,
    // making a right-stick movement look like a sideways strafe. Preserve
    // that combat stance only while the player deliberately aims (right
    // stick, mouse, or another explicit aim source); otherwise the controller
    // adopts the travel vector and the character turns into the move.
    if (command.aiming) { command.aimX = aimDirection.x; command.aimY = aimDirection.z; }
    command.dodge = command.dodge && this.body.grounded && !this.loadout.busy;
    const mounted=Boolean(this.vehicles?.current);
    if(mounted)this.controller.stepMounted(dt);
    const interaction = mounted?false:this.controller.step(command,dt);
    if (this.touchWasMoving && !this.session.input.touchMoving && !this.session.input.keyboardMoving) this.controller.stop(); this.touchWasMoving = this.session.input.touchMoving;
    if (interaction) this.interact(); if (this.session.getSnapshot().hack || this.session.blocked) return;
    if (mission.state !== 'ACTIVE') { this.pool.clear(); this.publish(); return; }
    this.previousPosition.copy(this.body.position);
    const x = this.body.position.x,z = this.body.position.z;
    const solids = [...this.solids,...this.occupants];
    const dodgeScale = dodgeMotionScale(this.controller.dodgeRemaining,dt);
    if(this.vehicles?.current){this.vehicles.step(dt,{...this.drivingInput,throttle:throttle||this.drivingInput.throttle,steer:steer||this.drivingInput.steer,brake:this.drivingInput.brake||command.dodge,cameraYaw:['third','first'].includes(this.rig.pov)?this.rig.yaw:0},this.solids,this.body.position);this.body.grounded=true;this.body.vertical=0;this.controller.stop();}
    else{this.vehicles?.step(dt,this.drivingInput,this.solids,this.body.position);moveKinematic(this.body,this.controller.vx * METRES * dt * dodgeScale,this.controller.vy * METRES * dt * dodgeScale,dt,solids,this.jump && this.controller.dodgeRemaining <= 0,this.jumpHeld,this.highJump);}
    this.jump = false;this.highJump=false;
    this.legacy.x=this.body.position.x/METRES;this.legacy.y=this.body.position.z/METRES;
    this.vehicles?.scan(this.body.position,this.art.city?.traffic.active??28);
    this.vehicleTargets.forEach((t,i)=>{const car=this.vehicles?.cars[i];t.team=car===this.vehicles?.current?'operative':car?.kind==='police'?'security':'civilian';});
    this.pursuit?.step(dt,this.legacy,this.npcs.filter(n=>n.model.spawn.id.startsWith('police-')).map(n=>({x:n.model.x,y:n.model.y,alive:n.model.alive})));
    this.campaign?.step(dt,this.body.position,this.npcs.filter(n=>n.model.spawn.id.startsWith('site-guard-')&&n.model.alive).length);
    const objective=this.session.mission.snapshot(),goal=this.campaign?.destination??objective.objectives.find(o=>o.id===objective.activeId)?.marker;
    this.gps?.update(dt,this.legacy,goal,Boolean(this.vehicles?.current));
    if(this.campaign&&this.loadout.shots!==this.alertedShots){this.alertedShots=this.loadout.shots;this.pursuit?.alert();}
    const traveled = Math.hypot(this.body.position.x - x,this.body.position.z - z); this.distance += traveled / METRES;
    this.humanoidFrame.vx = this.vehicles?.current?0:(this.body.position.x - x) / dt; this.humanoidFrame.vz = this.vehicles?.current?0:(this.body.position.z - z) / dt;
    this.combatAudio.walk(this.vehicles?.current?0:traveled,!this.vehicles?.current&&this.body.grounded && this.controller.dodgeRemaining <= 0,this.controller.sprinting);
    if (Math.hypot(this.controller.vx,this.controller.vy) > 20 && traveled < .0001) this.collisions++;
    this.setBox(this.targets[0].box,this.body.position,.34,1.75);
    this.security.step(dt,this.legacy,this.controller.health > 0,this.damage);
    if (this.security.alarmSerial !== this.alarmSerial) { this.alarmSerial = this.security.alarmSerial; this.audio.effect('drone_alert'); }
    const nearest = this.npcs.filter(n => n.model.alive).sort((a,b) => Math.hypot(a.model.x - this.legacy.x,a.model.y - this.legacy.y) - Math.hypot(b.model.x - this.legacy.x,b.model.y - this.legacy.y)).slice(0,2);
    for (const n of this.npcs) {
      if (this.security.alarmRemaining > 0) n.model.alarm(this.security.alarmSerial,this.security.alarmPosition);
      n.model.step(dt,{ player: this.legacy,alive: this.controller.health > 0,permitted: nearest.includes(n)||n.model.spawn.id.startsWith('police-'),near:Math.hypot(n.model.x-this.legacy.x,n.model.y-this.legacy.y)<1600,wanted:this.pursuit?.pursuingValuables },(enemy,angle) => this.shootSecurity(enemy.spawn.id,enemy.x,enemy.y,angle,enemy.config.damage));
      for(const solid of this.art.city?.traffic.colliders??[]){if(!solid.enabled)continue;const hit=horizontalContact(n.model.x*METRES,n.model.y*METRES,.36,solid);if(hit){n.model.x+=hit.x*hit.depth/METRES;n.model.y+=hit.z*hit.depth/METRES;}}
      this.setBox(n.target.box,point3(n.model.x,n.model.y),.36,1.8); n.collider.enabled = n.model.alive;
    }
    this.setBox(this.bossBox,point3(this.boss.x,this.boss.y),.55,2.7); this.occupants[this.occupants.length - 1].enabled = this.boss.active;
    if (this.throwRelease >= 0) { this.throwRelease -= dt; if (this.throwRelease <= 0) { if (this.controller.health > 0) this.field.throw(this.body.position,this.aim,true); this.throwRelease = -1; } }
    this.field.step(dt,this.solids,this.targets.filter(t=>!t.id.startsWith('vehicle-')),(p,radius) => { const s = this.spatial(p); this.effects?.blast(p,radius,this.solids);this.fires?.blast(p,radius,this.solids);this.vehicles?.blast(p,radius);this.pursuit?.alert(); this.art.city?.threat(p);this.combatAudio.blast(s.distance,s.pan); });
    this.fires?.step(dt,this.vehicles?.cars??[]);
    const previousReload = this.weapon.reloadRemaining,empty = this.weapon.ammo === 0;
    const fired = this.loadout.step(dt,command.fire,command.reload,this.controller.canAttack && !interaction,this.session.input.touchAiming);
    if (previousReload === 0 && this.weapon.reloadRemaining > 0) { if (empty && command.fire) this.combatAudio.empty(); this.combatAudio.reload(); }
    if (previousReload > 0 && this.weapon.reloadRemaining === 0) this.combatAudio.reload(true);
    if (fired) {
      // Aim sockets are refreshed for a real shot, but the expensive authored
      // mixer/leg pose advances once per displayed frame, not six times.
      this.player.root.position.copy(this.body.position);this.gun?.pose(this.aim,this.humanoidFrame);
      if (this.loadout.definition.kind === 'melee') {
        this.origin.copy(this.body.position).y += 1.05; this.direction.subVectors(this.aim,this.origin).normalize();
        const hits = meleeStrike(this.origin,this.direction,this.targets,this.solids,this.loadout.definition.damage,this.loadout.definition.range * METRES,this.loadout.shots,p => this.effects?.impact(p,true));
        if (hits) { this.hits += hits; this.hitSerial++; this.combatAudio.hit(true); } this.controller.attacked(); this.audio.effect('player_dash');
      } else {
      this.origin.copy(this.body.position).y += 1.23; this.firingMuzzle(this.socketPoint);
      const muzzle = this.socketPoint.toArray(),blocked = safeMuzzleOrigin(this.origin,this.socketPoint,this.solids,this.origin);
      this.direction.subVectors(this.aim,this.origin).normalize();
      const w = this.loadout.definition; if (w.spread) this.direction.applyAxisAngle(new T.Vector3(0,1,0),this.weapon.shotAngle(0));
      this.pool.fire(this.origin,this.direction,this.loadout.current.id==='pistol'?130:240,w.lifetime,w.range * METRES,w.damage,'operative','operative'); this.controller.attacked(); this.player.recoil = 1; this.gun!.fire(); this.viewGun?.fire(); this.cameraFeedback.fire(this.rig.ads,this.loadout.current.id==='pistol'?1.1:1); this.flash?.fire(); this.viewFlash?.fire();this.session.cityAudio?.duck();
      this.lastShot = { origin: this.origin.toArray(),muzzle,direction: this.direction.toArray(),blocked,serial: this.loadout.shots };
      this.effects?.muzzle(this.origin); this.combatAudio.shot(w.model as 'rifle' | 'pistol' | 'smg'); this.npcs.forEach(n => { n.model.hear(this.legacy); n.model.threat(this.legacy,{x:this.direction.x,y:this.direction.z}); });
      }
    }
    this.pool.step(dt,this.solids,this.targets,(p,damage,owner) => { const s = this.spatial(p); this.effects?.impact(p,damage > 0); this.combatAudio.hit(damage > 0,s.distance,s.pan); if (damage > 0 && owner === 'operative') { this.hits++; this.hitSerial++; } },bullet => this.effects?.trace(bullet));
    this.vehicleFeedback(dt);
    this.elapsed += dt; mission.sample(this.loadout.shots,this.hits,this.npcs.filter(n => !n.model.alive).length); mission.step(dt);
    // Shot presentation is immediate; the existing 10 Hz HUD clock coalesces
    // ammo/diagnostics instead of rebuilding React state for every burst.
    if (previousReload !== this.weapon.reloadRemaining && (!previousReload || !this.weapon.reloadRemaining)) this.publish();
    if (mission.state !== 'ACTIVE') { this.pool.clear(); this.session.clearInput(); this.publish(); }
  }
  private animatePlayer(dt: number,position=this.body.position) {
    this.player.root.position.copy(position);
    if(this.vehicles?.current){this.humanoidFrame.vx=this.humanoidFrame.vz=0;return;}
    Object.assign(this.humanoidFrame,{ vertical: this.body.vertical,grounded: this.body.grounded,sprinting: this.controller.sprinting,aiming: this.controller.aiming,angle: this.controller.aimAngle,pov: this.rig.pov,dodgeRemaining: this.controller.dodgeRemaining,dodgeSerial: this.controller.dodgeSerial,health: this.controller.health,hitSerial: this.session.getSnapshot().damage.serial,shots: this.loadout.shots,reload: this.weapon.reloadRemaining,reloadDuration: this.loadout.definition.reloadSeconds,equipment: this.loadout.current.id,action: this.loadout.action,actionRemaining: this.loadout.remaining });
    this.humanoidFrame.independentAim=this.independentAim;
    this.humanoid?.update(dt,this.humanoidFrame); this.gun?.decay(dt); this.gun?.pose(this.aim,this.humanoidFrame);
  }
  private setBox(box: T.Box3,p: T.Vector3,radius: number,height: number) { box.min.set(p.x - radius,p.y,p.z - radius); box.max.set(p.x + radius,p.y + height,p.z + radius); }
  private firingMuzzle(out: T.Vector3) {
    if (this.rig.pov === 'first' && this.viewGun) { this.viewGun.root.updateMatrixWorld(true); this.viewGun.model.getObjectByName('weapon-muzzle')!.getWorldPosition(out); return out.applyMatrix4(this.rig.perspective.matrixWorld); }
    return this.gun!.muzzleWorld(out);
  }
  private updateAim() {
    const input = this.session.input;
    if (this.rig.pov === 'tactical' || this.rig.pov === 'side') {
      if (input.touchAiming) { const length=Math.hypot(input.touchAimX,input.touchAimY),c={x:input.touchAimX/length,y:input.touchAimY/length};this.aim.copy(this.body.position).add(new T.Vector3(c.x * 12,this.rig.pov === 'side' ? 1.1 - c.y * 10 : 1.1,this.rig.pov === 'side' ? 0 : c.y * 12)); return; }
      if (!input.mouseActive) { this.aim.copy(this.body.position).add(new T.Vector3(Math.cos(this.controller.aimAngle) * 12,1.23,Math.sin(this.controller.aimAngle) * 12)); return; }
      const rect=this.renderer.domElement.getBoundingClientRect();this.mouse.set((input.mouseClientX - rect.left) / rect.width * 2 - 1,-(input.mouseClientY - rect.top) / rect.height * 2 + 1);
    } else this.mouse.set(input.touchAiming ? input.touchAimX*.72 : 0,input.touchAiming ? -input.touchAimY*.65 : 0);
    this.host.parentElement?.style.setProperty('--r3-aim-x',`${(this.mouse.x + 1) * 50}%`);
    this.host.parentElement?.style.setProperty('--r3-aim-y',`${(1 - this.mouse.y) * 50}%`);
    this.ray.setFromCamera(this.mouse,this.rig.camera);
    let nearest = traceSolids(this.ray.ray.origin,this.ray.ray.direction,this.solids,120);
    let aimedTarget = false;
    for (const t of this.targets) if (t.team !== 'operative' && t.alive()) { const p = this.ray.ray.intersectBox(t.box,new T.Vector3()); if (p && p.distanceTo(this.ray.ray.origin) <= nearest) { nearest = p.distanceTo(this.ray.ray.origin); aimedTarget = true; } }
    if (this.rig.pov === 'side' && !aimedTarget) { const p = this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-this.body.position.z),this.aim); if (p) return; }
    if (this.rig.pov === 'tactical' && nearest >= 120) {
      const p = this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-1.1),this.aim); if (p) return;
    }
    this.aim.copy(this.ray.ray.origin).addScaledVector(this.ray.ray.direction,nearest);
  }
  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    if(!this.modelsReady)return;this.cameraFeedback.restore();
    const wallDt=this.last?Math.max(0,(now-this.last)/1000):0;
    const {delta:dt,step:physicsStep}=frameTiming(wallDt); this.last = now;
    const active = this.modelsReady && this.session.getSnapshot().status === 'playing' && !this.session.getSnapshot().hack && !this.session.blocked;
    // The fire stick owns weapon aim only. Camera look remains a separate
    // playfield swipe; locomotion remains exclusively the left stick/keys.
    // Age existing effects before simulation so new short flashes survive their
    // first rendered frame even on a slow device. Pause freezes these clocks.
    if (active) this.effects?.age(dt);
    let simulationDelta = 0;
    if (active) { this.accumulator += dt; let steps = 0; while (this.accumulator+1e-9 >= physicsStep && steps++ < 12) { this.step(physicsStep); simulationDelta += physicsStep; this.accumulator = Math.max(0,this.accumulator-physicsStep); if (this.session.getSnapshot().status !== 'playing' || this.session.getSnapshot().hack) { this.accumulator = 0; break; } } this.frames.record(now); this.fpsClock += Math.min(1,wallDt); }
    const finished = this.session.getSnapshot().status === 'finished',settling = finished && (this.npcs.some(n => n.presentation?.dead && n.presentation.deathAge < 10) || (this.bossPresentation?.dead && this.bossPresentation.deathAge < 10) || this.campaign?.carrying&&this.recoveryAge<15);
    if(finished&&this.session.mission.state==='FAILED')this.recoverEvidence(dt);
    if (!active && !settling && !this.needsDraw) return;
    if(active){const scale=this.resolution.sample(wallDt);if(scale!==undefined)this.dpr=scale;}
    const presented=this.surface.present(this.host.clientWidth,this.host.clientHeight,this.dpr,()=>{
    const animationDelta = finished ? dt : simulationDelta;
    this.renderPosition.copy(active?this.previousPosition:this.body.position);if(active)this.renderPosition.lerp(this.body.position,T.MathUtils.clamp(this.accumulator/physicsStep,0,1));
    this.rig.update(this.renderPosition,this.vehicles?.current?this.solids.filter(s=>s.id!=='city-traffic-'+this.vehicles!.current!.id):this.solids,dt,this.session.getSnapshot().reducedMotion,0,this.vehicles?.current?{x:0,y:0}:{x:this.command.x,y:this.command.y});this.updateAim();this.player.root.position.copy(this.renderPosition);
    this.player.root.visible = this.rig.pov !== 'first'&&!this.vehicles?.current;
    if(finished){this.humanoidFrame.vx=this.humanoidFrame.vz=0;}this.animatePlayer(animationDelta,this.renderPosition);
    this.viewGun?.update(animationDelta,this.rig.ads,this.weapon.reloadRemaining,this.loadout.definition.reloadSeconds,this.loadout.action,this.loadout.remaining);
    if(this.rig.pov==='first')this.viewGun?.aimAt(this.viewAim.copy(this.aim).applyMatrix4(this.rig.perspective.matrixWorldInverse));

    this.flash?.update(animationDelta); this.viewFlash?.update(animationDelta); this.securityFlashes.forEach(f => f.update(animationDelta));
    for (const n of this.npcs) {
      n.actor.root.position.copy(point3(n.model.x,n.model.y)); n.actor.root.rotation.y = -n.model.angle - Math.PI / 2;
      // Visibility belongs to the active camera's depth buffer, not the
      // player's line of sight. Otherwise side-view opponents blink out.
      n.actor.root.visible = true;
      n.presentation?.update(animationDelta,Math.hypot(n.model.vx,n.model.vy) * METRES,n.model.hurt,this.body.position.clone().add(new T.Vector3(0,1.05,0)),n.model.tactic,n.model.sprinting);
    }
    this.bossActor.root.visible = this.boss.state !== 'DORMANT'; this.bossActor.root.position.copy(point3(this.boss.x,this.boss.y)); this.bossActor.root.rotation.y = -this.boss.angle - Math.PI / 2;
    this.bossPresentation?.update(animationDelta,this.boss.state === 'READY' ? .6 : 0,this.boss.flashing ? 1 : 0,this.body.position.clone().add(new T.Vector3(0,1.05,0)));
    this.securityMeshes.forEach((mesh,index) => { const phase = this.security.laserPhase(this.security.definition.lasers[index].id); mesh.visible = phase !== 'OFF'; (mesh.material as T.MeshBasicMaterial).opacity = phase === 'WARNING' ? .14 : .45; });
    this.bossWarning.visible = this.boss.ability === 'pulse' && ['WINDUP','ACTIVE'].includes(this.boss.state); if (this.bossWarning.visible) this.bossWarning.position.copy(point3(this.boss.target.x,this.boss.target.y,.03));
    this.bossLines.visible = this.boss.ability !== 'pulse' && ['WINDUP','ACTIVE'].includes(this.boss.state);
    if (this.bossLines.visible && this.boss.ability) {
      const ability = this.boss.definition.abilities[this.boss.ability],count = this.boss.ability === 'burst' ? ability.count + (this.boss.phase === 'A' ? 0 : 2) : 1,positions = this.bossLines.geometry.getAttribute('position') as T.BufferAttribute;
      const start = point3(this.boss.x,this.boss.y,1.22);
      for (let i = 0; i < count; i++) { const angle = this.boss.angle + (i - (count - 1) / 2) * ability.spread,direction = new T.Vector3(Math.cos(angle),0,Math.sin(angle)),length = traceSolids(start,direction,this.solids,this.boss.ability === 'reposition' ? 2 : 12); positions.setXYZ(i * 2,start.x,start.y,start.z); positions.setXYZ(i * 2 + 1,start.x + direction.x * length,start.y,start.z + direction.z * length); }
      positions.needsUpdate = true; this.bossLines.geometry.setDrawRange(0,count * 2);
    }
    this.securityRenderClock += dt;
    if (this.securityRenderClock >= .1) {
      this.securityRenderClock = 0;
      this.cameraNodes.forEach((node,index) => {
        const camera = this.security.definition.cameras[index],angle = this.security.cameraAngle(camera.id),disabled = this.security.disabledFor(camera.id) > 0,positions = node.fan.geometry.getAttribute('position') as T.BufferAttribute,start = point3(camera.x,camera.y,.03);
        node.head.rotation.y = -angle - Math.PI / 2; node.fan.visible = !disabled;
        for (let i = 0; i < 16; i++) {
          positions.setXYZ(i * 3,start.x,start.y,start.z);
          for (let corner = 0; corner < 2; corner++) { const theta = angle - camera.cone + (i + corner) / 16 * camera.cone * 2,direction = new T.Vector3(Math.cos(theta),0,Math.sin(theta)),range = traceSolids(start,direction,this.solids,camera.range * METRES); positions.setXYZ(i * 3 + corner + 1,start.x + direction.x * range,start.y,start.z + direction.z * range); }
        }
        positions.needsUpdate = true;
      });
    }
    this.roadGuide.update(this.renderPosition,this.gps?.route??[],this.gps?.goal,this.elapsed,this.session.getSnapshot().reducedMotion,this.vehicles?.current?this.vehicles.current.length/2+1.5:1.4);
    this.fires?.draw(this.rig.camera,this.elapsed,this.body.position);if(this.carriedCase)this.carriedCase.visible=Boolean(this.campaign?.carrying)&&!this.vehicles?.current;
    this.art.sync(this.elapsed); this.art.updateEnvironment(this.elapsed,this.rig.pov,this.session.getSnapshot().reducedMotion,this.renderPosition,this.loadout.shots,this.npcs.filter(n=>n.model.alive).map(n=>({x:n.model.x*METRES,z:n.model.y*METRES})),this.rig.camera,active?T.MathUtils.clamp(this.accumulator/physicsStep,0,1):1);this.atmosphere.follow(this.body.position,this.rig.pov); this.fieldArt?.sync(this.elapsed,this.field.nearby(this.body.position,this.solids),this.loadout.action === 'throw' && this.throwRelease > 0,this.rig.pov === 'first');
    if(this.witnessArt&&this.witnessPose&&this.campaign){const w=this.witnessPose,p=this.campaign.witness;w.yaw=Math.atan2(p.x*.025-w.x,p.y*.025-w.z);w.x=p.x*.025;w.z=p.y*.025;w.moving=this.campaign.witnessMoving;w.motion=w.moving?1.5:0;this.witnessArt.draw([w],this.campaign.witnessBoarded?0:1,this.elapsed,this.rig.camera);}
    if(active){this.burnClock+=dt;if(this.burnClock>.18){this.burnClock=0;for(const [id,time]of this.burning){const npc=this.npcs.find(n=>n.model.spawn.id===id);if(npc)this.effects?.burn(point3(npc.model.x,npc.model.y,.75));if(time<=0)this.burning.delete(id);else this.burning.set(id,time-.18);}}}
    // Small render-only recoil cannot change the ray used for authoritative
    // shots. The rig restores the camera before the next aim sample.
    const settings = this.session.getSnapshot().settings;
    const feedbackEnabled=!this.vehicles?.current&&settings.cameraShake&&!this.session.getSnapshot().reducedMotion&&['first','third'].includes(this.rig.pov);
    this.cameraFeedback.update(active?dt:0,feedbackEnabled,Math.hypot(this.humanoidFrame.vx,this.humanoidFrame.vz),this.rig.ads);if(feedbackEnabled)this.cameraFeedback.apply(this.rig.camera);
    this.shadowClock+=active?dt:0;const shadowPeriod=this.quality==='high'?1/30:this.quality==='balanced'?1/20:1/12;
    if(this.shadowClock>=shadowPeriod||this.needsDraw){this.renderer.shadowMap.needsUpdate=true;this.shadowClock=0;}
    if(active&&this.art.city){const cars=this.art.city.traffic.simulation.cars.slice(0,this.art.city.traffic.active),nearest=cars.reduce((a,b)=>Math.hypot(a.x-this.body.position.x,a.z-this.body.position.z)<Math.hypot(b.x-this.body.position.x,b.z-this.body.position.z)?a:b),driving=this.vehicles?.current;this.session.cityAudio?.update(this.elapsed,nearest.speed,Math.hypot(nearest.x-this.body.position.x,nearest.z-this.body.position.z),nearest.stopped,Boolean(this.pursuit?.active),driving?{speed:driving.speed,throttle:this.drivingInput.throttle||Math.hypot(this.drivingInput.stickX,this.drivingInput.stickY)}:undefined);}
    this.renderer.info.reset();this.post.render(this.rig.camera,this.elapsed);
    if (this.rig.pov === 'first' && this.viewGun&&!this.vehicles?.current) {
      this.viewCamera.aspect = this.rig.perspective.aspect; this.viewCamera.fov = this.rig.perspective.fov; this.viewCamera.updateProjectionMatrix();
      this.renderer.autoClear = false; this.renderer.clearDepth(); this.renderer.render(this.viewScene,this.viewCamera); this.renderer.autoClear = true;
    }
    this.needsDraw = false;
    this.hudClock += dt; if (this.hudClock > .1) { this.hudClock = 0; this.publish(); }
    if (this.fpsClock >= 1) {
      this.fpsClock = 0; const m = this.frames.read(); this.fps = m.fps; this.p95 = m.p95FrameMs;
    }
    });
    if(presented&&this.firstFrameReady){const ready=this.firstFrameReady;this.firstFrameReady=undefined;ready();}
  };
  private combatSnapshot(): CombatDiagnostics {
    const gun = this.gun,b = this.bossPresentation;
    const sight = this.viewGun?.model.getObjectByName('weapon-sight')?.getWorldPosition(new T.Vector3()).project(this.viewCamera).toArray() ?? [];
    const flash = this.rig.pov === 'first' ? this.viewFlash : this.flash,marker = this.rig.pov === 'first' ? this.viewGun?.model.getObjectByName('weapon-muzzle') : gun?.muzzle;
    const flashError = flash && marker ? flash.root.getWorldPosition(new T.Vector3()).distanceTo(marker.getWorldPosition(new T.Vector3())) : 0;
    return { inventory: this.loadout.snapshot(),field: this.field.snapshot(),flashError,view: { ads: this.rig.ads,fov: this.viewCamera.fov,visible: this.rig.pov === 'first',hands: Boolean(this.viewGun?.handsVisible && this.viewGun?.handsAttachedToWeapon),sight,yaw: this.rig.yaw,pitch: this.rig.pitch,feedback:this.cameraFeedback.snapshot },ready: !this.loadout.busy && (this.loadout.definition.kind !== 'melee' || this.loadout.meleeCooldown <= .00001) && this.controller.canAttack && this.weapon.cooldown <= .00001 && this.weapon.reloadRemaining === 0,grip: gun?.rightGripError ?? 0,support: gun?.leftGripError ?? 0,supported: gun?.supportEngaged ?? false,alignment: gun?.alignment ?? 1,muzzle: this.gun ? this.firingMuzzle(new T.Vector3()).toArray() : [],lastShot: this.lastShot,audio: this.combatAudio.snapshot(),effects: this.effects?.snapshot(),
      enemies: this.npcs.map(n => ({ id: n.model.spawn.id,dead: n.presentation?.dead ?? false,transitions: n.presentation?.deathTransitions ?? 0,age: n.presentation?.deathAge ?? 0,height: n.presentation?.height ?? 0,floorError: n.presentation?.floorError ?? 0,collider: n.collider.enabled,visible: n.presentation?.fall.visible ?? false,tactic:n.model.tactic,evasions:n.model.evasions,covers:n.model.covers,speed:Math.hypot(n.model.vx,n.model.vy),motion:n.actor.current,hits: n.presentation?.hitCount ?? 0 })),
      fires:this.fires?.snapshot,boss: b ? { dead: b.dead,transitions: b.deathTransitions,age: b.deathAge,height: b.height,floorError: b.floorError } : null };
  }
  private publish() {
    if (this.disposed) return;
    const active=this.session.mission.definition.objectives.find(o=>o.id===this.session.mission.snapshot().activeId),candidate=active&&this.world.level.objects.find(o=>o.id===active.event);const model = this.security,nearby = this.campaign?(candidate&&this.world.reachable(candidate,this.legacy)?candidate:null):this.world.nearest(this.legacy),pickup = this.campaign&&nearby?undefined:this.field.nearby(this.body.position,this.solids),period = model.definition.sequence.off + model.definition.sequence.warning + model.definition.sequence.open;
    const supply = pickup?.supply,pickupName = supply?.kind === 'weapon' ? EQUIPMENT[supply.weapon].name : supply?.kind === 'health' ? `FIELD MEDKIT / +${supply.amount} HP` : 'GRENADE CACHE';
    this.session.batch(() => {
      this.session.update({ soldier: { ...this.loadout.snapshot(),bombs: this.field.quantity,canThrow: this.field.quantity > 0 && !this.loadout.busy && this.weapon.reloadRemaining === 0,notice: this.field.message,replacement: this.field.pending,blocked: this.session.blocked } });
      this.session.update({ elapsed: this.elapsed,player: { ...this.legacy },velocity: { x: this.controller.vx,y: this.controller.vy },health: this.controller.health,maxHealth: this.controller.maxHealth,animation: this.controller.animations.state,facing: this.controller.facing,dodgeCooldown: this.controller.dodgeCooldown,dodgeSerial: this.controller.dodgeSerial,sprinting: this.controller.sprinting,aiming: this.controller.aiming,aimAngle: this.controller.aimAngle,collisions: this.collisions,distance: this.distance,
        weapon: { name: this.loadout.definition.name,ammo: this.loadout.definition.kind === 'melee' ? null : this.weapon.ammo,capacity: this.weapon.definition.magazine,reloading: this.weapon.reloadRemaining,reserve: this.weapon.reserve },combat: { shots: this.loadout.shots,hits: this.hits,kills: this.npcs.filter(n => !n.model.alive).length,projectiles: this.pool.entries.filter(b => b.active).length,targetHealth: [],hitSerial: this.hitSerial },
        nearby: pickup ? { id: pickup.id,name: pickupName,description: supply?.kind === 'health' && this.controller.health === this.controller.maxHealth ? 'Health Full.' : 'INTERACT TO COLLECT',active: false } : nearby ? { id: nearby.id,name: nearby.name,description: this.campaign?'INTERACT / '+nearby.name:this.world.description(nearby),active: this.world.active.has(nearby.id) } : null,
        world: { revision: this.world.revision,openDoors: ['transit-door','vault-gate'].filter(id => this.world.active.has(id)),core: this.world.active.has('training-core'),extracted: this.world.extracted,rangeActive: this.world.active.has('auxiliary-console'),message: 'PRACTICE RAID / No account or reward writes' },
        security: { alarm: model.alarmRemaining > 0,seconds: model.alarmRemaining,source: model.alarmSource,serial: model.alarmSerial,phase: model.sequencePhase,window: model.sequencePhase === 'ACTIVE' ? period - model.clock % period : model.definition.sequence.off + model.definition.sequence.warning - model.clock % period,linkRemaining: model.sequenceRemaining,linked: this.world.active.has('timed-access'),relays: Number(this.world.active.has('relay-a')) + Number(this.world.active.has('relay-b')),hacks: model.hacksCompleted,failures: model.sequenceFailures,disabled: [...model.disabled.keys()].filter(id => model.disabledFor(id) > 0),message: model.message },
        enemies: this.npcs.map(n => ({ id: n.model.spawn.id,type: n.model.spawn.type,state: n.model.state,x: n.model.x,y: n.model.y,health: n.model.health.current,maximum: n.model.health.maximum,detection: n.model.detection,shots: n.model.shots,deaths: n.model.deaths,windup: n.model.windup })),boss: this.boss.snapshot(),metrics: { ...this.session.getSnapshot().metrics,fps: this.fps,p95FrameMs: this.p95,renderScale: this.dpr } });
      this.session.publishMission();
    });
    const projected = this.npcs.map(n => { const point = point3(n.model.x,n.model.y,1).project(this.rig.camera); return { id: n.model.spawn.id,x: (point.x + 1) / 2 * this.host.clientWidth,y: (1 - point.y) / 2 * this.host.clientHeight,visible: n.actor.root.visible && n.model.alive && Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1 }; });
    const h = this.humanoid;
    const snapshot=this.session.mission.snapshot(),goal=this.campaign?.destination??snapshot.objectives.find(o=>o.id===snapshot.activeId)?.marker;this.gps?.update(0,this.legacy,goal,Boolean(this.vehicles?.current));
    const next=this.gps?.next;
    this.diagnostics({ navigation:this.gps?{route:this.gps.route,distance:this.gps.distance,goal:this.gps.goal,bearing:next?routeBearing(this.body.position,next,this.rig.camera):0,roadArrows:this.roadGuide.count}:undefined,vehicle:this.vehicles?.snapshot,pursuit:this.pursuit?.snapshot,campaign:this.campaign?.snapshot,environment: this.art.city?.stats,combat: this.combatSnapshot(),pov: this.rig.pov,zoom: this.rig.zoom[this.rig.pov],fps: this.fps,frameMs: this.p95,calls: this.renderer.info.render.calls,triangles: this.renderer.info.render.triangles,geometries: this.renderer.info.memory.geometries,textures: this.renderer.info.memory.textures,dpr: this.dpr,quality: this.quality,x: this.body.position.x,y: this.body.position.y,z: this.body.position.z,grounded: this.body.grounded,enemies: this.npcs.length,runId: this.session.mission.runId,targets: projected,character: h ? { motion: h.motion,clip: h.clipName,history: [...h.history],transition: h.transition,speed: h.speed,time: h.actionTime,yaw: h.yaw,actions: h.activeActions,leg: this.player.body!.getObjectByName('thigh_l')!.quaternion.toArray(),socket: h.socketPosition(this.socketPoint).toArray(),visible: this.player.root.visible,mixerTime: h.mixer.time } : undefined });
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;this.firstFrameReady?.();this.firstFrameReady=undefined;this.cameraFeedback.restore();cancelAnimationFrame(this.raf); this.resizeObserver?.disconnect(); this.unsubscribe?.(); this.input?.dispose(); this.removers.forEach(remove => remove()); this.audio?.dispose(); this.pool.clear();
    this.flash?.dispose(); this.viewFlash?.dispose(); this.securityFlashes.forEach(f => f.dispose()); this.fieldArt?.dispose(); this.combatAudio?.dispose(); this.effects?.dispose(); this.bossPresentation?.dispose(); this.npcs.forEach(n => n.presentation?.dispose());
    this.humanoid?.dispose(); this.viewGun?.dispose(); disposeActor(this.bossActor); this.npcs.forEach(n => disposeActor(n.actor));
    [this.bossActor,...this.npcs.map(n => n.actor)].forEach(actor => { actor.muzzle.geometry.dispose(); (actor.muzzle.material as T.Material).dispose(); });
    this.fires?.dispose();this.roadGuide.dispose();this.assignmentSite?.dispose();this.witnessArt?.dispose();this.art?.dispose();this.atmosphere?.dispose();this.post?.dispose(); this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    for (const id of ['rifle','smg','pistol'] as const) this.assets.models.get(id)?.scene.traverse(node => { if (node instanceof T.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof T.MeshStandardMaterial) material.envMap = null; });
    this.assets.dispose(); this.weaponEnvironment?.dispose(); this.scene.clear(); this.viewScene.clear(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.session.dispose();
  }
}
