/** Explicit owner-only download. No AI call, public URL or browser persistence.
 * A session/selection epoch rejects late responses. Close/logout abort reads and
 * revoke the only local object URL; native pickers keep their selected dates. */
import {element,createBottomSheet,localDay,previewFile} from './modules/index.js';
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function createDataExport({dialog,root,i18n,request,timezone,onError}){
 const sheet=createBottomSheet(dialog,{onDismiss:()=>{cancel();void sheet.close();}}),t=(key,p)=>i18n.t('appExport'+key,p);let preset='30',from=shift(localDay(),-29),to=localDay(),busy=false,epoch=0,abort=null,file=null,filename='',error='',renderedLanguage=i18n.language;
 const node=(tag,text,className)=>element(tag,{...(text===undefined?{}:{text}),...(className?{className}:{})});
 function cancel(){epoch++;abort?.abort();abort=null;busy=false;error='';dispose();root.replaceChildren();}
 function dispose(){file?.dispose();file=null;filename='';}
 function render(){
  root.replaceChildren();root.append(node('p',t('Description'),'routine-help'));
  const form=node('form',undefined,'export-form'),label=(key,control)=>{const l=node('label');l.append(node('span',t(key)),control);form.append(l);return l;},period=node('select');period.name='period';
  for(const key of ['7','30','90','custom'])period.append(element('option',{text:t(key),attributes:{value:key}}));period.value=preset;period.disabled=busy;
  period.addEventListener('change',()=>{preset=period.value;if(preset!=='custom'){to=localDay();from=shift(to,1-Number(preset));}dispose();error='';render();});label('Period',period);
  // Presets keep their calculated dates in memory; only custom ranges expose editors.
  if(preset==='custom'){const dates=node('div',undefined,'export-dates');for(const [key,name,value]of [['From','from',from],['To','to',to]]){const input=element('input',{attributes:{name,type:'date',value,min:'2000-01-01',max:localDay(),required:''}});input.disabled=busy;const l=node('label');l.append(node('span',t(key)),input);dates.append(l);input.addEventListener('change',()=>{if(name==='from')from=input.value;else to=input.value;preset='custom';period.value='custom';dispose();error='';root.querySelector('.export-download')?.remove();});}form.append(dates,node('p',t('RangeHelp'),'routine-help'));}
  const submit=element('button',{text:t(file?'Refresh':'Download'),className:file?'secondary':'primary',attributes:{type:'submit'}});submit.disabled=busy;form.append(submit);form.addEventListener('submit',event=>{event.preventDefault();void generate();});root.append(form);
  if(busy){const progress=node('section',undefined,'recheck-progress');progress.setAttribute('role','status');const track=node('div',undefined,'recheck-progress-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',t('Working'));track.append(node('span'));progress.append(node('p',t('Working')),track);root.append(progress);}
  if(error){const p=node('p',error,'conclusion-error');p.setAttribute('role','alert');root.append(p);}
  if(file){const ready=node('div',undefined,'export-download'),message=node('p',t('Ready'),'routine-help');message.setAttribute('role','status');const link=element('a',{text:t('Again'),className:'primary export-file-link',attributes:{download:filename}});
  // Only this controller's own Blob URL bypasses the generic external-URL guard.
  link.href=file.url;ready.append(message,link);root.append(ready);}
  root.setAttribute('aria-busy',String(busy));
 }
 async function generate(){
  if(busy)return;const valid=/^\d{4}-\d{2}-\d{2}$/;if(!valid.test(from)||!valid.test(to)||from>to||from<'2000-01-01'||to>localDay()||(Date.parse(to)-Date.parse(from))/86400000>365){error=i18n.message('INVALID_EXPORT_RANGE');render();return;}
  const version=++epoch;abort?.abort();abort=new AbortController();busy=true;error='';dispose();render();
  try{const result=await request('/v1/exports/pdf',{method:'POST',body:{from,to,timezone:timezone(),language:i18n.language},signal:abort.signal});if(version!==epoch)return;if(result.mime!=='application/pdf'||typeof result.pdf!=='string'||result.pdf.length>12*1024*1024)throw Error('REQUEST_FAILED');const bytes=Uint8Array.from(atob(result.pdf),c=>c.charCodeAt(0));if(String.fromCharCode(...bytes.slice(0,4))!=='%PDF')throw Error('REQUEST_FAILED');filename=String(result.filename).replace(/[\\/]/g,'_');file=previewFile(new Blob([bytes],{type:'application/pdf'}));busy=false;render();root.querySelector('.export-file-link').click();}
  catch(e){if(version===epoch){error=onError(e);}}
  finally{if(version===epoch){busy=false;render();}}
 }
 dialog.addEventListener('close',cancel);
 return {open(){if(preset!=='custom'){to=localDay();from=shift(to,1-Number(preset));}render();void sheet.open();},languageChanged(){if(i18n.language!==renderedLanguage){renderedLanguage=i18n.language;if(dialog.open)render();}},reset(){epoch++;abort?.abort();abort=null;busy=false;error='';dispose();preset='30';to=localDay();from=shift(to,-29);root.replaceChildren();void sheet.close({immediate:true});},get busy(){return busy;}};
}
