/** Session-memory report controller. Server owns durable text/decisions. Closing a
 * sheet never cancels paid work; logout/clear aborts reads and drops all private UI.
 * AI prose is always textContent, not HTML/Markdown interpreted as markup. */
import {element,createBottomSheet} from './modules/index.js';
export function createRoutineConclusion({dialog,root,i18n,request,configured,onRoutine,onAccepted,onError}){
 const sheet=createBottomSheet(dialog);let enabled=false,data=null,reading=false,starting=false,deciding=false,epoch=0,readSerial=0,abort=null,watching=false,requestId=null,error='';
 let historyMode=false,historyItems=null,historyNext=null,historicalReport=null,historyBusy=false,historyError='',historySerial=0;
 const t=(key,params)=>i18n.t('appConclusion'+key,params);
 // A cached dictionary may predate a newly introduced server report section.
 // Use an established translated label rather than exposing an internal key.
 const sectionTitle=key=>{const label=t('Section_'+key);return key==='research'&&label==='appConclusionSection_research'?i18n.t('appSources'):label;};
 const reportText=text=>String(text).replace(/[ \t]*\[S\d+(?:\s*[,;–-]\s*S?\d+)*\]/gi,'').trim();
 const node=(tag,text,className)=>element(tag,{...(text!==undefined?{text}:{}),...(className?{className}:{})});
 const button=(text,action,className='secondary')=>{const b=node('button',text,className);b.type='button';b.addEventListener('click',action);return b;};
 const actions=(label,action,disabled=false)=>{const wrap=node('div',undefined,'conclusion-actions'),b=button(label,action,'primary');b.disabled=disabled;wrap.append(b);root.append(wrap);};
 const dateLabel=value=>new Intl.DateTimeFormat(i18n.language==='lt'?'lt-LT':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 function tabs(){const nav=node('div',undefined,'conclusion-tabs');nav.setAttribute('role','group');nav.setAttribute('aria-label',t('Views'));for(const mode of [false,true]){const b=button(t(mode?'History':'Current'),()=>{historyMode=mode;historySerial++;historyBusy=false;historyError='';render();if(mode&&!historyItems)void loadHistory();});b.setAttribute('aria-pressed',String(historyMode===mode));nav.append(b);}root.append(nav);}
 function reportSections(report){const result=node('div',undefined,'conclusion-result');result.lang=report.language;for(const [key,text]of Object.entries(report.sections)){if(!['overview','benefits','overlaps','research','recommendations'].includes(key))continue;const card=node('section',undefined,'conclusion-section');card.append(node('h3',sectionTitle(key)),node('p',reportText(text)));result.append(card);}return result;}
 function renderHistory(){
  root.replaceChildren();tabs();
  if(historyError){const p=node('p',historyError,'conclusion-error');p.setAttribute('role','alert');root.append(p);actions(t('Retry'),()=>void(historicalReport?loadHistorical(historicalReport.id):loadHistory()));}
  if(historyBusy){const p=node('p',t('Loading'),'conclusion-empty');p.setAttribute('role','status');root.append(p);}
  if(historicalReport){root.append(button(t('AllHistory'),()=>{historySerial++;historyBusy=false;historicalReport=null;historyError='';render();},'secondary conclusion-history-back'));root.append(node('p',t('ArchivedNotice'),'conclusion-warning'),node('p',t('GeneratedAt',{date:dateLabel(historicalReport.createdAt)}),'conclusion-date'));if(historicalReport.inventory)root.append(node('p',t('HistoryCount',{count:historicalReport.inventory.totalProducts}),'conclusion-date'));root.append(reportSections(historicalReport));return;}
  if(!historyBusy&&historyItems?.length===0)root.append(node('p',t('HistoryEmpty'),'conclusion-empty'));
  const list=node('div',undefined,'conclusion-history-list');
  for(const item of historyItems||[]){const b=button('',()=>void loadHistorical(item.id),'conclusion-history-item');b.dataset.historyId=item.id;b.disabled=historyBusy;b.append(node('strong',dateLabel(item.createdAt)));if(item.inventory)b.append(node('small',t('HistoryCount',{count:item.inventory.totalProducts})));b.append(node('span',item.preview));list.append(b);}root.append(list);
  if(historyNext)actions(t('LoadMore'),()=>void loadHistory(true),historyBusy);
 }
 async function loadHistory(more=false){if(historyBusy)return;const version=epoch,serial=++historySerial;historyBusy=true;historyError='';render();try{const result=await request('/v1/conclusions/history'+(more&&historyNext?'?before='+encodeURIComponent(historyNext):''),{signal:abort?.signal});if(version!==epoch||serial!==historySerial)return;historyItems=more?[...(historyItems||[]),...result.items]:result.items;historyNext=result.next;}catch(e){if(version===epoch&&serial===historySerial)historyError=onError(e);}finally{if(version===epoch&&serial===historySerial){historyBusy=false;render();}}}
 async function loadHistorical(id){if(historyBusy)return;const version=epoch,serial=++historySerial;historyBusy=true;historyError='';render();try{const result=await request('/v1/conclusions/history/'+id,{signal:abort?.signal});if(version!==epoch||serial!==historySerial)return;historicalReport=result.report;dialog.scrollTop=0;}catch(e){if(version===epoch&&serial===historySerial)historyError=onError(e);}finally{if(version===epoch&&serial===historySerial){historyBusy=false;render();}}}
 function render(){
  if(!enabled){root.replaceChildren();return;}
  if(historyMode){renderHistory();return;}
  const running=reading||starting||data?.active;let progress=running?root.querySelector('.recheck-progress'):null;for(const child of [...root.children])if(child!==progress)child.remove();
  tabs();
  if(running){if(!progress){progress=node('section',undefined,'recheck-progress');progress.setAttribute('role','status');const track=node('div',undefined,'recheck-progress-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',t('Generating'));track.append(node('span'));progress.append(node('p'),track);root.prepend(progress);}progress.querySelector('p').textContent=t(reading&&!data?'Loading':'Generating');}
  const report=data?.report;
  if(error||data?.error){const message=error||i18n.message(data.error);const p=node('p',message,'conclusion-error');p.setAttribute('role','alert');root.append(p);}
  if(report){
   if(report.stale){const warning=node('div',t('Stale'),'conclusion-warning');warning.setAttribute('role','status');root.append(warning);}
   root.append(node('p',t('GeneratedAt',{date:dateLabel(report.createdAt)}),'conclusion-date'));
   root.append(reportSections(report));
   actions(t('Regenerate'),()=>void generate(),Boolean(running||deciding||!configured()||!data.ready||!data.hasSupplements));
   if(!data.ready)root.append(node('p',t('Incomplete'),'conclusion-empty'));
   if(report.proposals.length){root.append(node('h3',t('GroupRecommendations'),'conclusion-proposals-title'));const list=node('div',undefined,'recheck-proposals');
    for(const p of report.proposals){const card=node('article',undefined,'recheck-proposal');card.dataset.conclusionProposal=p.id;card.append(node('h3',p.name),node('p',p.manufacturer||i18n.t('appUnknownManufacturer'),'recheck-manufacturer'),node('p',(p.from.name||i18n.t('appUnassigned'))+' → '+p.to.name,'recheck-move'));if(p.reason)card.append(node('p',reportText(p.reason),'routine-help'));const row=node('div',undefined,'button-row');const accept=button(i18n.t('appRecheckAccept'),()=>void resolve(p,'accept'),'primary'),remove=button(i18n.t('appRecheckRemove'),()=>void resolve(p,'remove'));accept.disabled=remove.disabled=Boolean(deciding||starting||data.active);row.append(accept,remove);card.append(row);list.append(card);}root.append(list);
   }
  }else if(!running&&data){root.append(node('p',t(!data.hasSupplements?'NoSupplements':data.ready?'Intro':'Incomplete'),'conclusion-empty'));if(data.hasSupplements&&data.ready)actions(t('Generate'),()=>void generate(),!configured());}
  if(!running&&data&&!data.ready)actions(t('CompleteRoutine'),async()=>{await sheet.close();onRoutine();});
  if(!running&&!data)actions(t('Retry'),()=>void open());
  if(!configured()&&data?.hasSupplements)root.append(node('p',t('ConnectionRequired'),'routine-help'));
 }
 async function refresh(version=epoch){const readVersion=++readSerial;const response=await request('/v1/conclusions',{signal:abort?.signal});if(version!==epoch||readVersion!==readSerial)return;const newReport=response.report?.id!==data?.report?.id;if(newReport){historyItems=null;historyNext=null;}data=response;render();if(newReport&&historyMode&&!historicalReport)void loadHistory();if(data.active&&!watching)void watch(version);}
 async function watch(version){watching=true;const signal=abort.signal;try{while(version===epoch&&data?.active&&!signal.aborted){await new Promise(resolve=>{const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();},timer=setTimeout(done,1200);signal.addEventListener('abort',done,{once:true});});if(signal.aborted||version!==epoch)return;await refresh(version);}}catch(e){if(version===epoch&&!signal.aborted){error=onError(e);render();}}finally{if(version===epoch)watching=false;}}
 async function open({history=false}={}){historySerial++;historyBusy=false;historyError='';historyMode=history;historicalReport=null;enabled=true;if(!abort||abort.signal.aborted)abort=new AbortController();const version=epoch;reading=true;error='';render();void sheet.open();try{await refresh(version);if(historyMode&&!historicalReport)await loadHistory();}catch(e){if(version===epoch){error=onError(e);render();}}finally{if(version===epoch){reading=false;render();}}}
 async function generate(){if(starting||data?.active||deciding)return;const version=epoch;starting=true;error='';requestId??=crypto.randomUUID();render();try{await request('/v1/conclusions',{method:'POST',body:{requestId,language:i18n.language}});if(version!==epoch)return;requestId=null;historyItems=null;historyNext=null;await refresh(version);}catch(e){if(version===epoch)error=onError(e);}finally{if(version===epoch){starting=false;render();}}}
 async function resolve(p,action){if(deciding)return;const version=epoch;deciding=true;error='';render();try{await request('/v1/conclusions/'+data.report.id+'/'+p.id,{method:'PATCH',body:{action}});if(version!==epoch)return;if(action==='accept')await onAccepted();await refresh(version);}catch(e){if(version===epoch){error=onError(e);await refresh(version).catch(()=>{});}}finally{if(version===epoch){deciding=false;render();}}}
 return {open,openHistory:()=>open({history:true}),changed(){if(dialog.open&&!reading)void refresh().catch(e=>{error=onError(e);render();});},languageChanged:render,reset(){enabled=false;epoch++;historySerial++;historyMode=false;historyItems=null;historyNext=null;historicalReport=null;historyBusy=false;historyError='';abort?.abort();abort=null;watching=false;data=null;reading=starting=deciding=false;error='';requestId=null;root.replaceChildren();void sheet.close({immediate:true});},get busy(){return starting||deciding;}};
}
