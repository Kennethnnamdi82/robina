import type {QualityId} from '../core/presentation';
export const GRAPHICS_KEY='rivals_3d_graphics_v1';
export const GRAPHICS_OPTIONS=[
 {id:'low',label:'LOW',hint:'Lighter • older phones',detail:'Fewer civilians, lighter effects and shadows'},
 {id:'balanced',label:'MEDIUM',hint:'Balanced • recommended',detail:'Detailed surfaces, living traffic and soft shadows'},
 {id:'high',label:'HIGH',hint:'Detail • powerful devices',detail:'Full crowd, detailed shadows and cinematic highlights'},
] as const;
export function readGraphicsQuality():QualityId{
 try{const value=localStorage.getItem(GRAPHICS_KEY);if(value==='low'||value==='balanced'||value==='high')return value;}catch{/* Storage is optional. */}
 const device=navigator as Navigator&{deviceMemory?:number};
 return device.deviceMemory&&device.deviceMemory<=2||device.maxTouchPoints>0&&device.hardwareConcurrency<=4?'low':'balanced';
}
export function saveGraphicsQuality(value:QualityId){try{localStorage.setItem(GRAPHICS_KEY,value);}catch{/* The session selection still works. */}}
export function graphicsLabel(value:QualityId){return value==='balanced'?'MEDIUM':value.toUpperCase();}
export function GraphicsChooser({value,onChange}:{value:QualityId;onChange:(value:QualityId)=>void}){
 return <fieldset className="r3-graphics-presets"><legend>GRAPHICS QUALITY</legend><div>{GRAPHICS_OPTIONS.map(option=><button type="button" key={option.id} aria-pressed={value===option.id} aria-label={`${option.label} graphics`} title={option.detail} onClick={()=>onChange(option.id)}><strong>{option.label}</strong><span>{option.hint}</span></button>)}</div><p>Change graphics in the pause menu. Resolution adapts inside your chosen preset; game rules stay the same.</p></fieldset>;
}
