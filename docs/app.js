import {createWellbeingJournal} from './wellbeing-journal.js';
import {createIntakeEditor} from './intake-editor.js';
import appEn from './translations/en.js';
import appLt from './translations/lt.js';
/** Cloud tracker composition. Reuses toolkit auth/forms/viewport/worker and never
 * stores API keys, photos or account records in browser persistence. Session-scoped
 * in-memory state is cleared on logout, including open dialogs and pending requests.
 */
import {createConfig,createStorage,createSettings,createTheme,createI18n,dictionaries,createRouter,createToast,
 bindForm,trackDirty,setupViewport,setupGestures,setupPwa,watchNetwork,createAuth,setupAccount,
 element,confirmDialog as nativeConfirmDialog,prepareImage,localDay,compactText,createBottomSheet,productLabel,createImageViewer} from './modules/index.js';
import {setupPasswordVisibility} from './modules/password-visibility.js';
import {createUsageCalendar} from './usage-calendar.js';
import {createRoutineConclusion} from './routine-conclusion.js';
import {createRoutineWizard} from './routine-wizard.js';
import {parseCustomIcon} from './custom-icon.js';
// Local presentation icons use fixed SVG paths, never server/model markup.
const iconPaths={
 target:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
 back:'m15 5-7 7 7 7',
 pause:'M9 5v14 M15 5v14',
 'pause-circle':'M9 8v8 M15 8v8 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 coffee:'M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z M16 8h2a3 3 0 0 1 0 6h-2 M3 21h17 M7 3v2 M11 2v3',
 bowl:'M3 11h18a9 9 0 0 1-18 0Z M6 21h12 M7 6l2-3 M12 7l2-4 M17 6l2-3',
 sliders:'M3 6h18 M3 12h18 M3 18h18 M7 4v4 M16 10v4 M10 16v4',
 pencil:'m14 4 6 6 M3 21l5-1 13-13-5-5L3 15Z',
 ellipsis:'M5 12h.01 M12 12h.01 M19 12h.01',
 grip:'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',
 globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c-6 5-6 15 0 20 M12 2c6 5 6 15 0 20',
 gear:'m9 3 1-2h4l1 2 3 2 2 1 2 4-2 2v3l1 2-3 3-2-1h-3l-2 2-4-2v-2l-2-3-2-1 1-4 2-1 2-3Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 cpu:'M6 6h12v12H6Z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
 key:'M14 10a5 5 0 1 0-4 4l-7 7H1v-3l2-2h2v-2l3-3 M15 6h.01',
 database:'M3 5c0-4 18-4 18 0s-18 4-18 0v14c0 4 18 4 18 0V5 M3 10c0 4 18 4 18 0 M3 15c0 4 18 4 18 0',
 lock:'M5 10h14v12H5Z M8 10V6a4 4 0 0 1 8 0v4',
 wrench:'m15 3-4 4 3 3 4-4c3 7-3 11-8 9l-7 7-3-3 7-7C5 7 9 1 15 3Z',
 chart:'M3 12h3v9H3Z M10 3h3v18h-3Z M17 8h3v13h-3Z',
 users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3c0-5 14-5 14 0v3 M16 3c5 0 5 8 0 8 M18 14c5 0 5 3 5 7',

 training:'M7 21H5a4 4 0 1 1 3.6-5.7c1.4-2.3 3.6-3.1 6.4-2.3l-1.5-5-2 .5-2-2 1-3L13.5 2c1.5.5 2.5 2 3.5 4l4 9c1.3 3.5-1 6-5 6H7Z M8.6 15.3 10 17 M10.5 4l3 1-.5 3 M15 13l1 2',
 sleep:'M2.5 2.5 12 3.7l-.3 2.1-6.2 5.5 5.5.7-.3 2.5-9.5-1.2.3-2.1 6.2-5.5-5.5-.7Z M13 10.5l7.5.9-.2 1.7-4.8 4.2 4.3.5-.2 2-7.5-.9.2-1.7 4.8-4.2-4.3-.5Z M19 18.5l4 .5-.1 1-2.6 2.1 2.3.3-.1 1.4-4-.5.1-1 2.6-2.1-2.3-.3Z',
 groups:'M5 3h14v18l-3.5-3-3.5 3-3.5-3L5 21Z M9 8h6 M10 12h4',
 account:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M4 18c2-5 14-5 16 0',
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
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 bolt:'m13 2-9 12h7l-1 8 10-13h-7Z',
 clock:'M12 6v6l4 3 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 dose:'M9 3h6v3H9Z M7 6h10l2 4v11H5V10Z M9 13h6 M12 10v6',
 check:'m5 12 4 4 10-10',chevron:'m9 5 7 7-7 7'
};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':name==='sleep'?'1.1':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:name==='add-circle'?'icon add-circle-icon':'icon'}))svg.setAttribute(k,v);if(name==='add-circle'){const circle=document.createElementNS(svg.namespaceURI,'circle');for(const[k,v]of Object.entries({cx:12,cy:12,r:12}))circle.setAttribute(k,v);svg.append(circle);}const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',name==='add-circle'?'M12 7v10 M7 12h10':iconPaths[name]||iconPaths.leaf);svg.append(path);return svg;}
for(const node of document.querySelectorAll('[data-icon]'))node.append(icon(node.dataset.icon));
// Compose the toolkit confirmation with the same app header. The existing Cancel
// action owns dismissal/cleanup, so X also resolves false and preserves drafts.
function confirmDialog(message,options){
 const result=nativeConfirmDialog(message,{...options,presentation:'sheet'}),dialog=[...document.querySelectorAll('dialog[aria-labelledby^="dialog-"]')].at(-1);
 const title=dialog.querySelector('h2'),cancel=dialog.querySelector('.kit-actions button:not(.primary)'),header=element('div',{className:'sheet-header',attributes:{'data-sheet-drag':''}}),close=element('button',{className:'icon-button',attributes:{type:'button','aria-label':i18n.t('appClose')}});
 dialog.classList.remove('kit-sheet');const actions=dialog.querySelector('.kit-actions');dialog.append(...actions.children);actions.remove();dialog.querySelector('.kit-sheet-header').remove();dialog.querySelector('[data-sheet-handle]').remove();
 close.append(icon('close'));close.addEventListener('click',()=>cancel.click());header.append(title,close);dialog.prepend(element('div',{attributes:{'data-sheet-handle':'','aria-hidden':'true'}}),header);title.focus({preventScroll:true});return result;
}
const config=createConfig(await(await fetch('./app.config.json')).json());
const get=id=>document.getElementById(id),storage=createStorage(config.id);
const settings=createSettings(storage,{language:config.language,theme:config.theme},{language:v=>['en','lt'].includes(v),theme:v=>['light','dark','system'].includes(v)});
const theme=createTheme({storage}),i18n=createI18n({en:{...dictionaries.en,...appEn},lt:{...dictionaries.lt,...appLt}},settings.state.get().language),toast=createToast(get('toast')),network=watchNetwork();
theme.set(settings.state.get().theme);
setupViewport();setupGestures(config.interaction);
// This is a trusted bundled template; user and AI content always use textContent.
get('account-forms').append(document.createRange().createContextualFragment(await(await fetch('./account.html')).text()));
for(const node of get('account-forms').querySelectorAll('[data-icon]'))node.append(icon(node.dataset.icon));
for(const node of document.querySelectorAll('[data-security-form]'))get('security-forms').append(node);
get('admin-tools').append(get('admin-panel'));get('logout-slot').append(get('logout-button'));
const auth=createAuth({id:config.id,baseUrl:config.apiUrl,persistence:'persistent',timeout:100000});
// Hold the launch screen until saved-session validation and public updates finish.
// Never persist private dashboard/profile data just to avoid a login flash.
let starting=true,pwaReady=false,pwa;
let restoringSession=Boolean(auth.getToken())&&!new URLSearchParams(location.hash.slice(1)).has('reset'),restorePending;
const restoreAuth=auth.restore;
auth.restore=()=>restorePending||=(async()=>{try{return await restoreAuth();}finally{restorePending=null;restoringSession=Boolean(auth.getToken())&&!auth.state.get().user;if(router){render();if(current()){router.navigate('/');showRoute('/');}else if(restoringSession)showRoute('/');else router.navigate('/account');}}})();
setupAccount(config,{i18n,auth});
const passwordVisibility=setupPasswordVisibility(get('account-forms'),{selector:'#login-form input[type="password"],#register-form input[type="password"]',getLabel:shown=>i18n.t(shown?'appHidePassword':'appShowPassword'),subscribe:listener=>i18n.subscribe(listener)});
for(const control of document.querySelectorAll('[data-auth-mode]'))control.addEventListener('click',passwordVisibility.reset);
get('route-dialog').addEventListener('close',passwordVisibility.reset);
auth.state.subscribe(passwordVisibility.reset);
const api=auth.api;
let baseRoute='/',detailReturnRoute='/';
const addSheet=createBottomSheet(get('add-dialog'),{onDismiss:()=>closeAdd()});
const photoViewer=createImageViewer({labels:()=>({title:i18n.t('appPhotoPreview'),close:i18n.t('appClose'),zoom:i18n.t('appZoomIn'),fit:i18n.t('appFitImage')})});
const groupSheet=createBottomSheet(get('group-dialog'));
const recheckSheet=createBottomSheet(get('recheck-dialog'));
const pauseSheet=createBottomSheet(get('pause-dialog'));let pauseTarget=null,pauseSaving=false;
const wellbeingSheet=createBottomSheet(get('wellbeing-dialog'),{onDismiss:()=>{void wellbeing.allowLeave().then(ok=>{if(ok){wellbeing.discard();router.navigate('/account');}});}});
const usageSheet=createBottomSheet(get('usage-dialog'),{onDismiss:()=>router.navigate('/account')});
const routeSheet=createBottomSheet(get('route-dialog'),{onDismiss:()=>{if(current())router.navigate(router.current==='/detail'?detailReturnRoute:baseRoute);}});
const routineWizard=createRoutineWizard({dialog:get('routine-wizard-dialog'),editorDialog:get('routine-time-dialog'),goalsDialog:get('routine-goals-dialog'),i18n,icon,confirm:message=>confirmDialog(message,{i18n}),onError:error=>err(error),onSave:async(routine,revision)=>{
 const session=current();writes++;renderRoutineLoading();try{const result=await api.request('/v1/settings/routine',{method:'PUT',body:{routine,revision}});if(session!==current())return false;state.ai={...state.ai,routine:result.routine,routineRevision:result.revision};renderAccount();conclusion.changed();notify(i18n.t('appRoutineSaved'));return true;}catch(error){if(error.status===409&&session===current())await load(false);throw error;}finally{writes--;renderRoutineLoading();}
}});
const conclusion=createRoutineConclusion({dialog:get('conclusion-dialog'),root:get('conclusion-content'),i18n,request:(path,options)=>api.request(path,options),configured:()=>Boolean(state.ai?.configured),onRoutine:()=>routineWizard.open({...state.ai,firstIncomplete:true}),onAccepted:()=>load(false),onError:error=>err(error)});
get('open-conclusion').addEventListener('click',()=>void conclusion.open());
const intakeEditor=createIntakeEditor({i18n,icon,today:()=>state.day||localDay(),save:async(id,body)=>{
 const session=current();writes++;renderRoutineLoading();
 try{const response=await api.request('/v1/supplements/'+id+'/intake',{method:'PUT',body});if(session!==current())throw new Error('REQUEST_FAILED');await load(false);if(session!==current())throw new Error('REQUEST_FAILED');return {response,item:state.supplements.find(s=>s.id===id)};}
 finally{writes--;renderRoutineLoading();}
}});
get('route-dialog').addEventListener('close',()=>intakeEditor.reset());
const wellbeing=createWellbeingJournal({root:get('wellbeing-content'),i18n,icon,request:(path,options)=>api.request(path,options),confirm:message=>confirmDialog(message,{i18n}),isActive:()=>Boolean(current()&&router?.current==='/wellbeing')});
get('wellbeing-dialog').addEventListener('close',()=>wellbeing.reset());
const usageCalendar=createUsageCalendar({root:get('usage-content'),i18n,icon,groupIcon:renderGroupIcon,request:(path,options)=>api.get(path,options),onProduct:id=>router.navigate('/detail?id='+encodeURIComponent(id)),isActive:()=>Boolean(current()&&router?.current==='/usage')});
get('open-routine-wizard').addEventListener('click',()=>routineWizard.open(state.ai||{}));

