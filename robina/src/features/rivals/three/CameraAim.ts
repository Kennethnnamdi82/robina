import type {Ray,Vector3} from 'three';
/** Shoulder-camera cover behind the chest must never reverse a firing ray.
 * Bullet sweeps still independently enforce muzzle-to-cover obstruction. */
export function aimNearDistance(ray:Ray,player:Vector3){
  return Math.max(.05,(player.x-ray.origin.x)*ray.direction.x+(player.y+1.23-ray.origin.y)*ray.direction.y+(player.z-ray.origin.z)*ray.direction.z+.35);
}
