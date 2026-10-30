import { expect, it } from 'vitest';
import { simulationDelta } from './simulation';
it('retains normal frame timing and bounds long or invalid frames without accumulated debt', () => {
  for (const hz of [15, 30, 60, 120]) expect(simulationDelta(1000 / hz)).toBeCloseTo(1000 / hz);
  expect(simulationDelta(3000)).toBe(100); expect(simulationDelta(-10)).toBe(0); expect(simulationDelta(NaN)).toBe(0);
  expect(simulationDelta(16)).toBe(16);
});
