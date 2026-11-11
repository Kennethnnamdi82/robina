import { lazy, Suspense, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Box, Pause, Play, Rotate3D, ShieldCheck, X } from 'lucide-react';
import { CATALOG, money, referenceStats, collectionStats, type Product, type StoreAccount } from './catalog';
import { OUTFITS, OUTFIT_EDITIONS, isOutfit } from './outfits';
import ProductArt from './ProductArt';
const ModelPreview = lazy(() => import('./ModelPreview'));
export default function ProductDialog({ product:p,onClose,onPurchase,onSelect,account,reduced }: {product:Product;onClose:()=>void;onPurchase:(p:Product)=>void;onSelect:(p:Product)=>void;account?:StoreAccount;reduced:boolean}) {
  const [studio,setStudio]=useState(false),[playing,setPlaying]=useState(false);
  const owned=account?.ownedIds.includes(p.id),equipped=account?.equippedIds.includes(p.id),outfit=p.model&&isOutfit(p.model)?OUTFITS[p.model]:undefined;
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="rs-overlay"/><Dialog.Content className="rs-dialog rs-product-dialog" data-reduced={reduced} aria-describedby="rs-product-description">
    <Dialog.Close className="rs-close" aria-label="Close product details"><X size={20}/></Dialog.Close>
    <div className="rs-detail-stage"><div className="rs-stage-label"><span>RIVALS / COLLECTION STUDIO</span><span>360° INSPECTION</span></div>
      {studio&&p.model?<Suspense fallback={<p className="rs-model-loading" role="status">OPENING THE STUDIO</p>}><ModelPreview model={p.model} reduced={reduced}/></Suspense>:<ProductArt product={p} large playing={playing&&!reduced}/>}
      <div className="rs-studio-controls">{p.model&&<button aria-pressed={studio} onClick={()=>setStudio(v=>!v)}><Rotate3D size={16}/>{studio?'CLOSE 3D':'INSPECT IN 3D'}</button>}{p.art==='effect'&&<button aria-pressed={playing} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?'PAUSE':'PLAY'} MOTION STUDY</button>}</div>
      <p>{outfit?'COMPLETE UNIFORM / MATCHING EQUIPMENT':p.art==='effect'?'EXPRESSION & LIGHT / STUDIO STUDY':'ARMORY / SUPPLIED MODEL'}</p>
    </div>
    <div className="rs-detail-copy"><span className="rs-kicker">{p.subtitle}</span><Dialog.Title>{p.name}</Dialog.Title><Dialog.Description id="rs-product-description">{p.description}</Dialog.Description>
      <div className="rs-detail-price"><strong>{p.price?money(p.price):'FIELD PICKUP'}</strong><span>{p.price?'USD / COLLECTION PRICE':'EXISTING FIELD EQUIPMENT'}</span><span className="rs-badge">{equipped?'EQUIPPED':owned?'OWNED':'SHOWROOM'}</span></div>
      {outfit&&<div className="rs-outfit-spec"><span className="rs-kicker">{p.model&&isOutfit(p.model)?OUTFIT_EDITIONS[p.model].tier+' EDITION / '+OUTFIT_EDITIONS[p.model].role:''}</span><h3>BUILT INTO THIS LOOK</h3>{outfit.label.split(' · ').map(detail=><div key={detail}><ShieldCheck size={15}/><span>{detail}</span></div>)}<small>Cosmetic identity only — identical movement, health and hitboxes</small></div>}
      {p.proposed&&<div className="rs-spec-note"><strong>COLLECTION PLATFORM</strong><p>{p.proposed.magazine}-round magazine · {p.proposed.ammo}</p><small>Premium tuning — higher damage and sustained firepower than the issued firearms</small></div>}
      {p.category==='weapons'&&<section className="rs-field-stats" aria-label="Premium weapon tuning"><h3>PREMIUM CONFIGURATION</h3><dl className="rs-stats">{collectionStats(p.id).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p className="rs-fineprint">Configured for collection equipment — inspecting does not equip it or grant ownership</p></section>}
      {p.reference&&<details className="rs-field-stats"><summary>CURRENT FIELD CONFIGURATION</summary><dl className="rs-stats">{referenceStats(p.reference).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p className="rs-fineprint">Existing {p.reference} configuration — collection browsing does not rebalance your equipment</p></details>}
      {p.compatibility&&<p className="rs-spec-note">COMPATIBILITY / {p.compatibility}</p>}
      {p.includes&&<><h3>THE COMPLETE COLLECTION</h3><div className="rs-bundle-items">{p.includes.map(id=>{const item=CATALOG.find(p=>p.id===id)!;return <button key={id} onClick={()=>onSelect(item)}><ProductArt product={item}/><span>{item.name}<small>INSPECT INCLUDED ITEM</small></span><ArrowRight size={14}/></button>;})}</div></>}
      {p.category==='founder'&&<ul className="rs-inclusions">{['Founder field uniform','Profile badge','Founder title','Signature profile border','Victory presentation'].map(text=><li key={text}><Box size={14}/>{text}</li>)}</ul>}
      <div className="rs-availability"><ShieldCheck size={17}/><p>COLLECTION SHOWROOM<small>Inspect freely — checkout is not enabled and no payment is taken</small>{outfit&&<small>This uniform is a studio preview — it does not yet replace your playable character</small>}</p></div>
      {owned?<button className="rs-primary" disabled>{equipped?'UNEQUIP':'EQUIP'} · COLLECTION-MANAGED</button>:p.price>0&&<button className="rs-primary" onClick={()=>onPurchase(p)}>REVIEW SELECTION <ArrowRight size={17}/></button>}
    </div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
