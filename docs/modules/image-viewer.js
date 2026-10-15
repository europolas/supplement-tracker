/** Local photo preview in a nested native sheet. No upload or persistence. Caller
 * retains ownership of blob URLs; close clears the image, destroy removes DOM.
 * App viewport zoom locks are respected: 2x magnification is image-only, with
 * ordinary scrolling to pan. Import base.css and provide localized labels.
 */
import {createBottomSheet} from './bottom-sheet.js';
import {element} from './ui.js';
export function createImageViewer({document:doc=globalThis.document,labels=()=>({title:'Photo preview',close:'Close',zoom:'Zoom in',fit:'Fit image'})}={}){
 const dialog=element('dialog',{className:'local-image-viewer'},doc),title=element('h2',{},doc),close=element('button',{attributes:{type:'button','data-sheet-close':''}},doc),zoom=element('button',{attributes:{type:'button'}},doc),header=element('header',{},doc),stage=element('div',{className:'local-image-stage',attributes:{tabindex:'0'}},doc),img=element('img',{attributes:{alt:'',draggable:'false'}},doc);
 title.id='image-viewer-'+Math.random().toString(36).slice(2);dialog.setAttribute('aria-labelledby',title.id);header.setAttribute('data-sheet-drag','');header.append(title,zoom,close);stage.append(img);dialog.append(header,stage);doc.body.append(dialog);
 const sheet=createBottomSheet(dialog);let enlarged=false;
 const update=()=>{const text=labels();title.textContent=text.title;close.textContent='×';close.setAttribute('aria-label',text.close);zoom.textContent=enlarged?text.fit:text.zoom;zoom.setAttribute('aria-pressed',String(enlarged));dialog.dataset.enlarged=String(enlarged);};
 zoom.addEventListener('click',()=>{enlarged=!enlarged;stage.scrollTop=stage.scrollLeft=0;update();});
 const clear=()=>{img.removeAttribute('src');img.alt='';enlarged=false;update();};dialog.addEventListener('close',()=>{if(!dialog.open)clear();});
 // Panning the magnified image must not become a sheet-dismissal swipe.
 stage.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
 return {open(src,{alt=''}={}){if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)&&!src.startsWith('blob:'))throw TypeError('Expected a local photo');img.src=src;img.alt=alt;enlarged=false;update();stage.scrollTop=stage.scrollLeft=0;sheet.open();},close(){clear();return sheet.close({immediate:true});},destroy(){clear();sheet.destroy();dialog.remove();}};
}
