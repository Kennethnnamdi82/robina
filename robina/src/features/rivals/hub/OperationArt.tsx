import type { Assignment } from '../missions/assignments';
import { siteLayout } from '../three/SiteLayout';

/** A lightweight briefing drawing of the real mission footprint, not a fake map. */
export function OperationArt({assignment:a}:{assignment:Assignment}){
  return <svg className="rh-operation-map" viewBox="0 0 300 190" aria-label={a.name+' site plan'} role="img">
    <defs><pattern id={'grid-'+a.id} width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0H0V15" fill="none" stroke="currentColor" strokeWidth=".4" opacity=".2"/></pattern></defs>
    <rect width="300" height="190" fill={'url(#grid-'+a.id+')'}/>
    <path d="M0 160H300M35 0V190M268 0V190" stroke="currentColor" opacity=".2" fill="none"/>
    <g transform="translate(150 88) rotate(-12) scale(8)">
      <rect x="-7" y="-6.4" width="14" height="12.8" fill="#b9c1c6" fillOpacity=".03" stroke="currentColor" strokeWidth=".06" strokeDasharray=".3 .3"/>
      {siteLayout(a).map((p,i)=><rect key={i} x={p.x-p.width/2} y={p.z-p.depth/2} width={p.width} height={p.depth} fill="currentColor" fillOpacity={p.kind==='wall'?.75:.2} stroke="currentColor" strokeWidth=".07"/>)}
      <path d="M0 8V3.6m-1 1 1-1 1 1" fill="none" stroke="#ea5b57" strokeWidth=".2"/>
      <circle cx="0" cy="-3.9" r=".6" fill="none" stroke="#ea5b57" strokeWidth=".15"/>
    </g>
    <text x="12" y="181" fill="currentColor" fontSize="7" fontFamily="monospace" letterSpacing="1.5">SITE RECON / {a.site.x} : {a.site.z}</text>
    <path d="M279 28V12l-4 8 4-8 4 8" fill="none" stroke="currentColor" strokeWidth=".8"/><text x="277" y="39" fill="currentColor" fontSize="6">N</text>
  </svg>;
}
export function MissionDifficulty({stage}:{stage:number}){
  return <span className="rh-difficulty" aria-label={'Difficulty '+(stage+1)+' of 7'}><span>{['CONTROLLED','GUARDED','ELEVATED','HIGH RISK','SEVERE','CRITICAL','EXTREME'][stage]}</span><span aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} data-on={i<=stage}/>)}</span></span>;
}
