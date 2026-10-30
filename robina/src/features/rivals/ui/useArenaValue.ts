import { useSyncExternalStore } from 'react';
import type { ArenaSession } from '../core/session';
import type { ArenaSnapshot } from '../core/contracts';

/** Select stable primitives/references so position ticks do not redraw menus or vital bars. */
export function useArenaValue<T>(session: ArenaSession, select: (snapshot: ArenaSnapshot) => T): T {
  return useSyncExternalStore(session.subscribe, () => select(session.getSnapshot()), () => select(session.getSnapshot()));
}
