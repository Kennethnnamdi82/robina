import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, X } from 'lucide-react';
import { STATUS_LABELS, safeWebUrl, type SubmissionStatus } from './model';

export function StatusBadge({ status }: { status: SubmissionStatus | 'active' | 'closed' }) {
  return <span className="rb-status" data-status={status}>{status === 'active' ? 'Active' : status === 'closed' ? 'Closed' : STATUS_LABELS[status]}</span>;
}
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const safe = safeWebUrl(href);
  return safe ? <a className="rb-external" href={safe} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14}/><span className="sr-only"> (opens in a new tab)</span></a> : <span>Link unavailable</span>;
}
export function BountyDialog({ title, description, onClose, returnFocus, children, className = '' }: {
  title: string; description: string; onClose: () => void; returnFocus?: HTMLElement; children: ReactNode;
  className?: string;
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="rb-overlay"/>
    <Dialog.Content className={'rb-dialog ' + className} onCloseAutoFocus={event => {
      if (returnFocus) { event.preventDefault(); (returnFocus.matches(':disabled') ? returnFocus.closest<HTMLElement>('article, section') : returnFocus)?.focus(); }
    }}>
      <Dialog.Close className="rb-icon-button rb-close" aria-label="Close bounty dialog"><X size={20}/></Dialog.Close>
      <span className="rh-eyebrow">RIVALS / BOUNTY COMMAND</span>
      <Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description>
      {children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
