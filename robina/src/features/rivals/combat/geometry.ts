export interface Blocker { id: string; x: number; y: number; width: number; height: number; enabled: boolean }
/** Swept segment vs expanded AABB. Includes a segment beginning inside a solid. */
export function segmentBox(x: number, y: number, dx: number, dy: number, box: Blocker, radius = 0): number {
  let near = 0, far = 1;
  const left = box.x - box.width / 2 - radius, right = box.x + box.width / 2 + radius;
  const top = box.y - box.height / 2 - radius, bottom = box.y + box.height / 2 + radius;
  if (Math.abs(dx) < 1e-9) { if (x < left || x > right) return Infinity; }
  else { const a = (left - x) / dx, b = (right - x) / dx; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
  if (Math.abs(dy) < 1e-9) { if (y < top || y > bottom) return Infinity; }
  else { const a = (top - y) / dy, b = (bottom - y) / dy; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
  return near <= far && far >= 0 && near <= 1 ? near : Infinity;
}
export function segmentCircle(x: number, y: number, dx: number, dy: number, cx: number, cy: number, radius: number): number {
  const ox = x - cx, oy = y - cy, c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), discriminant = b * b - 4 * a * c;
  if (a < 1e-9 || discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}
