/**
 * iPhone standalone viewport and keyboard sizing ported from the working demo.
 * Preserve full screen height outside text editing; use visualViewport during keyboard display. Call the returned cleanup on unmount.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
// Derived from the working example-v1 iPhone fix; no hard-coded device sizes.
export function setupViewport({ window: win = globalThis.window, document: doc = globalThis.document, navigator: nav = globalThis.navigator } = {}) {
  const installed = nav.standalone === true || win.matchMedia('(display-mode: standalone)').matches;
  if (!installed || !/iPhone|iPod/.test(nav.userAgent)) return () => {};
  const root = doc.documentElement;
  const viewport = win.visualViewport;
  const bindings = [];
  let timer;
  const listen = (target, name, fn) => { target?.addEventListener(name, fn); if (target) bindings.push(() => target.removeEventListener(name, fn)); };
  function updateHeight() {
    const screen = win.screen;
    if (!screen?.width || !screen.height) return;
    const angle = screen.orientation?.angle ?? win.orientation ?? 0;
    const fullHeight = Math.abs(angle) % 180 === 90 ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    const editing = doc.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
    const visibleHeight = viewport?.height ?? win.innerHeight;
    const keyboard = Boolean(editing && fullHeight - visibleHeight > 150);
    root.style.setProperty('--app-height', `${Math.round(keyboard ? visibleHeight + (viewport?.offsetTop || 0) : fullHeight)}px`);
    root.dataset.keyboard = String(keyboard);
  }
  updateHeight();
  for (const name of ['resize', 'orientationchange', 'pageshow']) listen(win, name, updateHeight);
  for (const name of ['resize', 'scroll']) listen(viewport, name, updateHeight);
  listen(doc, 'focusin', updateHeight);
  listen(doc, 'focusout', () => { win.clearTimeout(timer); timer = win.setTimeout(updateHeight, 0); });
  return () => { bindings.forEach(remove => remove()); win.clearTimeout(timer); root.style.removeProperty('--app-height'); delete root.dataset.keyboard; };
}
