/** Opt-in password visibility for existing forms. Does not read/store/log values.
 * Preserve the original input, autocomplete and caret. Reset after form.reset();
 * callers must also reset on auth-tab changes, sheet closure and sign-out.
 * getLabel supplies localized accessible action text; subscribe rerenders labels.
 * destroy removes listeners, restores password masking and unwraps original inputs.
 */
export function setupPasswordVisibility(root,{selector='input[type="password"]',getLabel=shown=>shown?'Hide password':'Show password',subscribe}={}){
 const doc=root.ownerDocument,entries=[],cleanup=[];
 const listen=(node,event,fn)=>{node.addEventListener(event,fn);cleanup.push(()=>node.removeEventListener(event,fn));};
 const render=entry=>{const shown=entry.input.type==='text';entry.button.setAttribute('aria-label',getLabel(shown));entry.button.title=getLabel(shown);entry.button.setAttribute('aria-pressed',String(shown));entry.path.setAttribute('d',shown?'m3 3 18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.8 5.3A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3 3.8 M6.2 6.2C3.6 8.3 2 12 2 12s4 7 10 7a12 12 0 0 0 5.8-1.8':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0');};
 for(const input of root.querySelectorAll(selector)){
  if(input.type!=='password'||input.closest('.password-field'))continue;
  const wrapper=doc.createElement('span');wrapper.className='password-field';input.before(wrapper);wrapper.append(input);
  const button=doc.createElement('button');button.type='button';button.className='password-toggle';
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  const path=doc.createElementNS(svg.namespaceURI,'path');svg.append(path);button.append(svg);wrapper.append(button);
  const entry={input,button,path,wrapper};entries.push(entry);render(entry);
  listen(button,'pointerdown',event=>event.preventDefault());
  listen(button,'click',event=>{event.preventDefault();const start=input.selectionStart,end=input.selectionEnd;input.type=input.type==='password'?'text':'password';render(entry);input.focus({preventScroll:true});if(start!==null)input.setSelectionRange(start,end);});
 }
 const reset=()=>{for(const entry of entries){entry.input.type='password';render(entry);}};
 for(const form of new Set(entries.map(e=>e.input.form).filter(Boolean)))listen(form,'reset',reset);
 if(subscribe)cleanup.push(subscribe(()=>entries.forEach(render)));
 return {reset,destroy(){reset();for(const dispose of cleanup)dispose();for(const {input,wrapper} of entries){wrapper.before(input);wrapper.remove();}}};
}
