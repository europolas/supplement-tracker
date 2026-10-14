/**
 * Local event bus for loosely coupled modules.
 * Unsubscribe when a screen unmounts. This is not cross-window messaging or a server event stream.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createEvents() {
  const listeners = new Map();
  return {
    on(name, fn) { const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set); return () => { set.delete(fn); if (!set.size) listeners.delete(name); }; },
    emit(name, value) { for (const fn of [...(listeners.get(name) || [])]) fn(value); },
    clear() { listeners.clear(); }
  };
}
