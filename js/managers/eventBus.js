export function createEventBus() {
  const subs = Object.create(null);
  return {
    on(event, fn) {
      if (!subs[event]) subs[event] = [];
      subs[event].push(fn);
    },
    off(event, fn) {
      if (!subs[event]) return;
      subs[event] = subs[event].filter(f => f !== fn);
    },
    emit(event, payload) {
      const list = subs[event] || [];
      for (let i = 0; i < list.length; i++) {
        try { list[i](payload); } catch (e) { console.error('eventBus handler error', event, e); }
      }
    },
    _subs: subs
  };
}
