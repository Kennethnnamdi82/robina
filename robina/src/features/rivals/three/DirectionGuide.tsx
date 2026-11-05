import type { Diagnostics3D } from './RaidRuntime';
/** Always-readable bearing supplements the actual depth-tested road arrows. */
export function DirectionGuide({metrics}:{metrics?:Diagnostics3D}) {
  const navigation=metrics?.navigation;
  if(!navigation?.goal)return null;
  return <aside className="r3-direction-guide" data-driving={metrics?.vehicle?.driving} aria-label={`Red objective direction, ${Math.round(navigation.distance)} metres`}>
    <svg viewBox="0 0 48 48" role="img" aria-label="Red direction arrow" style={{transform:`rotate(${(navigation.bearing??0)*180/Math.PI}deg)`}}><path d="M24 3 43 42 24 33 5 42Z"/></svg>
    <strong>{Math.round(navigation.distance)} m</strong><span>FOLLOW RED ROUTE</span>
  </aside>;
}
