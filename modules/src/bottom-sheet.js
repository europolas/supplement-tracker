/** Native modal sheet with focus isolation, reduced-motion-aware transitions and
 * header/top-of-content swipe dismissal. The caller owns contents/drafts and route changes.
 * onDismiss requests navigation; call close() when the route actually leaves.
 * destroy() removes listeners/animations and closes immediately. Never persist data.
 */
export function createBottomSheet(dialog, { onDismiss, duration = 280 } = {}) {
  const win = dialog.ownerDocument.defaultView;
  let animation, revision = 0, destroyed = false, drag = null;
  const bindings = [];
  const listen = (name, fn, options) => { dialog.addEventListener(name, fn, options); bindings.push(() => dialog.removeEventListener(name, fn, options)); };
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
  // iOS takes over vertical pointer gestures and sends pointercancel. A non-passive
  // touchmove listener is required to intercept a downward pull BEFORE scrolling.
  // Never steal input/control gestures, upward scrolling, or an already scrolled list.
  const interactive = 'button,a,input,textarea,select,summary,[contenteditable="true"]';
  const eligible = target => !target.closest(interactive) &&
    (target.closest('[data-sheet-handle],[data-sheet-drag]') || dialog.scrollTop <= 1);
  const start = (point, target) => eligible(target) ? { x:point.clientX, y:point.clientY,
    header:Boolean(target.closest('[data-sheet-handle],[data-sheet-drag]')), accepted:false } : null;
  const downward = point => {
    if (!drag || (!drag.header && dialog.scrollTop > 1)) return false;
    const dy=point.clientY-drag.y, dx=Math.abs(point.clientX-drag.x);
    return dy>0 && dy>dx*1.5;
  };
  const finish = point => {
    const dismissNow=drag && downward(point) && point.clientY-drag.y>60;
    drag=null;if(dismissNow)dismiss();
  };
  listen('touchstart', event => { drag=event.touches.length===1?start(event.touches[0],event.target):null; }, {passive:true});
  listen('touchmove', event => {
    if(event.touches.length!==1){drag=null;return;}
    if(downward(event.touches[0])){if(event.cancelable)event.preventDefault();drag.accepted=true;}
    else if(drag&&!drag.accepted){const p=event.touches[0],dx=Math.abs(p.clientX-drag.x),dy=p.clientY-drag.y;if(dy < -8 || dx>10&&dx>Math.abs(dy) || !drag.header&&dialog.scrollTop>1)drag=null;}
  }, {passive:false});
  listen('touchend', event => {if(event.changedTouches.length===1)finish(event.changedTouches[0]);else drag=null;}, {passive:true});
  listen('touchcancel', () => {drag=null;}, {passive:true});
  // Pointer events remain useful for a mouse/pen grabber; touch uses the path above.
  listen('pointerdown', event => {
    if(event.pointerType==='touch'||!event.isPrimary||event.button!==0||!event.target.closest('[data-sheet-handle],[data-sheet-drag]')||event.target.closest(interactive))return;
    drag=start(event,event.target);
    try{event.target.setPointerCapture?.(event.pointerId);}catch{/* Cancelled pointer. */}
  });
  listen('pointerup', event => {if(event.pointerType!=='touch')finish(event);});
  listen('pointercancel', event => {if(event.pointerType!=='touch')drag=null;});
  return {
    open() {
      if (destroyed) throw new Error('Sheet has been destroyed');
      const alreadyOpen = dialog.open;
      stop();
      if (alreadyOpen) return;
      dialog.showModal(); dialog.scrollTop = 0;
      [...dialog.querySelectorAll('[data-sheet-focus]')].find(node=>node.getClientRects().length)?.focus({ preventScroll: true });
      void animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], false);
    },
    close,
    destroy() { destroyed = true; stop(); drag = null; bindings.forEach(remove => remove()); if (dialog.open) dialog.close(); }
  };
}
