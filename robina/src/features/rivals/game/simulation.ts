/** At most six fixed 60 Hz steps per rendered frame. Discard stall debt rather than teleport. */
export function simulationDelta(deltaMs: number): number {
  return Number.isFinite(deltaMs) ? Math.max(0, Math.min(100, deltaMs)) : 0;
}
