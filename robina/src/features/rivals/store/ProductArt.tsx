import { Activity, AudioLines, Badge, Bomb, Cross, Crown, Layers3, LockKeyhole, ScanLine, Shield, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Product } from './catalog';

export default function ProductArt({ product, large = false, playing = false }: { product: Product; large?: boolean; playing?: boolean }) {
  const model = product.model, character = ['character', 'bundle', 'founder'].includes(product.art);
  const Icon = { weapon: ScanLine, character: Shield, grenade: Bomb, medical: Cross, effect: Sparkles, bundle: Layers3, season: Badge, founder: Crown }[product.art];
  return <div className={'rs-art' + (large ? ' rs-art-large' : '')} style={{ '--rs-accent': product.accent } as CSSProperties} data-kind={product.art} data-playing={playing}>
    <span className="rs-art-grid" aria-hidden="true"/><span className="rs-art-halo" aria-hidden="true"/>
    {model ? <img className={character ? 'rs-art-operative' : 'rs-art-object'} src={'/assets/rivals/store/' + model + '.png'} alt={character ? 'Existing base operative reference, not the proposed outfit' : 'Existing ' + model + ' reference asset'} loading="lazy" decoding="async"/> : <div className="rs-concept-object" aria-hidden="true"><Icon strokeWidth={.8} size={large ? 120 : 72}/>{product.art === 'effect' && <><i/><i/><i/><AudioLines size={24}/></>}</div>}
    {product.quantity && <strong className="rs-pack-quantity">{product.quantity}<small>UNITS</small></strong>}
    {product.art === 'weapon' && !model && <span className="rs-missing"><LockKeyhole size={11}/> MODEL NOT AVAILABLE</span>}
    <span className="rs-art-serial" aria-hidden="true">R / {product.id.toUpperCase().slice(0, 13)}</span>
    {character && <span className="rs-art-swatch" aria-label={'Concept accent ' + product.accent}><i/> COLOR DIRECTION</span>}
    {large && <Activity className="rs-art-coordinate" size={18} aria-hidden="true"/>}
  </div>;
}
