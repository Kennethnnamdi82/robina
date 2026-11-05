import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Check, CheckCircle2, CircleDashed, CreditCard, LockKeyhole, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { money, type Product } from './catalog';
import ProductArt from './ProductArt';

export const PURCHASE_STATES = ['available', 'owned', 'equipped', 'purchase-pending', 'verification-pending', 'successful', 'failed', 'cancelled'] as const;
type PurchaseState = typeof PURCHASE_STATES[number];
const COPY: Record<PurchaseState, [string, string]> = {
  available: ['REVIEW YOUR SELECTION', 'Choose a payment option to preview — purchases are coming soon and no money will be taken'],
  owned: ['ALREADY IN YOUR COLLECTION', 'Sample ownership presentation only — This item has not been granted to your account'],
  equipped: ['EQUIPPED FOR DEPLOYMENT', 'Sample equipped presentation only — Your real mission equipment is unchanged'],
  'purchase-pending': ['PAYMENT PROCESSING', 'Sample pending state — No payment request has been sent'],
  'verification-pending': ['AWAITING VERIFICATION', 'Sample verification state — A real purchase must wait for authoritative confirmation'],
  successful: ['PURCHASE CONFIRMED', 'Sample success presentation — No purchase occurred, no receipt was created and no items were granted'],
  failed: ['PURCHASE NOT CONFIRMED', 'Sample failure presentation — Keep your equipment unchanged until payment is verified'],
  cancelled: ['PURCHASE CANCELLED', 'Sample cancellation presentation — No charge and no inventory change'],
};
export default function PurchaseDialog({ product, onClose,review=false }: { product: Product; onClose: () => void;review?:boolean }) {
  const [provider, setProvider] = useState('paystack'), [state, setState] = useState<PurchaseState>('available');
  const opener = useRef(document.activeElement as HTMLElement | null);
  const [heading, description] = COPY[state];
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="rs-overlay"/><Dialog.Content className="rs-dialog rs-checkout" aria-describedby="rs-purchase-description" onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } }}>
    <Dialog.Close className="rs-close" aria-label="Close purchase preview"><X size={20}/></Dialog.Close>
    <div className="rs-dialog-kicker"><LockKeyhole size={13}/> PAYMENT PREVIEW / NO CHARGES</div>
    <Dialog.Title>{heading}</Dialog.Title><Dialog.Description id="rs-purchase-description">{description}</Dialog.Description>
    <div className="rs-order"><ProductArt product={product}/><div><span>{product.subtitle}</span><h3>{product.name}</h3><strong>{money(product.price)} <small>USD · PROPOSED</small></strong></div></div>
    <fieldset className="rs-payment"><legend>PAYMENT METHOD / PREVIEW</legend><button aria-pressed={provider === 'paystack'} onClick={() => setProvider('paystack')}><CreditCard size={19}/><span><strong>Paystack</strong><small>Card & supported local methods</small></span>{provider === 'paystack' && <Check size={17}/>}</button><button aria-pressed={provider === 'base'} onClick={() => setProvider('base')}><span className="rs-base-mark" aria-hidden="true"/><span><strong>Base USDC</strong><small>USDC on Base</small></span>{provider === 'base' && <Check size={17}/>}</button></fieldset>
    {review&&<label className="rs-state-select">PREVIEW A PURCHASE STATE<select value={state} onChange={e => setState(e.target.value as PurchaseState)}>{PURCHASE_STATES.map(s => <option key={s} value={s}>{s.replaceAll('-', ' ').toUpperCase()}</option>)}</select></label>}
    <div className={'rs-verification rs-' + state} role="status">{state === 'successful' ? <CheckCircle2 size={20}/> : state === 'failed' ? <TriangleAlert size={20}/> : <ShieldCheck size={20}/>}<span><strong>{state === 'available' ? 'PURCHASES OPEN SOON' : 'SAMPLE STATE · NOT A TRANSACTION'}</strong><small>No payment is taken while previewing these options</small></span></div>
    <button className="rs-primary" disabled={!review} onClick={() => setState(state === 'available' ? 'purchase-pending' : 'available')}>{!review?'PURCHASES OPEN SOON':state === 'available' ? 'PREVIEW CONFIRMATION' : 'BACK TO REVIEW'}{state === 'available' ? <ArrowRight size={17}/> : <CircleDashed size={17}/>}</button>
    <Dialog.Close className="rs-secondary">CLOSE PREVIEW</Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
