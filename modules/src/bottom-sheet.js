/** Native modal sheet with focus isolation, reduced-motion-aware transitions and
 * handle-only swipe dismissal. The caller owns contents/drafts and route changes.
 * onDismiss requests navigation; call close() when the route actually leaves.
 * destroy() removes listeners/animations and closes immediately. Never persist data.
 */
export function createBottomSheet(dialog, { onDismiss, duration = 280 } = {}) {
  const win = dialog.ownerDocument.defaultView;
  let animation, revision = 0, destroyed = false, drag = null;
  const bindings = [];
  const listen = (name, fn) => { dialog.addEventListener(name, fn); bindings.push(() => dialog.removeEventListener(name, fn)); };
  dialog.classList.add('bottom-sheet');
  const stop = () => { revision++; animation?.cancel(); animation = null; };
  const animate = (frames, closing) => {
    stop();
    if (!dialog.animate || win.matchMedia('(prefers-reduced-motion: reduce)').matches) { if (closing) dialog.close(); return Promise.resolve(); }
    const version = revision;
    animation = dialog.animate(frames, { duration, easing: closing ? 'ease-in' : 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    return animation.finished.catch(() => {}).then(() => {
      if (version !== revision) return;
      if (closing) dialog.close();
      animation?.cancel(); animation = null;
    });
  };
  function close({ immediate = false } = {}) {
    if (!dialog.open) return Promise.resolve();
    if (immediate) { stop(); dialog.close(); return Promise.resolve(); }
    return animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], true);
  }
  const dismiss = () => { if (onDismiss) onDismiss(); else void close(); };
  listen('cancel', event => { event.preventDefault(); dismiss(); });
  listen('click', event => { if (event.target.closest('[data-sheet-close]')) dismiss(); });
  // Only the grabber is draggable: scrolling long content/inputs cannot dismiss it.
  listen('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || !event.target.closest('[data-sheet-handle]')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { event.target.setPointerCapture?.(event.pointerId); } catch { /* A cancelled pointer may already be inactive. */ }
  });
  listen('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = Math.abs(event.clientX - drag.x), dy = event.clientY - drag.y; drag = null;
    if (dy > 70 && dy > dx * 1.5) dismiss();
  });
  listen('pointercancel', () => { drag = null; });
  return {
    open() {
      if (destroyed) throw new Error('Sheet has been destroyed');
      const alreadyOpen = dialog.open;
      stop();
      if (alreadyOpen) return;
      dialog.showModal(); dialog.scrollTop = 0;
      dialog.querySelector('[data-sheet-focus]')?.focus({ preventScroll: true });
      void animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], false);
    },
    close,
    destroy() { destroyed = true; stop(); drag = null; bindings.forEach(remove => remove()); if (dialog.open) dialog.close(); }
  };
}
