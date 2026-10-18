/** Opt-in mobile controls. Content is plain text; host owns routing and teardown.
 * Uses shared native sheets, safe areas and existing theme. See MOBILE-WORKFLOWS.md.
 */
import {element} from './ui.js';
import {createBottomSheet} from './bottom-sheet.js';
import {createI18n} from './i18n.js';
export function createSheet({title='',i18n=createI18n(),document:doc=globalThis.document,onDismiss}={}) {
 const dialog=element('dialog',{className:'app-dialog kit-sheet'},doc),id='sheet-'+globalThis.crypto.randomUUID();
 const handle=element('div',{attributes:{'data-sheet-handle':'','aria-hidden':'true'}},doc),header=element('div',{className:'kit-sheet-header',attributes:{'data-sheet-drag':''}},doc);
 const heading=element('h2',{text:title,attributes:{id,tabindex:'-1','data-sheet-focus':''}},doc),close=element('button',{text:'×',className:'kit-close',attributes:{type:'button','data-sheet-close':'','aria-label':i18n.t('kitClose')}},doc);
 const content=element('div',{className:'kit-sheet-content'},doc);header.append(heading,close);dialog.setAttribute('aria-labelledby',id);dialog.append(handle,header,content);doc.body.append(dialog);
 const sheet=createBottomSheet(dialog,{onDismiss});
 return {dialog,content,heading,open:()=>sheet.open(),close:options=>sheet.close(options),setTitle:text=>heading.textContent=String(text),destroy(){sheet.destroy();dialog.remove();}};
}
export function createMobileNavigation({root,items,onNavigate=()=>{},i18n=createI18n(),label=i18n.t('kitNavigation')}){
 root.classList.add('kit-nav');root.setAttribute('aria-label',label);
 const links=items.map(item=>{const link=element('a',{text:item.label,attributes:{href:'#'+item.route,'data-route':item.route}},root.ownerDocument);if(item.icon){const glyph=item.icon.cloneNode(true);glyph.setAttribute('aria-hidden','true');link.prepend(glyph);}const click=()=>onNavigate(item.route);link.addEventListener('click',click);return {link,click,route:item.route};});root.replaceChildren(...links.map(i=>i.link));
 return {select(route){for(const item of links)if(item.route===route)item.link.setAttribute('aria-current','page');else item.link.removeAttribute('aria-current');},destroy(){for(const i of links)i.link.removeEventListener('click',i.click);root.replaceChildren();root.classList.remove('kit-nav');}};
}
export function createProgress(root,{label=''}={}){
 const track=element('div',{className:'kit-progress-track'},root.ownerDocument),bar=element('span',{},root.ownerDocument),text=element('p',{text:label},root.ownerDocument);track.append(bar);root.classList.add('kit-progress');root.replaceChildren(text,track);track.setAttribute('role','progressbar');
 return {update({value=0,total=100,busy=false,label:message=label}={}){text.textContent=String(message);track.setAttribute('aria-label',String(message));root.setAttribute('aria-busy',String(busy));track.classList.toggle('is-indeterminate',busy);if(busy){track.removeAttribute('aria-valuenow');bar.style.width='25%';}else{const percent=total>0?Math.max(0,Math.min(100,100*value/total)):0;track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(percent));bar.style.width=percent+'%';}},destroy(){root.replaceChildren();root.classList.remove('kit-progress');root.removeAttribute('aria-busy');}};
}
export function createLoadingScreen({root,document:doc=globalThis.document,i18n=createI18n(),onRetry=()=>{}}={}){
 const owned=!root;root??=element('div',{className:'kit-loading-screen'},doc);if(owned)doc.body.append(root);root.classList.add('kit-loading-screen');const progressRoot=element('div',{},doc),error=element('p',{attributes:{role:'alert'}},doc),retry=element('button',{text:i18n.t('kitRetry'),className:'primary',attributes:{type:'button'}},doc);root.replaceChildren(progressRoot,error,retry);const progress=createProgress(progressRoot,{label:i18n.t('kitLoading')});let destroyed=false;
 const retryClick=()=>onRetry();retry.addEventListener('click',retryClick);
 return {show(label=i18n.t('kitLoading')){if(destroyed)return;root.hidden=false;error.hidden=retry.hidden=true;progress.update({busy:true,label});},progress(value,label=i18n.t('kitLoading')){if(!destroyed)progress.update({value,label});},hide(){if(!destroyed)root.hidden=true;},fail(message){if(destroyed)return;root.hidden=false;progress.update({label:i18n.t('kitLoadFailed')});error.textContent=String(message);error.hidden=retry.hidden=false;},destroy(){destroyed=true;retry.removeEventListener('click',retryClick);progress.destroy();if(owned)root.remove();else{root.hidden=true;root.replaceChildren();}}};
}
