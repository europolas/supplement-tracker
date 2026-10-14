/** Cloud tracker composition. Reuses toolkit auth/forms/viewport/worker and never
 * stores API keys, photos or account records in browser persistence. Session-scoped
 * in-memory state is cleared on logout, including open dialogs and pending requests.
 */
import {createConfig,createStorage,createSettings,createTheme,createI18n,createRouter,createToast,
 bindForm,trackDirty,setupViewport,setupGestures,setupPwa,watchNetwork,createAuth,setupAccount,
 element,confirmDialog,prepareImage,localDay} from './modules/index.js';
const config=createConfig(await(await fetch('./app.config.json')).json());
const get=id=>document.getElementById(id),storage=createStorage(config.id);
const settings=createSettings(storage,{language:config.language,theme:config.theme},{language:v=>['en','lt'].includes(v),theme:v=>['light','dark','system'].includes(v)});
const theme=createTheme({storage}),i18n=createI18n(undefined,settings.state.get().language),toast=createToast(get('toast')),network=watchNetwork();
theme.set(settings.state.get().theme);
setupViewport();setupGestures(config.interaction);
// This is a trusted bundled template; user and AI content always use textContent.
get('account-forms').append(document.createRange().createContextualFragment(await(await fetch('./account.html')).text()));
const auth=createAuth({id:config.id,baseUrl:config.apiUrl,timeout:100000});
setupAccount(config,{i18n,auth});
const api=auth.api;
let state={groups:[],supplements:[],ai:null,day:localDay()},owner=null,generation=0,writes=0,router;
let photo=null,imageGeneration=0,sending=false,requestId=null,addedId=null,analysisAbort,midnightTimer,watchedJob=null;
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
 generation++;watchedJob=null;sending=false;state={groups:[],supplements:[],ai:null,day:localDay()};analysisAbort?.abort();closeAdd(true);
 for(const {form} of dirty){if(form.id==='settings-form')continue;form.reset();clearDirty(form);}
 get('supplement-detail').replaceChildren();get('ai-form').elements.key.value='';
 get('app-error').hidden=true;get('home-status').textContent='';
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
async function load(){
 const session=current();if(!session)return;
 const version=++generation;status('home-status',i18n.t('appLoading'));
 try{
  const result=await api.get('/v1/dashboard?timezone='+encodeURIComponent(zone()));
  if(session!==current()||version!==generation)return;
  state=result;get('app-error').hidden=true;status('home-status','');render();
  const latest=await api.get('/v1/supplements/jobs');if(session===current()&&latest.job?.status==='running'&&!watchedJob)watchJob(latest.job,session);
  else if(session===current()&&latest.job?.status==='failed')status('home-status',err(new Error(latest.job.error_code||'REQUEST_FAILED')),true);
 }catch(error){if(session===current()&&version===generation){status('home-status','');get('app-error').hidden=false;get('app-error').textContent=err(error);}}
}
function renderHome(){
 get('today-date').textContent=new Intl.DateTimeFormat(i18n.language,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
 get('today-progress').textContent=i18n.t('trackerProgress',{done:state.supplements.filter(s=>s.completed).length,total:state.supplements.length});
 get('home-empty').hidden=state.supplements.length>0;
 const container=get('routine-groups');container.replaceChildren();
 const groups=[...state.groups];if(state.supplements.some(s=>!s.group_id))groups.push({id:null,name:i18n.t('appUnassigned'),description:i18n.t('appUnassignedHelp')});
 groups.forEach((group,index)=>{
  const rows=state.supplements.filter(item=>item.group_id===group.id);
  const section=element('section',{className:'group-block'}),head=element('div',{className:'group-heading'}),labels=element('div');
  head.append(element('span',{text:String(index+1).padStart(2,'0'),className:'group-number'}));labels.append(heading(group.name));
  const benefit=group.description||[...new Set(rows.flatMap(item=>item.analysis.benefits))].slice(0,3).join(' · ')||i18n.t('appNoGroupBenefits');
  labels.append(element('p',{text:benefit,className:'group-benefit'}));head.append(labels);section.append(head);
  const list=element('table',{className:'supplement-table'}),thead=element('thead'),headRow=element('tr');
  headRow.append(element('th',{text:'✓',attributes:{scope:'col','aria-label':i18n.t('appTaken')}}),element('th',{text:i18n.t('appSupplement'),attributes:{scope:'col'}}),element('th',{text:i18n.t('appBenefit'),attributes:{scope:'col'}}));thead.append(headRow);list.append(thead);const body=element('tbody');list.append(body);
  if(!rows.length){const emptyRow=element('tr');emptyRow.append(element('td',{text:i18n.t('appGroupEmpty'),className:'group-empty',attributes:{colspan:'3'}}));body.append(emptyRow);}
  for(const item of rows){
   const row=element('tr',{className:'supplement-row'+(item.completed?' is-done':'')});row.dataset.id=item.id;
   const open=button('',()=>router.navigate('/detail?id='+encodeURIComponent(item.id)),'supplement-open');
   open.append(element('strong',{text:item.name}));
   const summary=item.analysis.benefits[0]||item.analysis.whenToUse;

   const check=button('',async()=>{if(check.disabled)return;check.disabled=true;await mutate(()=>api.request('/v1/supplements/'+item.id+'/completion',{method:'PUT',body:{completed:!(state.day===localDay()&&item.completed),timezone:zone()}}));check.disabled=false;},'check-button');
   check.setAttribute('aria-label',i18n.t(item.completed?'appUntake':'appTake',{name:item.name}));check.setAttribute('aria-pressed',String(item.completed));
   check.append(element('span',{text:'✓',className:'check-ring',attributes:{'aria-hidden':'true'}}));const checkCell=element('td'),nameCell=element('td'),benefitCell=element('td',{text:summary,className:'benefit-cell'});checkCell.append(check);nameCell.append(open);row.append(checkCell,nameCell,benefitCell);body.append(row);
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
 if(analysis.dosage){
  const d=analysis.dosage;card.append(heading(i18n.t('appManufacturerDose'),'h3'),element('p',{text:d.directions||i18n.t('appNoLabel')}));
  if(d.servingSize)card.append(element('p',{text:i18n.t('appServingSize')+': '+d.servingSize,className:'detail-meta'}));
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
 }
 card.append(element('p',{text:analysis.evidenceNote,className:'detail-meta'}),element('p',{text:i18n.t('appAiNote'),className:'detail-meta'}));
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
function clearPhoto(){imageGeneration++;photo=null;get('photo-preview').removeAttribute('src');get('photo-preview').hidden=true;get('remove-photo').hidden=true;get('analyze-form').elements.photo.value='';get('analyze-form').querySelector('button[type="submit"]').disabled=false;}
function closeAdd(force=false){
 if(sending&&!force){get('add-dialog').close();return;}analysisAbort?.abort();get('add-dialog').close();get('analyze-form').reset();clearPhoto();requestId=null;addedId=null;
 get('view-added').hidden=true;get('analysis-status').textContent='';get('analyze-form').querySelector('fieldset').disabled=false;
}
get('add-supplement').addEventListener('click',()=>{
 if(sending){notify(i18n.t('AI_BUSY'));return;}
 if(!state.ai?.configured){notify(i18n.t('AI_KEY_REQUIRED'),true);router.navigate('/account');return;}
 if(!state.groups.length){notify(i18n.t('CREATE_GROUP_FIRST'),true);router.navigate('/groups');return;}
 closeAdd();requestId=crypto.randomUUID();get('add-dialog').showModal();
});
get('close-add').addEventListener('click',()=>closeAdd());
get('add-dialog').addEventListener('cancel',event=>{event.preventDefault();closeAdd();});
get('remove-photo').addEventListener('click',()=>{clearPhoto();requestId=crypto.randomUUID();});
get('analyze-form').elements.name.addEventListener('input',()=>{requestId=crypto.randomUUID();});
get('analyze-form').elements.photo.addEventListener('change',async event=>{
 const selected=event.target.files[0];if(!selected)return;
 const version=++imageGeneration;get('analyze-form').querySelector('button[type="submit"]').disabled=true;
 status('analysis-status',i18n.t('appPreparingPhoto'));
 try{const data=await prepareImage(selected);if(version!==imageGeneration)return;photo=data;requestId=crypto.randomUUID();get('photo-preview').src=data;get('photo-preview').hidden=false;get('remove-photo').hidden=false;status('analysis-status','');}
 catch(error){if(version===imageGeneration){clearPhoto();status('analysis-status',err(error),true);}}
 finally{if(version===imageGeneration)get('analyze-form').querySelector('button[type="submit"]').disabled=false;}
});
/** Jobs continue on the server if iOS suspends this page. Only public job metadata
 * is polled; no photo/key is persisted. Reload/login discovers the active own job. */
async function watchJob(job,session){
 if(watchedJob===job.id)return;watchedJob=job.id;sending=true;analysisAbort=new AbortController();const signal=analysisAbort.signal;
 const wait=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1800);function abort(){clearTimeout(timer);reject(new Error('AI_JOB_INTERRUPTED'));}signal.addEventListener('abort',abort,{once:true});});
 try{
  while(job.status==='running'){
   if(session!==current())return;status('analysis-status',i18n.t('appSending'));status('home-status',i18n.t('appSending'));
   await wait();job=await api.get('/v1/supplements/jobs/'+job.id,{signal});
  }
  if(session!==current())return;
  if(job.status==='failed')throw new Error(job.error_code||'REQUEST_FAILED');
  addedId=job.supplement_id;clearDirty(get('analyze-form'));clearPhoto();await load();status('analysis-status',i18n.t('appSent'));status('home-status','');get('view-added').hidden=false;notify(i18n.t('appSent'));
 }catch(error){if(session===current()){status('analysis-status',err(error),true);status('home-status',err(error),true);get('analyze-form').querySelector('fieldset').disabled=false;requestId=crypto.randomUUID();}}
 finally{if(watchedJob===job.id){watchedJob=null;sending=false;}get('close-add').disabled=false;}
}
get('analyze-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!current())return;
 const form=get('analyze-form'),name=form.elements.name.value.trim();
 if(!name&&!photo){status('analysis-status',i18n.t('NAME_OR_PHOTO_REQUIRED'),true);return;}
 const session=current();sending=true;writes++;form.querySelector('fieldset').disabled=true;
 status('analysis-status',i18n.t('appSending'));
 try{
  const job=await api.post('/v1/supplements/jobs',{requestId:requestId||crypto.randomUUID(),name,image:photo,language:i18n.language});
  if(session!==current())return;clearPhoto();await watchJob(job,session);
 }catch(error){if(session===current()){status('analysis-status',err(error),true);form.querySelector('fieldset').disabled=false;}}
 finally{if(!watchedJob)sending=false;writes--;get('close-add').disabled=false;}
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
