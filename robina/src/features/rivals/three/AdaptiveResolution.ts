import type { QualityId } from '../core/presentation';

/** Use display timing to budget pixels and scene detail independently of the
 * fixed simulation clock. Start with the single-pass renderer while warming. */
export class AdaptiveResolution {
 private samples:number[]=[];private elapsed=0;private healthy=0;private overloaded=0;
 private ceilingQuality:QualityId='balanced';
 private highOverBudget=false;
 effectsLimited=false;
 constructor(public scale:number,readonly ceiling:number,readonly floor=.65){}
 quality(requested:QualityId):QualityId{
  if(requested==='low'||this.ceilingQuality==='low')return 'low';
  return requested==='balanced'?'balanced':this.ceilingQuality;
 }
 sample(seconds:number):number|undefined{
  if(!Number.isFinite(seconds)||seconds<=0||seconds>30)return;
  // Pause/visibility resets the runtime clock. Two heavy active frames are
  // overload, not one isolated suspension or shader-compilation hitch.
  if(seconds>.12){
   if(++this.overloaded<2)return;
   this.overloaded=0;this.healthy=0;this.samples=[];this.elapsed=0;this.effectsLimited=true;
   if(this.ceilingQuality==='high')this.highOverBudget=true;
   this.ceilingQuality='low';
   const next=Math.max(this.floor,Math.round(this.scale*.75*100)/100);
   if(next<this.scale){this.scale=next;return next;}
   return;
  }
  this.overloaded=0;
  this.samples.push(seconds);this.elapsed+=seconds;if(this.elapsed<1.5||this.samples.length<12)return;
  const ordered=this.samples.sort((a,b)=>a-b),p75=ordered[Math.floor(ordered.length*.75)];this.samples=[];this.elapsed=0;
  // Protect responsive camera/input presentation, not merely a 30FPS floor.
  if(p75>1/50){
   this.healthy=0;this.effectsLimited=true;
   if(this.ceilingQuality==='high'){this.highOverBudget=true;this.ceilingQuality='balanced';}
   else if(p75>1/34)this.ceilingQuality='low';
   const next=Math.max(this.floor,Math.round(this.scale*.86*100)/100);
   if(next<this.scale){this.scale=next;return next;}
  }
  else if(p75<1/57){
   if(++this.healthy>=5){
    this.healthy=0;
    this.effectsLimited=false;
    // A High pass that already stalled this raid stays off until a fresh
    // preset selection or mission. Avoid periodic expensive retries.
    this.ceilingQuality=this.ceilingQuality==='low'||this.highOverBudget?'balanced':'high';
    const next=Math.min(this.ceiling,Math.round((this.scale+.05)*100)/100);
    if(next>this.scale){this.scale=next;return next;}
   }
  }
  else this.healthy=0;
 }
}
