/** Generic pause/resume sheet. Captures the chosen zone with the date; server must
 * validate inclusive return semantics with createPause. No cron or implicit writes.
 */
import {createSheet} from './mobile-ui.js';
import {element} from './ui.js';
import {createI18n} from './i18n.js';
export function createPauseEditor({i18n=createI18n(),onSave,document:doc=globalThis.document}={}){
 let epoch=0,busy=false;const sheet=createSheet({title:i18n.t('kitPause'),i18n,document:doc,onDismiss:()=>{if(!busy)void sheet.close();}}),label=element('label',{text:i18n.t('kitReturnDate')},doc),date=element('input',{attributes:{type:'date'}},doc),manual=element('label',{className:'kit-check'},doc),check=element('input',{attributes:{type:'checkbox'}},doc),status=element('p',{attributes:{role:'alert'}},doc),actions=element('div',{className:'kit-actions kit-actions-pair'},doc);manual.append(check,element('span',{text:i18n.t('kitManualResume')},doc));label.append(date);sheet.content.append(manual,label,status,actions);const save=element('button',{text:i18n.t('kitSave'),className:'primary',attributes:{type:'button'}},doc),resume=element('button',{text:i18n.t('kitResume'),attributes:{type:'button'}},doc);actions.append(save,resume);
 const update=()=>date.disabled=check.checked||busy;check.addEventListener('change',update);
 async function submit(paused){if(busy)return;const version=epoch;if(paused&&!check.checked&&!date.reportValidity())return;busy=true;save.disabled=resume.disabled=true;update();status.textContent='';try{await onSave({paused,resumeOn:paused&&!check.checked?date.value:null,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});if(version===epoch)await sheet.close();}catch(e){if(version===epoch)status.textContent=i18n.message(e.message);}finally{if(version===epoch){busy=false;save.disabled=resume.disabled=false;update();}}}
 save.addEventListener('click',()=>void submit(true));resume.addEventListener('click',()=>void submit(false));
 return {async open(pause=null){epoch++;busy=false;check.checked=!pause?.resumeOn;date.value=pause?.resumeOn||'';date.required=true;const now=new Date();now.setDate(now.getDate()+1);date.min=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;resume.hidden=!pause;status.textContent='';save.disabled=resume.disabled=false;update();await sheet.open();},get busy(){return busy;},get dirty(){return sheet.dialog.open;},destroy(){epoch++;busy=false;sheet.destroy();}};
}
