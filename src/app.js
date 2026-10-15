/** Cloud tracker composition. Reuses toolkit auth/forms/viewport/worker and never
 * stores API keys, photos or account records in browser persistence. Session-scoped
 * in-memory state is cleared on logout, including open dialogs and pending requests.
 */
import {createConfig,createStorage,createSettings,createTheme,createI18n,createRouter,createToast,
 bindForm,trackDirty,setupViewport,setupGestures,setupPwa,watchNetwork,createAuth,setupAccount,
 element,confirmDialog as nativeConfirmDialog,prepareImage,localDay,compactText,createBottomSheet,productLabel,createImageViewer} from './modules/index.js';
// Local presentation icons use fixed SVG paths, never server/model markup.
const iconPaths={
 user:'M20 21v-2a7 7 0 0 0-14 0v2 M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
 home:'m3 10 9-7 9 7v11h-6v-7H9v7H3Z',
 calendar:'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 17h2',
 trash:'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
 expand:'M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6',
 plus:'M12 5v14 M5 12h14',close:'m6 6 12 12 M18 6 6 18',
 camera:'M3 7h4l2-3h6l2 3h4v14H3Z M16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 image:'M3 3h18v18H3Z m0 14 6-6 5 5 3-3 4 4 M8 7h.01',
 shield:'m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7Z M12 3v18',
 info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 meal:'M5 3v7 M2 3v5a3 3 0 0 0 6 0V3 M5 11v10 M19 3c-4 2-4 7 0 8h2 M21 3v18',
 moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
 sun:'M12 2v2 M12 20v2 M2 12h2 M20 12h2 m-3-9 1.5-1.5 M5 19l-1.5 1.5 M3 3l2 2 M19 19l2 2 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
 leaf:'M4 20c0-9 7-14 16-16 0 11-5 16-12 14 M4 20 15 9',
 clock:'M12 6v6l4 3 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 dose:'M9 3h6v3H9Z M7 6h10l2 4v11H5V10Z M9 13h6 M12 10v6',
 check:'m5 12 4 4 10-10',chevron:'m9 5 7 7-7 7'
};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:'icon'}))svg.setAttribute(k,v);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',iconPaths[name]||iconPaths.leaf);svg.append(path);return svg;}
for(const node of document.querySelectorAll('[data-icon]'))node.append(icon(node.dataset.icon));
const confirmDialog=(message,options)=>nativeConfirmDialog(message,{...options,presentation:'sheet'});
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
let baseRoute='/';
const addSheet=createBottomSheet(get('add-dialog'),{onDismiss:()=>closeAdd()});
const photoViewer=createImageViewer({labels:()=>({title:i18n.t('appPhotoPreview'),close:i18n.t('appClose'),zoom:i18n.t('appZoomIn'),fit:i18n.t('appFitImage')})});
const groupSheet=createBottomSheet(get('group-dialog'));
const routeSheet=createBottomSheet(get('route-dialog'),{onDismiss:()=>{if(current())router.navigate(baseRoute);}});
let state={groups:[],supplements:[],ai:null,day:localDay()},owner=null,generation=0,writes=0,router;
let collectionEpoch=0,photo=[],imageGeneration=0,sending=false,requestId=null,addedId=null,analysisAbort,midnightTimer,watchedJob=null,latestReport=null,activeJobs=[],modalJobId=null,jobSignature='',recognitionShown=new Set(),jobHistory=[];
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
 collectionEpoch++;
 void groupSheet.close({immediate:true});
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
  if(checkJobs){const latest=await api.get('/v1/supplements/jobs');if(version!==generation)return;await observeJobs(latest,session);}
 }catch(error){if(session===current()&&version===generation){status('home-status','');get('app-error').hidden=false;get('app-error').textContent=err(error);}}
}
function renderHome(){
 get('routine-note').hidden=!state.supplements.some(s=>s.analysis.schemaVersion==='draft-1');
 get('today-date').textContent=new Intl.DateTimeFormat(i18n.language,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
 const done=state.supplements.filter(s=>s.completed).length,total=state.supplements.length;
 get('today-progress').textContent=i18n.t('trackerProgress',{done,total});
 get('progress-count').textContent=done+' / '+total;get('progress-ring').setAttribute('aria-label',get('today-progress').textContent);
 get('progress-arc').setAttribute('stroke-dasharray',(total?100*done/total:0)+' 100');
 get('progress-message').textContent=i18n.t(!total?'appStartRoutine':done===total?'appDayComplete':done?'appOnTrack':'appReadyToday');
 get('progress-caption').textContent=i18n.t(done&&done===total?'appSeeTomorrow':'appKeepGoing');
 get('home-empty').hidden=state.supplements.length>0;
 const container=get('routine-groups');container.replaceChildren();
 const groups=[...state.groups];if(state.supplements.some(s=>!s.group_id))groups.push({id:null,name:i18n.t('appUnassigned'),description:i18n.t('appUnassignedHelp')});
 groups.forEach((group,index)=>{
  const rows=state.supplements.filter(item=>item.group_id===group.id);
  const section=element('section',{className:'group-block'}),head=element('div',{className:'group-heading'}),labels=element('div');
  const groupIcon=element('span',{className:'group-symbol'});groupIcon.append(icon(groupSymbol(group.name)));head.append(groupIcon);labels.append(heading(group.name));
  head.append(labels);if(group.id){const edit=button('',()=>openGroup(group),'group-edit');edit.setAttribute('aria-label',i18n.t('appEdit')+': '+group.name);edit.append(icon('chevron'));head.append(edit);}section.append(head);
  const list=element('table',{className:'supplement-table',attributes:{'aria-label':group.name}}),body=element('tbody');list.append(body);
  if(!rows.length){const emptyRow=element('tr');emptyRow.append(element('td',{text:i18n.t('appGroupEmpty'),className:'group-empty',attributes:{colspan:'2'}}));body.append(emptyRow);}
  for(const item of rows){
   const row=element('tr',{className:'supplement-row'+(item.completed?' is-done':'')});row.dataset.id=item.id;
   const open=button('',()=>router.navigate('/detail?id='+encodeURIComponent(item.id)),'supplement-open');
   const label=productLabel({name:item.name,manufacturer:item.analysis.manufacturer,variant:item.analysis.variant});
   open.append(element('strong',{text:label.name,className:'product-title'}));
   const summary=item.analysis.benefitTags?.length?item.analysis.benefitTags.slice(0,3).map(b=>b[i18n.language]||b.en).join(', '):compactText(item.analysis.benefitSummary||item.analysis.benefits?.[0]||item.analysis.whenToUse);
   const meta=element('span',{className:'summary'});if(label.manufacturer)meta.append(element('b',{text:label.manufacturer,className:'product-manufacturer'}));if(summary)meta.append(document.createTextNode((label.manufacturer?' · ':'')+summary));if(meta.textContent)open.append(meta);
   if(item.analysis.compatibility?.assessments?.some(a=>['potential_conflict','duplicate'].includes(a.status)))open.append(element('span',{text:i18n.t('appReviewCombination'),className:'research-badge review-combination'}));
   if(item.analysis.enrichment&&item.analysis.enrichment.status!=='complete')open.append(element('span',{text:i18n.t('appInfo_'+item.analysis.enrichment.status),className:'research-badge'}));

   const check=button('',async()=>{if(check.disabled)return;check.disabled=true;await mutate(()=>api.request('/v1/supplements/'+item.id+'/completion',{method:'PUT',body:{completed:!(state.day===localDay()&&item.completed),timezone:zone()}}));check.disabled=false;},'check-button');
   check.setAttribute('aria-label',i18n.t(item.completed?'appUntake':'appTake',{name:item.name}));check.setAttribute('aria-pressed',String(item.completed));
   check.append(element('span',{text:'✓',className:'check-ring',attributes:{'aria-hidden':'true'}}));const checkCell=element('td'),nameCell=element('td');checkCell.append(check);nameCell.append(open);row.append(checkCell,nameCell);body.append(row);
  }section.append(list);container.append(section);
 });
}
// Icons are decoration only; group assignment remains the server's decision.
function groupSymbol(name){return /evening|bed|sleep|vakar|mieg/i.test(name)?'moon':/morning|empty|ryt|tušč/i.test(name)?'sun':'meal';}
function openGroup(group){
 const form=get('group-form');resetGroup();
 if(group){form.elements.id.value=group.id;form.elements.name.value=group.name;form.elements.description.value=group.description||'';get('group-form-title').textContent=i18n.t('appEditGroup');get('cancel-group').hidden=false;}
 groupSheet.open();
}
get('new-group').addEventListener('click',()=>openGroup());
function renderGroups(){
 const list=get('group-list');list.replaceChildren();
 for(const [index,group] of state.groups.entries()){
  const card=element('div',{className:'surface'});card.append(element('p',{text:String(index+1).padStart(2,'0'),className:'eyebrow'}),heading(group.name));
  if(group.description)card.append(element('p',{text:group.description,className:'muted'}));
  const actions=element('div',{className:'group-actions'});
  actions.append(button(i18n.t('appEdit'),()=>openGroup(group)));
  actions.append(button(i18n.t('appDelete'),async()=>{
   if(!await confirmDialog(i18n.t('appDeleteGroupConfirm'),{i18n}))return;
   await mutate(()=>api.delete('/v1/groups/'+group.id));if(get('group-form').elements.id.value===group.id)resetGroup();
  },'danger-link'));card.append(actions);list.append(card);
 }
}
/** Keep the everyday detail view limited to dose, benefit, compatibility and
 * timing. Native disclosure contains the unchanged evidence and management tools.
 * Preserve expansion only for this product across polling/language/theme renders;
 * navigating to a different product or signing out resets it. Nothing is persisted.
 */
function renderDetail(){
 const id=new URLSearchParams(location.hash.split('?')[1]||'').get('id');
 const item=state.supplements.find(s=>s.id===id),container=get('supplement-detail');
 const previous=container.querySelector('details[data-supplement-id]'),expanded=previous?.dataset.supplementId===id&&previous.open;
 container.replaceChildren();
 if(!item){container.append(element('p',{text:i18n.t('appDetailMissing')}));return;}
 const analysis=item.analysis,card=element('div',{className:'surface detail-section'}),primary=element('div',{attributes:{id:'detail-primary'}}),extra=element('div',{className:'detail-extra-content',attributes:{id:'detail-extra-content'}});
 const pending=['queued','researching'].includes(analysis.enrichment?.status),draft=analysis.schemaVersion==='draft-1',fallback=analysis.doseFallback;
 const reference=fallback&&['established_adult_intake','usual_adult_supplement_range'].includes(fallback.basis)&&(!analysis.dosage?.directions||analysis.dosage?.dailyServingsMin==null);
 const section=(key,name)=>{const node=element('section',{className:'detail-tile',attributes:{'data-detail-section':name}});node.append(icon({dose:'clock',benefits:'leaf',composition:'dose'}[name]),heading(i18n.t(key),'h3'));primary.append(node);return node;};
 const prose=(target,value)=>{if(Array.isArray(value)){const list=element('ul');for(const text of value)list.append(element('li',{text}));target.append(list);}else target.append(element('p',{text:value}));};
 const assigned=state.groups.find(group=>group.id===item.group_id),badge=element('div',{className:'group-badge'});badge.append(icon(assigned?groupSymbol(assigned.name):'info'),element('span',{text:assigned?.name||i18n.t('appUnassigned')}));
 const productInfo=productLabel({name:item.name,manufacturer:analysis.manufacturer,variant:analysis.variant});
 card.append(element('h1',{text:productInfo.name,className:'detail-name',attributes:{id:'product-detail-title',tabindex:'-1','data-sheet-focus':'',autofocus:''}}));
 const subtitle=element('p',{className:'product-subtitle'});if(productInfo.manufacturer)subtitle.append(element('b',{text:productInfo.manufacturer}));if(productInfo.variant)subtitle.append(document.createTextNode((productInfo.manufacturer?' · ':'')+productInfo.variant));if(subtitle.textContent)card.append(subtitle);
 card.append(badge,primary);
 const basic=analysis.schemaVersion==='basic-1';
 if(!basic){
 // Same compact presentation for historical records; never trigger paid research
 // on read or expose obsolete routine-review prose as product information.
 const composition=section('appComposition','composition');
 if(!draft&&analysis.nutrients?.length){
  if(analysis.dosage?.servingSize)prose(composition,i18n.t('appServingSize')+': '+analysis.dosage.servingSize);
  const list=element('ul',{className:'composition-list'});
  for(const n of analysis.nutrients){
   const amount=n.amount==null?'':new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2}).format(n.amount)+' '+(n.unit==='ug'?'µg':n.unit==='other'?n.originalUnit||'':n.unit);
   const row=element('li');row.append(element('strong',{text:n.name+(amount?' · '+amount:'')}));
   if(n.amountNote)row.append(element('p',{text:n.amountNote,className:'detail-meta'}));list.append(row);
  }composition.append(list);
 }else composition.append(element('p',{className:'dose-unknown',children:[element('em',{text:i18n.t('appDoseUnknown')})]}));
 const dose=section('appUsage','dose');
 const unknownDose=()=>dose.append(element('p',{className:'dose-unknown',children:[element('em',{text:i18n.t('appDoseUnknown')})]}));
 if(draft)unknownDose();
 else if(reference){
  const number=value=>new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2}).format(value),unit=fallback.unit==='ug'?'µg':fallback.unit;
  const range=fallback.dailyAmountMin===fallback.dailyAmountMax?number(fallback.dailyAmountMin):number(fallback.dailyAmountMin)+'–'+number(fallback.dailyAmountMax);
  prose(dose,fallback.ingredient+': '+range+' '+unit);
  dose.append(element('p',{text:i18n.t('appDoseFallback')+' · '+i18n.t(fallback.basis==='established_adult_intake'?'appDoseIntakeReference':'appDoseSupplementRange'),className:'detail-meta'}));
  if(fallback.explanation)prose(dose,fallback.explanation);
  if(fallback.sourceUrl)extra.append(element('a',{text:i18n.t('appSources'),attributes:{href:fallback.sourceUrl,target:'_blank',rel:'noopener noreferrer'}}));
 }else if(analysis.dosage?.directions||analysis.labelDirections)prose(dose,analysis.dosage?.directions||analysis.labelDirections);
 else unknownDose();
 for(const value of new Set([analysis.whenToUse,analysis.howToUse].filter(Boolean)))prose(dose,value);
 prose(section('appBenefits','benefits'),analysis.benefits?.length?analysis.benefits:i18n.t(pending?'appInfo_'+analysis.enrichment.status:'appNoBenefits'));
 if(!draft&&analysis.sources?.length){
  extra.append(heading(i18n.t('appSources'),'h3'));const list=element('ul',{className:'source-list'});
  for(const source of analysis.sources){const row=element('li');row.append(element('a',{text:source.title,attributes:{href:source.url,target:'_blank',rel:'noopener noreferrer'}}));list.append(row);}extra.append(list);
 }
 }else{
  if(analysis.composition){const node=section('appComposition','composition');if(analysis.composition.ingredients.length)prose(node,analysis.composition.ingredients.map(n=>n.name+(n.labelAmount?' · '+n.labelAmount:'')));else prose(node,i18n.t('appDoseUnknown'));if(!analysis.composition.complete)node.append(element('p',{className:'detail-meta',text:i18n.t('appCompositionPartial')}));}
  prose(section('appBenefits','benefits'),analysis.benefitTags?.length?analysis.benefitTags.map(b=>b[i18n.language]||b.en):analysis.benefitSummary);
 }
 // Research is opt-in, never triggered by opening this sheet or adding a product.
 const refresh=button(i18n.t('appGetDetailedInfo'),async()=>{const session=current();refresh.disabled=true;writes++;try{const job=await api.post('/v1/supplements/'+item.id+'/research',{requestId:crypto.randomUUID(),language:i18n.language});if(session!==current())return;await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);await load();}catch(error){if(session===current()){failure(error);refresh.disabled=false;}}finally{writes--;}});
 refresh.disabled=pending;card.append(refresh);
 if(pending||basic&&analysis.enrichment?.status==='failed')card.append(element('p',{text:i18n.t('appInfo_'+analysis.enrichment.status),className:'research-badge',attributes:{role:'status'}}));
 const select=element('select',{attributes:{'aria-label':i18n.t('appMoveGroup')}});
 select.append(element('option',{text:i18n.t('appUnassigned'),attributes:{value:''}}));
 for(const group of state.groups)select.append(element('option',{text:group.name,attributes:{value:group.id}}));select.value=item.group_id||'';
 select.addEventListener('change',async()=>{select.disabled=true;await mutate(()=>api.patch('/v1/supplements/'+item.id,{groupId:select.value||null}));});
 extra.append(heading(i18n.t('appMoveGroup'),'h3'),select);
 extra.append(button(i18n.t('appDeleteSupplement'),async()=>{
  if(!await confirmDialog(i18n.t('appDeleteSupplementConfirm'),{i18n}))return;
  await mutate(async()=>{await api.delete('/v1/supplements/'+item.id);router.navigate('/');});
 },'danger-link'));
 const disclosure=element('details',{className:'detail-more',attributes:{'data-supplement-id':item.id}}),toggle=element('summary',{className:'secondary',attributes:{'aria-controls':extra.id}});
 const label=()=>{toggle.textContent=i18n.t(disclosure.open?'appLessInfo':'appMoreInfo');};
 disclosure.open=Boolean(expanded);label();disclosure.addEventListener('toggle',label);
 disclosure.append(toggle,extra);card.append(disclosure,element('p',{text:i18n.t('appDoctorConsultation'),className:'detail-meta doctor-note'}));container.append(card);
}
function renderAi(){
 get('clear-data-panel').hidden=!current();get('ai-settings').hidden=!current();if(!state.ai)return;
 status('ai-key-status',i18n.t(state.ai.configured?'appKeySaved':'appKeyMissing'));
 get('remove-key').disabled=!state.ai.configured;
 const select=get('ai-form').elements.model;
 const editing=dirty.find(item=>item.form===get('ai-form')).tracker.dirty;
 if(!editing){select.replaceChildren(...state.ai.models.map(model=>element('option',{text:model,attributes:{value:model}})));select.value=state.ai.model;}
}
function render(){
 get('diagnostics-link').hidden=!current();renderDiagnostics();
 i18n.render(document);get('app-version').textContent=i18n.t('version',{version:config.version});
 get('network-status').textContent=network.state.get().online?'':i18n.t('appOffline');
 get('app-nav').hidden=!current();get('route-dialog').querySelector('[data-sheet-close]').hidden=!current();get('route-title').textContent=router?.current==='/detail'?'':i18n.t(router?.current==='/diagnostics'?'appDiagnostics':'appAccount');renderHome();renderGroups();if(router?.current==='/detail')renderDetail();renderAi();
 get('group-form-title').textContent=i18n.t(get('group-form').elements.id.value?'appEditGroup':'appNewGroup');
 renderReport('home-analysis-results',latestReport);renderUploadQueue();
}
/** Only server-owned account metadata is displayed; model text always uses safe
 * text nodes. Show partial successes and skipped/failed identities individually. */
