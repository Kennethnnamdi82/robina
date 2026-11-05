import * as T from 'three';
import type { Point } from '../ai/navigation';

/** Sample the navigation polyline, never a straight line through buildings. */
export function roadGuidePoints(player: Point, route: readonly Point[], spacing = 1.8, limit = 56) {
  const result: { x: number; z: number; yaw: number }[] = [];
  let x = player.x * .025, z = player.y * .025, remaining = 1.1;
  for (const point of route) {
    const tx = point.x * .025, tz = point.y * .025, dx = tx - x, dz = tz - z;
    let length = Math.hypot(dx, dz);
    if (length < .001) continue;
    const ux = dx / length, uz = dz / length;
    while (length >= remaining && result.length < limit) {
      x += ux * remaining; z += uz * remaining; length -= remaining;
      result.push({ x, z, yaw: Math.atan2(ux, uz) }); remaining = spacing;
    }
    if (result.length === limit) break;
    remaining -= length; x = tx; z = tz;
  }
  return result;
}

export function routeBearing(player: T.Vector3, next: Point, camera: T.Camera) {
  const direction = new T.Vector3(next.x * .025 - player.x, 0, next.y * .025 - player.z);
  if ((camera as T.OrthographicCamera).isOrthographicCamera) {
    const a = player.clone().project(camera), b = player.clone().add(direction).project(camera);
    // Projection coordinates need the camera aspect for a physical screen angle.
    const ortho = camera as T.OrthographicCamera;
    return Math.atan2((b.x - a.x) * (ortho.right - ortho.left) / (ortho.top - ortho.bottom), b.y - a.y);
  }
  const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
  const forward = camera.getWorldDirection(new T.Vector3()).setY(0).normalize();
  return Math.atan2(direction.dot(right), direction.dot(forward));
}

/** Two bounded draws: road-projected red triangles and a destination marker.
 * Depth testing deliberately stays on: directions never erase buildings. */
export class RoadGuide {
  readonly root = new T.Group();
  private geometry = new T.BufferGeometry();
  private material = new T.MeshBasicMaterial({ color: 0xff332c, toneMapped: false, side: T.DoubleSide, transparent: true, opacity: .96, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  private arrows: T.InstancedMesh;
  private marker: T.Mesh;
  private markerGeometry = new T.ConeGeometry(.48, .9, 3);
  private dummy = new T.Object3D();
  private route?: readonly Point[];
  private anchor = new T.Vector3(Infinity, 0, Infinity);
  count = 0;
  constructor() {
    this.root.name = 'Red mission road guidance';
    this.geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, .56, -.34, 0, -.36, 0, 0, -.16, 0, 0, .56, 0, 0, -.16, .34, 0, -.36], 3));
    this.geometry.computeVertexNormals();
    this.arrows = new T.InstancedMesh(this.geometry, this.material, 56);
    this.arrows.instanceMatrix.setUsage(T.DynamicDrawUsage); this.arrows.frustumCulled = false; this.arrows.count = 0;
    this.marker = new T.Mesh(this.markerGeometry, this.material); this.marker.rotation.z = Math.PI;
    this.root.add(this.arrows, this.marker); this.root.visible = false;
  }
  update(player: T.Vector3, route: readonly Point[], goal: Point | undefined, time: number, reduced = false) {
    this.root.visible = Boolean(goal); if (!goal) { this.count = this.arrows.count = 0; return; }
    if (route !== this.route || player.distanceToSquared(this.anchor) > .36) {
      this.route = route; this.anchor.copy(player);
      const points = roadGuidePoints({ x: player.x * 40, y: player.z * 40 }, route);
      for (const [i, p] of points.entries()) {
        this.dummy.position.set(p.x, .105, p.z); this.dummy.rotation.set(0, p.yaw, 0); this.dummy.updateMatrix();
        this.arrows.setMatrixAt(i, this.dummy.matrix);
      }
      this.count = this.arrows.count = points.length; this.arrows.instanceMatrix.needsUpdate = true;
    }
    this.marker.position.set(goal.x * .025, 2.8 + (reduced ? 0 : Math.sin(time * 2.5) * .12), goal.y * .025);
  }
  dispose() { this.arrows.dispose(); this.geometry.dispose(); this.markerGeometry.dispose(); this.material.dispose(); this.root.clear(); this.root.removeFromParent(); }
}
