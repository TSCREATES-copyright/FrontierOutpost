import { initHotbar } from './components/hotbar.js';
import { setVignetteLowLight } from './effects/vignette.js';

export function createHudController(context) {
  const refs = {
    hud: document.getElementById('hud'),
    hotbar: document.getElementById('hotbar'),
    vignette: document.getElementById('vignette'),
    targetInfo: document.getElementById('targetInfo'),
    targetName: document.getElementById('targetName'),
    targetHealthFill: document.getElementById('targetHealthFill'),
    alerts: document.getElementById('alerts'),
    killFeed: document.getElementById('killFeed'),
  };

  try {
    if (refs.hotbar) initHotbar(refs.hotbar);
  } catch (e) {
    console.warn('Hotbar init failed', e);
  }

  function setTargetInfo(name, pct) {
    if (!refs.targetInfo) return;
    refs.targetName.textContent = name || '';
    refs.targetHealthFill.style.width =
      Math.max(0, Math.min(100, pct || 0)) + '%';
    refs.targetInfo.style.display = pct > 0 ? 'block' : 'none';
  }

  function setNightMode(isNight) {
    document.body.classList.toggle('low-light', !!isNight);
    setVignetteLowLight(!!isNight);
  }

  return {
    render(dt) {
      void dt;
    },
    setTargetInfo,
    setNightMode,
  };
}