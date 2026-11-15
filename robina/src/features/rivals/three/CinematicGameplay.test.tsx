import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Box3,Group,PerspectiveCamera,Texture,Vector3} from 'three';
import {FirstPersonWeapon} from './WeaponRig';
import {CinematicImpacts,EXPLOSION_VISUALS,ScreenBlood} from './CinematicImpacts';
import {CombatEffects} from './CombatEffects';
import {SandboxSession} from './SandboxSession';
import {FpsTouchControls} from './FpsTouchControls';
import {SoldierControls} from './SoldierHUD';
import {CameraRig} from './CameraRig';
import {emptyCommand} from '../input/InputBuffer';
import type {RaidRuntime} from './RaidRuntime';
import {BOMB} from './FieldItems';
import {VehicleController} from './VehicleController';
import type {CityCar} from './CitySimulation';
import {authoritativeMuzzle,MUZZLE_GEOMETRY} from './WeaponGeometry';
import {Projectile3D} from './Projectile3D';
import {readFileSync} from 'node:fs';
import {CityCrowd} from './CityCrowd';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function gun(){const root=new Group(),muzzle=new Group();muzzle.name='weapon-muzzle';muzzle.position.set(0,.1,-.57);root.add(muzzle);root.userData.rivalsWeapon={id:'rifle',length:.82,forward:'-Z',recoil:.025,sockets:{grip:[0,0,0],muzzle:[0,.1,-.57],support:[0,.045,-.19],eject:[.035,.08,-.06],sight:[0,.158,-.1]}};return root;}
function pointers(){vi.stubGlobal('PointerEvent',class extends MouseEvent{pointerId:number;constructor(type:string,init:PointerEventInit={}){super(type,init);this.pointerId=init.pointerId??1;}});HTMLElement.prototype.setPointerCapture=vi.fn();}

