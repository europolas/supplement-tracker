/** Cloud tracker composition. Reuses toolkit auth/forms/viewport/worker and never
 * stores API keys, photos or account records in browser persistence. Session-scoped
 * in-memory state is cleared on logout, including open dialogs and pending requests.
 */
import {createConfig,createStorage,createSettings,createTheme,createI18n,createRouter,createToast,
 bindForm,trackDirty,setupViewport,setupGestures,setupPwa,watchNetwork,createAuth,setupAccount,
 element,confirmDialog,prepareImage,localDay,compactText} from './modules/index.js';
const config=createConfig(await(await fetch('./app.config.json')).json());
const get=id=>document.getElementById(id),storage=createStorage(config.id);
const settings=createSettings(storage,{language:config.language,theme:config.theme},{language:v=>['en','lt'].includes(v),theme:v=>['light','dark','system'].includes(v)});
const theme=createTheme({storage}),i18n=createI18n(undefined,settings.state.get().language),toast=createToast(get('toast')),network=watchNetwork();
theme.set(settings.state.get().theme);
setupViewport();setupGestures(config.interaction);
// This is a trusted bundled template; user and AI content always use textContent.
get('account-forms').append(document.createRange().createContextualFragment(await(await fetch('./account.html')).text()));
const auth=createAuth({id:config.id,baseUrl:config.apiUrl,persistence:'persistent',timeout:100000});
setupAccount(config,{i18n,auth});
const api=auth.api;
let state={groups:[],supplements:[],ai:null,day:localDay()},owner=null,generation=0,writes=0,router;
let photo=null,imageGeneration=0,sending=false,requestId=null,addedId=null,analysisAbort,midnightTimer,watchedJob=null,latestReport=null,activeJobs=[],modalJobId=null,jobSignature='',recognitionShown=new Set(),jobHistory=[];
const dirty=[...document.querySelectorAll('form')].map(form=>({form,tracker:trackDirty(form)}));
const clearDirty=form=>dirty.find(item=>item.form===form)?.tracker.reset();
for(const {form} of dirty){form.addEventListener('reset',()=>clearDirty(form));form.addEventListener('app:saved',()=>clearDirty(form));}
const zone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const current=()=>auth.state.get().user?.id||null;
const err=error=>i18n.message(error?.data?.error||error?.message||'REQUEST_FAILED');
const notify=(message,error=false)=>toast.show(message,error);
function failure(error){notify(err(error),true);}
function status(id,text,error=false){get(id).textContent=text;get(id).dataset.error=String(error);}
function resetSession(){
 generation++;jobHistory=[];activeJobs=[];modalJobId=null;jobSignature='';recognitionShown.clear();watchedJob=null;sending=false;state={groups:[],supplements:[],ai:null,day:localDay()};analysisAbort?.abort();closeAdd(true);
 for(const {form} of dirty){if(form.id==='settings-form')continue;form.reset();clearDirty(form);}
 get('supplement-detail').replaceChildren();get('ai-form').elements.key.value='';
 get('app-error').hidden=true;get('home-status').textContent='';
 latestReport=null;renderReport('home-analysis-results',null);renderUploadQueue();
}
function heading(text,tag='h2'){return element(tag,{text});}
function button(text,action,className='secondary'){
 const node=element('button',{text,className,attributes:{type:'button'}});node.addEventListener('click',action);return node;
}
async function mutate(task){
 const session=current();writes++;
 try{await task();if(session===current())await load();}
 catch(error){if(session===current())failure(error);}
 finally{writes--;}
}
async function load(checkJobs=true){
 const session=current();if(!session)return;
 const version=++generation;status('home-status',i18n.t('appLoading'));
 try{
  const result=await api.get('/v1/dashboard?timezone='+encodeURIComponent(zone()));
  if(session!==current()||version!==generation)return;
  state=result;get('app-error').hidden=true;status('home-status','');render();
  if(checkJobs){const latest=await api.get('/v1/supplements/jobs');await observeJobs(latest,session);}
 }catch(error){if(session===current()&&version===generation){status('home-status','');get('app-error').hidden=false;get('app-error').textContent=err(error);}}
}
function renderHome(){
 get('routine-note').hidden=!state.supplements.some(s=>s.analysis.schemaVersion==='draft-1');
 get('today-date').textContent=new Intl.DateTimeFormat(i18n.language,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
 get('today-progress').textContent=i18n.t('trackerProgress',{done:state.supplements.filter(s=>s.completed).length,total:state.supplements.length});
 get('home-empty').hidden=state.supplements.length>0;
 const container=get('routine-groups');container.replaceChildren();
 const groups=[...state.groups];if(state.supplements.some(s=>!s.group_id))groups.push({id:null,name:i18n.t('appUnassigned'),description:i18n.t('appUnassignedHelp')});
 groups.forEach((group,index)=>{
  const rows=state.supplements.filter(item=>item.group_id===group.id);
  const section=element('section',{className:'group-block'}),head=element('div',{className:'group-heading'}),labels=element('div');
  head.append(element('span',{text:String(index+1).padStart(2,'0'),className:'group-number'}));labels.append(heading(group.name));
  const benefit=compactText(group.description||[...new Set(rows.map(item=>item.analysis.benefitSummary||item.analysis.benefits?.[0]||''))].filter(Boolean).slice(0,3).join(' · ')||i18n.t('appNoGroupBenefits'),{maxWords:10,maxLength:120});
  labels.append(element('p',{text:benefit,className:'group-benefit'}));head.append(labels);section.append(head);
  const list=element('table',{className:'supplement-table'}),thead=element('thead'),headRow=element('tr');
  headRow.append(element('th',{text:'✓',attributes:{scope:'col','aria-label':i18n.t('appTaken')}}),element('th',{text:i18n.t('appSupplement'),attributes:{scope:'col'}}));thead.append(headRow);list.append(thead);const body=element('tbody');list.append(body);
  if(!rows.length){const emptyRow=element('tr');emptyRow.append(element('td',{text:i18n.t('appGroupEmpty'),className:'group-empty',attributes:{colspan:'2'}}));body.append(emptyRow);}
  for(const item of rows){
   const row=element('tr',{className:'supplement-row'+(item.completed?' is-done':'')});row.dataset.id=item.id;
   const open=button('',()=>router.navigate('/detail?id='+encodeURIComponent(item.id)),'supplement-open');
   open.append(element('strong',{text:item.name}));if(item.analysis.enrichment&&item.analysis.enrichment.status!=='complete')open.append(element('span',{text:i18n.t('appInfo_'+item.analysis.enrichment.status),className:'research-badge'}));
   const summary=compactText(item.analysis.benefitSummary||item.analysis.benefits?.[0]||item.analysis.whenToUse);
   if(summary)open.append(element('span',{text:summary,className:'summary'}));

   const check=button('',async()=>{if(check.disabled)return;check.disabled=true;await mutate(()=>api.request('/v1/supplements/'+item.id+'/completion',{method:'PUT',body:{completed:!(state.day===localDay()&&item.completed),timezone:zone()}}));check.disabled=false;},'check-button');
   check.setAttribute('aria-label',i18n.t(item.completed?'appUntake':'appTake',{name:item.name}));check.setAttribute('aria-pressed',String(item.completed));
   check.append(element('span',{text:'✓',className:'check-ring',attributes:{'aria-hidden':'true'}}));const checkCell=element('td'),nameCell=element('td');checkCell.append(check);nameCell.append(open);row.append(checkCell,nameCell);body.append(row);
  }section.append(list);container.append(section);
 });
}
function renderGroups(){
 const list=get('group-list');list.replaceChildren();
 for(const [index,group] of state.groups.entries()){
  const card=element('div',{className:'surface'});card.append(element('p',{text:String(index+1).padStart(2,'0'),className:'eyebrow'}),heading(group.name));
  if(group.description)card.append(element('p',{text:group.description,className:'muted'}));
  const actions=element('div',{className:'group-actions'});
  actions.append(button(i18n.t('appEdit'),()=>{
   const form=get('group-form');form.elements.id.value=group.id;form.elements.name.value=group.name;form.elements.description.value=group.description;
   get('group-form-title').textContent=i18n.t('appEditGroup');get('cancel-group').hidden=false;form.dispatchEvent(new Event('input',{bubbles:true}));form.scrollIntoView({block:'center',behavior:'smooth'});
  }));
  actions.append(button(i18n.t('appDelete'),async()=>{
   if(!await confirmDialog(i18n.t('appDeleteGroupConfirm'),{i18n}))return;
   await mutate(()=>api.delete('/v1/groups/'+group.id));if(get('group-form').elements.id.value===group.id)resetGroup();
  },'danger-link'));card.append(actions);list.append(card);
 }
}
function renderDetail(){
 const id=new URLSearchParams(location.hash.split('?')[1]||'').get('id');
 const item=state.supplements.find(s=>s.id===id),container=get('supplement-detail');container.replaceChildren();
 if(!item){container.append(element('p',{text:i18n.t('appDetailMissing')}));return;}
 const analysis=item.analysis,card=element('div',{className:'surface detail-section'});
 card.append(element('p',{text:state.groups.find(g=>g.id===item.group_id)?.name||i18n.t('appUnassigned'),className:'eyebrow'}),element('h1',{text:item.name,className:'detail-name'}));
 if(analysis.needsReview)card.append(element('p',{text:i18n.t('appReview')+(analysis.reviewReason?' '+analysis.reviewReason:''),className:'review-note'}));
 if(analysis.manufacturer)card.append(element('p',{text:[analysis.manufacturer,analysis.variant].filter(Boolean).join(' · '),className:'muted'}));
 const pending=['queued','researching'].includes(analysis.enrichment?.status);
 if(analysis.enrichment&&analysis.enrichment.status!=='complete')card.append(element('p',{text:i18n.t('appInfo_'+analysis.enrichment.status)+(analysis.enrichment.error?' '+i18n.message(analysis.enrichment.error):''),className:'review-note'}));
 if(analysis.language&&analysis.language!==i18n.language)card.append(element('p',{text:i18n.t('appAnalysisLanguage',{language:analysis.language==='lt'?'Lietuvių':'English'}),className:'detail-meta'}));
 if(analysis.compatibility?.stale)card.append(element('p',{text:i18n.t('appCompatibilityStale'),className:'review-note'}));
 if(analysis.schemaVersion!=='draft-1'){
 if(analysis.dosage){
  const d=analysis.dosage;card.append(heading(i18n.t('appManufacturerDose'),'h3'),element('p',{text:d.directions||i18n.t('appNoLabel')}));
  if(d.servingSize)card.append(element('p',{text:i18n.t('appServingSize')+': '+d.servingSize,className:'detail-meta'}));
 }
 const fallback=analysis.doseFallback;
 if(fallback&&fallback.basis!=='not_needed'&&(!analysis.dosage?.directions||analysis.dosage?.dailyServingsMin==null)){
  card.append(heading(i18n.t('appDoseFallback'),'h3'));
  if(['established_adult_intake','usual_adult_supplement_range'].includes(fallback.basis)){
   const number=value=>new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2}).format(value),unit=fallback.unit==='ug'?'µg':fallback.unit;
   const range=fallback.dailyAmountMin===fallback.dailyAmountMax?number(fallback.dailyAmountMin):number(fallback.dailyAmountMin)+'–'+number(fallback.dailyAmountMax);
   card.append(element('p',{text:fallback.ingredient+': '+range+' '+unit}),element('p',{text:i18n.t(fallback.basis==='established_adult_intake'?'appDoseIntakeReference':'appDoseSupplementRange'),className:'detail-meta'}));
   card.append(element('p',{text:i18n.t('appDoseFallbackHelp'),className:'review-note'}));
  }else card.append(element('p',{text:i18n.t('appDoseFallbackUnavailable')}));
  if(fallback.explanation)card.append(element('p',{text:fallback.explanation}));
  // The URL was independently matched to provider citations on the server.
  if(fallback.sourceUrl)card.append(element('a',{text:i18n.t('appSources'),attributes:{href:fallback.sourceUrl,target:'_blank',rel:'noopener noreferrer'},className:'detail-meta'}));
 }
 if(analysis.nutrients?.length){
  card.append(heading(i18n.t('appNutrients'),'h3'));
  const table=element('table',{className:'nutrient-table'}),head=element('thead'),tr=element('tr');
  for(const key of ['appNutrient','appPerServing','appDailyAmount','appReference'])tr.append(element('th',{text:i18n.t(key),attributes:{scope:'col'}}));head.append(tr);table.append(head);const body=element('tbody');
  const number=value=>new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2}).format(value);
  const unit=value=>value==='ug'?'µg':value;
  const amount=(value,u)=>value===null||value===undefined?'—':number(value)+' '+unit(u);
  const range=(a,b,u)=>a===null||a===undefined?'—':a===b?amount(a,u):number(a)+'–'+amount(b,u);
  for(const n of analysis.nutrients){const row=element('tr');
   const daily=range(n.dailyAmountMin,n.dailyAmountMax,n.unit==='other'?n.originalUnit||'':n.unit);
   const reference=n.reference?amount(n.reference.amount,n.reference.unit):i18n.t('appNoNrv');
   const percent=n.dailyPercentMin===null||n.dailyPercentMin===undefined?'':range(n.dailyPercentMin,n.dailyPercentMax,'%');
   const name=element('td');name.append(element('strong',{text:n.name}));if(n.amountNote)name.append(element('small',{text:n.amountNote}));
   row.append(name,element('td',{text:amount(n.amount,n.unit==='other'?n.originalUnit||'':n.unit)}),element('td',{text:daily+(percent?' · '+percent:'')}),element('td',{text:reference}));body.append(row);
  }table.append(body);card.append(table,element('p',{text:i18n.t('appNrvHelp'),className:'detail-meta'}));
 }
 if(analysis.compatibility){
  card.append(heading(i18n.t('appCompatibility'),'h3'),element('p',{text:analysis.compatibility.summary}));
  const list=element('ul');for(const assessment of analysis.compatibility.assessments){list.append(element('li',{text:assessment.supplementName+' · '+i18n.t('compat_'+assessment.status)+': '+assessment.reason}));}card.append(list);
 }
 for(const [key,value] of [['appBenefits',analysis.benefits],['appHow',analysis.howToUse],['appWhen',analysis.whenToUse],...(!analysis.dosage?[['appLabel',analysis.labelDirections||i18n.t('appNoLabel')]]:[]),['appCautions',analysis.cautions]]){
  card.append(heading(i18n.t(key),'h3'));
  if(Array.isArray(value)){const ul=element('ul');for(const entry of value)ul.append(element('li',{text:entry}));card.append(ul);}else card.append(element('p',{text:value}));
 }
 if(analysis.sources?.length){
  card.append(heading(i18n.t('appSources'),'h3'));const list=element('ul',{className:'source-list'});
  for(const source of analysis.sources){const row=element('li');row.append(element('a',{text:source.title,attributes:{href:source.url,target:'_blank',rel:'noopener noreferrer'}}),element('span',{text:' · '+i18n.t('source_'+source.kind),className:'detail-meta'}));list.append(row);}card.append(list);
  if(analysis.research?.checkedAt)card.append(element('p',{text:i18n.t('appResearchedAt',{date:new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(analysis.research.checkedAt))}),className:'detail-meta'}));
  if(analysis.research?.omittedSourceCount)card.append(element('p',{text:i18n.t('appOmittedSources',{count:analysis.research.omittedSourceCount}),className:'review-note'}));
 }
 card.append(element('p',{text:analysis.evidenceNote,className:'detail-meta'}),element('p',{text:i18n.t('appAiNote'),className:'detail-meta'}));
 }else{card.append(element('p',{text:i18n.t('appProvisional'),className:'review-note'}),heading(i18n.t('appBenefits'),'h3'),element('p',{text:analysis.benefits.join(' · ')}),element('p',{text:analysis.whenToUse}));}
 const refresh=button(i18n.t('appRefreshInfo'),async()=>{const session=current();refresh.disabled=true;writes++;try{const job=await api.post('/v1/supplements/'+item.id+'/research',{requestId:crypto.randomUUID(),language:i18n.language});if(session!==current())return;await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);await load();}catch(error){if(session===current()){failure(error);refresh.disabled=false;}}finally{writes--;}});refresh.disabled=pending;card.append(refresh);
 const select=element('select',{attributes:{'aria-label':i18n.t('appMoveGroup')}});
 select.append(element('option',{text:i18n.t('appUnassigned'),attributes:{value:''}}));
 for(const group of state.groups)select.append(element('option',{text:group.name,attributes:{value:group.id}}));select.value=item.group_id||'';
 select.addEventListener('change',async()=>{select.disabled=true;await mutate(()=>api.patch('/v1/supplements/'+item.id,{groupId:select.value||null}));});
 card.append(heading(i18n.t('appMoveGroup'),'h3'),select);
 card.append(button(i18n.t('appDeleteSupplement'),async()=>{
  if(!await confirmDialog(i18n.t('appDeleteSupplementConfirm'),{i18n}))return;
  await mutate(async()=>{await api.delete('/v1/supplements/'+item.id);router.navigate('/');});
 },'danger-link'));container.append(card);
}
function renderAi(){
 get('ai-settings').hidden=!current();if(!state.ai)return;
 status('ai-key-status',i18n.t(state.ai.configured?'appKeySaved':'appKeyMissing'));
 get('remove-key').disabled=!state.ai.configured;
 const select=get('ai-form').elements.model;
 const editing=dirty.find(item=>item.form===get('ai-form')).tracker.dirty;
 if(!editing){select.replaceChildren(...state.ai.models.map(model=>element('option',{text:model,attributes:{value:model}})));select.value=state.ai.model;}
}
function render(){
 i18n.render(document);get('app-version').textContent=i18n.t('version',{version:config.version});
 get('network-status').textContent=network.state.get().online?'':i18n.t('appOffline');
 get('app-nav').hidden=!current();renderHome();renderGroups();renderDetail();renderAi();
 get('group-form-title').textContent=i18n.t(get('group-form').elements.id.value?'appEditGroup':'appNewGroup');
 renderReport('home-analysis-results',latestReport);renderUploadQueue();
}
/** Only server-owned account metadata is displayed; model text always uses safe
 * text nodes. Show partial successes and skipped/failed identities individually. */
