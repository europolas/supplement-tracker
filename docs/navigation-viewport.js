/** The iPhone shell deliberately retains screen.height for its full-height main
 * scroller. Floating controls must instead fit the currently visible viewport:
 * browser chrome, standalone restoration and keyboard dismissal can leave those
 * heights different. A higher z-index/popover cannot fix off-screen geometry.
 * App-specific positioning only; do not change the shared scroller/edge masks.
 * https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 * Returns cleanup for an app that unmounts; bfcache pageshow resynchronizes it.
 */
export function setupNavigationViewport({window:win=window,document:doc=document}={}){
 const root=doc.documentElement,viewport=win.visualViewport,bindings=[];let frame;
 function update(){
  frame=undefined;
  const visible=viewport?.height>0?viewport.height+Math.max(0,viewport.offsetTop):win.innerHeight;
  // Never place a target below the layout viewport either. Do not use screen or
  // --app-height: both intentionally cover space that iOS may currently clip.
  const bottom=Math.min(win.innerHeight,visible);
  if(bottom>0)root.style.setProperty('--nav-viewport-bottom',`${Math.floor(bottom)}px`);
 }
 function schedule(){if(frame===undefined)frame=win.requestAnimationFrame(update);}
 const listen=(target,event)=>{target?.addEventListener(event,schedule);if(target)bindings.push(()=>target.removeEventListener(event,schedule));};
 update();
 for(const event of ['resize','orientationchange','pageshow'])listen(win,event);
 for(const event of ['resize','scroll'])listen(viewport,event);
 listen(doc,'visibilitychange');
 return ()=>{bindings.forEach(remove=>remove());if(frame!==undefined)win.cancelAnimationFrame(frame);root.style.removeProperty('--nav-viewport-bottom');};
}