let state={groups:[],supplements:[],ai:null,day:localDay()},owner=null,generation=0,writes=0,router,appReady=false;
const localizationAttempts=new Set();let localizationSending=false;
let routineReading=false,routineJobLoading=false;
/** One fixed-size ring reports reads, writes and background work without shifting the routine. */
function renderRoutineLoading(){const busy=Boolean(current()&&(routineReading||writes||routineJobLoading));get('progress-ring').classList.toggle('is-loading',busy);get('progress-ring').setAttribute('aria-busy',String(busy));}
let uploadQueueExpanded=false,groupDrag=null;
let routineChecks={active:null,latest:null,proposals:[]},recheckBusy=false,recheckStarting=false,recheckWatcher=null,recheckAbort;
let collectionEpoch=0,photo=[],imageGeneration=0,sending=false,requestId=null,addedId=null,analysisAbort,midnightTimer,watchedJob=null,activeJobs=[],modalJobId=null,jobSignature='',recognitionShown=new Set(),jobHistory=[];
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
 void routeSheet.close({immediate:true});void usageSheet.close({immediate:true});void wellbeingSheet.close({immediate:true});wellbeing.reset();get('route-header').querySelector('.detail-name')?.remove();usageCalendar.reset();intakeEditor.reset();routineWizard.reset();conclusion.reset();pauseTarget=null;pauseSaving=false;void pauseSheet.close({immediate:true});
 routineChecks={active:null,latest:null,proposals:[]};recheckBusy=false;recheckStarting=false;get('recheck-content').replaceChildren();recheckAbort?.abort();recheckWatcher=null;void recheckSheet.close({immediate:true});
 groupDrag=null;get('profile-form').hidden=true;get('connection-editor').open=false;
 appReady=false;collectionEpoch++;uploadQueueExpanded=false;localizationAttempts.clear();localizationSending=false;
 void groupSheet.close({immediate:true});
 generation++;jobHistory=[];activeJobs=[];modalJobId=null;jobSignature='';recognitionShown.clear();watchedJob=null;sending=false;state={groups:[],supplements:[],ai:null,day:localDay()};analysisAbort?.abort();closeAdd(true);
 for(const {form} of dirty){if(form.id==='settings-form')continue;form.reset();clearDirty(form);}
 get('supplement-detail').replaceChildren();get('ai-form').elements.key.value='';
 get('app-error').hidden=true;routineReading=false;routineJobLoading=false;renderRoutineLoading();
 renderUploadQueue();
}
function heading(text,tag='h2'){return element(tag,{text});}
function button(text,action,className='secondary'){
 const node=element('button',{text,className,attributes:{type:'button'}});node.addEventListener('click',action);return node;
}
async function mutate(task){
 const session=current();writes++;renderRoutineLoading();
 try{await task();if(session===current())await load();}
 catch(error){if(session===current())failure(error);}
 finally{writes--;renderRoutineLoading();if(router?.current==='/groups')renderGroups();}
}
async function load(checkJobs=true){
 const session=current();if(!session)return;
 const version=++generation;routineReading=true;renderRoutineLoading();
 try{
  const [result,checks]=await Promise.all([api.get('/v1/dashboard?timezone='+encodeURIComponent(zone())+'&language='+i18n.language),api.get('/v1/rechecks')]);
  if(session!==current()||version!==generation)return;
  routineChecks=Array.isArray(checks.proposals)?checks:{active:null,latest:null,proposals:[]};if(routineChecks.active&&!recheckWatcher)void watchRoutineChecks(session,collectionEpoch);
  state=result;conclusion.changed();appReady=true;get('app-error').hidden=true;render();
  if(checkJobs){const latest=await api.get('/v1/supplements/jobs');if(version!==generation)return;await observeJobs(latest,session);}
 }catch(error){if(session===current()&&version===generation){get('app-error').hidden=false;get('app-error').textContent=err(error);appReady=true;render();}}
 finally{if(session===current()&&version===generation){routineReading=false;renderRoutineLoading();}}
}
async function ensureLanguage(){
 const session=current();if(!session||localizationSending||!state.ai?.configured||activeJobs.some(j=>j.result?.kind==='localization'))return;
 const candidates=state.supplements.filter(s=>s.analysis.localizationNeeded&&!['queued','researching'].includes(s.analysis.enrichment?.status)).slice(0,4);if(!candidates.length)return;
 const language=i18n.language,key=language+':'+candidates.map(s=>s.id+':'+(s.analysis.research?.checkedAt||s.analysis.enrichment?.jobId||'legacy')).join(',');if(localizationAttempts.has(key))return;localizationAttempts.add(key);localizationSending=true;
 try{const job=await api.post('/v1/supplements/localize',{requestId:crypto.randomUUID(),language});if(session!==current())return;if(job.id&&job.status==='running')await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);else await load(false);}
 catch(error){if(session===current())failure(error);}finally{if(session===current())localizationSending=false;}
}
// Effective pause comes from the server, including automatic return in its saved zone.
const activeSupplements=()=>state.supplements.filter(item=>!item.paused&&item.scheduledToday!==false);
const todayOccurrences=item=>item.occurrences||[{slot:'daily',time:null,quantity:1,unit:'unit',completed:item.completed}];
function pauseStatus(item){return i18n.t(item.resume_on?'appPausedUntil':'appPausedManual',item.resume_on?{date:new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium'}).format(new Date(item.resume_on+'T12:00:00'))}:{});}
function openPause(item){
 if(pauseSaving)return;
 pauseTarget=item.id;const form=get('pause-form');form.reset();get('pause-product-name').textContent=item.name;
 const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);form.elements.resumeOn.min=localDay(tomorrow);form.elements.resumeOn.value=localDay(tomorrow);
 get('pause-date-label').hidden=true;form.elements.resumeOn.required=false;get('pause-error').hidden=true;pauseSheet.open();
}
get('pause-dialog').addEventListener('close',()=>{pauseTarget=null;get('pause-form').reset();clearDirty(get('pause-form'));});
get('pause-form').elements.returnChoice.addEventListener('change',()=>{const chosen=get('pause-form').elements.returnChoice.value==='date';get('pause-date-label').hidden=!chosen;get('pause-form').elements.resumeOn.required=chosen;});
get('pause-form').addEventListener('submit',async event=>{
 event.preventDefault();if(pauseSaving||!pauseTarget)return;const session=current(),target=pauseTarget,form=event.currentTarget;
 pauseSaving=true;writes++;renderRoutineLoading();form.setAttribute('aria-busy','true');const submit=form.querySelector('[type="submit"]');submit.disabled=true;
 try{await api.request('/v1/supplements/'+target+'/pause',{method:'PUT',body:{paused:true,resumeOn:form.elements.returnChoice.value==='date'?form.elements.resumeOn.value:null,timezone:zone()}});if(session!==current())return;await pauseSheet.close();await load();}
 catch(error){if(session===current()){get('pause-error').textContent=err(error);get('pause-error').hidden=false;}}
 finally{pauseSaving=false;writes--;renderRoutineLoading();form.removeAttribute('aria-busy');submit.disabled=false;}
});
async function resumeSupplement(item){await mutate(()=>api.request('/v1/supplements/'+item.id+'/pause',{method:'PUT',body:{paused:false,timezone:zone()}}));}
function renderHome(){
 const active=activeSupplements();
 get('routine-note').hidden=!active.some(s=>s.analysis.schemaVersion==='draft-1');
 get('today-date').textContent=new Intl.DateTimeFormat(i18n.language,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
 const occurrences=active.flatMap(todayOccurrences),done=occurrences.filter(s=>s.completed).length,total=occurrences.length;
 get('today-progress').textContent=i18n.t('trackerProgress',{done,total});
 get('progress-count').textContent=done+' / '+total;get('progress-ring').setAttribute('aria-label',get('today-progress').textContent);
 get('progress-arc').setAttribute('stroke-dasharray',(total?100*done/total:0)+' 100');
 get('progress-message').textContent=i18n.t(!total?'appStartRoutine':done===total?'appDayComplete':done?'appOnTrack':'appReadyToday');
 get('progress-caption').textContent=i18n.t(done&&done===total?'appSeeTomorrow':'appKeepGoing');
 get('home-empty').hidden=state.supplements.length>0;
 const paused=state.supplements.filter(item=>item.paused),pausedRoot=get('paused-supplements');pausedRoot.replaceChildren();pausedRoot.hidden=!paused.length;
 if(paused.length){pausedRoot.append(heading(i18n.t('appPausedCount',{count:paused.length}),'h2'));
  for(const item of paused){const row=element('div',{className:'paused-row'}),open=button('',()=>router.navigate('/detail?id='+encodeURIComponent(item.id)),'paused-open');open.append(element('strong',{text:item.name}),element('small',{text:[item.analysis.manufacturer,pauseStatus(item)].filter(Boolean).join(' · ')}));const resume=button(i18n.t('appResumeSupplement'),async()=>{resume.disabled=true;await resumeSupplement(item);resume.disabled=false;},'secondary paused-resume');row.append(open,resume);pausedRoot.append(row);}
 }
 const container=get('routine-groups');container.replaceChildren();
 const groups=[...state.groups];if(active.some(s=>!s.group_id))groups.push({id:null,name:i18n.t('appUnassigned'),description:i18n.t('appUnassignedHelp')});
 groups.forEach((group,index)=>{
  const rows=active.filter(item=>item.group_id===group.id);
  const section=element('section',{className:'group-block'}),head=element('div',{className:'group-heading'}),labels=element('div');
  const groupIcon=element('span',{className:'group-symbol'});groupIcon.append(renderGroupIcon(group));head.append(groupIcon);labels.append(heading(group.name));
  head.append(labels);if(group.id){const edit=button('',()=>openGroup(group),'group-edit');edit.setAttribute('aria-label',i18n.t('appEdit')+': '+group.name);edit.append(icon('chevron'));head.append(edit);}section.append(head);
  const list=element('table',{className:'supplement-table',attributes:{'aria-label':group.name}}),body=element('tbody');list.append(body);
  if(!rows.length){const emptyRow=element('tr');emptyRow.append(element('td',{text:i18n.t('appGroupEmpty'),className:'group-empty',attributes:{colspan:'2'}}));body.append(emptyRow);}
  for(const product of rows)for(const occurrence of todayOccurrences(product)){
   const item={...product,completed:occurrence.completed};
   const isResearching=item.analysis.localizationNeeded||['queued','researching'].includes(item.analysis.enrichment?.status);
   const row=element('tr',{className:'supplement-row'+(item.completed?' is-done':'')+(isResearching?' is-researching':''),attributes:{'aria-busy':String(isResearching)}});row.dataset.id=item.id;row.dataset.slot=occurrence.slot;
   const open=button('',()=>router.navigate('/detail?id='+encodeURIComponent(item.id)),'supplement-open');
   const label=productLabel({name:item.name,manufacturer:item.analysis.manufacturer,variant:item.analysis.variant});
   open.append(element('strong',{text:label.name+(occurrence.time?' · '+occurrence.time:''),className:'product-title'}));
   const summary=item.analysis.benefitTags?.length?item.analysis.benefitTags.slice(0,3).map(b=>b[i18n.language]||b.en).join(', '):compactText(item.analysis.benefitSummary||item.analysis.benefits?.[0]||item.analysis.whenToUse);
   const meta=element('span',{className:'summary'});if(label.manufacturer)meta.append(element('b',{text:label.manufacturer,className:'product-manufacturer'}));if(summary)meta.append(document.createTextNode((label.manufacturer?' · ':'')+summary));if(meta.textContent)open.append(meta);
   if(item.analysis.localizationNeeded)open.append(element('span',{text:i18n.t('appTranslationOriginalShort'),className:'research-badge'}));
   else if(item.analysis.enrichment&&item.analysis.enrichment.status!=='complete')open.append(element('span',{text:i18n.t('appInfo_'+item.analysis.enrichment.status),className:'research-badge'}));

   if(item.stock_remaining!==null&&item.stock_remaining!==undefined&&item.stock_remaining<=item.stock_threshold)open.append(element('span',{text:i18n.t('appIntakeLowStock',{count:item.stock_remaining}),className:'stock-badge'}));
   const check=button('',async()=>{if(check.disabled)return;check.disabled=true;await mutate(()=>api.request('/v1/supplements/'+item.id+'/completion',{method:'PUT',body:{completed:!(state.day===localDay()&&item.completed),slot:occurrence.slot,timezone:zone()}}));check.disabled=false;},'check-button');
   check.setAttribute('aria-label',i18n.t(item.completed?'appUntake':'appTake',{name:item.name}));check.setAttribute('aria-pressed',String(item.completed));
   check.append(element('span',{text:'✓',className:'check-ring',attributes:{'aria-hidden':'true'}}));const checkCell=element('td'),nameCell=element('td');checkCell.append(check);nameCell.append(open);row.append(checkCell,nameCell);body.append(row);
  }section.append(list);container.append(section);
 });
 const resting=state.supplements.filter(s=>!s.paused&&s.scheduledToday===false);if(resting.length){const box=element('details',{className:'surface rest-day-supplements'});box.append(element('summary',{text:i18n.t('appIntakeNotTodayCount',{count:resting.length})}));for(const item of resting){const open=button(item.name,()=>router.navigate('/detail?id='+encodeURIComponent(item.id)),'rest-day-open');box.append(open);}container.append(box);}
}
// Icons are decoration only; group assignment remains the server's decision.
function renderGroupIcon(group){try{return parseCustomIcon(group?.icon)||icon(groupSymbol(group?.name||''));}catch{return icon(groupSymbol(group?.name||''));}}
function groupSymbol(name){return /evening|bed|sleep|vakar|mieg/i.test(name)?'moon':/morning|empty|ryt|tušč/i.test(name)?'sun':'meal';}
function openGroup(group){
 const form=get('group-form');resetGroup();
 if(group){form.elements.id.value=group.id;form.elements.name.value=group.name;form.elements.description.value=group.description||'';form.elements.icon.value=group.icon||'';get('group-form-title').textContent=i18n.t('appEditGroup');get('cancel-group').hidden=false;}
 renderGroupIconOptions();groupSheet.open();
}
/** The original hand-drawn app glyphs are persisted as ordinary safe SVG. This
 * reuses the existing icon contract/API; no remote icon service or new format. */
const groupIconPresets=['sun','meal','moon','training','sleep','dose','shield'];
function renderGroupIconOptions(){
 const root=get('group-icon-options');root.replaceChildren();
 for(const name of ['',...groupIconPresets]){const svg=icon(name||groupSymbol(get('group-form').elements.name.value)),value=name?svg.outerHTML:'';
 const node=button('',()=>{get('group-form').elements.icon.value=value;get('group-form').elements.icon.dispatchEvent(new Event('input',{bubbles:true}));},'group-icon-option');node.dataset.iconValue=value;node.setAttribute('aria-pressed','false');node.append(svg,element('span',{text:i18n.t(name?'appIcon_'+name:'appIconDefault')}));root.append(node);}
 updateGroupIconPreview();
}
function updateGroupIconPreview(){
 const value=get('group-form').elements.icon.value.trim(),root=get('group-icon-preview');root.replaceChildren();
 for(const node of get('group-icon-options').children)node.setAttribute('aria-pressed',String(node.dataset.iconValue===value));
 try{const graphic=parseCustomIcon(value)||icon(groupSymbol(get('group-form').elements.name.value));root.append(graphic,element('span',{text:i18n.t('appIconPreview')}));}catch{root.append(element('span',{text:i18n.t('INVALID_GROUP_ICON'),className:'status-error'}));}
}
get('group-form').elements.icon.addEventListener('input',updateGroupIconPreview);
get('group-form').elements.name.addEventListener('input',updateGroupIconPreview);
get('new-group').addEventListener('click',()=>openGroup());
function renderGroups(){
 if(groupDrag)return;
 get('group-count').textContent=state.groups.length;get('group-supplement-count').textContent=state.supplements.length;
 const list=get('group-list'),openMenus=new Set([...list.querySelectorAll('.group-menu[open]')].map(n=>n.closest('[data-group-id]').dataset.groupId));list.replaceChildren();
 for(const group of state.groups){
  const row=element('div',{className:'managed-group',attributes:{'data-group-id':group.id}}),grip=button('',()=>{},'group-grip');
  grip.disabled=Boolean(writes);grip.append(icon('grip'));grip.setAttribute('aria-label',i18n.t('appMoveGroupOrder',{name:group.name}));
  grip.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const index=state.groups.findIndex(g=>g.id===group.id);void moveGroup(group.id,index+(event.key==='ArrowUp'?-1:1));});
  grip.addEventListener('pointerdown',event=>{
   if(event.button!==0||writes||!event.isPrimary)return;event.preventDefault();grip.setPointerCapture(event.pointerId);groupDrag={id:group.id,pointerId:event.pointerId,start:event.clientY,moved:false,owner:current()};
  });
  const glyph=element('span',{className:'managed-group-icon'});glyph.append(renderGroupIcon(group));
  const text=button('',()=>openGroup(group),'managed-group-copy');text.append(heading(group.name,'h2'));if(group.description)text.append(element('p',{text:group.description}));text.append(element('small',{text:i18n.t('appSupplementCount',{count:state.supplements.filter(s=>s.group_id===group.id).length})}));
  const menu=element('details',{className:'group-menu'}),summary=element('summary',{attributes:{'aria-label':i18n.t('appManageGroup',{name:group.name})}});summary.append(icon('ellipsis'));
  menu.open=openMenus.has(group.id);
  const actions=element('div',{className:'group-menu-actions'});actions.append(button(i18n.t('appEdit'),()=>{menu.open=false;openGroup(group);}),button(i18n.t('appMoveUp'),()=>{void moveGroup(group.id,state.groups.indexOf(group)-1);}),button(i18n.t('appMoveDown'),()=>{void moveGroup(group.id,state.groups.indexOf(group)+1);}),button(i18n.t('appDelete'),async()=>{
   menu.open=false;if(!await confirmDialog(i18n.t('appDeleteGroupConfirm'),{i18n}))return;
   await mutate(()=>api.delete('/v1/groups/'+group.id));if(get('group-form').elements.id.value===group.id)resetGroup();
  },'danger-link'));menu.append(summary,actions);row.append(grip,glyph,text,menu);list.append(row);
 }
}
// Listen above the row: DOM reordering can release native pointer capture.
// A captured grip may move, but the gesture must still commit/cancel reliably.
window.addEventListener('pointermove',event=>{
 if(!groupDrag||event.pointerId!==groupDrag.pointerId||groupDrag.owner!==current())return;
 if(Math.abs(event.clientY-groupDrag.start)<5&&!groupDrag.moved)return;
 groupDrag.moved=true;const list=get('group-list'),row=[...list.children].find(n=>n.dataset.groupId===groupDrag.id);if(!row)return;row.classList.add('is-dragging');
 const next=[...list.children].filter(n=>n!==row).find(n=>event.clientY<n.getBoundingClientRect().top+n.getBoundingClientRect().height/2);list.insertBefore(row,next||null);
});
window.addEventListener('pointerup',event=>{if(!groupDrag||event.pointerId!==groupDrag.pointerId)return;const drag=groupDrag,ids=[...get('group-list').children].map(n=>n.dataset.groupId);groupDrag=null;if(drag.moved&&drag.owner===current())void saveGroupOrder(ids);else renderGroups();});
window.addEventListener('pointercancel',()=>{if(groupDrag){groupDrag=null;renderGroups();}});
async function saveGroupOrder(ids){if(writes)return;await mutate(()=>api.request('/v1/groups/order',{method:'PUT',body:{ids}}));renderGroups();}
async function moveGroup(id,index){if(index<0||index>=state.groups.length)return;const ids=state.groups.map(g=>g.id),from=ids.indexOf(id);ids.splice(from,1);ids.splice(index,0,id);await saveGroupOrder(ids);}
get('new-custom-group').addEventListener('click',()=>openGroup());
for(const name of ['training','sleep'])get('quick-'+name).addEventListener('click',()=>{openGroup();const f=get('group-form');f.elements.name.value=i18n.t('appIcon_'+name);f.elements.description.value=i18n.t(name==='training'?'appTrainingHelp':'appSleepHelp');f.elements.icon.value=icon(name).outerHTML;renderGroupIconOptions();});
function renderAccount(){
 get('open-routine-wizard').disabled=!current()||!appReady;get('routine-preference-summary').textContent=i18n.t(state.ai?.routine?'appRoutineConfigured':'appRoutineSetUp');
 const user=auth.state.get().user;get('account-screen').dataset.authenticated=String(Boolean(user));for(const id of ['account-security','account-tools','logout-slot'])get(id).hidden=!user;
 get('account-display-name').textContent=user?.name||'';get('account-initials').textContent=(user?.name||'').trim().split(/\s+/).slice(0,2).map(n=>Array.from(n)[0]).join('').toUpperCase();
 get('edit-profile-name').setAttribute('aria-expanded',String(!get('profile-form').hidden));
}
get('edit-profile-name').addEventListener('click',()=>{get('profile-form').hidden=!get('profile-form').hidden;renderAccount();if(!get('profile-form').hidden)get('profile-form').elements.name.focus();});
get('profile-form').addEventListener('app:saved',()=>{get('profile-form').hidden=true;renderAccount();});
/** Keep composition, usage, benefits and severe routine conflicts visible.
 * Native disclosure contains restrictions, evidence and management tools.
 * Preserve expansion only for this product across polling/language/theme renders;
 * navigating to a different product or signing out resets it. Nothing is persisted.
 */
function renderDetail(){
 const id=new URLSearchParams(location.hash.split('?')[1]||'').get('id');
 const item=state.supplements.find(s=>s.id===id),container=get('supplement-detail');
 if(item)intakeEditor.refresh(item);
 if(intakeEditor.isEditing(id))return;
 const previous=container.querySelector('details[data-supplement-id]'),expanded=previous?.dataset.supplementId===id&&previous.open;
 container.replaceChildren();
 if(!item){container.append(element('p',{text:i18n.t('appDetailMissing')}));return;}
 const analysis=item.analysis,card=element('div',{className:'surface detail-section'}),primary=element('div',{attributes:{id:'detail-primary'}}),extra=element('div',{className:'detail-extra-content',attributes:{id:'detail-extra-content'}});
 const pending=['queued','researching'].includes(analysis.enrichment?.status),draft=analysis.schemaVersion==='draft-1',fallback=analysis.doseFallback;
 const reference=fallback&&['established_adult_intake','usual_adult_supplement_range'].includes(fallback.basis)&&(!analysis.dosage?.directions||analysis.dosage?.dailyServingsMin==null);
 const section=(key,name,parent=primary)=>{const node=element('section',{className:'detail-tile',attributes:{'data-detail-section':name}});node.append(icon({dose:'clock',benefits:'leaf',composition:'dose',restrictions:'shield',compatibility:'shield'}[name]),heading(i18n.t(key),'h3'));parent.append(node);return node;};
 const prose=(target,value)=>{if(Array.isArray(value)){const list=element('ul');for(const text of value)list.append(element('li',{text}));target.append(list);}else target.append(element('p',{text:value}));};
 const assigned=state.groups.find(group=>group.id===item.group_id),badge=element('div',{className:'group-badge'});badge.append(assigned?renderGroupIcon(assigned):icon('info'),element('span',{text:assigned?.name||i18n.t('appUnassigned')}));
 const productInfo=productLabel({name:item.name,manufacturer:analysis.manufacturer,variant:analysis.variant});
 get('route-header').querySelector('.detail-name')?.remove();get('route-header').prepend(element('h1',{text:productInfo.name,className:'detail-name',attributes:{id:'product-detail-title',tabindex:'-1','data-sheet-focus':'',autofocus:''}}));
 const subtitle=element('p',{className:'product-subtitle'});if(productInfo.manufacturer)subtitle.append(element('b',{text:productInfo.manufacturer}));if(productInfo.variant)subtitle.append(document.createTextNode((productInfo.manufacturer?' · ':'')+productInfo.variant));if(subtitle.textContent)card.append(subtitle);
 card.append(badge);if(analysis.localizationNeeded)card.append(element('p',{className:'form-help',text:i18n.t('appTranslationOriginal')}));if(item.paused)card.append(element('p',{className:'pause-status',text:pauseStatus(item),attributes:{role:'status'}}));card.append(primary);
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
 if(analysis.research?.scope==='full-product-details'){
 const severe=(analysis.compatibility?.assessments||[]).filter(a=>a.severity==='severe'&&['potential_conflict','duplicate'].includes(a.status));
 if(severe.length){const compatibility=section('appSevereConflicts','compatibility');
 for(const a of severe){const block=element('div',{className:'interaction-alert'});if(a.supplementName)block.append(heading(a.supplementName,'h4'));prose(block,a.reason);
 const recommended=state.groups.find(g=>g.id===a.recommendedGroupId);if(a.recommendation&&(!a.recommendedGroupId||recommended&&recommended.id!==item.group_id))prose(block,a.recommendation);
 if(recommended&&recommended.id!==item.group_id)block.append(element('p',{text:i18n.t('appSuggestedGroup',{name:recommended.name}),className:'detail-meta'}));compatibility.append(block);}}
 if(analysis.cautions?.length)prose(section('appRestrictions','restrictions',extra),analysis.cautions);
 }
 if(!draft&&analysis.sources?.length){
  extra.append(heading(i18n.t('appSources'),'h3'));const list=element('ul',{className:'source-list'});
  for(const source of analysis.sources){const row=element('li');row.append(element('a',{text:source.title,attributes:{href:source.url,target:'_blank',rel:'noopener noreferrer'}}));list.append(row);}extra.append(list);
 }
 }else{
  if(analysis.composition){const node=section('appComposition','composition');if(analysis.composition.ingredients.length)prose(node,analysis.composition.ingredients.map(n=>n.name+(n.labelAmount?' · '+n.labelAmount:'')));else prose(node,i18n.t('appDoseUnknown'));if(!analysis.composition.complete)node.append(element('p',{className:'detail-meta',text:i18n.t('appCompositionPartial')}));}
  prose(section('appBenefits','benefits'),analysis.benefitTags?.length?analysis.benefitTags.map(b=>b[i18n.language]||b.en):analysis.benefitSummary);
 }
 // New products are researched automatically. This action retries/refreshes explicitly.
 const refresh=button(i18n.t('appRefreshInfo'),async()=>{const session=current();refresh.disabled=true;writes++;renderRoutineLoading();try{const job=await api.post('/v1/supplements/'+item.id+'/research',{requestId:crypto.randomUUID(),language:i18n.language});if(session!==current())return;await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);await load();}catch(error){if(session===current()){failure(error);refresh.disabled=false;}}finally{writes--;renderRoutineLoading();}});
 refresh.disabled=pending;refresh.className='secondary detail-research-button';
 const select=element('select',{attributes:{'aria-label':i18n.t('appMoveGroup')}});
 select.append(element('option',{text:i18n.t('appUnassigned'),attributes:{value:''}}));
 for(const group of state.groups)select.append(element('option',{text:group.name,attributes:{value:group.id}}));select.value=item.group_id||'';
 select.addEventListener('change',async()=>{select.disabled=true;await mutate(()=>api.patch('/v1/supplements/'+item.id,{groupId:select.value||null}));});
 const groupControls=element('div',{className:'detail-group-controls'});groupControls.append(select);
 const remove=button(i18n.t('appDeleteSupplement'),async()=>{
  if(!await confirmDialog(i18n.t('appDeleteSupplementConfirm'),{i18n}))return;
  await mutate(async()=>{await api.delete('/v1/supplements/'+item.id);router.navigate('/');});
 },'danger-link');
 if(!basic&&!draft&&extra.childElementCount){
 const disclosure=element('details',{className:'detail-more',attributes:{'data-supplement-id':item.id}}),toggle=element('summary',{className:'secondary',attributes:{'aria-controls':extra.id}});
 const label=()=>{toggle.textContent=i18n.t(disclosure.open?'appLessInfo':'appMoreInfo');};
 disclosure.open=Boolean(expanded);label();disclosure.addEventListener('toggle',label);
 disclosure.append(toggle,extra);card.append(disclosure);
 }
 const pause=button(i18n.t(item.paused?'appResumeSupplement':'appPauseSupplement'),async()=>{if(item.paused){pause.disabled=true;await resumeSupplement(item);}else openPause(item);},'secondary pause-supplement');
 const actions=element('div',{className:'detail-actions'});actions.append(pause,refresh,remove);
 card.append(intakeEditor.mount(item),groupControls,actions);
 if(pending||basic&&analysis.enrichment?.status==='failed')card.append(element('p',{text:i18n.t('appInfo_'+analysis.enrichment.status),className:'research-badge',attributes:{role:'status'}}));
 container.append(card);
}
function renderAi(){
 renderAccount();
 get('clear-data-panel').hidden=!current();if(!state.ai)return;
 status('ai-key-status',i18n.t(state.ai.configured?'appKeySaved':'appKeyMissing'));
 get('remove-key').disabled=!state.ai.configured;
 const select=get('ai-form').elements.model;
 const editing=dirty.find(item=>item.form===get('ai-form')).tracker.dirty;
 if(!editing){select.replaceChildren(...state.ai.models.map(model=>element('option',{text:model,attributes:{value:model}})));select.value=state.ai.model;}
}
function finishStartup(){
 if(!starting||!pwaReady||restoringSession||(current()&&!appReady))return;
 // Permanently close automatic activation BEFORE revealing interactive content.
 pwa.finishStartup();
 starting=false;get('startup-progress').setAttribute('aria-valuenow','100');
 document.documentElement.dataset.starting='false';get('startup-screen').hidden=true;
 const route=current()?'/':'/account';router.navigate(route);showRoute(route);
}
function render(){
 get('startup-progress').setAttribute('aria-label',i18n.t('appLoading'));
 get('startup-progress').setAttribute('aria-valuenow',String(appReady?80:current()?55:30));
 finishStartup();
 const booting=restoringSession||Boolean(current()&&!appReady);document.documentElement.dataset.sessionRestoring=String(booting);document.querySelector('main').setAttribute('aria-busy',String(booting));get('add-supplement').disabled=booting;
 get('diagnostics-link').hidden=!current();renderAccount();renderDiagnostics();
 i18n.render(document);get('app-version').textContent=i18n.t('version',{version:config.version});
 get('network-status').textContent=network.state.get().online?'':i18n.t('appOffline');
 get('app-nav').hidden=!current();get('route-dialog').querySelector('[data-sheet-close]').hidden=!current();get('route-title').textContent=router?.current==='/detail'?'':i18n.t(router?.current==='/diagnostics'?'appDiagnostics':'appAccount');usageCalendar.languageChanged();wellbeing.languageChanged();conclusion.languageChanged();get('conclusion-home').hidden=!current()||!state.supplements.some(s=>state.groups.some(g=>g.id===s.group_id));renderHome();renderRoutineCheck();renderGroups();if(router?.current==='/detail')renderDetail();renderAi();
 get('group-form-title').textContent=i18n.t(get('group-form').elements.id.value?'appEditGroup':'appNewGroup');if(get('group-dialog').open)renderGroupIconOptions();
 renderUploadQueue();
}
/** Recheck drafts stay on the server, independently of upload history. Closing
 * this sheet stops no work; logout/clear invalidates every in-flight UI result. */
