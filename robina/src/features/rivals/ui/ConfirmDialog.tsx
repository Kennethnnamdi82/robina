import { useEffect, useRef } from 'react';

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus(); const node = dialog.current; return () => node?.close(); }, []);
  return <dialog ref={dialog} className="rivals-guide rv-confirm" aria-labelledby="rv-confirm-title" onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={e => e.stopPropagation()}>
    <span className="rivals-overline">CONFIRM OPERATION</span><h2 id="rv-confirm-title">{title}</h2><p>{description}</p><div className="rv-confirm-actions"><button ref={cancel} className="rivals-secondary" onClick={onCancel}>CANCEL</button><button className="rivals-primary" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}
