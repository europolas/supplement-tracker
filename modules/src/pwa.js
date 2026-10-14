/**
 * Register the worker and announce guarded application updates.
 * Do not force reload dirty forms. canReload must include every unsaved editor; destroy stops polling and listeners.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export async function setupPwa({ url = './sw.js', navigator: nav = globalThis.navigator, window: win = globalThis.window, document: doc = globalThis.document, canReload = () => true, onUpdate = () => {}, onError = () => {} } = {}) {
  if (!nav?.serviceWorker) return { supported: false, destroy() {} };
  let registration;
  let hadController = Boolean(nav.serviceWorker.controller);
  let reloading = false;
  const bindings = [];
  const listen = (target, name, fn) => { target.addEventListener(name, fn); bindings.push(() => target.removeEventListener(name, fn)); };
  function apply() {
    if (!canReload()) throw new Error("Save your changes first.");
    if (registration?.waiting) registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    else if (nav.serviceWorker.controller && !reloading) { reloading = true; win.location.reload(); }
  }
  listen(nav.serviceWorker, 'controllerchange', () => {
    if (hadController && !reloading) { if (canReload()) { reloading = true; win.location.reload(); } else onUpdate({ apply, activated: true }); }
    hadController = true;
  });
  try { registration = await nav.serviceWorker.register(url, { type: 'module', updateViaCache: 'none' }); }
  catch (error) { bindings.forEach(remove => remove()); onError(error); return { supported: true, error, destroy() {} }; }
  const announce = () => { if (registration.waiting && nav.serviceWorker.controller) onUpdate({ apply, activated: false }); };
  announce();
  listen(registration, 'updatefound', () => { const worker = registration.installing; if (worker) listen(worker, 'statechange', announce); });
  const check = () => { if (doc.visibilityState === 'visible' && nav.onLine !== false) registration.update().catch(onError); };
  check(); listen(doc, 'visibilitychange', check); listen(win, 'online', check); listen(win, 'pageshow', check);
  const timer = win.setInterval(check, 60000);
  return { supported: true, registration, check, apply, destroy() { win.clearInterval(timer); bindings.forEach(remove => remove()); } };
}
