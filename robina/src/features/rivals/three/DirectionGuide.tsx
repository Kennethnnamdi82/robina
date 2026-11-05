import type { Diagnostics3D } from './RaidRuntime';
import { useRef } from 'react';
/** Always-readable bearing supplements the actual depth-tested road arrows. */
export function DirectionGuide({metrics}:{metrics?:Diagnostics3D}) {
  const navigation=metrics?.navigation;
  const rotation=useRef<{last:number;angle:number}|null>(null);
  const bearing=navigation?.bearing??0;
  if(!rotation.current)rotation.current={last:bearing,angle:bearing};
  else{rotation.current.angle+=Math.atan2(Math.sin(bearing-rotation.current.last),Math.cos(bearing-rotation.current.last));rotation.current.last=bearing;}
  if(!navigation?.goal)return null;
  return <aside className="r3-direction-guide" data-driving={metrics?.vehicle?.driving} data-nearby={Boolean(metrics?.vehicle?.nearby&&!metrics?.vehicle?.driving)} aria-label={`Red objective direction, ${Math.round(navigation.distance)} metres`}>
    <svg viewBox="0 0 48 48" role="img" aria-label="Red direction arrow" style={{transform:`rotate(${rotation.current.angle*180/Math.PI}deg)`}}><path d="M24 3 43 42 24 33 5 42Z"/></svg>
    <strong>{Math.round(navigation.distance)} m</strong><span>OBJECTIVE</span>
  </aside>;
}
