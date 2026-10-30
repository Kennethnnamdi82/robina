import type { KeyboardEvent } from 'react';
export function trapFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const nodes = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, a[href], [tabindex="0"]');
  if (!nodes.length) return;
  if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
  else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
}
