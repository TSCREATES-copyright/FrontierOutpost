// Simple wave-based spawner that emits events and delegates actual entity creation to AI/system listeners
export function createSpawner(context = {}) {
  const bus = context.eventBus;
  let activeIntervals = [];

  function spawnPulse(count, paceMs) {
    let spawned = 0;
    return setInterval(() => {
      if (spawned >= count) return;
      spawned++;
      bus && bus.emit('spawner:spawn', { type: 'bandit', meta: { index: spawned } });
    }, paceMs);
  }

  function startWave(opts = {}) {
    const count = opts.count || 4;
    const pace = opts.pace || 500;
    const delay = opts.delay || 0;
    bus && bus.emit('spawner:waveStart', { count, opts });
    const id = setTimeout(() => {
      const intervalId = spawnPulse(count, pace);
      activeIntervals.push(intervalId);
      // stop after enough time
      setTimeout(() => {
        activeIntervals.forEach(i => clearInterval(i));
        activeIntervals = [];
        bus && bus.emit('spawner:waveEnd', { count });
      }, count * pace + 1000);
    }, delay);
    activeIntervals.push(id);
  }

  function stop() {
    activeIntervals.forEach(i => clearInterval(i));
    activeIntervals = [];
  }

  return { startWave, stop };
}
