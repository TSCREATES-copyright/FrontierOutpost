export function createLifecycleManager() {
  const systems = [];
  return {
    register(system) {
      if (!system) return;
      systems.push(system);
    },
    disposeAll() {
      for (let i = systems.length - 1; i >= 0; i--) {
        const s = systems[i];
        try { s && s.dispose && s.dispose(); } catch (e) { console.error('lifecycle dispose error', e); }
      }
    },
    _systems: systems
  };
}
