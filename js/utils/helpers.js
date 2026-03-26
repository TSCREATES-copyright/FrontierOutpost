export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

// Disposal helpers for Three.js objects and generic listeners
export function disposeMesh(mesh) {
  if (!mesh) return;
  try {
    if (mesh.geometry) { mesh.geometry.dispose && mesh.geometry.dispose(); }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) mesh.material.forEach(m => m && m.dispose && m.dispose());
      else mesh.material.dispose && mesh.material.dispose();
    }
  } catch (e) { console.warn('disposeMesh error', e); }
}

export function removeListener(target, event, fn) {
  try { if (!target || !event) return; target.removeEventListener && target.removeEventListener(event, fn); } catch (e) { /* ignore */ }
}
