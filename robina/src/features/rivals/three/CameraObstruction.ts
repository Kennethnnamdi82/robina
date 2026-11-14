import { Vector3 } from 'three';
import { rayBox } from './physics3d';
import type { Solid3D } from './world3d';
import { cameraDamping } from './SmartCameraFollow';

/** Padded boom/sweep against existing collision boxes, not render meshes.
 * rayBox performs a conservative segment-AABB rejection before slab tests.
 * All working vectors are reused; the occupied vehicle is skipped by ID. */
export class CameraObstruction {
  private direction = new Vector3();
  private length = Infinity;
  private raised = false;
  private vehicleId: number | null = null;
  private ignore = '';
  private shoulderThreshold = .95;
  get elevated() { return this.raised; }
  reset() { this.length = Infinity; this.raised = false; }
  occupiedVehicle(id: number | null, length = 0) {
    if (id === this.vehicleId) return;
    this.vehicleId = id; this.ignore = id === null ? '' : 'city-traffic-' + id;
    this.shoulderThreshold = id === null ? .95 : length * .5 + .4;
    this.reset();
  }
  private distance(origin: Vector3, end: Vector3, solids: readonly Solid3D[]) {
    this.direction.subVectors(end, origin);
    const distance = this.direction.length();
    if (distance < .001) return distance;
    this.direction.multiplyScalar(1 / distance);
    let safe = distance;
    for (const solid of solids) {
      if (!solid.enabled || solid.id === this.ignore) continue;
      safe = Math.min(safe, rayBox(origin, this.direction, solid, distance, .18));
    }
    return safe < distance ? Math.max(.015, safe - .04) : distance;
  }
  boom(focus: Vector3, desired: Vector3, solids: readonly Solid3D[], dt: number, yaw: number, third: boolean, immediate: boolean) {
    let safe = this.distance(focus, desired, solids);
    // Hysteresis prevents alternating between the head and raised shoulder.
    if (third) {
      if (safe < this.shoulderThreshold) this.raised = true;
      else if (safe > this.shoulderThreshold + .6) this.raised = false;
      if (this.raised) {
        desired.copy(focus); desired.x += Math.sin(yaw) * .65;
        desired.y += 2.1; desired.z += Math.cos(yaw) * .65;
        safe = this.distance(focus, desired, solids);
      }
    }
    this.length = immediate || safe < this.length ? safe : this.length + (safe - this.length) * cameraDamping(5, dt);
    this.direction.subVectors(desired, focus);
    const distance = this.direction.length();
    if (distance > .001) desired.copy(focus).addScaledVector(this.direction, Math.min(distance, this.length) / distance);
  }
  /** Re-test AFTER damping: a safe target does not guarantee a safe lagged eye. */
  constrain(focus: Vector3, eye: Vector3, solids: readonly Solid3D[]) {
    const safe = this.distance(focus, eye, solids), distance = eye.distanceTo(focus);
    if (distance > safe && distance > .001) eye.copy(focus).addScaledVector(this.direction, safe);
  }
}
