import { describe, expect, it } from 'vitest';
import { ANIMATION_STATES, animationPlan, FACINGS } from './definitions';

describe('character presentation contract', () => {
  it('keeps every directional loop in its own authored atlas row', () => {
    const all = new Set<string>();
    for (const facing of FACINGS) {
      const plan = animationPlan('walk', facing);
      expect(plan.authored).toBe(true);
      expect(plan.frameNames).toHaveLength(6);
      plan.frameNames.forEach(name => { expect(name.startsWith(`walk/${facing}/`)).toBe(true); all.add(name); });
    }
    expect(all.size).toBe(24);
  });
  it('makes missing clips explicit rather than claiming authored combat animation', () => {
    for (const state of ANIMATION_STATES.filter(s => s !== 'walk')) {
      const plan = animationPlan(state, 'up');
      expect(plan.authored).toBe(false);
      expect(plan.fallback).not.toBeNull();
    }
    expect(animationPlan('run', 'left').frameRate).toBeGreaterThan(animationPlan('walk', 'left').frameRate);
    expect(animationPlan('idle', 'down').frameNames).toEqual(['walk/down/2']);
  });
});
