import Phaser from 'phaser';
import { ArenaScene, type RuntimeViewport } from './ArenaScene';
import type { ArenaSession } from '../core/session';
import { renderResolution } from '../core/presentation';

export function createArena(host: HTMLElement, session: ArenaSession): () => void {
  const rect = host.getBoundingClientRect();
  const viewport: RuntimeViewport = { cssWidth: Math.max(1, host.clientWidth), cssHeight: Math.max(1, host.clientHeight), ratio: 1, left: rect.left, top: rect.top };
  viewport.ratio = renderResolution(viewport.cssWidth, viewport.cssHeight, devicePixelRatio, session.getSnapshot().quality);
  session.loading('Initializing the renderer');
  const arena = new ArenaScene(session, viewport);
  const game = new Phaser.Game({
    type: Phaser.CANVAS, parent: host,
    width: Math.round(viewport.cssWidth * viewport.ratio), height: Math.round(viewport.cssHeight * viewport.ratio),
    backgroundColor: '#080b16', banner: false,
    render: { antialias: true, roundPixels: false, powerPreference: 'low-power' },
    fps: { target: 60, smoothStep: false, forceSetTimeOut: false },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false, fps: 60, fixedStep: true, customUpdate: true } },
    audio: { noAudio: true },
    input: { activePointers: 3, keyboard: false, mouse: false, touch: false }, scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [arena],
  });
  let previousQuality = session.getSnapshot().quality;
  const resize = () => {
    if (!host.clientWidth || !host.clientHeight || !game.isBooted) return;
    viewport.cssWidth = host.clientWidth; viewport.cssHeight = host.clientHeight;
    const bounds = host.getBoundingClientRect(); viewport.left = bounds.left; viewport.top = bounds.top;
    viewport.ratio = renderResolution(viewport.cssWidth, viewport.cssHeight, devicePixelRatio, session.getSnapshot().quality);
    const width = Math.round(viewport.cssWidth * viewport.ratio), height = Math.round(viewport.cssHeight * viewport.ratio);
    if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height);
    game.canvas.style.width = '100%'; game.canvas.style.height = '100%';
  };
  const unsubscribe = session.subscribe(() => {
    const quality = session.getSnapshot().quality;
    if (quality !== previousQuality) { previousQuality = quality; resize(); }
  });
  const observer = new ResizeObserver(resize); observer.observe(host);
  const contextLost = (event: Event) => { event.preventDefault(); session.fail('The graphics context was interrupted. Return to the lobby to retry.'); };
  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.setAttribute('aria-label', 'Playable RIVALS training arena');
    game.canvas.tabIndex = 0;
    game.canvas.addEventListener('contextlost', contextLost); resize();
  });
  return () => {
    observer.disconnect(); unsubscribe();
    game.canvas?.removeEventListener('contextlost', contextLost);
    arena.release(); session.dispose(); game.destroy(true, false);
    if (game.isBooted && !game.loop.running) { game.loop.resetDelta(); game.loop.wake(); }
    host.replaceChildren();
  };
}
