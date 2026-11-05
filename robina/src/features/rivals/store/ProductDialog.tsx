import { lazy, Suspense, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Box, LockKeyhole, Pause, Play, Rotate3D, X } from 'lucide-react';
import { CATALOG, money, referenceStats, type Product, type StoreAccount } from './catalog';
import ProductArt from './ProductArt';
const ModelPreview = lazy(() => import('./ModelPreview'));
export default function ProductDialog({ product: p, onClose, onPurchase, onSelect, account, reduced }: { product: Product; onClose: () => void; onPurchase: (p: Product) => void; onSelect: (p: Product) => void; account?: StoreAccount; reduced: boolean }) {
  const [studio, setStudio] = useState(false), [finish, setFinish] = useState(false), [playing, setPlaying] = useState(false);
  const owned = account?.ownedIds.includes(p.id), equipped = account?.equippedIds.includes(p.id);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="rs-overlay"/><Dialog.Content className="rs-dialog rs-product-dialog" data-reduced={reduced} aria-describedby="rs-product-description">
    <Dialog.Close className="rs-close" aria-label="Close product details"><X size={20}/></Dialog.Close>
    <div className="rs-detail-stage"><div className="rs-stage-label"><span>RIVALS / STUDIO</span><span>COLLECTION PREVIEW</span></div>
      {studio && p.model ? <Suspense fallback={<p className="rs-model-loading" role="status">PREPARING STUDIO…</p>}><ModelPreview model={p.model} finish={finish ? p.finish : undefined} reduced={reduced}/></Suspense> : <ProductArt product={p} large playing={playing && !reduced}/>}
      <div className="rs-studio-controls">{p.model && <button aria-pressed={studio} onClick={() => setStudio(v => !v)}><Rotate3D size={16}/>{studio ? 'CLOSE 3D' : 'INSPECT IN 3D'}</button>}{p.finish && <button aria-pressed={finish} onClick={() => { setFinish(v => !v); setStudio(true); }}>{finish ? 'SHOW ORIGINAL' : 'PREVIEW COLOR STUDY'}</button>}{p.art === 'effect' && <button aria-pressed={playing} onClick={() => setPlaying(v => !v)}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'PAUSE' : 'PLAY'} MOTION STUDY</button>}</div>
      <p>{p.model === 'operative' ? 'BASE OPERATIVE / OUTFIT CONCEPT' : p.art === 'effect' ? 'CONCEPT MOTION ONLY · NOT A GAMEPLAY EFFECT' : p.model ? 'EXISTING REFERENCE ASSET · NOT A FINISHED STORE PRODUCT' : 'DEDICATED ASSET NOT YET AVAILABLE'}</p>
    </div><div className="rs-detail-copy"><span className="rs-kicker">{p.subtitle}</span><Dialog.Title>{p.name}</Dialog.Title><Dialog.Description id="rs-product-description">{p.description}</Dialog.Description>
      <div className="rs-detail-price"><strong>{p.price ? money(p.price) : 'FIELD PICKUP'}</strong><span>{p.price ? 'USD · PROPOSED PRICE' : 'EXISTING GAMEPLAY ONLY'}</span><span className="rs-badge">{equipped ? 'EQUIPPED' : owned ? 'OWNED' : 'COLLECTION PREVIEW'}</span></div>
      {p.proposed && <div className="rs-spec-note"><strong>PROPOSED CATALOG SPECIFICATION</strong><p>{p.proposed.magazine}-round magazine · {p.proposed.ammo}</p><small>Not the current gameplay configuration — Suggested specifications do not rebalance weapons</small></div>}
      {p.reference ? <><h3>CURRENT REFERENCE / GAME CONFIG</h3><dl className="rs-stats">{referenceStats(p.reference).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p className="rs-fineprint">Derived from the existing {p.reference} configuration — Spread is an angle, not a fabricated accuracy rating — Actual behavior remains unchanged</p></> : p.category === 'weapons' && <p className="rs-unavailable"><LockKeyhole size={18}/> Combat statistics unavailable — No finished model or authoritative configuration</p>}
      {p.compatibility && <p className="rs-spec-note">COMPATIBILITY / {p.compatibility}<small>Appearance only — Damage, magazine, fire rate and hitboxes are unchanged</small></p>}
      {p.includes && <><h3>IN THE COLLECTION</h3><div className="rs-bundle-items">{p.includes.map(id => { const item = CATALOG.find(p => p.id === id)!; return <button key={id} onClick={() => onSelect(item)}><Box size={15}/><span>{item.name}<small>CONCEPT ITEM · VIEW DETAILS</small></span><ArrowRight size={14}/></button>; })}</div><p className="rs-fineprint">Unavailable until every included item is implemented and configured — No unsupported discount is advertised</p></>}
      {p.category === 'founder' && <ul className="rs-inclusions">{['Founder costume', 'Profile badge', 'Founder title', 'Premium profile border', 'Special victory animation'].map(text => <li key={text}><Box size={14}/>{text}<small>PROPOSED</small></li>)}</ul>}
      <div className="rs-availability"><LockKeyhole size={17}/><p>{owned ? 'Ownership supplied by a connected source' : 'COMING SOON'}<small>Purchases are not yet available</small></p></div>
      {owned ? <button className="rs-primary" disabled>{equipped ? 'UNEQUIP' : 'EQUIP'} · COMING SOON</button> : p.price > 0 && <button className="rs-primary" onClick={() => onPurchase(p)}>PREVIEW PURCHASE <ArrowRight size={17}/></button>}
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
