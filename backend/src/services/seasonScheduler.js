import { syncSeasonStates } from "./seasonLifecycle.js";

async function activateDueSeasons() {
  await syncSeasonStates();
}

export function startSeasonScheduler() {
  activateDueSeasons().catch(() => {});
  setInterval(() => {
    activateDueSeasons().catch(() => {});
  }, 60 * 1000);
}
