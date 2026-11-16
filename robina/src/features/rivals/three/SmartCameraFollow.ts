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

// Kept at its original module path for camera/obstruction consumers. Automatic
// travel following, delayed recentering and reversing flips have been removed.
