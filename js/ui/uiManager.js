export function initUiManager() {
  const queue = [];
  let scheduled = false;

  function flush() {
    scheduled = false;
    const items = queue.splice(0);
    for (const f of items) {
      try { f(); } catch (e) { console.error('uiManager handler error', e); }
    }
  }

  window.UIMANAGER = {
    queue(fn) {
      queue.push(fn);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    },
    batchHUD: true
  };
}