/** Configurable in-memory wizard. Each step renders caller-owned fields and may
 * validate asynchronously; Save is explicit and revision handling is caller-owned.
 * No fixed footer. Host must include dirty/busy in its update/reload guard.
 */
import {createSheet} from './mobile-ui.js';
import {element} from './ui.js';
import {createI18n} from './i18n.js';
export function createWizard({title,steps,i18n=createI18n(),onSave=()=>{},confirmDiscard=async()=>true,onState=()=>{},document:doc=globalThis.document}={}){
 if(!steps?.length||steps.some(s=>typeof s.render!=='function'))throw new TypeError('Invalid steps');
 let draft,baseline,index=0,busy=false,epoch=0,stepCleanup=()=>{};const sheet=createSheet({title,i18n,document:doc,onDismiss:()=>dismiss()});
 const tabs=element('div',{className:'kit-tabs',attributes:{role:'group','aria-label':title}},doc),body=element('div',{},doc),status=element('p',{attributes:{role:'alert'}},doc),actions=element('div',{className:'kit-actions'},doc);sheet.content.append(tabs,body,status,actions);
 const dirty=()=>draft!==undefined&&JSON.stringify(draft)!==baseline;
 function render(){stepCleanup();stepCleanup=()=>{};tabs.replaceChildren();body.replaceChildren();actions.replaceChildren();steps.forEach((step,i)=>{const b=element('button',{text:step.title,attributes:{type:'button','aria-pressed':String(i===index)}},doc);b.disabled=busy;b.addEventListener('click',()=>void go(i));tabs.append(b);});stepCleanup=steps[index].render({root:body,value:draft,change:patch=>{if(busy)return;Object.assign(draft,patch);onState({dirty:dirty(),busy});}})||(()=>{});
 const next=element('button',{text:i18n.t(index===steps.length-1?'kitSave':'kitContinue'),className:'primary',attributes:{type:'button'}},doc);next.disabled=busy;next.addEventListener('click',()=>void(index===steps.length-1?save():go(index+1)));actions.append(next);body.inert=busy;onState({dirty:dirty(),busy});}
 async function validate(){const message=await steps[index].validate?.(draft);if(message===false||typeof message==='string'&&message){status.textContent=typeof message==='string'?message:i18n.t('kitRequired');return false;}status.textContent='';return true;}
 async function go(next){if(busy||next===index||next<0||next>=steps.length)return;const version=epoch;busy=true;render();try{if(next<index||await validate()){if(version!==epoch)return;index=next;}}catch(e){if(version===epoch)status.textContent=i18n.message(e.message);}finally{if(version===epoch){busy=false;render();}}}
 async function save(){if(busy)return;const version=epoch;busy=true;render();try{for(let i=0;i<steps.length;i++){const message=await steps[i].validate?.(draft);if(version!==epoch)return;if(message===false||typeof message==='string'&&message){index=i;status.textContent=typeof message==='string'?message:i18n.t('kitRequired');return;}}await onSave(structuredClone(draft));if(version===epoch){baseline=JSON.stringify(draft);await sheet.close();}}catch(e){if(version===epoch)status.textContent=i18n.message(e.message);}finally{if(version===epoch){busy=false;render();}}}
 async function dismiss(){if(busy)return;if(dirty()&&!await confirmDiscard())return;epoch++;await sheet.close();draft=undefined;baseline=undefined;stepCleanup();stepCleanup=()=>{};onState({dirty:false,busy:false});}
 return {async open(value={}){epoch++;draft=structuredClone(value);baseline=JSON.stringify(draft);index=0;busy=false;status.textContent='';render();await sheet.open();},close:dismiss,get dirty(){return dirty();},get busy(){return busy;},get value(){return structuredClone(draft);},destroy(){epoch++;busy=false;stepCleanup();stepCleanup=()=>{};draft=undefined;sheet.destroy();onState({dirty:false,busy:false});}};
}