function renderRoutineCheck(){
 const {active,latest,proposals}=routineChecks;get('recheck-home').hidden=!current()||!activeSupplements().length;
 get('recheck-all').textContent=i18n.t(active?'appRecheckRunning':'appRecheckAll');get('recheck-all').disabled=recheckBusy||!state.ai?.configured||!activeSupplements().length||!state.groups.length;
 get('home-routine-actions').hidden=get('conclusion-home').hidden&&get('recheck-home').hidden;get('recheck-pending').hidden=!proposals.length;get('recheck-pending').textContent=i18n.t('appRecheckPending',{count:proposals.length});
 const root=get('recheck-content'),running=Boolean(current()&&(active||recheckStarting));
 // Keep the animated node connected across polling; removing it restarts CSS animation.
 let progress=running?root.querySelector('.recheck-progress'):null;
 for(const child of [...root.children])if(child!==progress)child.remove();if(!current())return;
 if(running){if(!progress){progress=element('section',{className:'recheck-progress',attributes:{role:'status','aria-live':'polite'}});const track=element('div',{className:'recheck-progress-track',attributes:{role:'progressbar'}});track.append(element('span',{attributes:{'aria-hidden':'true'}}));progress.append(element('p'),track);root.prepend(progress);}progress.querySelector('p').textContent=i18n.t(active?.phase==='queued'?'appRecheckQueued':'appRecheckProgress',{count:active?.total_count||state.supplements.length});progress.querySelector('[role="progressbar"]').setAttribute('aria-label',i18n.t('appRecheckRunning'));}
 if(latest?.status==='failed')root.append(element('p',{className:'status-error',text:err(new Error(latest.error_code||'REQUEST_FAILED')),attributes:{role:'status'}}));
 if(latest?.skippedCount)root.append(element('p',{className:'form-help',text:i18n.t('appRecheckStale')}));
 if(!active&&!proposals.length&&!recheckBusy)root.append(element('p',{className:'recheck-empty',text:i18n.t(latest?.status==='complete'?(latest.proposedCount?'appRecheckResolved':'appRecheckNoChanges'):'appRecheckIntro')}));
 const list=element('div',{className:'recheck-proposals'});
 for(const p of proposals){const card=element('article',{className:'recheck-proposal',attributes:{'data-proposal-id':p.id}});card.append(heading(p.name,'h3'),element('p',{className:'recheck-manufacturer',text:p.manufacturer||i18n.t('appUnknownManufacturer')}),element('p',{className:'recheck-move',text:(p.from.name||i18n.t('appUnassigned'))+' → '+(p.to.name||i18n.t('appUnassigned'))}));
  const actions=element('div',{className:'button-row'}),accept=button(i18n.t('appRecheckAccept'),()=>resolveRoutineCheck(p,'accept'),'primary'),remove=button(i18n.t('appRecheckRemove'),()=>resolveRoutineCheck(p,'remove'),'secondary');accept.disabled=remove.disabled=recheckBusy;actions.append(accept,remove);card.append(actions);list.append(card);
 }root.append(list);
}
async function refreshRoutineChecks(session,epoch,signal){const data=await api.get('/v1/rechecks',{signal});if(session!==current()||epoch!==collectionEpoch||signal?.aborted)return;routineChecks=data;renderRoutineCheck();}
async function watchRoutineChecks(session,epoch){
 const marker={};recheckWatcher=marker;recheckAbort=new AbortController();const signal=recheckAbort.signal;
 const wait=()=>new Promise(resolve=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1200);function abort(){clearTimeout(timer);resolve();}signal.addEventListener('abort',abort,{once:true});});
 try{while(current()===session&&epoch===collectionEpoch&&routineChecks.active&&!signal.aborted){await wait();if(signal.aborted)return;await refreshRoutineChecks(session,epoch,signal);}}
 catch(error){if(current()===session&&!signal.aborted)failure(error);}finally{if(recheckWatcher===marker)recheckWatcher=null;}
}
get('recheck-pending').addEventListener('click',()=>{renderRoutineCheck();recheckSheet.open();});
get('recheck-all').addEventListener('click',async()=>{
 renderRoutineCheck();recheckSheet.open();if(recheckBusy||routineChecks.active)return;
 const session=current(),epoch=collectionEpoch;recheckBusy=true;recheckStarting=true;renderRoutineCheck();
 try{await api.post('/v1/rechecks',{requestId:crypto.randomUUID(),language:i18n.language});await refreshRoutineChecks(session,epoch);if(current()===session&&epoch===collectionEpoch&&routineChecks.active&&!recheckWatcher)void watchRoutineChecks(session,epoch);}
 catch(error){if(current()===session&&epoch===collectionEpoch)failure(error);}finally{if(current()===session&&epoch===collectionEpoch){recheckBusy=false;recheckStarting=false;renderRoutineCheck();}}
});
async function resolveRoutineCheck(proposal,action){
 if(recheckBusy)return;const session=current(),epoch=collectionEpoch;recheckBusy=true;writes++;renderRoutineLoading();renderRoutineCheck();
 try{await api.patch('/v1/rechecks/'+proposal.jobId+'/'+proposal.id,{action});if(current()!==session||epoch!==collectionEpoch)return;if(action==='accept')await load(false);else await refreshRoutineChecks(session,epoch);}
 catch(error){if(current()===session&&epoch===collectionEpoch)failure(error);}finally{writes--;renderRoutineLoading();if(current()===session&&epoch===collectionEpoch){recheckBusy=false;renderRoutineCheck();}}
}

