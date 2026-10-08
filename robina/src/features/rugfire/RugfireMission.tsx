import { useEffect, useRef } from 'react';
import { RugfireEngine, type HudSnapshot } from './engine';
export type MissionHandle = { engine: RugfireEngine | null };
export default function RugfireMission({ handle, onHud, onError }: { handle: React.MutableRefObject<MissionHandle>; onHud: (hud: HudSnapshot) => void; onError: (message: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let engine: RugfireEngine | undefined; const currentHandle = handle.current;
    try { engine = new RugfireEngine(host.current!, onHud, onError); currentHandle.engine = engine; }
    catch (error) { onError('Unable to initialize 3D graphics. Enable hardware acceleration and reload. ' + (error instanceof Error ? error.message : '')); }
    return () => { engine?.dispose(); currentHandle.engine = null; };
  }, [handle, onHud, onError]);
  return <div className="rf-world" ref={host} />;
}
