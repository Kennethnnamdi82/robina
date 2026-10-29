import { describe, expect, it } from 'vitest';
import { FrameMetrics } from './FrameMetrics';

describe('measured frame timing', () => {
  it('measures actual intervals and includes active frame stalls', () => {
    const frames = new FrameMetrics();
    for (let i = 0; i < 100; i++) frames.record(1000 + i * (1000 / 60));
    expect(frames.read().fps).toBeCloseTo(60);
    frames.record(10000);
    expect(frames.read().fps).toBeLessThan(20);
  });
  it('excludes explicit pause duration and bounds its sample window', () => {
    const frames = new FrameMetrics(); frames.record(100); frames.record(120);
    frames.resetClock(); frames.record(10000); frames.record(10020);
    expect(frames.read().fps).toBe(50);
    for (let i = 0; i < 500; i++) frames.record(20000 + i * 25);
    expect(frames.read().fps).toBe(40);
  });
});
