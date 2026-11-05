/** Preserve real movement speed down to 5 FPS without an unbounded catch-up
 * loop. Below 12 FPS the same swept physics uses 30 Hz rather than 60 Hz.
 * Long background/debugger stalls remain bounded, never a teleport on resume. */
export function frameTiming(seconds:number){
  const delta=Number.isFinite(seconds)?Math.max(0,Math.min(.2,seconds)):0;
  return{delta,step:delta>1/12?1/30:1/60};
}
