import { MathUtils, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3, type Camera } from 'three';
import type { Solid3D } from './world3d';
import { CameraObstruction } from './CameraObstruction';
import { cameraDamping, SmartCameraFollow, type CameraMotion } from './SmartCameraFollow';
export const POVS = ['tactical','side','third','first'] as const;
export type POV = typeof POVS[number];
export const POV_LABELS: Record<POV,string> = { tactical: 'TACTICAL / TOP-DOWN',side: 'ACTION / SIDE-VIEW',third: 'THIRD-PERSON / TPS',first: 'FIRST-PERSON / FPS' };
export const ZOOM_KEY = 'rivals_3d_camera_preferences_v1';
const STILL_LOOK = { x: 0, y: 0 };

export class CameraRig {
  readonly perspective = new PerspectiveCamera(65,1,.045,160);
  readonly orthographic = new OrthographicCamera(-10,10,8,-8,.045,360);
  pov: POV = 'tactical'; yaw = 0; pitch = -.08; ads = false; sensitivity = 1;
  zoom: Record<POV,number> = { tactical: 1,side: 1,third: 1,first: 1 };
  private aspect = 1; private initialized = false; private displayZoom = 1;
  private focus = new Vector3(); private desired = new Vector3(); private direction = new Vector3();
  private lookTarget = new Vector3(); private desiredLook = new Vector3();
  private previousRotation = new Quaternion();
  private desiredRotation = new Quaternion();
  private follow = new SmartCameraFollow(); private obstruction = new CameraObstruction();
  private transition = 0; private halfHeight = 8;
  private matchProjection = false; private transitionFov = 65;
  private movementYaw = 0; private moving = false; private vehicleYaw = 0; private steering = false;
  private mounted = false; private footPitch = -.09;
  private needsSettlement = false;
  private adsBlend = 0;
  get settling() { return this.transition > 0 || this.needsSettlement; }
  bodyVisible = true;
  constructor() {
    try { const p = JSON.parse(localStorage.getItem(ZOOM_KEY) ?? '{}'); for (const key of POVS) if (Number.isFinite(p[key])) this.zoom[key] = MathUtils.clamp(p[key],.7,1.4); } catch { /* Preference storage is optional. */ }
  }
  get camera(): Camera { return this.pov === 'tactical' || this.pov === 'side' ? this.orthographic : this.perspective; }
  setPOV(pov: POV) {
    if (!POVS.includes(pov) || pov === this.pov) return;
    const previous = this.camera;
    this.pov = pov; this.ads = false;
    if (this.initialized) {
      this.matchProjection = previous !== this.camera;
      this.transitionFov = this.perspective.fov;
      this.camera.position.copy(previous.position); this.camera.quaternion.copy(previous.quaternion);
      this.transition = .7;
    }
    this.displayZoom = this.zoom[pov]; this.pitch = pov === 'third' ? -.09 : -.08;
    if (this.mounted) this.footPitch = this.pitch;
    this.moving = this.steering = false; this.obstruction.reset();
  }
  setZoom(value: number) {
    if (!Number.isFinite(value)) return; this.zoom[this.pov] = MathUtils.clamp(value,.7,1.4);
    try { localStorage.setItem(ZOOM_KEY,JSON.stringify(this.zoom)); } catch { /* Session preference still works. */ }
  }
  cycleZoom() { const presets = [.7,1,1.4],at = presets.findIndex(n => n > this.zoom[this.pov] + .05); this.setZoom(presets[at < 0 ? 0 : at]); }
  rotate(dx: number,dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !dx && !dy) return;
    this.yaw -= dx * .003 * this.sensitivity;
    this.pitch = MathUtils.clamp(this.pitch - dy * .0025 * this.sensitivity,this.pov==='third'?-.55:-1.05,this.pov==='third'?.24:.9);
    this.follow.manualLook(); this.movementYaw = this.vehicleYaw = this.yaw;
  }
  /** Refresh aim orientation without advancing follow/zoom damping twice. */
  refreshLook() {
    if (this.pov !== 'first' && this.pov !== 'third') return;
    this.direction.set(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    this.lookTarget.copy(this.camera.position).addScaledVector(this.direction,this.pov === 'third' || this.mounted ? 5 : 20);
    this.camera.lookAt(this.lookTarget); this.camera.updateMatrixWorld();
  }
  resize(width: number,height: number) {
    this.aspect = Math.max(.1,width / Math.max(1,height));
    this.perspective.aspect = this.aspect; this.perspective.updateProjectionMatrix();
  }
  update(player: Vector3,solids: readonly Solid3D[],delta: number,reduced = false,recoil = 0,look = STILL_LOOK,motion?: CameraMotion) {
    const dt = MathUtils.clamp(Number.isFinite(delta) ? delta : 0,0,.2);
    const car = motion?.vehicle;
    if (Boolean(car) !== this.mounted) {
      if(car)this.ads=false;
      if (car) this.footPitch = this.pitch;
      else this.pitch = this.footPitch;
      this.mounted = Boolean(car); this.transitionFov = this.perspective.fov;
      if (!this.transition) this.matchProjection = false;
      this.transition = this.initialized ? .7 : 0;
      this.moving = this.steering = false;
    }
    const view = car && this.pov === 'first' ? 'third' : this.pov;
    const combat = Boolean(motion?.combat || this.ads);
    const followMotion = motion;
    // ADS also locks automatic rotation even when a caller omits combat context.
    if (followMotion && this.ads) {
      this.yaw = this.follow.update(this.yaw,dt,false,followMotion);
    } else this.yaw = this.follow.update(this.yaw,dt,view === 'third',followMotion);
    const immediate = !this.initialized || reduced;
    if(view==='third'&&!car&&!this.follow.manual&&!combat&&Math.hypot(motion?.vx??0,motion?.vz??0)>.35)this.pitch+=(-.09-this.pitch)*cameraDamping(2.5,dt);
    this.adsBlend+=(Number(this.ads)-this.adsBlend)*(immediate?1:cameraDamping(16,dt));
    this.displayZoom += (this.zoom[this.pov] - this.displayZoom) * (immediate ? 1 : cameraDamping(12,dt));
    const zoom = this.displayZoom, boost = this.follow.speed;
    this.focus.copy(player); this.focus.y += view === 'first' ? 1.62 : car ? 1.1 : 1.05;
    this.obstruction.occupiedVehicle(car?.id ?? null,car?.length);
    if (view === 'tactical' || view === 'side') {
      if (view === 'side') {
        this.focus.x += MathUtils.clamp(look.x,-1,1) * 1.3;
        this.focus.y += .35 + MathUtils.clamp(-look.y,-1,1) * .3;
      }
      if (motion && car) {
        this.focus.x += MathUtils.clamp(motion.vx * .15,-2,2);
        this.focus.z += MathUtils.clamp(motion.vz * .15,-2,2);
      } else if (motion && view === 'tactical') {
        this.focus.x += MathUtils.clamp(motion.vx * .12,-.8,.8);
        this.focus.z += MathUtils.clamp(motion.vz * .12,-.8,.8);
      }
      this.desired.copy(this.focus); this.desired.y += view === 'tactical' ? 150 : 48;
      this.desired.z += view === 'tactical' ? 90 : 120;
      this.desiredLook.copy(this.focus);
    } else {
      const pitch = car ? MathUtils.clamp(this.pitch - .07,-.65,.12) : this.pitch;
      this.direction.set(-Math.sin(this.yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(this.yaw)*Math.cos(pitch));
      if (view === 'first') this.desired.copy(this.focus);
      else {
        const distance = car ? Math.max(5.2,car.length * .82) + boost * 2.5 : this.ads ? 1.85 : 3.05 + boost * .65;
        this.desired.copy(this.focus).addScaledVector(this.direction,-distance / zoom);
        this.desired.x += Math.cos(this.yaw) * (car ? 0 : .48);
        this.desired.y += car ? 1.1 : .48;
        this.desired.z -= Math.sin(this.yaw) * (car ? 0 : .48);
      }
      this.desired.y = Math.max(.42,this.desired.y);
      this.obstruction.boom(this.focus,this.desired,solids,dt,this.yaw,view === 'third',immediate);
      this.direction.set(-Math.sin(this.yaw)*Math.cos(pitch),Math.sin(pitch)+recoil*.012,-Math.cos(this.yaw)*Math.cos(pitch));
      if (car && this.obstruction.elevated) this.desiredLook.copy(this.focus);
      else this.desiredLook.copy(this.desired).addScaledVector(this.direction,view === 'third' ? 5 : 20);
    }
    const camera = this.camera;
    const positionRate = car ? 7 : view === 'first' ? 24 : 13;
    // Head tracking has no positional latency; POV/vehicle transitions still blend.
    camera.position.lerp(this.desired,immediate || view === 'first' && !this.transition ? 1 : cameraDamping(positionRate,dt));
    if (view === 'third' || view === 'first') {
      camera.position.y = Math.max(.42,camera.position.y);
      this.obstruction.constrain(this.focus,camera.position,solids);
    }
    const switching = this.transition > 0 && !immediate;
    if ((view === 'third' || view === 'first') && !switching) {
      // A lagged shoulder position must never introduce sideways aim drift.
      // Orient from the actual eye, not a moving player-relative look target.
      if (car && this.obstruction.elevated) this.desiredLook.copy(this.focus);
      else this.desiredLook.copy(camera.position).addScaledVector(this.direction,view === 'third' ? 5 : 20);
    }
    this.lookTarget.lerp(this.desiredLook,immediate || !switching ? 1 : cameraDamping(12,dt));
    this.previousRotation.copy(camera.quaternion);
    camera.lookAt(this.lookTarget);
    if ((switching || car) && !combat && !motion?.manual) {
      this.desiredRotation.copy(camera.quaternion);
      camera.quaternion.copy(this.previousRotation).slerp(this.desiredRotation,cameraDamping(12,dt));
    }
    const size = (view === 'tactical' ? this.aspect < 1 ? 12 : 8 : this.aspect < 1 ? 8 : 5.6) / zoom;
    const baseFov = car ? 59 + boost * 9 : view === 'first' ? MathUtils.clamp(72 / zoom * (1-this.adsBlend*.28),42,90) : MathUtils.lerp(57+boost*4,49,this.adsBlend);
    const targetSpan = view === 'side' || view === 'tactical' ? size : Math.tan(MathUtils.degToRad(baseFov / 2)) * this.desired.distanceTo(this.desiredLook);
    this.halfHeight += (targetSpan - this.halfHeight) * (immediate || !switching ? 1 : cameraDamping(12,dt));
    this.orthographic.left = -this.halfHeight * this.aspect; this.orthographic.right = this.halfHeight * this.aspect;
    this.orthographic.top = this.halfHeight; this.orthographic.bottom = -this.halfHeight;
    const matchedFov = MathUtils.radToDeg(2 * Math.atan(this.halfHeight / Math.max(.05,camera.position.distanceTo(this.lookTarget))));
    const weight = switching ? MathUtils.smoothstep(this.transition / .7,0,1) : 0;
    this.perspective.fov = MathUtils.lerp(baseFov,this.matchProjection ? MathUtils.clamp(matchedFov,3,110) : this.transitionFov,weight);
    this.perspective.updateProjectionMatrix(); this.orthographic.updateProjectionMatrix();
    camera.updateMatrixWorld(); this.transition = Math.max(0,this.transition-dt);
    // Draw the exact endpoint after the last blended frame even while paused.
    // Otherwise an idle renderer can retain the penultimate FOV/orientation.
    this.needsSettlement = switching && this.transition === 0 || camera.position.distanceToSquared(this.desired) > .0001 || Math.abs(this.displayZoom-this.zoom[this.pov]) > .0001;
    const eyeHeight = camera.position.y-player.y;
    this.bodyVisible = view !== 'first' && (Math.hypot(camera.position.x-player.x,camera.position.z-player.z) > .55 || eyeHeight > 1.9 || eyeHeight < .05);
    this.initialized = true;
  }
  /** Keep a held gesture in world space while automatic yaw catches up.
   * Manual look/aim refresh the basis immediately; a fresh gesture re-latches. */
  movement(x: number,y: number,grounded: boolean) {
    if (this.pov === 'third' || this.pov === 'first') {
      if (!this.moving || this.pov === 'first' || this.follow.manual || this.follow.combat || this.ads) this.movementYaw = this.yaw;
      this.moving = Math.hypot(x,y) > .08;
      const yaw = this.movementYaw;
      return { x: x * Math.cos(yaw) + y * Math.sin(yaw),y: -x * Math.sin(yaw) + y * Math.cos(yaw) };
    }
    return { x,y: this.pov === 'side' && !grounded ? 0 : y };
  }
  /** The same camera-input basis is sent to the server and used for prediction. */
  drivingYaw(x: number,y: number) {
    if (this.pov === 'tactical' || this.pov === 'side') return 0;
    if (!this.steering || this.follow.manual) this.vehicleYaw = this.yaw;
    this.steering = Math.hypot(x,y) > .12;
    return this.vehicleYaw;
  }
}
