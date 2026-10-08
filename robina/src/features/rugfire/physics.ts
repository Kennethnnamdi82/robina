import { Box3, Ray, Vector3 } from 'three';
export type Collider = { box: Box3; camera: boolean };
const ray = new Ray(), hit = new Vector3();
export function obstacleDistance(origin: Vector3, direction: Vector3, colliders: Collider[], range: number, cameraOnly = false) {
  ray.set(origin, direction); let nearest = range;
  for (const collider of colliders) {
    if (cameraOnly && !collider.camera) continue;
    if (collider.box.containsPoint(origin)) return 0;
    if (ray.intersectBox(collider.box, hit)) nearest = Math.min(nearest, origin.distanceTo(hit));
  }
  return nearest;
}
export function moveBody(position: Vector3, dx: number, dz: number, colliders: Collider[], radius = .34) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .18));
  for (let step = 0; step < steps; step++) {
    position.x += dx / steps;
    for (const { box } of colliders) {
      if (position.y + 1.65 < box.min.y || position.y > box.max.y) continue;
      if (position.z > box.min.z - radius && position.z < box.max.z + radius && position.x > box.min.x - radius && position.x < box.max.x + radius)
        position.x = dx > 0 ? box.min.x - radius : dx < 0 ? box.max.x + radius : position.x;
    }
    position.z += dz / steps;
    for (const { box } of colliders) {
      if (position.y + 1.65 < box.min.y || position.y > box.max.y) continue;
      if (position.x > box.min.x - radius && position.x < box.max.x + radius && position.z > box.min.z - radius && position.z < box.max.z + radius)
        position.z = dz > 0 ? box.min.z - radius : dz < 0 ? box.max.z + radius : position.z;
    }
    position.x = Math.max(-11.3, Math.min(11.3, position.x)); position.z = Math.max(-81, Math.min(15, position.z));
  }
}
