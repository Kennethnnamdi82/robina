import { syncSeasonStates } from './seasonLifecycle.js';
import { startPeriodicWorker } from './periodicWorker.js';

export function startSeasonScheduler() {
  return startPeriodicWorker(syncSeasonStates, 60000, error => console.error('[seasons]', error));
}