/** Only server-owned account metadata is displayed; model text always uses safe
 * text nodes. Show partial successes and skipped/failed identities individually. */
function renderReport(id,report){
 const container=get(id);container.replaceChildren();container.hidden=!report;if(!report)return;
 const items=report.items||[],added=items.filter(item=>item.status==='added'),translation=report.kind==='localization',translated=items.filter(item=>item.research==='complete').length;
 container.append(heading(translation?i18n.t(report.running?'appTranslationProcessing':'appTranslationSummary',{done:report.running?items.filter(i=>['complete','failed'].includes(i.research)).length:translated,total:report.total||items.length}):report.running?i18n.t('appBatchProgress',{done:items.filter(item=>['complete','reused','failed'].includes(item.research)).length,total:report.total}):i18n.t('appBatchSummary',{added:added.length,total:items.length}),'h3'));
 const list=element('div',{className:'upload-product-list'});
 for(const item of items){
  const available=(translation||item.status==='added')&&state.supplements.some(s=>s.id===item.id),phase=item.status==='failed'?'failed':item.research||'queued';
  const tone=phase==='failed'?'failed':['complete','reused'].includes(phase)?'complete':'pending';
  const control=button(item.name,()=>{void addSheet.close({immediate:true});router.navigate('/detail?id='+encodeURIComponent(item.id));},'upload-product-button');
  control.disabled=!available;control.dataset.state=tone;control.setAttribute('aria-label',item.name+' — '+i18n.t((translation?'appTranslation_':'appInfo_')+(['queued','researching','complete','failed'].includes(phase)?phase:tone==='complete'?'complete':'queued')));list.append(control);
 }container.append(list);
 // Persisted job snapshots describe actual AI moves, even after later edits. For
 // older jobs only infer a move from a matching research job and AI provenance.
 const changes=items.flatMap(item=>{const a=state.supplements.find(s=>s.id===item.id)?.analysis;let change=item.groupChange||(a?.grouping?.change?.jobId===report.jobId?a.grouping.change:null);
  if(!change&&!report.groupChangesTracked&&report.submission&&a?.enrichment?.jobId===report.jobId&&a.grouping?.basis==='researched'&&a.identity?.groupId&&a.identity.groupId!==a.grouping.groupId)change={from:{id:a.identity.groupId},to:{id:a.grouping.groupId}};
  return change&&change.from.id!==change.to.id?[{name:item.name,...change}]:[];});
 if(changes.length){const section=element('section',{className:'upload-group-changes'});section.append(heading(i18n.t('appResearchGroupChanges'),'h3'));const rows=element('div',{className:'upload-group-change-list'});
  for(const change of changes){const label=group=>group.name||state.groups.find(g=>g.id===group.id)?.name||i18n.t('appUnassigned'),row=element('div',{className:'upload-group-change'});row.append(element('strong',{text:change.name}),element('p',{text:label(change.from)+' → '+label(change.to)}));rows.append(row);}section.append(rows);container.append(section);
 }
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
bindForm(get('group-form'),async(data,form)=>{parseCustomIcon(data.icon);
 await api.request('/v1/groups'+(data.id?'/'+data.id:''),{method:data.id?'PATCH':'POST',body:{name:data.name,description:data.description,icon:data.icon}});
 resetGroup();void groupSheet.close();await load();notify(i18n.t('appSaved'));
},{onError:failure});
// Public display preferences apply immediately, without a submit step. Keep
// only this form's dirty state clear; no other account edits are discarded.
get('settings-form').addEventListener('submit',event=>event.preventDefault());
get('settings-form').addEventListener('change',()=>{try{settings.update({language:get('settings-form').elements.language.value,theme:get('settings-form').elements.theme.value});clearDirty(get('settings-form'));}catch(error){failure(error);}});
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

get('toggle-upload-queue').addEventListener('click',()=>{uploadQueueExpanded=!uploadQueueExpanded;renderUploadQueue();});
get('remove-photo').addEventListener('click',()=>{clearPhoto();requestId=crypto.randomUUID();});
get('analyze-form').elements.name.addEventListener('input',()=>{requestId=crypto.randomUUID();});
for(const name of ['photo'])get('analyze-form').elements[name].addEventListener('change',async event=>{
 const selected=[...event.target.files];if(!selected.length)return;
 if(photo.length+selected.length>6){status('analysis-status',i18n.t('appPhotoLimit'),true);event.target.value='';return;}
 const version=++imageGeneration;get('analyze-form').querySelector('button[type="submit"]').disabled=true;
 status('analysis-status',i18n.t('appPreparingPhoto'));
 try{
  const prepared=[];
  // Share the remaining encoded payload budget across new photos. Six photos
  // must still fit the deployed API/proxy limits, including base64 expansion.
  const maxBytes=Math.min(600000,Math.floor((4300000-10000-photo.reduce((sum,data)=>sum+data.length,0))*3/4/selected.length));
  for(const file of selected){let data,lastError;for(const maxSide of [1800,1400,1000,700]){try{data=await prepareImage(file,{maxSide,maxBytes});break;}catch(error){lastError=error;}}if(!data)throw lastError;if(version!==imageGeneration)return;prepared.push(data);}
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
 container.replaceChildren();get('upload-queue').hidden=!uploadQueueExpanded;get('toggle-upload-queue').setAttribute('aria-expanded',String(uploadQueueExpanded));get('upload-queue-spinner').hidden=!sending&&!jobHistory.some(job=>job.status==='running');
 const running=jobHistory.filter(job=>job.status==='running');get('upload-queue-count').textContent=i18n.t('appUploadQueueCount',{count:running.length});
 const ordered=[...jobHistory].sort((a,b)=>(a.status==='running'?0:1)-(b.status==='running'?0:1)||(a.status==='running'?Date.parse(a.created_at||0)-Date.parse(b.created_at||0):Date.parse(b.finished_at||b.created_at||0)-Date.parse(a.finished_at||a.created_at||0)));
 for(const job of ordered){
  const card=element('details',{className:'upload-job',attributes:{'data-job-id':job.id,'data-phase':job.phase||'recognizing'}});card.open=previous.has(job.id)?previous.get(job.id):job.status==='running'||job.id===modalJobId;
  const translation=job.result?.kind==='localization',submission=job.result?.submission,title=translation?i18n.t('appTranslateInfo'):submission?.name||i18n.t(submission?.kind==='photo'?'appUploadPhoto':'appUploadSupplement');
  const failed=job.status==='failed',issues=job.result?.items?.some(item=>item.research==='failed'||item.status==='failed');
  const phase=job.phase||'recognizing',label=failed?'appUploadFailed':job.status==='complete'?(issues?'appUploadDoneIssues':'appUploadDone'):translation?'appTranslationStage':job.result?.monitor?.pipeline==='grok-jev'&&phase==='enriching'?'appJevClassifying':'appUpload_'+phase;
  const summary=element('summary'),labels=element('div',{className:'upload-job-labels'});labels.append(element('strong',{text:title}),element('span',{text:i18n.t(job.result?.review?.status==='checking'?'appGroupReview_checking':label),className:'upload-job-phase'}));
  if(job.created_at){const date=new Date(job.created_at);if(Number.isFinite(date.getTime()))labels.append(element('time',{text:new Intl.DateTimeFormat(i18n.language,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date),attributes:{datetime:date.toISOString()},className:'upload-job-time'}));}
  summary.append(element('span',{text:failed?'!':job.status==='complete'?'✓':'…',className:'upload-job-icon',attributes:{'aria-hidden':'true'}}),labels);card.append(summary);
  const step=job.status==='complete'?3:translation?1:failed?({queued:0,recognizing:1,enriching:2}[job.result?.failedPhase]??(job.result?.items?.length?2:1)):({queued:0,recognizing:1,enriching:2,done:3}[phase]??1),steps=element('ol',{className:'upload-steps'});
  (translation?['appUpload_queued','appTranslationStage','appTranslationSaving','appUploadDone']:['appUpload_queued','appUpload_recognizing',job.result?.review?'appGroupReview':job.result?.monitor?.pipeline==='grok-jev'?'appJevClassifying':job.result?.monitor?.pipeline==='gemini-single'?'appSavingRecords':'appUpload_enriching','appUploadDone']).forEach((key,index)=>{const row=element('li',{text:i18n.t(key),className:index<step||job.status==='complete'?'is-complete':index===step?'is-current':''});if(index===step&&job.status==='running')row.setAttribute('aria-current','step');if(index===step&&failed)row.dataset.error='true';steps.append(row);});card.append(steps);
  if(job.total_count>0){const progress=element('progress',{attributes:{max:String(job.total_count),value:String(job.processed_count||0),'aria-label':i18n.t(translation?'appTranslationStage':'appUpload_enriching')}});card.append(progress,element('p',{text:translation?i18n.t('appTranslationProcessing',{done:job.processed_count||0,total:job.total_count}):job.result?.review?i18n.t('appGroupReview'):i18n.t('appUploadDetailsProgress',{done:job.processed_count||0,total:job.total_count}),className:'form-help'}));}
  if(failed)card.append(element('p',{text:translation?i18n.t('appTranslationFailed'):err(new Error(job.error_code||'REQUEST_FAILED')),attributes:{'data-error':'true'}}));
  if(translation&&(failed||issues)){const retry=button(i18n.t('appTranslationRetry'),async()=>{if(retry.disabled)return;retry.disabled=true;const session=current();writes++;renderRoutineLoading();try{const next=await api.post('/v1/supplements/localize',{requestId:crypto.randomUUID(),language:job.language||job.result.language||i18n.language,supplementIds:(job.result.items||[]).filter(i=>i.research!=='complete').map(i=>i.id).slice(0,4)});if(session!==current())return;if(next.id)await observeJobs({job:next,active:next.status==='running'?[...activeJobs.filter(j=>j.id!==next.id),next]:activeJobs},session);await load(false);}catch(error){if(session===current())failure(error);}finally{writes--;renderRoutineLoading();if(session===current())retry.disabled=false;}},'secondary translation-retry');retry.disabled=activeJobs.some(j=>j.result?.kind==='localization');card.append(retry);}
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
 routineJobLoading=active.length>0;renderRoutineLoading();
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
 void ensureLanguage();
}
async function watchJobs(session){
 const marker={};watchedJob=marker;analysisAbort=new AbortController();const signal=analysisAbort.signal;
 const wait=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1200);function abort(){clearTimeout(timer);reject(new Error('AI_JOB_INTERRUPTED'));}signal.addEventListener('abort',abort,{once:true});});
 try{while(session===current()&&activeJobs.length){await wait();const data=await api.get('/v1/supplements/jobs',{signal});if(signal.aborted)return;await observeJobs(data,session,true);}}
 catch(error){if(session===current()&&!signal.aborted){routineJobLoading=false;renderRoutineLoading();failure(error);}}
 finally{if(watchedJob===marker)watchedJob=null;}
}
get('clear-supplements').addEventListener('click',async()=>{
 if(writes||!current())return;
 if(!await confirmDialog(i18n.t('appClearSupplementsConfirm'),{i18n}))return;
 const session=current(),control=get('clear-supplements');control.disabled=true;writes++;renderRoutineLoading();
 try{await api.delete('/v1/supplements',{body:{confirm:true}});if(session!==current())return;resetSession();await load();notify(i18n.t('appClearSupplementsDone'));}
 catch(error){if(session===current())failure(error);}finally{writes--;renderRoutineLoading();control.disabled=false;}
});
get('analyze-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!current())return;
 const form=get('analyze-form'),name=form.elements.name.value.trim();
 if(!name&&!photo.length){status('analysis-status',i18n.t('NAME_OR_PHOTO_REQUIRED'),true);return;}
 const session=current();sending=true;writes++;renderRoutineLoading();renderUploadQueue();form.querySelector('fieldset').disabled=true;
 status('analysis-status',i18n.t('appUploading'));
 try{
  const job=await api.post('/v1/supplements/jobs',{requestId:requestId||crypto.randomUUID(),name,images:photo,language:i18n.language});
  if(session!==current())return;resetAddDraft();modalJobId=job.id;status('analysis-status',i18n.t('appUploadAccepted'));await observeJobs({job,active:[...activeJobs.filter(j=>j.id!==job.id),job]},session);
 }catch(error){if(session===current()){status('analysis-status',err(error),true);form.querySelector('fieldset').disabled=false;}}
 finally{sending=false;writes--;renderRoutineLoading();form.querySelector('fieldset').disabled=false;get('close-add').disabled=false;renderUploadQueue();}
});
get('view-added').addEventListener('click',()=>{const id=addedId;closeAdd();if(id)router.navigate('/detail?id='+encodeURIComponent(id));});
settings.state.subscribe(value=>{
 theme.set(value.theme);i18n.setLanguage(value.language);get('settings-form').elements.language.value=value.language;get('settings-form').elements.theme.value=value.theme;render();if(current())void load();
},true);
network.state.subscribe(()=>render());
// Home, Groups and Account share the main scroller and persistent navigation.
// Details/diagnostics alone are sheets, returning to the originating tab.
function showRoute(path){
 if(starting)return;
 if(restoringSession&&!current()){baseRoute='/';for(const section of document.querySelectorAll('main [data-screen]'))section.hidden=section.dataset.screen!=='/';void routeSheet.close({immediate:true});render();return;}
 if(path!=='/account'&&!current()){location.hash='/account';return;}
 const sheet=['/detail','/diagnostics'].includes(path);
 if(path!=='/account')passwordVisibility.reset();
 if(path==='/detail')detailReturnRoute=get('usage-dialog').open?'/usage':baseRoute;
 if(path==='/usage'||path==='/wellbeing')baseRoute='/account';else if(!sheet)baseRoute=path;document.documentElement.dataset.tab=baseRoute;
 for(const section of document.querySelectorAll('main [data-screen]'))section.hidden=section.dataset.screen!==baseRoute;
 if(sheet)for(const section of get('route-dialog').querySelectorAll('[data-screen]'))section.hidden=section.dataset.screen!==path;
 for(const link of document.querySelectorAll('[data-route]')){if(link.dataset.route===((path==='/usage'||path==='/wellbeing'||baseRoute==='/usage')?'/account':path==='/account'?'/account':baseRoute))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(path==='/diagnostics')get('route-header').querySelector('.detail-name')?.remove();
 if(sheet){get('route-title').textContent=path==='/diagnostics'?i18n.t('appDiagnostics'):'';get('route-dialog').classList.toggle('product-sheet',path==='/detail');get('route-dialog').setAttribute('aria-labelledby',path==='/detail'?'product-detail-title':'route-title');}
 get('route-dialog').querySelector('[data-sheet-close]').hidden=!current();
 if(path==='/wellbeing'){const fresh=!get('wellbeing-dialog').open;wellbeingSheet.open();if(fresh)wellbeing.open();}else void wellbeingSheet.close();
 if(path==='/usage'){const fresh=!get('usage-dialog').open;usageSheet.open();usageCalendar.open({resetScroll:fresh});}
 else if(!(path==='/detail'&&detailReturnRoute==='/usage'))void usageSheet.close();if(path==='/detail')renderDetail();if(path==='/diagnostics')renderDiagnostics();
 if(sheet)routeSheet.open();else {void routeSheet.close().then(()=>{if(!get('route-dialog').open){get('supplement-detail').replaceChildren();get('route-header').querySelector('.detail-name')?.remove();}});if(path!=='/usage'&&path!=='/wellbeing'){if(!document.querySelector('main').dataset.tab||document.querySelector('main').dataset.tab!==path)document.querySelector('main').scrollTop=0;document.querySelector('main').dataset.tab=path;}}
}
let journalLeaving=false;
router=createRouter({beforeNavigate:(next,from)=>{if(current()&&from==='/wellbeing'&&(wellbeing.dirty||wellbeing.saving)){if(!journalLeaving&&!wellbeing.saving){journalLeaving=true;void wellbeing.allowLeave().then(ok=>{if(ok){wellbeing.discard();router.navigate(next);}}).finally(()=>journalLeaving=false);}return false;}return true;},routes:Object.fromEntries(['/', '/groups','/account','/usage','/wellbeing','/detail','/diagnostics'].map(path=>[path,()=>showRoute(path)])),onNotFound:()=>{location.hash=current()?'/':'/account';}});
// The generic router ignores query-only changes; details must follow the item ID.
window.addEventListener('hashchange',()=>{if(router.current==='/detail')renderDetail();});
auth.state.subscribe(async({user})=>{
 const next=user?.id||null;if(next===owner){renderAccount();return;}owner=next;resetSession();if(user)get('profile-form').elements.name.value=user.name;render();
 if(!next){router.navigate('/account');return;}
 const session=next;
 try{await api.post('/v1/bootstrap',{timezone:zone(),language:i18n.language});if(current()!==session)return;await load();router.navigate('/');}
 catch(error){if(current()===session)failure(error);}
},true);
function refreshDay(){
 usageCalendar.refreshDay();void wellbeing.refresh();
 // Native photo pickers fire focus/visibility events even on cancel. The open
 // composer owns that interaction; real upload jobs keep their separate polling.
 if(state.day!==localDay()){state.day=localDay();state.supplements=state.supplements.map(item=>({...item,completed:false,occurrences:item.occurrences?.map(s=>({...s,completed:false}))}));renderHome();}
 if(current()&&document.visibilityState==='visible'&&!get('add-dialog').open)load();
}
function scheduleMidnight(){clearTimeout(midnightTimer);const next=new Date();next.setHours(24,0,0,50);midnightTimer=setTimeout(()=>{refreshDay();scheduleMidnight();},Math.max(50,next-Date.now()));}
scheduleMidnight();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshDay();scheduleMidnight();}});
window.addEventListener('focus',()=>{if(restoringSession&&!current())void auth.restore().catch(failure);else refreshDay();});
let applyUpdate;
pwa=await setupPwa({autoUpdate:true,startupTimeout:4000,canReload:()=>!wellbeing.dirty&&!wellbeing.saving&&!intakeEditor.dirty&&!intakeEditor.busy&&!conclusion.busy&&!routineWizard.dirty&&!routineWizard.saving&&!photo.length&&!sending&&writes===0&&(starting||!document.querySelector('dialog[open], form[aria-busy="true"]'))&&!dirty.some(({tracker})=>tracker.dirty)&&![...document.querySelectorAll('input[type="password"]')].some(node=>node.value),
 // The module owns automatic activation. Calling apply here would count as a
 // manual action and could reload after the launch screen has already closed.
 onUpdate:({apply})=>{applyUpdate=apply;get('update-button').hidden=false;},onError:()=>{}});
