import type { PointerEvent,MouseEvent } from 'react';

/** Activate a thumb action even when another finger owns a joystick. */
export function press(action: () => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { if (event.button !== 0) return; event.preventDefault(); action(); },
    onClick: (event: MouseEvent<HTMLButtonElement>) => { if (event.detail === 0) action(); },
  };
}
