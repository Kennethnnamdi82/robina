import {ArrowUpRight,Check,Shield} from 'lucide-react';
import {findProduct,money,type Product} from './catalog';
import ProductArt from './ProductArt';
import {OUTFITS,OUTFIT_EDITIONS,type OutfitId} from './outfits';
const EDITIONS=['shadow','midnight','commander'] as const;
export default function SoldierEditions({onInspect}:{onInspect:(product:Product)=>void}){
 return <section className="rs-soldier-editions" aria-label="Compare soldier editions">
  <header><div><span className="rs-kicker">TAILORED EQUIPMENT / DISTINCT SILHOUETTES</span><h2>THREE TIERS.<br/>THREE IDENTITIES.</h2></div><p>Not a recolor. Different armor, different hardware, different presence.<br/><strong>Cosmetic only. The same playing field.</strong></p></header>
  <div className="rs-edition-lineup">{EDITIONS.map((id,i)=>{
   const product=findProduct(id)!,edition=OUTFIT_EDITIONS[id];
   return <article key={id} data-edition={id}><div className="rs-edition-top"><span>0{i+1} / {edition.tier}</span><Shield size={15}/></div><button className="rs-edition-portrait" onClick={()=>onInspect(product)} aria-label={'Inspect '+product.name+' edition'}><ProductArt product={product} large/></button><div className="rs-edition-copy"><span className="rs-kicker">{edition.role}</span><h3>{product.name}</h3><strong className="rs-edition-price">{money(product.price)}<small>USD / COLLECTION</small></strong><ul>{OUTFITS[id as OutfitId].label.split(' · ').map(detail=><li key={detail}><Check size={12}/>{detail}</li>)}</ul><button onClick={()=>onInspect(product)} className="rs-secondary">INSPECT THIS EDITION<ArrowUpRight size={15}/></button></div></article>;
  })}</div>
 </section>;
}
