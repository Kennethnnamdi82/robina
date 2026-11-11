import { useSyncExternalStore } from 'react';
import type { PlayerEconomy } from './PlayerEconomy';
export const usePlayerEconomy = (economy:PlayerEconomy) => useSyncExternalStore(economy.subscribe,economy.getSnapshot,economy.getSnapshot);
