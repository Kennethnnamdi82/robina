import { Activity, AudioLines, Badge, Bomb, Cross, Crown, Layers3, ScanLine, Shield, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Product } from './catalog';
import { CHARACTER_MODELS, modelArt } from './modelAssets';

export default function ProductArt({ product, large = false, playing = false }: { product: Product; large?: boolean; playing?: boolean }) {
  const model = product.model, character = Boolean(model && CHARACTER_MODELS.has(model));
  const Icon = { weapon: ScanLine, character: Shield, grenade: Bomb, medical: Cross, effect: Sparkles, bundle: Layers3, season: Badge, founder: Crown }[product.art];
  return <div className={'rs-art' + (large ? ' rs-art-large' : '')} style={{ '--rs-accent': product.accent } as CSSProperties} data-kind={product.art} data-playing={playing} data-outfit={character ? model : undefined}>
    <span className="rs-art-grid" aria-hidden="true"/><span className="rs-art-halo" aria-hidden="true"/>
    {model ? <img className={character ? 'rs-art-operative' : 'rs-art-object'} src={modelArt(model)} alt={product.name + (character ? ' — complete field uniform and equipment' : ' — supplied 3D collection model')} loading="lazy" decoding="async"/> : <div className="rs-concept-object" aria-hidden="true"><Icon strokeWidth={.8} size={large ? 120 : 72}/>{product.art === 'effect' && <><i/><i/><i/><AudioLines size={24}/></>}</div>}
    {product.quantity && <strong className="rs-pack-quantity">{product.quantity}<small>UNITS</small></strong>}
    <span className="rs-art-serial" aria-hidden="true">RH / {product.id.toUpperCase().slice(0, 13)}</span>
    {character && <span className="rs-art-swatch"><i/>{product.model === 'commander' ? 'COMMAND EDITION' : product.model === 'founder' ? 'FOUNDER EDITION' : 'FIELD COLLECTION'}</span>}
    {large && <Activity className="rs-art-coordinate" size={18} aria-hidden="true"/>}
  </div>;
}