function renderReport(id,report){
 const container=get(id);container.replaceChildren();container.hidden=!report;if(id==='home-analysis-results')get('home-report').hidden=!report;if(!report)return;
 const items=report.items||[],added=items.filter(item=>item.status==='added');
 container.append(heading(report.running?i18n.t('appBatchProgress',{done:items.filter(item=>['complete','reused','failed'].includes(item.research)).length,total:report.total}):i18n.t('appBatchSummary',{added:added.length,total:items.length}),'h3'));
 const list=element('ul');
 for(const item of items){const row=element('li');
  if(item.status==='added'&&state.supplements.some(s=>s.id===item.id))row.append(button('✓ '+item.name,()=>{void addSheet.close({immediate:true});router.navigate('/detail?id='+encodeURIComponent(item.id));}));
  else row.textContent=item.name+(item.status==='failed'?' — '+i18n.message(item.error):'');if(item.research)row.append(element('span',{text:' · '+i18n.t('appInfo_'+item.research)+(item.error?' — '+i18n.message(item.error):''),className:'research-badge'}));list.append(row);
 }container.append(list);
 renderGroupReview(container,report);
 if(report.skipped?.length){container.append(heading(i18n.t('appPhotoSkipped'),'h3'));const skipped=element('ul');for(const item of report.skipped)skipped.append(element('li',{text:[item.name||item.location,item.reasonCode?i18n.message(item.reasonCode):item.reason].filter(Boolean).join(' — ')}));container.append(skipped);}
}
function renderGroupReview(container,report){
 const review=report.review;if(!review)return;
 const section=element('section',{className:'group-review'});section.append(heading(i18n.t('appGroupReview'),'h3'));
 if(review.status==='checking'||review.status==='failed'||review.status==='applied'){section.append(element('p',{text:i18n.t('appGroupReview_'+review.status),attributes:{role:'status'}}));}
 if(review.status==='ready'){
  section.append(element('p',{text:i18n.t(review.changes.length?'appGroupReviewProposal':'appGroupReviewNoChanges')}));
  const list=element('ul');for(const a of review.assessments){const row=element('li');row.append(element('strong',{text:a.name}));if(a.from!==a.to)row.append(element('p',{text:(review.groups.find(g=>g.id===a.from)?.name||i18n.t('appUnassigned'))+' → '+(review.groups.find(g=>g.id===a.to)?.name||i18n.t('appUnassigned'))}));row.append(element('p',{text:a.reason}));if(a.sourceUrl)row.append(element('a',{text:i18n.t('appSources'),attributes:{href:a.sourceUrl,target:'_blank',rel:'noopener noreferrer'}}));list.append(row);}section.append(list);
  if(review.changes.length){const apply=button(i18n.t('appApplyGroupReview'),async()=>{apply.disabled=true;await mutate(()=>api.post('/v1/supplements/jobs/'+report.jobId+'/apply-groups',{}));apply.disabled=false;},'primary');section.append(apply);}
 }
 container.append(section);
}
function resetGroup(){get('group-form').reset();clearDirty(get('group-form'));get('cancel-group').hidden=true;get('group-form-title').textContent=i18n.t('appNewGroup');}
get('cancel-group').addEventListener('click',()=>{resetGroup();void groupSheet.close();});
bindForm(get('group-form'),async(data,form)=>{
 await api.request('/v1/groups'+(data.id?'/'+data.id:''),{method:data.id?'PATCH':'POST',body:{name:data.name,description:data.description}});
 resetGroup();void groupSheet.close();await load();notify(i18n.t('appSaved'));
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
function renderPhotoPreviews(){
 const container=get('photo-previews');container.hidden=!photo.length;container.replaceChildren();
 const rest=element('div',{attributes:{id:'more-photo-previews'}});
 photo.forEach((src,index)=>{
  const tile=element('div',{className:'photo-thumb'}),img=element('img',{attributes:{alt:i18n.t('appLibraryPhoto')}});if(!index)img.id='photo-preview';img.src=src;
  const remove=button('',()=>{
   // Invalidate unfinished preparation so removed files cannot reappear later.
   imageGeneration++;photo.splice(index,1);requestId=crypto.randomUUID();get('analyze-form').elements.photo.value='';renderPhotoPreviews();status('analysis-status','');get('analyze-form').querySelector('button[type="submit"]').disabled=false;
   (get('photo-previews').querySelectorAll('.photo-remove')[Math.min(index,photo.length-1)]||get('analyze-form').elements.photo).focus();
  },'photo-remove');remove.setAttribute('aria-label',i18n.t('appRemoveOnePhoto',{number:index+1}));remove.append(icon('trash'));const enlarge=button('',()=>photoViewer.open(src,{alt:i18n.t('appEnlargePhoto',{number:index+1})}),'photo-zoom');enlarge.setAttribute('aria-label',i18n.t('appEnlargePhoto',{number:index+1}));enlarge.append(icon('expand'));tile.append(img,remove,enlarge);(index?rest:container).append(tile);
 });container.append(rest);get('remove-photo').hidden=!photo.length;
}
function clearPhoto(){photoViewer.close();imageGeneration++;photo=[];renderPhotoPreviews();get('analyze-form').elements.photo.value='';get('analyze-form').querySelector('button[type="submit"]').disabled=false;}

function resetAddDraft(){get('analyze-form').reset();clearPhoto();clearDirty(get('analyze-form'));requestId=crypto.randomUUID();}
function closeAdd(force=false){
 photoViewer.close(); void addSheet.close({immediate:force});if(!force)return;
 resetAddDraft();modalJobId=null;addedId=null;get('view-added').hidden=true;get('analysis-status').textContent='';get('analyze-form').hidden=false;get('analyze-form').querySelector('fieldset').disabled=false;
}
get('add-supplement').addEventListener('click',()=>{
 if(!state.ai?.configured){notify(i18n.t('AI_KEY_REQUIRED'),true);router.navigate('/account');return;}
 if(!state.groups.length){notify(i18n.t('CREATE_GROUP_FIRST'),true);router.navigate('/groups');return;}
 requestId ||= crypto.randomUUID();renderUploadQueue();addSheet.open();
 // Refresh history even when no active polling survived a previous connection loss.
 void load();
});
get('close-add').addEventListener('click',()=>closeAdd());

get('remove-photo').addEventListener('click',()=>{clearPhoto();requestId=crypto.randomUUID();});
get('analyze-form').elements.name.addEventListener('input',()=>{requestId=crypto.randomUUID();});
for(const name of ['photo'])get('analyze-form').elements[name].addEventListener('change',async event=>{
 const selected=[...event.target.files];if(!selected.length)return;
 if(photo.length+selected.length>5){status('analysis-status',i18n.t('appPhotoLimit'),true);event.target.value='';return;}
 const version=++imageGeneration;get('analyze-form').querySelector('button[type="submit"]').disabled=true;
 status('analysis-status',i18n.t('appPreparingPhoto'));
 try{
  const prepared=[];
  // Bound each compressed photo so five fit the existing server/proxy limit.
  for(const file of selected){let data,lastError;for(const maxSide of [1800,1400,1000,700]){try{data=await prepareImage(file,{maxSide,maxBytes:600000});break;}catch(error){lastError=error;}}if(!data)throw lastError;if(version!==imageGeneration)return;prepared.push(data);}
  if(version!==imageGeneration)return;photo.push(...prepared);requestId=crypto.randomUUID();renderPhotoPreviews();event.target.value='';status('analysis-status','');
 }
 catch(error){if(version===imageGeneration){clearPhoto();status('analysis-status',err(error),true);}}
 finally{if(version===imageGeneration)get('analyze-form').querySelector('button[type="submit"]').disabled=false;}
});
/** Account-scoped process history. Keep the composer independent of server jobs:
 * polling must never clear a newly selected photo or typed next supplement. No
 * private history/photo enters browser persistence; API history restores reloads. */
function renderUploadQueue(){
 renderDiagnostics();
 const container=get('analysis-results'),previous=new Map([...container.querySelectorAll('details[data-job-id]')].map(node=>[node.dataset.jobId,node.open]));
 container.replaceChildren();get('upload-queue').hidden=!jobHistory.length;
 const running=jobHistory.filter(job=>job.status==='running');get('upload-queue-count').textContent=i18n.t('appUploadQueueCount',{count:running.length});
 const ordered=[...jobHistory].sort((a,b)=>(a.status==='running'?0:1)-(b.status==='running'?0:1)||(a.status==='running'?Date.parse(a.created_at||0)-Date.parse(b.created_at||0):Date.parse(b.finished_at||b.created_at||0)-Date.parse(a.finished_at||a.created_at||0)));
 for(const job of ordered){
  const card=element('details',{className:'upload-job',attributes:{'data-job-id':job.id,'data-phase':job.phase||'recognizing'}});card.open=previous.has(job.id)?previous.get(job.id):job.status==='running'||job.id===modalJobId;
  const submission=job.result?.submission,title=submission?.name||i18n.t(submission?.kind==='photo'?'appUploadPhoto':'appUploadSupplement');
  const failed=job.status==='failed',issues=job.result?.items?.some(item=>item.research==='failed'||item.status==='failed');
  const phase=job.phase||'recognizing',label=failed?'appUploadFailed':job.status==='complete'?(issues?'appUploadDoneIssues':'appUploadDone'):job.result?.monitor?.pipeline==='grok-jev'&&phase==='enriching'?'appJevClassifying':'appUpload_'+phase;
  const summary=element('summary'),labels=element('div',{className:'upload-job-labels'});labels.append(element('strong',{text:title}),element('span',{text:i18n.t(job.result?.review?.status==='checking'?'appGroupReview_checking':label),className:'upload-job-phase'}));
  if(job.created_at){const date=new Date(job.created_at);if(Number.isFinite(date.getTime()))labels.append(element('time',{text:new Intl.DateTimeFormat(i18n.language,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date),attributes:{datetime:date.toISOString()},className:'upload-job-time'}));}
  summary.append(element('span',{text:failed?'!':job.status==='complete'?'✓':'…',className:'upload-job-icon',attributes:{'aria-hidden':'true'}}),labels);card.append(summary);
  const step=job.status==='complete'?3:failed?({queued:0,recognizing:1,enriching:2}[job.result?.failedPhase]??(job.result?.items?.length?2:1)):({queued:0,recognizing:1,enriching:2,done:3}[phase]??1),steps=element('ol',{className:'upload-steps'});
  ['appUpload_queued','appUpload_recognizing',job.result?.review?'appGroupReview':job.result?.monitor?.pipeline==='grok-jev'?'appJevClassifying':'appUpload_enriching','appUploadDone'].forEach((key,index)=>{const row=element('li',{text:i18n.t(key),className:index<step||job.status==='complete'?'is-complete':index===step?'is-current':''});if(index===step&&job.status==='running')row.setAttribute('aria-current','step');if(index===step&&failed)row.dataset.error='true';steps.append(row);});card.append(steps);
  if(job.total_count>0){const progress=element('progress',{attributes:{max:String(job.total_count),value:String(job.processed_count||0),'aria-label':i18n.t('appUpload_enriching')}});card.append(progress,element('p',{text:job.result?.review?i18n.t('appGroupReview'):i18n.t('appUploadDetailsProgress',{done:job.processed_count||0,total:job.total_count}),className:'form-help'}));}
  if(failed)card.append(element('p',{text:err(new Error(job.error_code||'REQUEST_FAILED')),attributes:{'data-error':'true'}}));
  if(job.result?.items?.length||job.result?.skipped?.length){const result=element('div',{attributes:{id:'upload-result-'+job.id},className:'upload-job-result'});card.append(result);container.append(card);renderReport(result.id,{...job.result,jobId:job.id,running:job.status==='running',total:job.total_count});}else container.append(card);
 }
}
/** One loop observes every job; closing the upload dialog never aborts it. */
async function observeJobs(data,session,refresh=false){
 const epoch=collectionEpoch;
 if(session!==current())return;
 const active=data.active||((data.job?.status==='running')?[data.job]:[]),signature=JSON.stringify([data.job,active,data.recent]);
 if(refresh&&signature!==jobSignature)await load(false);if(session!==current()||epoch!==collectionEpoch)return;jobSignature=signature;activeJobs=active;
 const history=new Map(jobHistory.map(job=>[job.id,job]));for(const job of [...(data.recent||[]),...(data.job?[data.job]:[]),...active])history.set(job.id,job);
 jobHistory=[...history.values()].sort((a,b)=>Date.parse(b.finished_at||b.created_at||0)-Date.parse(a.finished_at||a.created_at||0)).filter((job,index)=>job.status==='running'||index<20);
 const recognizing=active.some(job=>!job.phase||job.phase==='recognizing'),queued=active.some(job=>job.phase==='queued');
 const progress=active.reduce((sum,job)=>({done:sum.done+(job.processed_count||0),total:sum.total+(job.total_count||0)}),{done:0,total:0});
 status('home-status',active.some(j=>j.result?.review?.status==='checking')?i18n.t('appGroupReview_checking'):recognizing?i18n.t('appRecognizing'):queued?i18n.t('appUpload_queued'):active.length?i18n.t(active.some(j=>j.result?.monitor?.pipeline==='grok-jev')?'appJevClassifying':'appEnrichingProgress',progress):data.job?.status==='failed'?err(new Error(data.job.error_code||'REQUEST_FAILED')):'',data.job?.status==='failed');
 if(data.job?.result?.items?.length){latestReport={...data.job.result,jobId:data.job.id,running:data.job.status==='running',total:data.job.total_count};renderReport('home-analysis-results',latestReport);}
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
 try{while(session===current()&&activeJobs.length){await wait();const data=await api.get('/v1/supplements/jobs',{signal});if(signal.aborted)return;await observeJobs(data,session,true);}}
 catch(error){if(session===current()&&!signal.aborted)status('home-status',err(error),true);}
 finally{if(watchedJob===marker)watchedJob=null;}
}
get('clear-supplements').addEventListener('click',async()=>{
 if(writes||!current())return;
 if(!await confirmDialog(i18n.t('appClearSupplementsConfirm'),{i18n}))return;
 const session=current(),control=get('clear-supplements');control.disabled=true;writes++;
 try{await api.delete('/v1/supplements',{body:{confirm:true}});if(session!==current())return;resetSession();await load();notify(i18n.t('appClearSupplementsDone'));}
 catch(error){if(session===current())failure(error);}finally{writes--;control.disabled=false;}
});
get('analyze-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!current())return;
 const form=get('analyze-form'),name=form.elements.name.value.trim();
 if(!name&&!photo.length){status('analysis-status',i18n.t('NAME_OR_PHOTO_REQUIRED'),true);return;}
 const session=current();sending=true;writes++;form.querySelector('fieldset').disabled=true;
 status('analysis-status',i18n.t('appUploading'));
 try{
  const job=await api.post('/v1/supplements/jobs',{requestId:requestId||crypto.randomUUID(),name,images:photo,language:i18n.language});
  if(session!==current())return;resetAddDraft();modalJobId=job.id;status('analysis-status',i18n.t('appUploadAccepted'));await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);
 }catch(error){if(session===current()){status('analysis-status',err(error),true);form.querySelector('fieldset').disabled=false;}}
 finally{sending=false;writes--;form.querySelector('fieldset').disabled=false;get('close-add').disabled=false;}
});
get('view-added').addEventListener('click',()=>{const id=addedId;closeAdd();if(id)router.navigate('/detail?id='+encodeURIComponent(id));});
settings.state.subscribe(value=>{
 theme.set(value.theme);i18n.setLanguage(value.language);get('settings-form').elements.language.value=value.language;get('settings-form').elements.theme.value=value.theme;render();
},true);
network.state.subscribe(()=>render());
// Home/day are tab pages. Account/details are routed native sheets, so Back,
// close and swipe reveal the same underlying tab and its retained scroll offset.
function showRoute(path){
 if(path!=='/account'&&!current()){location.hash='/account';return;}
 const sheet=['/account','/detail','/diagnostics'].includes(path);
 if(!sheet)baseRoute=path;
 for(const section of document.querySelectorAll('main [data-screen]'))section.hidden=section.dataset.screen!==baseRoute;
 if(sheet)for(const section of get('route-dialog').querySelectorAll('[data-screen]'))section.hidden=section.dataset.screen!==path;
 for(const link of document.querySelectorAll('[data-route]')){if(link.dataset.route===baseRoute)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(sheet){get('preferences').hidden=path!=='/account';get('route-title').textContent=path==='/account'?i18n.t('appAccount'):path==='/diagnostics'?i18n.t('appDiagnostics'):'';get('route-dialog').classList.toggle('product-sheet',path==='/detail');get('route-dialog').setAttribute('aria-labelledby',path==='/detail'?'product-detail-title':'route-title');}
 get('route-dialog').querySelector('[data-sheet-close]').hidden=!current();
 if(path==='/detail')renderDetail();if(path==='/diagnostics')renderDiagnostics();
 if(sheet)routeSheet.open();else {void routeSheet.close().then(()=>{if(!get('route-dialog').open)get('supplement-detail').replaceChildren();});if(!document.querySelector('main').dataset.tab||document.querySelector('main').dataset.tab!==path)document.querySelector('main').scrollTop=0;document.querySelector('main').dataset.tab=path;}
}
router=createRouter({routes:Object.fromEntries(['/', '/groups','/account','/detail','/diagnostics'].map(path=>[path,()=>showRoute(path)])),onNotFound:()=>{location.hash=current()?'/':'/account';}});
// The generic router ignores query-only changes; details must follow the item ID.
window.addEventListener('hashchange',()=>{if(router.current==='/detail')renderDetail();});
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
await setupPwa({canReload:()=>!photo.length&&!sending&&writes===0&&!document.querySelector('dialog[open], form[aria-busy="true"]')&&!dirty.some(({tracker})=>tracker.dirty)&&![...document.querySelectorAll('input[type="password"]')].some(node=>node.value),
 onUpdate:({apply})=>{applyUpdate=apply;get('update-card').hidden=false;},onError:()=>{}});
get('update-button').addEventListener('click',()=>{try{applyUpdate?.();}catch(error){failure(error);}});

/** Read-only owner history, refreshed by the existing polling loop. No extra API
 * requests per clock tick; all provider/model/error text is rendered as text. */
function renderDiagnostics(){
 const root=get('ai-dashboard');if(!root)return;root.replaceChildren();if(!current())return;
 const ms=value=>Number.isFinite(value)?(value/1000).toLocaleString(i18n.language,{maximumFractionDigits:2})+' s':'—';
 root.append(element('p',{className:'muted',text:i18n.t('appDiagnosticsHelp')}));
 if(!jobHistory.length){root.append(element('p',{text:i18n.t('appDiagnosticsEmpty')}));return;}
 for(const job of jobHistory){
  const m=job.result?.monitor||{},t=job.result?.timings||m,card=element('article',{className:'surface diagnostics-card',attributes:{'data-diagnostic-job-id':job.id}});
  const title=job.result?.submission?.name||i18n.t('appUploadPhoto');card.append(heading(title,'h2'));
  const label=job.status==='running'?i18n.t(m.pipeline==='grok-jev'&&job.phase==='enriching'?'appJevClassifying':'appUpload_'+(job.phase||'recognizing')):i18n.t(job.status==='complete'?'appUploadDone':'appUploadFailed');
  card.append(element('p',{className:'research-badge',text:label}));
  if(job.created_at){const date=new Date(job.created_at);if(Number.isFinite(date.getTime()))card.append(element('time',{className:'muted',text:date.toLocaleString(i18n.language)}));}
  const list=element('dl',{className:'diagnostics-grid'});
  const row=(key,value)=>{list.append(element('dt',{text:i18n.t(key)}),element('dd',{text:String(value??'—')}));};
  row('appDiagPipeline',m.pipeline||job.result?.pipeline||job.result?.recognitionModel||'—');
  row('appDiagGrok',ms(t.grokMs));row('appDiagJev',ms(t.jevMs));
  row('appDiagTotal',ms(t.totalMs));
  const from=Date.parse(job.created_at),to=job.status==='running'?Date.now():Date.parse(job.finished_at);
  row('appDiagElapsed',ms(Number.isFinite(from)&&Number.isFinite(to)?Math.max(0,to-from):undefined));
  row('appDiagModels',[m.grokModel,m.jevModel].filter(Boolean).join(' / ')||'—');
  row('appDiagProducts',m.recognized??job.total_count);
  row('appDiagCalls',m.grokCalls==null?'—':`${m.grokCalls} / ${m.jevCompleted||0} / ${m.jevBatches||0}`);
  row('appDiagQuestions',m.questions);row('appDiagTokens',m.jevInputTokens);
  row('appDiagComposition',m.completeComposition==null?'—':`${m.completeComposition} / ${m.partialComposition} / ${m.unknownComposition}`);
  card.append(list);
  if(job.error_code)card.append(element('p',{className:'status-error',text:err(new Error(job.error_code))+' · '+job.error_code}));
  root.append(card);
 }
}
setInterval(()=>{if(current()&&router?.current==='/diagnostics'&&document.visibilityState==='visible')renderDiagnostics();},1000);
