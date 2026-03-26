export function createUpdateManager(phases = ['input','physics','game','ai','world','ui','render']) {
  const registry = Object.create(null);
  phases.forEach(p => (registry[p] = []));

  return {
    register(phase, fn) {
      if (!registry[phase]) registry[phase] = [];
      if (typeof fn === 'function') registry[phase].push(fn);
    },
    runPhase(phase) {
      const list = registry[phase] || [];
      for (let i = 0; i < list.length; i++) {
        try { list[i](); } catch (e) { console.error('updateManager phase error', phase, e); }
      }
    },
    runAll() {
      for (let i = 0; i < phases.length; i++) this.runPhase(phases[i]);
    },
    getPhases() { return phases.slice(); },
    _registry: registry
  };
}
