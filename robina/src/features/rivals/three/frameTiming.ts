/** One fixed interpolation interval: changing it with frame rate made the
 * presentation jump backwards when frames crossed the old 12 FPS threshold.
 * At most twelve swept ticks catch up a 200ms frame; resume stalls are bounded. */
export function frameTiming(seconds:number){
  const delta=Number.isFinite(seconds)?Math.max(0,Math.min(.2,seconds)):0;
  return{delta,step:1/60};
}