function renderReport(id,report){
 const container=get(id);container.replaceChildren();container.hidden=!report;if(!report)return;
 const items=report.items||[],added=items.filter(item=>item.status==='added');
 container.append(heading(report.running?i18n.t('appBatchProgress',{done:items.filter(item=>['complete','reused','failed'].includes(item.research)).length,total:report.total}):i18n.t('appBatchSummary',{added:added.length,total:items.length}),'h3'));
 const list=element('ul');
 for(const item of items){const row=element('li');
  if(item.status==='added'&&state.supplements.some(s=>s.id===item.id))row.append(button('✓ '+item.name,()=>{get('add-dialog').close();router.navigate('/detail?id='+encodeURIComponent(item.id));}));
  else row.textContent=item.name+(item.status==='failed'?' — '+i18n.message(item.error):'');if(item.research)row.append(element('span',{text:' · '+i18n.t('appInfo_'+item.research)+(item.error?' — '+i18n.message(item.error):''),className:'research-badge'}));list.append(row);
 }container.append(list);
 if(report.skipped?.length){container.append(heading(i18n.t('appPhotoSkipped'),'h3'));const skipped=element('ul');for(const item of report.skipped)skipped.append(element('li',{text:[item.name||item.location,item.reasonCode?i18n.message(item.reasonCode):item.reason].filter(Boolean).join(' — ')}));container.append(skipped);}
}
function resetGroup(){get('group-form').reset();clearDirty(get('group-form'));get('cancel-group').hidden=true;get('group-form-title').textContent=i18n.t('appNewGroup');}
get('cancel-group').addEventListener('click',resetGroup);
bindForm(get('group-form'),async(data,form)=>{
 await api.request('/v1/groups'+(data.id?'/'+data.id:''),{method:data.id?'PATCH':'POST',body:{name:data.name,description:data.description}});
 resetGroup();await load();notify(i18n.t('appSaved'));
},{onError:failure});
bindForm(get('settings-form'),data=>{settings.update(data);clearDirty(get('settings-form'));notify(i18n.t('saved'));},{onError:failure});
bindForm(get('ai-form'),async(data,form)=>{
 state.ai=await api.request('/v1/settings/ai',{method:'PUT',body:{key:data.key||undefined,model:data.model}});
 form.elements.key.value='';clearDirty(form);renderAi();notify(i18n.t('appSaved'));
},{onError:error=>{get('ai-form').elements.key.value='';failure(error);}});
get('remove-key').addEventListener('click',async()=>{
 if(!await confirmDialog(i18n.t('appRemoveKeyConfirm'),{i18n}))return;
 const node=get('remove-key');node.disabled=true;
 await mutate(async()=>{state.ai=await api.delete('/v1/settings/ai');get('ai-form').elements.key.value='';clearDirty(get('ai-form'));});
 renderAi();
});
function clearPhoto(){imageGeneration++;photo=null;get('photo-preview').removeAttribute('src');get('photo-preview').hidden=true;get('remove-photo').hidden=true;for(const name of ['camera','photo'])get('analyze-form').elements[name].value='';get('analyze-form').querySelector('button[type="submit"]').disabled=false;}
function resetAddDraft(){get('analyze-form').reset();clearPhoto();clearDirty(get('analyze-form'));requestId=crypto.randomUUID();}
function closeAdd(force=false){
 get('add-dialog').close();if(!force)return;
 resetAddDraft();modalJobId=null;addedId=null;get('view-added').hidden=true;get('analysis-status').textContent='';get('analyze-form').hidden=false;get('analyze-form').querySelector('fieldset').disabled=false;
}
get('add-supplement').addEventListener('click',()=>{
 if(!state.ai?.configured){notify(i18n.t('AI_KEY_REQUIRED'),true);router.navigate('/account');return;}
 if(!state.groups.length){notify(i18n.t('CREATE_GROUP_FIRST'),true);router.navigate('/groups');return;}
 requestId ||= crypto.randomUUID();renderUploadQueue();get('add-dialog').showModal();
 // Refresh history even when no active polling survived a previous connection loss.
 void load();
});
get('close-add').addEventListener('click',()=>closeAdd());
get('add-dialog').addEventListener('cancel',event=>{event.preventDefault();closeAdd();});
get('remove-photo').addEventListener('click',()=>{clearPhoto();requestId=crypto.randomUUID();});
get('analyze-form').elements.name.addEventListener('input',()=>{requestId=crypto.randomUUID();});
for(const name of ['camera','photo'])get('analyze-form').elements[name].addEventListener('change',async event=>{
 const selected=event.target.files[0];if(!selected)return;
 const version=++imageGeneration;get('analyze-form').querySelector('button[type="submit"]').disabled=true;
 status('analysis-status',i18n.t('appPreparingPhoto'));
 try{const data=await prepareImage(selected);if(version!==imageGeneration)return;photo=data;requestId=crypto.randomUUID();get('photo-preview').src=data;get('photo-preview').hidden=false;get('remove-photo').hidden=false;status('analysis-status','');}
 catch(error){if(version===imageGeneration){clearPhoto();status('analysis-status',err(error),true);}}
 finally{if(version===imageGeneration)get('analyze-form').querySelector('button[type="submit"]').disabled=false;}
});
/** Account-scoped process history. Keep the composer independent of server jobs:
 * polling must never clear a newly selected photo or typed next supplement. No
 * private history/photo enters browser persistence; API history restores reloads. */
