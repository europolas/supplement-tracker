/**
 * Small observable in-memory state container.
 * Subscriptions return cleanup functions. State is not persistent; use settings or database for explicit persistence.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(update) { const previous = state; state = typeof update === 'function' ? update(previous) : update; if (Object.is(state, previous)) return; for (const fn of [...listeners]) fn(state, previous); },
    subscribe(fn, immediate = false) { listeners.add(fn); if (immediate) fn(state, state); return () => listeners.delete(fn); }
  };
}
