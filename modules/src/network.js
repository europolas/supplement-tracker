/**
 * Observe browser online/offline hints.
 * navigator.onLine does not guarantee API reachability. Handle actual request failures separately and destroy listeners on unmount.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
import { createStore } from './store.js';
export function watchNetwork({ window: win = globalThis.window, navigator: nav = globalThis.navigator } = {}) {
  const state = createStore({ online: nav.onLine !== false });
  const update = () => state.set({ online: nav.onLine !== false });
  win.addEventListener('online', update); win.addEventListener('offline', update);
  return { state, destroy() { win.removeEventListener('online', update); win.removeEventListener('offline', update); } };
}