function renderUploadQueue(){
 const container=get('analysis-results'),previous=new Map([...container.querySelectorAll('details[data-job-id]')].map(node=>[node.dataset.jobId,node.open]));
 container.replaceChildren();get('upload-queue').hidden=!jobHistory.length;
 const running=jobHistory.filter(job=>job.status==='running');get('upload-queue-count').textContent=i18n.t('appUploadQueueCount',{count:running.length});
 const ordered=[...jobHistory].sort((a,b)=>(a.status==='running'?0:1)-(b.status==='running'?0:1)||(a.status==='running'?Date.parse(a.created_at||0)-Date.parse(b.created_at||0):Date.parse(b.finished_at||b.created_at||0)-Date.parse(a.finished_at||a.created_at||0)));
 for(const job of ordered){
  const card=element('details',{className:'upload-job',attributes:{'data-job-id':job.id,'data-phase':job.phase||'recognizing'}});card.open=previous.has(job.id)?previous.get(job.id):job.status==='running'||job.id===modalJobId;
  const submission=job.result?.submission,title=submission?.name||i18n.t(submission?.kind==='photo'?'appUploadPhoto':'appUploadSupplement');
  const failed=job.status==='failed',issues=job.result?.items?.some(item=>item.research==='failed'||item.status==='failed');
  const phase=job.phase||'recognizing',label=failed?'appUploadFailed':job.status==='complete'?(issues?'appUploadDoneIssues':'appUploadDone'):'appUpload_'+phase;
  const summary=element('summary'),labels=element('div',{className:'upload-job-labels'});labels.append(element('strong',{text:title}),element('span',{text:i18n.t(label),className:'upload-job-phase'}));
  if(job.created_at){const date=new Date(job.created_at);if(Number.isFinite(date.getTime()))labels.append(element('time',{text:new Intl.DateTimeFormat(i18n.language,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date),attributes:{datetime:date.toISOString()},className:'upload-job-time'}));}
  summary.append(element('span',{text:failed?'!':job.status==='complete'?'✓':'…',className:'upload-job-icon',attributes:{'aria-hidden':'true'}}),labels);card.append(summary);
  const step=job.status==='complete'?3:failed?({queued:0,recognizing:1,enriching:2}[job.result?.failedPhase]??(job.result?.items?.length?2:1)):({queued:0,recognizing:1,enriching:2,done:3}[phase]??1),steps=element('ol',{className:'upload-steps'});
  ['appUpload_queued','appUpload_recognizing','appUpload_enriching','appUploadDone'].forEach((key,index)=>{const row=element('li',{text:i18n.t(key),className:index<step||job.status==='complete'?'is-complete':index===step?'is-current':''});if(index===step&&job.status==='running')row.setAttribute('aria-current','step');if(index===step&&failed)row.dataset.error='true';steps.append(row);});card.append(steps);
  if(job.total_count>0){const progress=element('progress',{attributes:{max:String(job.total_count),value:String(job.processed_count||0),'aria-label':i18n.t('appUpload_enriching')}});card.append(progress,element('p',{text:i18n.t('appUploadDetailsProgress',{done:job.processed_count||0,total:job.total_count}),className:'form-help'}));}
  if(failed)card.append(element('p',{text:err(new Error(job.error_code||'REQUEST_FAILED')),attributes:{'data-error':'true'}}));
  if(job.result?.items?.length||job.result?.skipped?.length){const result=element('div',{attributes:{id:'upload-result-'+job.id},className:'upload-job-result'});card.append(result);container.append(card);renderReport(result.id,{...job.result,running:job.status==='running',total:job.total_count});}else container.append(card);
 }
}
/** One loop observes every job; closing the upload dialog never aborts it. */
async function observeJobs(data,session,refresh=false){
 if(session!==current())return;
 const active=data.active||((data.job?.status==='running')?[data.job]:[]),signature=JSON.stringify([data.job,active,data.recent]);
 if(refresh&&signature!==jobSignature)await load(false);if(session!==current())return;jobSignature=signature;activeJobs=active;
 const history=new Map(jobHistory.map(job=>[job.id,job]));for(const job of [...(data.recent||[]),...(data.job?[data.job]:[]),...active])history.set(job.id,job);
 jobHistory=[...history.values()].sort((a,b)=>Date.parse(b.finished_at||b.created_at||0)-Date.parse(a.finished_at||a.created_at||0)).filter((job,index)=>job.status==='running'||index<20);
 const recognizing=active.some(job=>!job.phase||job.phase==='recognizing'),queued=active.some(job=>job.phase==='queued');
 const progress=active.reduce((sum,job)=>({done:sum.done+(job.processed_count||0),total:sum.total+(job.total_count||0)}),{done:0,total:0});
 status('home-status',recognizing?i18n.t('appRecognizing'):queued?i18n.t('appUpload_queued'):active.length?i18n.t('appEnrichingProgress',progress):data.job?.status==='failed'?err(new Error(data.job.error_code||'REQUEST_FAILED')):'',data.job?.status==='failed');
 if(data.job?.result?.items?.length){latestReport={...data.job.result,running:data.job.status==='running',total:data.job.total_count};renderReport('home-analysis-results',latestReport);}
 const job=history.get(modalJobId);
 if(job&&!sending){
  if(job.status==='failed')status('analysis-status',err(new Error(job.error_code||'REQUEST_FAILED')),true);
  else if(job.phase==='enriching'||job.status==='complete'){
   if(!recognitionShown.has(job.id)){recognitionShown.add(job.id);notify(i18n.t('appRecognized',{count:job.result?.items.length||1}));}
   status('analysis-status',job.status==='complete'?i18n.t('appBatchSummary',{added:job.result?.items.filter(item=>item.status==='added').length||1,total:job.total_count||1}):i18n.t('appRecognized',{count:job.total_count||0})+' '+i18n.t('appEnrichingProgress',{done:job.processed_count||0,total:job.total_count||0}));
  }else status('analysis-status',i18n.t(job.phase==='queued'?'appUpload_queued':'appRecognizing'));
 }
 renderUploadQueue();
 if(active.length&&!watchedJob)void watchJobs(session);
}
async function watchJobs(session){
 const marker={};watchedJob=marker;analysisAbort=new AbortController();const signal=analysisAbort.signal;
 const wait=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1200);function abort(){clearTimeout(timer);reject(new Error('AI_JOB_INTERRUPTED'));}signal.addEventListener('abort',abort,{once:true});});
 try{while(session===current()&&activeJobs.length){await wait();const data=await api.get('/v1/supplements/jobs',{signal});await observeJobs(data,session,true);}}
 catch(error){if(session===current()&&!signal.aborted)status('home-status',err(error),true);}
 finally{if(watchedJob===marker)watchedJob=null;}
}
get('analyze-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!current())return;
 const form=get('analyze-form'),name=form.elements.name.value.trim();
 if(!name&&!photo){status('analysis-status',i18n.t('NAME_OR_PHOTO_REQUIRED'),true);return;}
 const session=current();sending=true;writes++;form.querySelector('fieldset').disabled=true;
 status('analysis-status',i18n.t('appUploading'));
 try{
  const job=await api.post('/v1/supplements/jobs',{requestId:requestId||crypto.randomUUID(),name,image:photo,language:i18n.language});
  if(session!==current())return;resetAddDraft();modalJobId=job.id;status('analysis-status',i18n.t('appUploadAccepted'));await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);
 }catch(error){if(session===current()){status('analysis-status',err(error),true);form.querySelector('fieldset').disabled=false;}}
 finally{sending=false;writes--;form.querySelector('fieldset').disabled=false;get('close-add').disabled=false;}
});
get('view-added').addEventListener('click',()=>{const id=addedId;closeAdd();if(id)router.navigate('/detail?id='+encodeURIComponent(id));});
settings.state.subscribe(value=>{
 theme.set(value.theme);i18n.setLanguage(value.language);get('settings-form').elements.language.value=value.language;get('settings-form').elements.theme.value=value.theme;render();
},true);
network.state.subscribe(()=>render());
router=createRouter({routes:Object.fromEntries(['/', '/groups','/account','/detail'].map(path=>[path,()=>{
 if(path!=='/account'&&!current()){location.hash='/account';return;}
 for(const section of document.querySelectorAll('[data-screen]'))section.hidden=section.dataset.screen!==path;
 for(const link of document.querySelectorAll('[data-route]')){if(link.dataset.route===path)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 get('preferences').hidden=path!=='/account';renderDetail();document.querySelector('main').scrollTop=0;
}])),onNotFound:()=>{location.hash=current()?'/':'/account';}});
auth.state.subscribe(async({user})=>{
 const next=user?.id||null;if(next===owner)return;owner=next;resetSession();if(user)get('profile-form').elements.name.value=user.name;render();
 if(!next){router.navigate('/account');return;}
 const session=next;
 try{await api.post('/v1/bootstrap',{timezone:zone(),language:i18n.language});if(current()!==session)return;await load();router.navigate('/');}
 catch(error){if(current()===session)failure(error);}
},true);
function refreshDay(){
 if(state.day!==localDay()){state.day=localDay();state.supplements=state.supplements.map(item=>({...item,completed:false}));renderHome();}
 if(current()&&document.visibilityState==='visible')load();
}
function scheduleMidnight(){clearTimeout(midnightTimer);const next=new Date();next.setHours(24,0,0,50);midnightTimer=setTimeout(()=>{refreshDay();scheduleMidnight();},Math.max(50,next-Date.now()));}
scheduleMidnight();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshDay();scheduleMidnight();}});
window.addEventListener('focus',refreshDay);
let applyUpdate;
await setupPwa({canReload:()=>!sending&&writes===0&&!document.querySelector('dialog[open], form[aria-busy="true"]')&&!dirty.some(({tracker})=>tracker.dirty)&&![...document.querySelectorAll('input[type="password"]')].some(node=>node.value),
 onUpdate:({apply})=>{applyUpdate=apply;get('update-card').hidden=false;},onError:()=>{}});
get('update-button').addEventListener('click',()=>{try{applyUpdate?.();}catch(error){failure(error);}});
