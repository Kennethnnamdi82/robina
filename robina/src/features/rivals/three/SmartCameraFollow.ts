export interface CameraVehicleMotion {
  id: number;
  /** Camera yaw looking along the vehicle's forward axis, in radians. */
  heading: number;
  speed: number;
  length: number;
}
export interface CameraMotion {
  vx: number;
  vz: number;
  sprinting: boolean;
  combat: boolean;
  manual: boolean;
  paused?: boolean;
  vehicle: CameraVehicleMotion | null;
}
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const cameraDamping = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Intent arbitration only. Never changes a controller, weapon or vehicle. */
export class SmartCameraFollow {
  private manualRemaining = 0;
  private combatRemaining = 0;
  private reverseTime = 0;
  private reversing = false;
  private vehicleId: number | null = null;
  private settleRemaining = 0;
  private lastHeading = 0;
  private speedBlend = 0;
  get manual() { return this.manualRemaining > 0; }
  get combat() { return this.combatRemaining > 0; }
  get speed() { return this.speedBlend; }
  manualLook() { this.manualRemaining = 2.2; }
  update(yaw: number, dt: number, enabled: boolean, motion?: CameraMotion) {
    if (!motion || dt <= 0 || motion.paused) return yaw;
    this.manualRemaining = motion.manual ? 2.2 : Math.max(0, this.manualRemaining - dt);
    this.combatRemaining = motion.combat ? .7 : Math.max(0, this.combatRemaining - dt);
    const car = motion.vehicle;
    const speed = car ? Math.abs(car.speed) : Math.hypot(motion.vx, motion.vz);
    const boost = car ? Math.min(1, speed / 22) : motion.sprinting && !this.combat ? Math.min(1, speed / 6) : 0;
    if (!this.combat || car) this.speedBlend += (boost - this.speedBlend) * cameraDamping(5, dt);
    if ((car?.id ?? null) !== this.vehicleId) {
      this.vehicleId = car?.id ?? null; this.reverseTime = 0; this.reversing = false;
      this.settleRemaining = 0;
    }
    if (car) {
      this.reverseTime = car.speed < -.8 ? this.reverseTime + dt : 0;
      if (this.reverseTime > .4) this.reversing = true;
      if (car.speed > .8) this.reversing = false;
      this.lastHeading = car.heading + (this.reversing ? Math.PI : 0);
      this.settleRemaining = .4;
    } else if (speed > .35) {
      this.lastHeading = Math.atan2(-motion.vx, -motion.vz);
      this.settleRemaining = .35;
    } else this.settleRemaining = Math.max(0, this.settleRemaining - dt);
    if (!enabled || this.manual || this.combat || !this.settleRemaining) return yaw;
    const change = angleDelta(yaw, this.lastHeading) * cameraDamping(car ? 2.8 : 3.6, dt);
    // Shortest-arc, bounded turn rate, including 180-degree reversals.
    return yaw + Math.max(-2.4 * dt, Math.min(2.4 * dt, change));
  }
}
