/** Account-only routine editor. Drafts stay in memory; owner reset discards them.
 * Uses the shared modal sheets/controls. Saving preferences never starts AI work.
 * Exact times are 15-minute choices; approximate ranges may cross midnight.
 */
import {routineGoals,emptyPersonal} from './routine-options.js';
import {element,createBottomSheet} from './modules/index.js';
const events=['breakfast','lunch','dinner','exercise','sleep'];
const eventIcons={breakfast:'coffee',lunch:'meal',dinner:'bowl',exercise:'training',sleep:'moon'};
const ranges={breakfast:[['early','06:00','08:00'],['morning','08:00','10:00'],['later','10:00','12:00']],lunch:[['early','11:00','13:00'],['day','12:00','14:00'],['later','14:00','16:00']],dinner:[['early','17:00','19:00'],['evening','18:00','20:00'],['later','20:00','22:00']],exercise:[['morning','06:00','10:00'],['day','10:00','17:00'],['evening','17:00','21:00']],sleep:[['early','21:00','23:00'],['later','23:00','01:00'],['late','01:00','03:00']]};
const variable=()=>({mode:'varies',start:null,end:null});
const initial=()=>({version:1,meals:Object.fromEntries(events.slice(0,3).map(k=>[k,{status:null,timing:null}])),exercise:{status:null,frequency:'varies',timing:null},sleep:{timing:null},days:'similar',strategy:'rhythm',restEvening:true});
const clone=v=>structuredClone(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createRoutineWizard({dialog,editorDialog,goalsDialog,i18n,icon,confirm,onSave,onError}){
 const root=dialog.querySelector('[data-routine-content]'),editRoot=editorDialog.querySelector('[data-routine-editor]');
 let personalReviewed=false,goalDraft=[],draft=null,baseline=null,revision=0,step=0,editing=null,editDraft=null,mode='approximate',saving=false,serial=0;
 const t=(k,params)=>i18n.t('appRoutine'+k,params);
 const node=(tag,text,className)=>element(tag,{...(text!==undefined?{text}:{}),...(className?{className}:{})});
 const button=(text,click,className='secondary')=>{const b=node('button',text,className);b.type='button';b.addEventListener('click',click);return b;};
 const glyph=name=>{const span=node('span',undefined,'routine-glyph');span.append(icon(name));return span;};
 const value=(key,source=draft)=>events.indexOf(key)<3?source.meals[key]:source[key];
 function timeLabel(timing){return !timing?t('NotSet'):timing.mode==='varies'?t('VariableTime'):timing.mode==='exact'?timing.start:timing.start+'–'+timing.end;}
 function summary(key){const v=value(key);if(v.status==='no')return t(key==='exercise'?'NoExercise':'Skipped');if(key!=='sleep'&&v.status===null)return t('NotSet');let text=key==='exercise'&&v.timing?.mode==='approximate'?(t('Range_'+(ranges.exercise.find(r=>r[1]===v.timing.start&&r[2]===v.timing.end)?.[0]||'variable'))):timeLabel(v.timing);if(key==='exercise'&&v.status!=='no'&&v.frequency!=='varies')text+=' · '+t('Frequency_'+v.frequency);else if(key==='breakfast'&&v.status==='yes')text+=' · '+t('Eat');if(v.status==='varies')text+=' · '+t('Varies');return text;}
 function choices(values,selected,select,className='routine-choice-row'){
  const row=node('div',undefined,className);row.setAttribute('role','group');
  for(const [v,label] of values){const b=button(label,()=>select(v),'routine-choice');b.setAttribute('aria-pressed',String(v===selected));b.dataset.value=v;row.append(b);}return row;
 }
 function toolbar(close,title){const bar=node('div',undefined,'routine-toolbar routine-heading sheet-header');bar.setAttribute('data-sheet-drag','');const x=button('',close,'icon-button');x.setAttribute('aria-label',t('Close'));x.append(icon('close'));bar.append(title,x);return bar;}
 const sheet=createBottomSheet(dialog,{onDismiss:()=>void dismiss()});
 const goalsSheet=createBottomSheet(goalsDialog);
 const editSheet=createBottomSheet(editorDialog,{onDismiss:()=>void editSheet.close()});
 async function dismiss(){if(saving)return;if(!equal(draft,baseline)&&!await confirm(t('Discard')))return;draft=null;await sheet.close();}
 function complete(){return events.every(k=>{const v=value(k);return (k==='sleep'||['yes','no','varies'].includes(v.status))&&v.timing;});}
 function goto(next){if(next>0&&!complete()){root.querySelector('[data-routine-error]').textContent=t('Complete');return;}if(step===1&&next>1){if(!validPersonalInputs())return;personalReviewed=true;}if(next===2&&!personalReviewed)next=1;step=next;render();dialog.scrollTop=0;root.querySelector('h2')?.focus();}
 function tabs(){const row=node('div',undefined,'routine-tabs');for(const n of [0,1,2]){const b=button(t(['StepDay','StepMe','StepPreferences'][n]),()=>goto(n),'routine-tab');b.setAttribute('aria-current',n===step?'step':'false');if(n<step)b.append(glyph('check'));row.append(b);}return row;}
 function render(){
  if(!draft)return;root.replaceChildren();const title=node('h2',t(step===2?'Preferences':step===1?'StepMe':'Title'));title.tabIndex=-1;title.setAttribute('data-sheet-focus','');
  root.append(toolbar(()=>void dismiss(),title));
  root.append(tabs());
  const body=node('div',undefined,'routine-wizard-body');root.append(body);
  if(!step){
   const timeline=node('div',undefined,'routine-timeline');
   for(const key of events){const row=button('',()=>openEditor(key),'routine-event');row.dataset.routineEvent=key;row.append(glyph(eventIcons[key]));const text=node('span',undefined,'routine-event-text');text.append(node('strong',t('Event_'+key)),node('small',summary(key)));row.append(text,glyph('chevron'));timeline.append(row);}body.append(timeline);
   const days=node('section',undefined,'routine-card routine-days');days.append(node('h3',t('DaysQuestion')),choices([['similar',t('SimilarDays')],['varies',t('ChangingDays')]],draft.days,v=>{draft.days=v;render();}),node('p',t('CanEdit'),'routine-help'));body.append(days);
  }else if(step===1){renderPersonal(body);
  }else{
   const strategies=node('div',undefined,'routine-strategies');
   for(const [key,symbol] of [['rhythm','calendar'],['fewer','chart'],['keep','sliders']]){const b=button('',()=>{draft.strategy=key;render();},'routine-strategy');b.dataset.strategy=key;b.setAttribute('aria-pressed',String(draft.strategy===key));b.append(glyph(symbol));const text=node('span');text.append(node('strong',t('Strategy_'+key)),node('small',t('StrategyHelp_'+key)));b.append(text,node('span',undefined,'routine-radio'));strategies.append(b);}body.append(strategies);
   const rest=button('',()=>{draft.restEvening=!draft.restEvening;render();},'routine-rest');rest.setAttribute('role','switch');rest.setAttribute('aria-checked',String(draft.restEvening));rest.append(glyph('moon'));const restText=node('span');restText.append(node('strong',t('RestEvening')),node('small',t('RestHelp')));rest.append(restText,node('span',undefined,'routine-switch'));body.append(rest);
   const recap=node('section',undefined,'routine-card routine-recap'),heading=node('div',undefined,'routine-recap-heading');heading.append(node('h3',t('YourChoices')),button(t('Edit'),()=>goto(0),'routine-edit-link'));recap.append(heading);
   recap.append(node('p',t('Meals')+' '+events.slice(0,3).map(k=>value(k).status==='no'?t('Skipped'):timeLabel(value(k).timing)).join(' · '),'routine-recap-copy'),node('p',t('Event_exercise')+' '+summary('exercise')+' · '+t('Event_sleep')+' '+timeLabel(draft.sleep.timing),'routine-recap-copy'));body.append(recap);
  }
  const error=node('p','','routine-error');error.setAttribute('role','alert');error.dataset.routineError='';root.append(error);
  const footer=node('div',undefined,'routine-wizard-actions');const save=button(t(step===2?'SaveRoutine':'Next'),()=>step===2?void saveRoutine():goto(step+1),'primary');save.disabled=saving;footer.append(save);root.append(footer);
 }

 function validPersonalInputs(){
  for(const input of root.querySelectorAll('[data-personal-input]'))if(!input.disabled&&!input.reportValidity())return false;
  const p=draft.personal;if(p.muscleKg!==null&&p.weightKg!==null&&p.muscleKg>p.weightKg){root.querySelector('[data-routine-error]').textContent=t('MuscleInvalid');return false;}return true;
 }
 function renderPersonal(body){
  const card=node('section',undefined,'routine-card routine-personal');
  const p=draft.personal;
  const sex=node('label',undefined,'routine-personal-field');sex.append(node('span',t('Sex')));const select=node('select');select.setAttribute('aria-label',t('Sex'));for(const [v,k]of [['','Unspecified'],['female','Female'],['male','Male'],['other','Other']]){const o=node('option',t(k));o.value=v;select.append(o);}select.value=p.sex||'';select.addEventListener('change',()=>p.sex=select.value||null);sex.append(select);card.append(sex);
  for(const [key,label,type,min,max]of [['birthDate','BirthDate','date','1900-01-01',new Date().toISOString().slice(0,10)],['heightCm','Height','number',40,260],['weightKg','Weight','number',2,500],['muscleKg','Muscle','number',1,250]]){
   const field=node('div',undefined,'routine-personal-field');field.append(node('label',t(label)));const choice=node('select');choice.setAttribute('aria-label',t(label)+' · '+t('Disclosure'));choice.dataset.personalChoice=key;for(const [v,k]of [['','Unspecified'],['set','Specify']]){const o=node('option',t(k));o.value=v;choice.append(o);}choice.value=p[key]===null?'':'set';
   const input=node('input');input.type=type;input.dataset.personalInput=key;input.setAttribute('aria-label',t(label));input.min=min;input.max=max;if(type==='number'){input.step='0.1';input.inputMode='decimal';}input.value=p[key]??'';input.disabled=input.hidden=p[key]===null;input.required=true;
   choice.addEventListener('change',()=>{const enabled=choice.value==='set';input.disabled=input.hidden=!enabled;if(!enabled){p[key]=null;input.value='';}else input.focus();});input.addEventListener('input',()=>p[key]=input.value===''?null:type==='number'?Number(input.value):input.value);field.append(choice,input);card.append(field);
  }
  card.append(node('p',t('MuscleHelp'),'routine-help'));body.append(card);
  const goals=button('',openGoals,'routine-card routine-goals-open');goals.append(glyph('target'));const text=node('span');text.append(node('strong',t('Goals')),node('small',p.goals.length?p.goals.map(k=>t('Goal_'+k)).join(' · '):t('Unspecified')));goals.append(text,glyph('chevron'));body.append(goals);
  const consent=button('',()=>{p.allowAI=!p.allowAI;render();},'routine-rest');consent.setAttribute('role','switch');consent.setAttribute('aria-label',t('AllowAI'));consent.setAttribute('aria-checked',String(p.allowAI));consent.append(glyph('shield'));const copy=node('span');copy.append(node('strong',t('AllowAI')),node('small',t('AllowHelp')));consent.append(copy,node('span',undefined,'routine-switch'));body.append(consent);
 }
 function openGoals(){goalDraft=[...draft.personal.goals];renderGoals();void goalsSheet.open();}
 function renderGoals(){
  const panel=goalsDialog.querySelector('[data-routine-goals]');panel.replaceChildren();const header=node('div',undefined,'sheet-header');header.setAttribute('data-sheet-drag','');const title=node('h2',t('Goals'));title.tabIndex=-1;title.setAttribute('data-sheet-focus','');const close=button('',()=>void goalsSheet.close(),'icon-button');close.setAttribute('aria-label',t('Close'));close.append(icon('close'));header.append(title,close);panel.append(header,node('p',t('GoalsHelp'),'routine-help'));
  const count=node('p',t('GoalsCount',{count:goalDraft.length}),'routine-goal-count');count.setAttribute('role','status');panel.append(count);
  const chips=node('div',undefined,'routine-goal-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label',t('Goals'));
  for(const key of ['',...routineGoals]){const selected=key?goalDraft.includes(key):!goalDraft.length;const b=button(t(key?'Goal_'+key:'Unspecified'),()=>{goalDraft=key?(selected?goalDraft.filter(g=>g!==key):[...goalDraft,key]):[];renderGoals();},'routine-choice');b.dataset.goal=key;b.setAttribute('aria-pressed',String(selected));b.disabled=Boolean(key&&!selected&&goalDraft.length>=3);chips.append(b);}panel.append(chips);
  panel.append(button(t('Save'),async()=>{const version=serial;draft.personal.goals=[...goalDraft];await goalsSheet.close();if(version!==serial||!draft)return;render();root.querySelector('.routine-goals-open')?.focus({preventScroll:true});},'primary routine-goals-save'));
 }
 function openEditor(key){editing=key;editDraft=clone(value(key));if(key!=='sleep'&&editDraft.status===null)editDraft.status='yes';mode=editDraft.timing?.mode==='exact'?'exact':'approximate';renderEditor();void editSheet.open();}
 function renderEditor(){
  editRoot.replaceChildren();const handle=node('div');handle.setAttribute('data-sheet-handle','');editRoot.append(handle);
  const header=node('div',undefined,'routine-editor-heading sheet-header');const title=node('h2',t('Edit_'+editing));title.tabIndex=-1;title.setAttribute('data-sheet-focus','');const close=button('',()=>void editSheet.close(),'icon-button');close.setAttribute('aria-label',t('Close'));close.append(icon('close'));header.append(title,close);editRoot.append(header);
  if(editing==='exercise')editRoot.append(node('h3',t('ExerciseQuestion'),'routine-subheading'));
  if(editing!=='sleep')editRoot.append(choices([['yes',t(editing==='exercise'?'Yes':'Eat')],['no',t(editing==='exercise'?'No':'DoNotEat')],['varies',t('Varies')]],editDraft.status,v=>{editDraft.status=v;if(v==='no'){editDraft.timing=variable();if(editing==='exercise')editDraft.frequency='varies';}renderEditor();},'routine-choice-row routine-presence'));
  if(editDraft.status!=='no'){
   if(editing==='exercise'){const label=node('label',undefined,'routine-frequency');label.append(node('span',t('Frequency')));const select=node('select');select.setAttribute('aria-label',t('Frequency'));for(const v of ['1-2','2-3','4-5','daily','varies']){const opt=node('option',t('Frequency_'+v));opt.value=v;select.append(opt);}select.value=editDraft.frequency;select.addEventListener('change',()=>{editDraft.frequency=select.value;});label.append(select);editRoot.append(label);}
   editRoot.append(node('h3',t('Precision'),'routine-subheading'),choices([['approximate',t('Approximate')],['exact',t('Exact')]],mode,v=>{mode=v;if(v==='exact'&&editDraft.timing?.mode!=='exact')editDraft.timing={mode:'exact',start:editDraft.timing?.start||'08:00',end:null};renderEditor();},'routine-time-mode'));
   if(mode==='approximate'){
    const grid=node('div',undefined,'routine-range-grid');
    for(const [name,start,end] of [...ranges[editing],['variable',null,null]]){const selected=name==='variable'?editDraft.timing?.mode==='varies':editDraft.timing?.mode==='approximate'&&editDraft.timing.start===start&&editDraft.timing.end===end;const b=button('',()=>{editDraft.timing=name==='variable'?variable():{mode:'approximate',start,end};renderEditor();},'routine-range');b.dataset.range=name;b.setAttribute('aria-pressed',String(selected));b.append(node('strong',t('Range_'+name)),node('small',name==='variable'?t('NoFixedTime'):start+'–'+end));if(selected)b.append(glyph('check'));grid.append(b);}editRoot.append(grid);
   }
   const precise=node('label',undefined,'routine-exact');precise.append(glyph('clock'),node('span',t('ExactTime')));const select=node('select');select.setAttribute('aria-label',t('ExactTime'));const blank=node('option',t('Choose'));blank.value='';select.append(blank);for(let n=0;n<96;n++){const v=String(Math.floor(n/4)).padStart(2,'0')+':'+String(n%4*15).padStart(2,'0');const opt=node('option',v);opt.value=v;select.append(opt);}select.value=editDraft.timing?.start||'';select.addEventListener('change',()=>{if(!select.value)return;editDraft.timing={mode:'exact',start:select.value,end:null};mode='exact';renderEditor();});precise.append(select);editRoot.append(precise);
  }
  editRoot.append(node('p',t(editing==='exercise'?'ExerciseHelp':editing==='sleep'?'SleepHelp':'SkipHelp'),'routine-help'));
  const note=node('p',undefined,'routine-editor-note');note.append(glyph('info'),node('span',t('EditorNote')));editRoot.append(note);
  const error=node('p','','routine-error');error.setAttribute('role','alert');error.dataset.editorError='';editRoot.append(error);
  const actions=node('div',undefined,'button-row routine-editor-actions');actions.append(button(t('Cancel'),()=>void editSheet.close(),'secondary'),button(t('Save'),()=>{if(!editDraft.timing){error.textContent=t('ChooseTime');return;}if(editing==='sleep')draft.sleep=clone(editDraft);else if(editing==='exercise')draft.exercise=clone(editDraft);else draft.meals[editing]=clone(editDraft);render();void editSheet.close();},'primary'));editRoot.append(actions);
 }
 async function saveRoutine(){if(saving||!complete())return;const version=serial;saving=true;render();try{const saved=await onSave(clone(draft),revision);if(version!==serial)return;if(saved===false)return;baseline=clone(draft);await sheet.close();}catch(error){if(version===serial){root.querySelector('[data-routine-error]').textContent=onError(error);}}finally{if(version===serial){saving=false;root.querySelector('.routine-wizard-actions button').disabled=false;}}}
 return {open({routine=null,routineRevision=0,firstIncomplete=false}={}){serial++;draft={...clone(routine||initial()),version:2,personal:clone(routine?.personal||emptyPersonal())};baseline=clone(draft);revision=routineRevision;personalReviewed=routine?.version===2;step=firstIncomplete&&routine?.version===1?1:0;saving=false;render();void sheet.open();},reset(){serial++;goalDraft=[];personalReviewed=false;editing=null;editDraft=null;draft=null;baseline=null;saving=false;editRoot.replaceChildren();root.replaceChildren();void goalsSheet.close({immediate:true});goalsDialog.querySelector('[data-routine-goals]').replaceChildren();void editSheet.close({immediate:true});void sheet.close({immediate:true});},get dirty(){return Boolean(draft&&!equal(draft,baseline));},get saving(){return saving;}};
}
