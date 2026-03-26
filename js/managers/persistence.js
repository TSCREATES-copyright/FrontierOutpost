export function createPersistenceManager(options = {}) {
  const key = options.key || 'frontier-outpost-save-v1';
  const systems = [];

  function snapshot() {
    const out = { version: 1, systems: {} };
    for (let i = 0; i < systems.length; i++) {
      const s = systems[i];
      try {
        if (s.system && typeof s.system.snapshot === 'function') {
          out.systems[s.name] = s.system.snapshot();
        }
      } catch (e) { console.error('persistence snapshot error', s.name, e); }
    }
    try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) { console.warn('persistence save failed', e); }
    return out;
  }

  function restore(raw) {
    if (!raw) raw = localStorage.getItem(key);
    if (!raw) return null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { console.error('persistence parse error', e); return null; }

    const map = parsed.systems || {};
    for (let i = 0; i < systems.length; i++) {
      const s = systems[i];
      try {
        if (s.system && typeof s.system.restore === 'function' && map[s.name]) {
          s.system.restore(map[s.name]);
        }
      } catch (e) { console.error('persistence restore error', s.name, e); }
    }
    return parsed;
  }

  return {
    register(name, system) {
      if (!name || !system) return;
      systems.push({ name, system });
    },
    save() { return snapshot(); },
    load() { return restore(); },
    exportJSON() { return localStorage.getItem(key); },
    importJSON(json) { try { localStorage.setItem(key, json); return restore(json); } catch (e) { console.error('import error', e); return null; } }
  };
}
