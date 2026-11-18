// Retain ordinary stalls instead of silently running the world in slow motion.
// One slice is bounded; the authority yields to sockets before draining more.
export const MAX_SIMULATION_DEBT = 1;
export const MAX_STEPS_PER_SLICE = 6;
export function simulationBudget(accumulator, delta, step) {
  const debt = (accumulator ?? 0) + Math.max(0, delta);
  if (debt > MAX_SIMULATION_DEBT) return { steps: 0, remaining: 0, interrupted: true };
  const steps = Math.min(MAX_STEPS_PER_SLICE, Math.floor((debt + 1e-9) / step));
  return { steps, remaining: Math.max(0, debt - steps * step), interrupted: false };
}