describe('cinematic gameplay upgrades',()=>{
  it('interpolates server crowd stride distance instead of sliding frozen legs, and advances confirmed death presentation',()=>{
    const crowd=Object.create(CityCrowd.prototype) as CityCrowd;Object.assign(crowd,{people:[{x:0,z:0,distance:0,health:60}]});
    const pose={x:1,z:0,yaw:0,motion:1,moving:true,distance:1,panicUntil:8,health:60,hitRemaining:.2,deathAge:0};crowd.applyAuthority([pose]);
    crowd.step(1/60,0,[],{x:10,z:10},[]);expect(crowd.people[0].distance).toBeGreaterThan(0);expect(crowd.people[0].distance).toBeLessThan(1);expect(crowd.people[0].panicUntil).toBe(8);
    crowd.applyAuthority([{...pose,health:0,moving:false}]);crowd.step(1/60,0,[],{x:10,z:10},[]);expect(crowd.people[0].deathAge).toBeGreaterThan(0);
  });
  it('shares the real GLB muzzle calibrations and never starts a server projectile through near cover',()=>{
    for(const kind of ['rifle','smg','pistol'] as const){const bytes=readFileSync(`public/assets/rivals/combat3d/weapons/${kind}.glb`),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),metadata=[...gltf.nodes,...gltf.scenes].find(n=>n.extras?.rivalsWeapon)?.extras.rivalsWeapon;expect(metadata.sockets.muzzle).toEqual([...MUZZLE_GEOMETRY[kind]]);}
    const wall={id:'near-cover',kind:'wall' as const,enabled:true,box:new Box3(new Vector3(-2,0,-.4),new Vector3(2,3,-.3))},origin=new Vector3(),aim=new Vector3(0,1.35,-10);
    expect(authoritativeMuzzle(new Vector3(),aim,'rifle',[wall],origin)).toBe(true);expect(origin.z).toBeGreaterThan(-.26);
    const pool=new Projectile3D(),damage=vi.fn(()=>25);pool.fire(origin,aim.sub(origin).normalize(),240,1,50,25,'operative','operative');
    pool.step(.1,[wall],[{id:'guard',team:'security',box:new Box3(new Vector3(-1,0,-3),new Vector3(1,2,-2)),alive:()=>true,damage}],()=>{});expect(damage).not.toHaveBeenCalled();
  });
  it.each([390/844,16/9])('physically aligns the circular optic with the camera centre, including recoil, at aspect %s',aspect=>{
    const view=new FirstPersonWeapon(gun()),camera=new PerspectiveCamera(52,aspect,.025,8);
    view.update(1/60,false,0,1.2);const hip=view.root.position.clone();view.update(1/60,true,0,1.2);
    expect(view.root.position.distanceTo(hip)).toBeLessThan(.1);expect(view.root.getObjectByName('reflex-reticle')).toBeDefined();
    for(let i=0;i<180;i++){if(i%10===0)view.fire();view.update(1/60,true,0,1.2);view.aimAt(new Vector3(0,0,-1));}
    view.root.updateMatrixWorld(true);const centre=view.root.localToWorld(new Vector3().fromArray(view.sightPoint)).project(camera);
    expect(Math.abs(centre.x)).toBeLessThan(.0001);expect(Math.abs(centre.y)).toBeLessThan(.0001);expect(centre.z).toBeLessThan(1);
    expect(view.metadata.sockets.sight[1]).toBeGreaterThan(.18);
    const optic=view.root.getObjectByName('rivals-reflex-optic')!;view.dispose();expect(optic.parent).toBeNull();
  });
  it('keeps three simultaneous movement, look and trigger pointers independent and resets on interruption',()=>{
    pointers();const session=new SandboxSession();session.update({status:'playing'});session.input.aimShoots=false;
    const rig=new CameraRig(),runtime={rig} as RaidRuntime;const mounted=render(<FpsTouchControls session={session} runtime={runtime} disabled={false}/>);
    session.setMovement({x:.6,y:-.8});const look=screen.getByTestId('fps-look-area'),shoot=screen.getByRole('button',{name:'Shoot weapon'});
    fireEvent.pointerDown(look,{pointerId:2,clientX:200,clientY:200});fireEvent.pointerDown(shoot,{pointerId:3});fireEvent.pointerMove(look,{pointerId:2,clientX:230,clientY:190});
    const command=session.input.read(emptyCommand());expect(command.fire).toBe(true);expect(command.x).toBe(.6);expect(rig.yaw).not.toBe(0);
    fireEvent.pointerCancel(shoot,{pointerId:4});expect(session.input.read(emptyCommand()).fire).toBe(true);
    fireEvent.pointerUp(shoot,{pointerId:3});expect(session.input.read(emptyCommand()).fire).toBe(false);
    fireEvent.pointerDown(shoot,{pointerId:3});mounted.rerender(<FpsTouchControls session={session} runtime={runtime} disabled/>);session.input.read(emptyCommand());expect(session.input.read(emptyCommand()).fire).toBe(false);session.dispose();
  });
  it('toggles ADS on taps and retains the other POV aim stick',()=>{
    const session=new SandboxSession();session.update({status:'playing'});const runtime={rig:new CameraRig()} as RaidRuntime;
    const mounted=render(<SoldierControls session={session} runtime={runtime} pov="first"/>);
    fireEvent.click(screen.getByRole('button',{name:'Aim down sights'}));expect(runtime.rig.ads).toBe(true);expect(screen.queryByTestId('aim-stick')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Aim down sights'}));expect(runtime.rig.ads).toBe(false);
    mounted.rerender(<SoldierControls session={session} runtime={runtime} pov="third"/>);expect(screen.getByTestId('aim-stick')).toBeDefined();session.dispose();
  });
  it('keeps explosion visuals separate from damage and bounds/cleans all simultaneous effects',()=>{
    const fx=new CinematicImpacts();expect(EXPLOSION_VISUALS.radius).toBe(10);expect(BOMB.radius).toBe(7);
    for(let i=0;i<100;i++){fx.blast(new Vector3(i,1,0));fx.blood(new Vector3(),new Vector3(0,0,-1));fx.stain(new Vector3());}
    fx.update(.01);expect(fx.snapshot.fragments).toBeLessThanOrEqual(72);expect(fx.snapshot.shockwaves).toBe(4);expect(fx.snapshot.stains).toBe(8);
    fx.update(60);expect(fx.snapshot.fragments).toBe(0);expect(fx.snapshot.stains).toBe(0);expect(fx.root.visible).toBe(false);fx.dispose();expect(fx.root.children).toHaveLength(0);
  });
  it('generates blood for body hits but not wall impacts and naturally fades screen droplets',()=>{
    const fx=new CombatEffects({flash:new Texture(),smoke:new Texture(),blast:new Texture()});fx.impact(new Vector3(0,1,0),false);expect(fx.cinematic.snapshot.fragments).toBe(0);
    fx.impact(new Vector3(0,1,0),true,new Vector3(0,0,-1));expect(fx.cinematic.snapshot.fragments).toBe(10);fx.dispose();
    const overlay=new ScreenBlood(document.body);overlay.hurt(.5,20);overlay.update(.01);expect(Number(overlay.root.style.opacity)).toBeGreaterThan(0);overlay.update(3);expect(overlay.root.style.opacity).toBe('0');overlay.dispose();expect(document.querySelector('.r3-screen-blood')).toBeNull();
  });
  it('blocks vehicle blast damage through solid cover and never re-explodes a destroyed vehicle',()=>{
    const car={id:0,x:3,z:0,dx:1,dz:0,length:4,health:200} as CityCar,controller=new VehicleController([car]);
    const wall={id:'wall',kind:'wall' as const,enabled:true,box:new Box3(new Vector3(1,0,-5),new Vector3(1.4,4,5))};
    controller.blast(new Vector3(0,.6,0),7,150,[wall]);expect(car.health).toBe(200);
    controller.blast(new Vector3(0,.6,0),7,400,[]);expect(car.exploded).toBe(true);const count=controller.explosions;controller.blast(new Vector3(),7,400,[]);expect(controller.explosions).toBe(count);
  });
});
