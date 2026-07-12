export const eventBus = {
  listeners: {},
  emit(eventName, payload = {}) {
    const handlers = this.listeners[eventName] || [];
    handlers.forEach((handler) => handler(payload));
  },
  on(eventName, handler) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(handler);
  },
};
