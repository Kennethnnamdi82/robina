import { segmentBox, type Blocker } from '../combat/geometry';
export interface Point { x: number; y: number }
export function clearSight(a: Point, b: Point, blockers: readonly Blocker[], radius = 0) {
  for (const box of blockers) if (box.enabled && segmentBox(a.x, a.y, b.x - a.x, b.y - a.y, box, radius) <= 1) return false;
  return true;
}
/** Shared, bounded BFS workspace. Rebuild occupancy only when solid geometry changes. */
export class NavigationGrid {
  private free: Uint8Array; private seen: Int32Array; private parent: Int32Array; private queue: Int32Array; private stamp = 0;
  searches = 0;
  constructor(readonly width: number, readonly height: number, readonly tile: number, readonly blockers: readonly Blocker[], readonly radius = 18) {
    const size = width * height;
    this.free = new Uint8Array(size); this.seen = new Int32Array(size); this.parent = new Int32Array(size); this.queue = new Int32Array(size); this.rebuild();
  }
  rebuild() {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const px = (x + .5) * this.tile, py = (y + .5) * this.tile;
      this.free[y * this.width + x] = Number(!this.blockers.some(box => box.enabled && segmentBox(px, py, 0, 0, box, this.radius) === 0));
    }
  }
  private cell(point: Point) {
    const x = Math.max(0, Math.min(this.width - 1, Math.floor(point.x / this.tile))), y = Math.max(0, Math.min(this.height - 1, Math.floor(point.y / this.tile)));
    if (this.free[y * this.width + x]) return y * this.width + x;
    for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height && this.free[ny * this.width + nx]) return ny * this.width + nx;
    }
    return -1;
  }
  path(start: Point, finish: Point): Point[] {
    this.searches++;
    const from = this.cell(start), to = this.cell(finish); if (from < 0 || to < 0) return [];
    const stamp = ++this.stamp; let head = 0, tail = 0;
    this.queue[tail++] = from; this.seen[from] = stamp; this.parent[from] = -1;
    while (head < tail) {
      const index = this.queue[head++]; if (index === to) break;
      const x = index % this.width, y = Math.floor(index / this.width);
      for (const next of [x > 0 ? index - 1 : -1, x + 1 < this.width ? index + 1 : -1, y > 0 ? index - this.width : -1, y + 1 < this.height ? index + this.width : -1]) {
        if (next < 0 || !this.free[next] || this.seen[next] === stamp) continue;
        const nx = next % this.width, ny = Math.floor(next / this.width);
        if (!clearSight({ x: (x + .5) * this.tile, y: (y + .5) * this.tile }, { x: (nx + .5) * this.tile, y: (ny + .5) * this.tile }, this.blockers, this.radius)) continue;
        this.seen[next] = stamp; this.parent[next] = index; this.queue[tail++] = next;
      }
    }
    if (this.seen[to] !== stamp) return [];
    const path: Point[] = [];
    for (let index = to; index >= 0; index = this.parent[index]) path.push({ x: (index % this.width + .5) * this.tile, y: (Math.floor(index / this.width) + .5) * this.tile });
    path.reverse();
    if (path.length && clearSight(start, path[1] ?? path[0], this.blockers, this.radius)) path.shift();
    return path;
  }
  move(actor: Point, dx: number, dy: number) {
    let fraction = 1;
    for (const box of this.blockers) if (box.enabled) fraction = Math.min(fraction, segmentBox(actor.x, actor.y, dx, dy, box, this.radius));
    const safe = Math.max(0, Math.min(1, fraction) - .001);
    actor.x += dx * safe; actor.y += dy * safe;
    return safe > .1;
  }
}
