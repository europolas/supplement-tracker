/** Draft-only one/many selection. Save commits through a callback; dismiss discards.
 * Stable IDs are caller-owned; private selections never enter browser storage.
 */
import {createSheet} from './mobile-ui.js';
import {element} from './ui.js';
import {createI18n} from './i18n.js';
export function createSelectionSheet({title,options,max=3,i18n=createI18n(),onSave=()=>{},document:doc=globalThis.document}={}){
 if(!Number.isInteger(max)||max<1||new Set(options.map(o=>o.id)).size!==options.length)throw new TypeError('Invalid choices');
 let selected=new Set(),epoch=0,busy=false;const sheet=createSheet({title,i18n,document:doc,onDismiss:()=>sheet.close()});
 const choices=element('div',{className:'kit-choices',attributes:{role:'group','aria-label':title}},doc),status=element('p',{attributes:{role:'status'}},doc),save=element('button',{text:i18n.t('kitSave'),className:'primary',attributes:{type:'button'}},doc);sheet.content.append(choices,status,save);
 function render(){choices.replaceChildren();for(const option of [{id:null,label:i18n.t('kitUnspecified')},...options]){const chosen=option.id===null?selected.size===0:selected.has(option.id),button=element('button',{text:option.label,className:'kit-toggle',attributes:{type:'button','aria-pressed':String(chosen)}},doc);button.disabled=busy||option.id!==null&&!chosen&&max>1&&selected.size>=max;button.addEventListener('click',()=>{if(option.id===null)selected.clear();else if(selected.has(option.id))selected.delete(option.id);else if(max===1){selected.clear();selected.add(option.id);}else if(selected.size<max)selected.add(option.id);render();});choices.append(button);}save.disabled=busy;}
 const commit=async()=>{if(busy)return;busy=true;status.textContent='';const version=epoch;render();try{await onSave([...selected]);if(version===epoch)await sheet.close();}catch(e){if(version===epoch)status.textContent=i18n.message(e.message);}finally{if(version===epoch){busy=false;render();}}};save.addEventListener('click',commit);
 return {async open(ids=[]){epoch++;busy=false;selected=new Set(ids.filter(id=>options.some(o=>o.id===id)).slice(0,max));status.textContent='';render();await sheet.open();},get busy(){return busy;},get dirty(){return sheet.dialog.open;},async close(){epoch++;busy=false;await sheet.close();},destroy(){epoch++;busy=false;save.removeEventListener('click',commit);selected.clear();sheet.destroy();}};
}
