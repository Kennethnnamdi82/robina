/** Hysteresis changes pixel workload, never scene geometry, physics or input.
 * Wall-clock samples are independent of the capped fixed simulation clock. */
export class AdaptiveResolution {
 private samples:number[]=[];private elapsed=0;private healthy=0;private overloaded=0;
 constructor(public scale:number,readonly ceiling:number,readonly floor=.65){}
 sample(seconds:number):number|undefined{
  if(!Number.isFinite(seconds)||seconds<=0||seconds>30)return;
  // Pause/visibility resets the runtime clock. Two heavy active frames are
  // overload, not one isolated suspension or shader-compilation hitch.
  if(seconds>.25){if(++this.overloaded>=2){this.overloaded=0;this.healthy=0;this.samples=[];this.elapsed=0;const next=Math.max(this.floor,Math.round(this.scale*.75*100)/100);if(next<this.scale){this.scale=next;return next;}}return;}this.overloaded=0;
  this.samples.push(seconds);this.elapsed+=seconds;if(this.elapsed<1.5||this.samples.length<12)return;
  const ordered=this.samples.sort((a,b)=>a-b),p75=ordered[Math.floor(ordered.length*.75)];this.samples=[];this.elapsed=0;
  if(p75>1/35){this.healthy=0;const next=Math.max(this.floor,Math.round(this.scale*.86*100)/100);if(next<this.scale){this.scale=next;return next;}}
  else if(p75<1/57){if(++this.healthy>=5){this.healthy=0;const next=Math.min(this.ceiling,Math.round((this.scale+.05)*100)/100);if(next>this.scale){this.scale=next;return next;}}}
  else this.healthy=0;
 }
}
