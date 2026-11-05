/** Fine centre control, full-speed outer travel; independent of screen DPI/FPS. */
export function aimStickResponse(value: number) {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.min(1, Math.abs(value));
  return Math.sign(value) * magnitude * (.28 + .72 * magnitude);
}
export function drivingStick(vector: {x:number;y:number}) {
  return { steer: Math.max(-1, Math.min(1, vector.x)), throttle: Math.max(-1, Math.min(1, -vector.y)) };
}
