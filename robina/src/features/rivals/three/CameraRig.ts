import { MathUtils, OrthographicCamera, PerspectiveCamera, Vector3, type Camera } from 'three';
import type { Solid3D } from './world3d';
import { traceSolids } from './physics3d';
export const POVS = ['tactical','side','third','first'] as const;
export type POV = typeof POVS[number];
export const POV_LABELS: Record<POV,string> = { tactical: 'TACTICAL / TOP-DOWN',side: 'ACTION / SIDE-VIEW',third: 'THIRD-PERSON / TPS',first: 'FIRST-PERSON / FPS' };
export const ZOOM_KEY = 'rivals_3d_camera_preferences_v1';
export class CameraRig {
  readonly perspective = new PerspectiveCamera(65,1,.045,160);
  readonly orthographic = new OrthographicCamera(-10,10,8,-8,.045,160);
  pov: POV = 'tactical'; yaw = 0; pitch = -.08; ads = false; sensitivity = 1;
  zoom: Record<POV,number> = { tactical: 1,side: 1,third: 1,first: 1 };
  private aspect = 1; private switched = true; private displayZoom = 1;
  private focus = new Vector3(); private desired = new Vector3(); private direction = new Vector3();
  constructor() {
    try { const p = JSON.parse(localStorage.getItem(ZOOM_KEY) ?? '{}'); for (const key of POVS) if (Number.isFinite(p[key])) this.zoom[key] = MathUtils.clamp(p[key],.7,1.4); } catch { /* Local preference may be unavailable. */ }
  }
  get camera(): Camera { return this.pov === 'tactical' || this.pov === 'side' ? this.orthographic : this.perspective; }
  setPOV(pov: POV) { if (!POVS.includes(pov) || pov === this.pov) return; this.pov = pov; this.ads = false; this.switched = true; this.displayZoom = this.zoom[pov]; this.pitch = pov === 'third' ? -.24 : -.08; }
  setZoom(value: number) {
    if (!Number.isFinite(value)) return; this.zoom[this.pov] = MathUtils.clamp(value,.7,1.4);
    try { localStorage.setItem(ZOOM_KEY,JSON.stringify(this.zoom)); } catch { /* Session preference still works. */ }
  }
  cycleZoom() { const presets = [.7,1,1.4],at = presets.findIndex(n => n > this.zoom[this.pov] + .05); this.setZoom(presets[at < 0 ? 0 : at]); }
  rotate(dx: number,dy: number) { if(!Number.isFinite(dx)||!Number.isFinite(dy))return;this.yaw -= dx * .003 * this.sensitivity; this.pitch = MathUtils.clamp(this.pitch - dy * .0025 * this.sensitivity,-1.05,this.pov==='third'?.24:.9); }
  /** Refresh aim orientation without advancing follow/zoom damping twice. */
  refreshLook() {
    if(this.pov!=='first'&&this.pov!=='third')return;
    this.direction.set(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    this.camera.lookAt(this.focus.clone().addScaledVector(this.direction,this.pov==='third'?5:20));this.camera.updateMatrixWorld();
  }
  resize(width: number,height: number) { this.aspect = Math.max(.1,width / Math.max(1,height)); this.perspective.aspect = this.aspect; this.perspective.updateProjectionMatrix(); }
  update(player: Vector3,solids: readonly Solid3D[],dt: number,reduced = false,recoil = 0,look = { x: 0,y: 0 }) {
    this.displayZoom = MathUtils.lerp(this.displayZoom,this.zoom[this.pov],this.switched || reduced ? 1 : 1 - Math.exp(-dt * 12));
    const zoom = this.displayZoom; this.focus.copy(player).y += this.pov === 'first' ? 1.62 : 1.05;
    if (this.pov === 'tactical') {
      this.desired.copy(this.focus).add(new Vector3(0,150,90));
      this.orthographic.far=360;
      const size = (this.aspect < 1 ? 12 : 8) / zoom;
      this.orthographic.left = -size * this.aspect; this.orthographic.right = size * this.aspect; this.orthographic.top = size; this.orthographic.bottom = -size;
    } else if (this.pov === 'side') {
      this.focus.x += MathUtils.clamp(look.x,-1,1) * 1.3; this.focus.y += .35 + MathUtils.clamp(-look.y,-1,1) * .3;
      // Orthographic scale is independent of camera distance. Keep its eye
      // outside the district rather than retracting the near plane through
      // buildings every time the operative passes a foreground obstacle.
      this.desired.copy(this.focus).add(new Vector3(0,48,120));
      this.orthographic.far=360;
      const size = (this.aspect < 1 ? 8 : 5.6) / zoom;
      this.orthographic.left = -size * this.aspect; this.orthographic.right = size * this.aspect; this.orthographic.top = size; this.orthographic.bottom = -size;
    } else {
      this.direction.set(-Math.sin(this.yaw) * Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw) * Math.cos(this.pitch));
      if (this.pov === 'first') this.desired.copy(this.focus);
      else this.desired.copy(this.focus).addScaledVector(this.direction,-(this.ads ? 2.1 : 4.2) / zoom).add(new Vector3(Math.cos(this.yaw) * .35,.65,-Math.sin(this.yaw) * .35));
      this.perspective.fov = this.pov === 'first' ? MathUtils.clamp(72 / zoom * (this.ads ? .72 : 1),42,90) : 62;
      this.perspective.updateProjectionMatrix();
    }
    // Tactical uses roofless high framing; every low-angle camera tests full 3D solids.
    if (this.pov === 'third' || this.pov === 'first') {
      const offset = this.direction.subVectors(this.desired,this.focus),distance = offset.length();
      if (distance > .01) {
        offset.normalize(); const safe = traceSolids(this.focus,offset,solids,distance,.12);
        if (this.pov === 'third' && safe < 1.15) {
          // A wall directly behind the operative must not push the TPS camera
          // inside their head/chest. Use a collision-tested elevated shoulder.
          this.desired.copy(this.focus).add(new Vector3(Math.sin(this.yaw) * .65,2.1,Math.cos(this.yaw) * .65));
          offset.subVectors(this.desired,this.focus); const elevated = offset.length(); offset.normalize();
          const clear = traceSolids(this.focus,offset,solids,elevated,.12);
          this.desired.copy(this.focus).addScaledVector(offset,Math.max(.03,clear - .12));
        } else this.desired.copy(this.focus).addScaledVector(offset,Math.max(.03,safe - .12));
      }
    }
    // A TPS orbit is not allowed to pass below the drivable ground plane,
    // including wide zoom, collision recovery and an already-invalid orbit.
    if(this.pov==='third'||this.pov==='first')this.desired.y=Math.max(.42,this.desired.y);
    const camera = this.camera;
    camera.position.lerp(this.desired,this.switched || reduced || this.pov === 'first' ? 1 : 1 - Math.exp(-dt * 13));
    if(this.pov==='third'||this.pov==='first')camera.position.y=Math.max(.42,camera.position.y);
    if (this.pov === 'first' || this.pov === 'third') {
      this.direction.set(-Math.sin(this.yaw) * Math.cos(this.pitch),Math.sin(this.pitch) + recoil * .012,-Math.cos(this.yaw) * Math.cos(this.pitch));
      camera.lookAt(this.focus.clone().addScaledVector(this.direction,this.pov === 'third' ? 5 : 20));
    } else camera.lookAt(this.focus);
    this.orthographic.updateProjectionMatrix(); camera.updateMatrixWorld(); this.switched = false;
  }
  /** Screen-relative ground movement in FPS/TPS; side depth lanes lock only in the air. */
  movement(x: number,y: number,grounded: boolean) {
    if (this.pov === 'third' || this.pov === 'first') return { x: x * Math.cos(this.yaw) + y * Math.sin(this.yaw),y: -x * Math.sin(this.yaw) + y * Math.cos(this.yaw) };
    return { x,y: this.pov === 'side' && !grounded ? 0 : y };
  }
}
