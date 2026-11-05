import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import type { Vector } from '../core/contracts';
import { movementVector } from '../systems/movement';

/** One owner per stick; another finger's cancellation must never reset this pointer. */
export function TouchStick({ onMove, onPress, disabled, kind = 'move' }: { onMove: (vector: Vector) => void; onPress?: (held: boolean) => void; disabled: boolean; kind?: 'move' | 'aim' | 'drive' }) {
  const owner = useRef<number | null>(null), node = useRef<HTMLDivElement>(null), callback = useRef(onMove);
  const bounds = useRef<DOMRect>();
  const press = useRef(onPress); callback.current = onMove; press.current = onPress;
  const reset = useCallback(() => {
    const id = owner.current; owner.current = null;
    if (node.current && id !== null && node.current.hasPointerCapture?.(id)) node.current.releasePointerCapture(id);
    node.current?.style.setProperty('--stick-x', '0px'); node.current?.style.setProperty('--stick-y', '0px');
    callback.current({ x: 0, y: 0 }); if (id !== null) press.current?.(false);
  }, []);
  useEffect(() => { if (disabled) reset(); return reset; }, [disabled, reset]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset); window.addEventListener('resize', reset); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', reset); window.removeEventListener('resize', reset); document.removeEventListener('visibilitychange', hidden); };
  }, [reset]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = bounds.current ?? event.currentTarget.getBoundingClientRect(), radius = Math.min(38, rect.width * .28);
    const value = movementVector((event.clientX - rect.left - rect.width / 2) / radius, (event.clientY - rect.top - rect.height / 2) / radius, kind === 'aim' ? .055 : .08);
    event.currentTarget.style.setProperty('--stick-x', (value.x * radius) + 'px'); event.currentTarget.style.setProperty('--stick-y', (value.y * radius) + 'px');
    callback.current(value);
  };
  return <div className={'rivals-touch-controls rv-stick-control rv-stick-' + kind} aria-hidden={disabled}>
    <div ref={node} className="rivals-stick" role="group" aria-label={kind === 'move' ? 'Movement joystick' : kind === 'drive' ? 'Driving joystick' : 'Aiming joystick'} data-testid={kind === 'move' ? 'movement-stick' : kind === 'drive' ? 'driving-stick' : 'aim-stick'}
      onPointerDown={event => { if (disabled || owner.current !== null) return; event.preventDefault(); bounds.current = event.currentTarget.getBoundingClientRect(); owner.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); press.current?.(true); }}
      onPointerMove={event => { if (!disabled && owner.current === event.pointerId) move(event); }}
      onPointerUp={event => { if (owner.current === event.pointerId) reset(); }}
      onPointerCancel={event => { if (owner.current === event.pointerId) reset(); }}
      onLostPointerCapture={event => { if (owner.current === event.pointerId) reset(); }}>
      <span className="rivals-stick-cross" /><span className="rivals-stick-knob" style={{ transform: 'translate(var(--stick-x,0px),var(--stick-y,0px))' }} />
    </div><span className="rivals-stick-label">{kind === 'move' ? 'MOVE' : kind === 'drive' ? 'DRIVE / REVERSE' : 'AIM / FIRE'}</span>
  </div>;
}
