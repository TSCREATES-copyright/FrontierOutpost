export function initHotbar(container) {
  if (!container) return;
  const slots = Array.from(container.querySelectorAll('.hotbar-slot'));

  function setActive(index) {
    slots.forEach((s, i) => s.classList.toggle('active', i === index));
  }

  // Keyboard-friendly hit area: ensure focus outlines and enlarge touch targets
  slots.forEach((slot, i) => {
    slot.setAttribute('role', 'button');
    slot.setAttribute('tabindex', '0');
    slot.addEventListener('click', () => setActive(i));
    slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); } });
  });

  // expose simple API
  return { setActive };
}
