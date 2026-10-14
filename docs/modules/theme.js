/**
 * Persistent light, dark and system theme selection.
 * Use the shared CSS variables. destroy removes system preference listeners; the system option follows OS theme only.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createTheme({ root = globalThis.document.documentElement, storage, media = globalThis.matchMedia?.('(prefers-color-scheme: dark)') } = {}) {
  let preference = storage?.get('theme', 'dark') || 'dark';
  function apply() { root.dataset.theme = preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference; root.style.colorScheme = root.dataset.theme; }
  media?.addEventListener('change', apply); apply();
  return { get: () => preference, set(value) { if (!['light', 'dark', 'system'].includes(value)) throw new TypeError('Invalid theme'); preference = value; storage?.set('theme', value); apply(); }, destroy() { media?.removeEventListener('change', apply); } };
}