// One bounded startup check, including registration/installation/activation.
// Offline or stalled workers release the splash; late updates stay manual.
await pwa.waitForStartup();
pwaReady=true;render();
get('update-button').addEventListener('click',()=>{try{applyUpdate?.();}catch(error){failure(error);}});

/** Read-only owner history, refreshed by the existing polling loop. No extra API
 * requests per clock tick; all provider/model/error text is rendered as text. */
function renderDiagnostics(){
 const root=get('ai-dashboard');if(!root)return;const infoOpen=Boolean(root.querySelector('.diagnostic-ai-info')?.open);root.replaceChildren();if(!current())return;
 const info=element('details',{className:'ai-consent diagnostic-ai-info'}),summary=element('summary');info.open=infoOpen;summary.append(icon('shield'),element('span',{text:i18n.t('appSentWithKey')}),icon('info'));info.append(summary,element('p',{className:'form-help',text:i18n.t('appAiConsent')}));root.append(info);
 const ms=value=>Number.isFinite(value)?(value/1000).toLocaleString(i18n.language,{maximumFractionDigits:2})+' s':'—';
 root.append(element('p',{className:'muted',text:i18n.t('appDiagnosticsHelp')}));
 if(!jobHistory.length){root.append(element('p',{text:i18n.t('appDiagnosticsEmpty')}));return;}
 for(const job of jobHistory){
  const m=job.result?.monitor||{},t=job.result?.timings||m,card=element('article',{className:'surface diagnostics-card',attributes:{'data-diagnostic-job-id':job.id}});
  const title=job.result?.kind==='localization'?i18n.t('appTranslateInfo'):job.result?.submission?.name||i18n.t('appUploadPhoto');card.append(heading(title,'h2'));
  const label=job.status==='running'?i18n.t(m.pipeline==='grok-jev'&&job.phase==='enriching'?'appJevClassifying':(job.result?.monitor?.pipeline==='gemini-single'&&job.phase==='enriching'?(job.result?.monitor?.autoResearch?'appUpload_enriching':'appSavingRecords'):'appUpload_'+(job.phase||'recognizing'))):i18n.t(job.status==='complete'?(job.result?.items?.some(item=>item.research==='failed'||item.status==='failed')?'appUploadDoneIssues':'appUploadDone'):'appUploadFailed');
  card.append(element('p',{className:'research-badge',text:label}));
  if(job.created_at){const date=new Date(job.created_at);if(Number.isFinite(date.getTime()))card.append(element('time',{className:'muted',text:date.toLocaleString(i18n.language)}));}
  const list=element('dl',{className:'diagnostics-grid'});
  const row=(key,value)=>{list.append(element('dt',{text:i18n.t(key)}),element('dd',{text:String(value??'—')}));};
  row('appDiagPipeline',m.pipeline||job.result?.pipeline||job.result?.recognitionModel||'—');
  const localizing=m.pipeline==='gemini-localization',gemini=localizing||m.pipeline==='gemini-single'||job.result?.pipeline==='gemini-single';
  if(gemini){row(localizing?'appTranslateInfo':'appDiagGemini',ms(localizing?t.localizationMs:t.geminiMs));row('appDiagSingleCalls',m.calls);row('appDiagUsage',[m.inputTokens,m.outputTokens,m.thinkingTokens].map(v=>v??'—').join(' / '));}
  else {row('appDiagGrok',ms(t.grokMs));if(m.grokCacheHit)row('appDiagCached',i18n.t('appDiagCachedYes'));row('appDiagJev',ms(t.jevMs));}
  if(t.detailsMs!=null)row('appDiagDetails',ms(t.detailsMs));
  if(job.result?.items?.some(item=>item.research==='queued'||item.research==='researching'||item.research==='complete'&&!item.reused)){const items=job.result.items;row('appDiagResearchProgress',items.filter(i=>i.research==='complete').length+' / '+items.filter(i=>i.research==='failed').length+' / '+items.length);}
  row('appDiagTotal',ms(t.totalMs));
  const from=Date.parse(job.created_at),to=job.status==='running'?Date.now():Date.parse(job.finished_at);
  row('appDiagElapsed',ms(Number.isFinite(from)&&Number.isFinite(to)?Math.max(0,to-from):undefined));
  row('appDiagModels',[m.model,m.grokModel,m.jevModel].filter(Boolean).join(' / ')||'—');
  row('appDiagProducts',m.recognized??job.total_count);
  if(!gemini)row('appDiagCalls',m.grokCalls==null?'—':`${m.grokCalls} / ${m.jevCompleted||0} / ${m.jevBatches||0}`);
  if(!gemini){row('appDiagQuestions',m.questions);row('appDiagTokens',m.jevInputTokens);}
  row('appDiagComposition',m.completeComposition==null?'—':`${m.completeComposition} / ${m.partialComposition} / ${m.unknownComposition}`);
  card.append(list);
  if(job.error_code)card.append(element('p',{className:'status-error',text:err(new Error(job.error_code))+' · '+job.error_code}));
  root.append(card);
 }
}
setInterval(()=>{if(current()&&router?.current==='/diagnostics'&&document.visibilityState==='visible')renderDiagnostics();},1000);
