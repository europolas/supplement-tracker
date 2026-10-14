/**
 * Validated persistent preferences backed by storage and observable state.
 * Default values apply only when no valid saved preference exists. Language selection must not be overwritten by browser locale.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
import { createStore } from './store.js';
export function createSettings(storage, defaults, validators = {}) {
  function clean(value) { const result = { ...defaults }; for (const key of Object.keys(defaults)) if (Object.hasOwn(value, key) && (!validators[key] || validators[key](value[key]))) result[key] = value[key]; return result; }
  const state = createStore(clean(storage.get('settings', {}) || {}));
  return { state, update(patch) { for (const key of Object.keys(patch)) if (!Object.hasOwn(defaults, key) || (validators[key] && !validators[key](patch[key]))) throw new TypeError('Invalid setting: ' + key); const next = clean({ ...state.get(), ...patch }); storage.set('settings', next); state.set(next); }, reset() { storage.remove('settings'); state.set({ ...defaults }); } };
}
