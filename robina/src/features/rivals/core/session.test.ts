import { describe, expect, it, vi } from 'vitest';
import { ArenaSession } from './session';

describe('arena session lifecycle', () => {
  it('starts separate missions on HTTP LAN origins without crypto.randomUUID', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues });
    try {
      const first = new ArenaSession(), second = new ArenaSession();
      expect(first.mission.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(second.mission.runId).not.toBe(first.mission.runId);
      expect(first.getSnapshot().status).toBe('loading');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pauses once, clears input, and resumes through the scene controls', () => {
    const session = new ArenaSession();
    const controls = { pause: vi.fn(), resume: vi.fn(), mute: vi.fn() };
    session.attach(controls);
    session.update({ status: 'playing' });
    session.setMovement({ x: 1, y: 0 });
    session.pause(); session.pause();
    expect(session.getSnapshot().status).toBe('paused');
    expect(session.movement).toEqual({ x: 0, y: 0 });
    expect(controls.pause).toHaveBeenCalledTimes(1);
    session.setMovement({ x: 1, y: 0 });
    expect(session.movement.x).toBe(0);
    session.resume();
    expect(controls.resume).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().status).toBe('playing');
  });

  it('ignores late loader events after teardown and removes subscribers', () => {
    const session = new ArenaSession(), listener = vi.fn();
    session.subscribe(listener);
    session.dispose();
    const calls = listener.mock.calls.length;
    session.update({ status: 'playing' });
    session.fail('late import rejection');
    expect(session.getSnapshot().status).toBe('disposed');
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it('reports failed loads without permitting resume into a broken scene', () => {
    const session = new ArenaSession();
    session.fail('tiles unavailable'); session.resume();
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: 'tiles unavailable' });
  });

  it('starts silent and propagates an explicit audio choice', () => {
    const session = new ArenaSession();
    const mute = vi.fn();
    session.attach({ pause: vi.fn(), resume: vi.fn(), mute });
    expect(session.getSnapshot().muted).toBe(true);
    session.toggleMute();
    expect(mute).toHaveBeenCalledWith(false);
  });
});
