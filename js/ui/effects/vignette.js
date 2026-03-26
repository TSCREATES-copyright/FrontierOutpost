let current = false;

export function setVignetteLowLight(isLow) {
  current = !!isLow;
  // CSS handles the visual. This hook exists so game systems can call it without manipulating classes directly.
  document.body.classList.toggle('low-light', !!isLow);
}

export function isVignetteLowLight() { return current; }
