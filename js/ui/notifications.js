export function createNotificationCenter({ alertsContainer, killFeedContainer }) {
  const activeAlerts = new Map();

  function showAlert(message, isError = false) {
    if (!alertsContainer) return;

    if (activeAlerts.has(message)) {
      const existing = activeAlerts.get(message);
      clearTimeout(existing.timeoutId);
      existing.element.style.animation = 'none';
      existing.element.offsetHeight;
      existing.element.style.animation = 'alertLiftFade 3.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
      existing.timeoutId = setTimeout(() => {
        existing.element.remove();
        activeAlerts.delete(message);
      }, 3200);
      return;
    }

    const element = document.createElement('div');
    element.className = 'alert-msg' + (isError ? ' red' : '');
    element.textContent = message;
    alertsContainer.appendChild(element);

    const timeoutId = setTimeout(() => {
      element.remove();
      activeAlerts.delete(message);
    }, 3200);

    activeAlerts.set(message, { element, timeoutId });

    while (alertsContainer.children.length > 4) {
      const oldest = alertsContainer.firstElementChild;
      const oldestMessage = oldest.textContent;
      if (activeAlerts.has(oldestMessage)) {
        clearTimeout(activeAlerts.get(oldestMessage).timeoutId);
        activeAlerts.delete(oldestMessage);
      }
      oldest.remove();
    }
  }

  function addKillFeed(kills) {
    if (!killFeedContainer) return;
    const element = document.createElement('div');
    element.className = 'kill-entry';
    element.textContent = `Bandit eliminated [${kills}]`;
    killFeedContainer.appendChild(element);
    setTimeout(() => element.remove(), 4500);
  }

  function clear() {
    for (const [message, item] of activeAlerts.entries()) {
      clearTimeout(item.timeoutId);
      item.element?.remove();
      activeAlerts.delete(message);
    }
    if (alertsContainer) alertsContainer.innerHTML = '';
    if (killFeedContainer) killFeedContainer.innerHTML = '';
  }

  return { showAlert, addKillFeed, clear };
}
