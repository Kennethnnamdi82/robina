import { MathUtils, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3, type Camera } from 'three';
import type { Solid3D } from './world3d';
import { CameraObstruction } from './CameraObstruction';
import { cameraDamping, type CameraMotion } from './SmartCameraFollow';
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
  private obstruction = new CameraObstruction();
  private previousPlayer = new Vector3();
  private transition = 0; private halfHeight = 8;
  private matchProjection = false; private transitionFov = 65;
  private mounted = false; private footPitch = -.09;
  private needsSettlement = false;
  private adsBlend = 0;
  get settling() { return this.transition > 0 || this.needsSettlement; }
  get transitioning(){return this.transition>0;}
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
    this.obstruction.reset();
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
    this.refreshLook();
  }
  /** Refresh aim orientation without advancing follow/zoom damping twice. */
  refreshLook() {
    if (this.mounted || this.pov !== 'first' && this.pov !== 'third') return;
    this.direction.set(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    this.lookTarget.copy(this.camera.position).addScaledVector(this.direction,this.pov === 'third' || this.mounted ? 5 : 20);
    this.camera.lookAt(this.lookTarget); this.camera.updateMatrixWorld();
  }
  resize(width: number,height: number) {
    this.aspect = Math.max(.1,width / Math.max(1,height));
    this.perspective.aspect = this.aspect; this.perspective.updateProjectionMatrix();
  }
  update(player: Vector3,solids: readonly Solid3D[],delta: number,reduced = false,recoil = 0,_look = STILL_LOOK,motion?: CameraMotion) {
    const dt = MathUtils.clamp(Number.isFinite(delta) ? delta : 0,0,.2);
    const car = motion?.vehicle;
    if (Boolean(car) !== this.mounted) {
      if(car)this.ads=false;
      if (car) this.footPitch = this.pitch;
      else this.pitch = this.footPitch;
      this.mounted = Boolean(car); this.transitionFov = this.perspective.fov;
      if (!this.transition) this.matchProjection = false;
      this.transition = this.initialized ? .7 : 0;
    }
    const view = car && this.pov === 'first' ? 'third' : this.pov;
    const combat = Boolean(motion?.combat || this.ads);
    const immediate = !this.initialized || reduced;
    this.adsBlend+=(Number(this.ads)-this.adsBlend)*(immediate?1:cameraDamping(16,dt));
    this.displayZoom += (this.zoom[this.pov] - this.displayZoom) * (immediate ? 1 : cameraDamping(12,dt));
    const zoom = this.displayZoom;
    this.focus.copy(player); this.focus.y += view === 'first' ? 1.62 : car ? 1.1 : 1.05;
    this.obstruction.occupiedVehicle(car?.id ?? null,car?.length);
    if (view === 'tactical' || view === 'side') {
      if (view === 'side') this.focus.y += .35;
      this.desired.copy(this.focus); this.desired.y += view === 'tactical' ? 150 : 48;
      this.desired.z += view === 'tactical' ? 90 : 120;
      this.desiredLook.copy(this.focus);
    } else {
      const pitch = car ? MathUtils.clamp(this.pitch - .07,-.65,.12) : this.pitch;
      this.direction.set(-Math.sin(this.yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(this.yaw)*Math.cos(pitch));
      if (view === 'first') this.desired.copy(this.focus);
      else {
        const distance = car ? Math.max(5.2,car.length * .82) : MathUtils.lerp(3.05,1.85,this.adsBlend);
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
    const positionRate = car ? 12 : view === 'first' ? 24 : 16;
    // Translation follows the same interpolated position as the character.
    // Damp only changes to the boom/zoom, not ordinary walking a second time.
    // This also avoids an apparent stop-and-catch-up after each server correction.
    if (this.initialized && !this.transition) camera.position.add(player).sub(this.previousPlayer);
    this.previousPlayer.copy(player);
    // Head tracking has no positional latency; POV/vehicle transitions still blend.
    camera.position.lerp(this.desired,immediate || view === 'first' && !this.transition ? 1 : cameraDamping(positionRate,dt));
    if (view === 'third' || view === 'first') {
      camera.position.y = Math.max(.42,camera.position.y);
      this.obstruction.constrain(this.focus,camera.position,solids);
    }
    const switching = this.transition > 0 && !immediate;
    const blendLook = switching && !combat && !motion?.manual;
    if (!blendLook) {
      // A lagged shoulder position must never introduce sideways aim drift.
      // Orient from the actual eye, not a moving player-relative look target.
      if(view==='tactical'||view==='side')this.desiredLook.sub(this.desired).add(camera.position);
      else if (car && this.obstruction.elevated) this.desiredLook.copy(this.focus);
      else this.desiredLook.copy(camera.position).addScaledVector(this.direction,view === 'third' ? 5 : 20);
    }
    this.lookTarget.lerp(this.desiredLook,immediate || !blendLook ? 1 : cameraDamping(12,dt));
    this.previousRotation.copy(camera.quaternion);
    camera.lookAt(this.lookTarget);
    if ((switching || car) && !combat && !motion?.manual) {
      this.desiredRotation.copy(camera.quaternion);
      camera.quaternion.copy(this.previousRotation).slerp(this.desiredRotation,cameraDamping(car?18:12,dt));
    }
    const size = (view === 'tactical' ? this.aspect < 1 ? 12 : 8 : this.aspect < 1 ? 8 : 5.6) / zoom;
    const baseFov = car ? 59 : view === 'first' ? MathUtils.clamp(72 / zoom * (1-this.adsBlend*.28),42,90) : MathUtils.lerp(57,49,this.adsBlend);
    const targetSpan = view === 'side' || view === 'tactical' ? size : Math.tan(MathUtils.degToRad(baseFov / 2)) * this.desired.distanceTo(this.desiredLook);
    this.halfHeight += (targetSpan - this.halfHeight) * (immediate || !switching ? 1 : cameraDamping(12,dt));
    const halfWidth=this.halfHeight*this.aspect;
    const projectionChanged=Math.abs(this.orthographic.right-halfWidth)>1e-6||Math.abs(this.orthographic.top-this.halfHeight)>1e-6;
    const matchedFov = MathUtils.radToDeg(2 * Math.atan(this.halfHeight / Math.max(.05,camera.position.distanceTo(this.lookTarget))));
    const weight = switching ? MathUtils.smoothstep(this.transition / .7,0,1) : 0;
    const fov=MathUtils.lerp(baseFov,this.matchProjection ? MathUtils.clamp(matchedFov,3,110) : this.transitionFov,weight);
    // These invert projection matrices. Ordinary following changes the world
    // transform only; do not rebuild both projections on every rendered frame.
    const fovChanged=Math.abs(this.perspective.fov-fov)>1e-6;this.perspective.fov=fov;
    if(fovChanged)this.perspective.updateProjectionMatrix();
    if(projectionChanged){this.orthographic.left=-halfWidth;this.orthographic.right=halfWidth;this.orthographic.top=this.halfHeight;this.orthographic.bottom=-this.halfHeight;this.orthographic.updateProjectionMatrix();}
    camera.updateMatrixWorld(); this.transition = Math.max(0,this.transition-dt);
    // Draw the exact endpoint after the last blended frame even while paused.
    // Otherwise an idle renderer can retain the penultimate FOV/orientation.
    this.needsSettlement = switching && this.transition === 0 || camera.position.distanceToSquared(this.desired) > .0001 || Math.abs(this.displayZoom-this.zoom[this.pov]) > .0001;
    const eyeHeight = camera.position.y-player.y;
    this.bodyVisible = view !== 'first' && (Math.hypot(camera.position.x-player.x,camera.position.z-player.z) > .55 || eyeHeight > 1.9 || eyeHeight < .05);
    this.initialized = true;
  }
  /** Movement always uses the selected view, never an auto-follow timer. */
  movement(x: number,y: number,grounded: boolean) {
    if (this.pov === 'third' || this.pov === 'first') {
      const yaw = this.yaw;
      return { x: x * Math.cos(yaw) + y * Math.sin(yaw),y: -x * Math.sin(yaw) + y * Math.cos(yaw) };
    }
    return { x,y: this.pov === 'side' && !grounded ? 0 : y };
  }
  /** The same camera-input basis is sent to the server and used for prediction. */
  drivingYaw(_x: number,_y: number) {
    if (this.pov === 'tactical' || this.pov === 'side') return 0;
    return this.yaw;
  }
}
