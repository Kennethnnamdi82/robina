import { useRef, useState, type PointerEvent } from 'react';
import type { Vector } from '../core/contracts';
import { movementVector } from '../systems/movement';

export function TouchStick({ onMove, disabled }: { onMove: (vector: Vector) => void; disabled: boolean }) {
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const reset = () => { pointer.current = null; setKnob({ x: 0, y: 0 }); onMove({ x: 0, y: 0 }); };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const vector = movementVector((event.clientX - rect.left - rect.width / 2) / 38, (event.clientY - rect.top - rect.height / 2) / 38);
    setKnob({ x: vector.x * 38, y: vector.y * 38 }); onMove(vector);
  };
  return <div className="rivals-touch-controls" aria-hidden={disabled}>
    <div className="rivals-stick" role="group" aria-label="Movement joystick" data-testid="movement-stick"
      onPointerDown={event => { if (disabled || pointer.current !== null) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
      onPointerMove={event => { if (!disabled && pointer.current === event.pointerId) move(event); }}
      onPointerUp={event => { if (pointer.current === event.pointerId) reset(); }}
      onPointerCancel={reset} onLostPointerCapture={reset}>
      <span className="rivals-stick-cross" />
      <span className="rivals-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
    <span className="rivals-stick-label">MOVE</span>
  </div>;
}
