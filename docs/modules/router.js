/**
 * Hash routes, browser back and optional navigation guard.
 * Route values are untrusted input. Authorization remains server-side; cleanup removes the hashchange listener.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createRouter({ window: win = globalThis.window, routes, beforeNavigate = () => true, onNotFound = () => {} }) {
  let current;
  function render() {
    const next = win.location.hash.slice(1).split('?')[0] || '/';
    if (next === current) return;
    if (beforeNavigate(next, current) === false) { win.history.replaceState(null, '', '#' + (current || '/')); return; }
    current = next;
    const route = routes[next];
    if (route) route({ path: next, query: new URLSearchParams(win.location.hash.split('?')[1] || '') }); else onNotFound(next);
  }
  win.addEventListener('hashchange', render);
  render();
  return { navigate(path) { if (!path.startsWith('/')) throw new TypeError('Route must start with /'); win.location.hash = path; }, get current() { return current; }, destroy() { win.removeEventListener('hashchange', render); } };
}
