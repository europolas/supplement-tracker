/**
 * Optional zoom and text selection restrictions.
 * Inputs remain editable through CSS. The cleanup restores viewport metadata and removes gesture listeners.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function setupGestures({ document: doc = globalThis.document, lockZoom = true, lockSelection = true } = {}) {
  doc.documentElement.dataset.lockSelection = String(lockSelection);
  doc.documentElement.dataset.lockZoom = String(lockZoom);
  const meta = doc.querySelector?.('meta[name="viewport"]');
  const original = meta?.getAttribute('content');
  if (!lockZoom && meta) meta.setAttribute('content', (original || '').split(',').filter(value => !/maximum-scale|minimum-scale|user-scalable/.test(value)).join(','));
  const restore = () => { delete doc.documentElement.dataset.lockSelection; delete doc.documentElement.dataset.lockZoom; if (meta && original !== null && original !== undefined) meta.setAttribute('content', original); };
  if (!lockZoom) return restore;
  const gesture = event => event.preventDefault();
  const move = event => { if (event.touches.length > 1) event.preventDefault(); };
  for (const name of ['gesturestart', 'gesturechange']) doc.addEventListener(name, gesture, { passive: false });
  doc.addEventListener('touchmove', move, { passive: false });
  return () => { for (const name of ['gesturestart', 'gesturechange']) doc.removeEventListener(name, gesture); doc.removeEventListener('touchmove', move); restore(); };
}
