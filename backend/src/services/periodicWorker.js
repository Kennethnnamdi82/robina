// Schedule the next run only after the previous run finishes.
export function startPeriodicWorker(run, intervalMs, onError = error => console.error('[worker]', error)) {
  let stopped = false;
  let timer;
  let active = Promise.resolve();
  const tick = () => {
    if (stopped) return;
    active = Promise.resolve().then(run).catch(onError).finally(() => {
      if (!stopped) { timer = setTimeout(tick, intervalMs); timer.unref?.(); }
    });
  };
  tick();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await active;
  };
}
