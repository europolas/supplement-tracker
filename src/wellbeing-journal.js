/** Session-only journal editor matching the selected mobile reference.
 * Owner/date generations and aborts reject stale reads and writes. Drafts are
 * explicit: navigating dates/closing asks before discard; save conflicts retain
 * text. No personal journal data enters storage, logs, AI or supplement writes.
 */
import {element,localDay} from './modules/index.js';
import {createRatingGroup} from './modules/rating-group.js';
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const monday=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
const date=day=>new Date(day+'T12:00:00');
const observations=['more_energy','better_sleep','fatigue','bloating','headache','other'];
const blank=()=>({mood:null,sleep:null,energy:null,digestion:null,observations:[],notes:''});
export function createWellbeingJournal({root,i18n,icon,request,confirm,isActive,today=()=>localDay()}){
 let selected=today(),data=null,draft=blank(),revision=0,dirty=false,saving=false,loading=false,error='',message='',epoch=0,controller,ratings=[],language=i18n.language,confirmation=null;
 const t=(key,values)=>i18n.t(key,values),make=(tag,text,cls)=>element(tag,{text,className:cls}),button=(label,action,cls='')=>element('button',{text:label,className:cls,attributes:{type:'button'},on:{click:action}});
 const format=(day,options)=>new Intl.DateTimeFormat(i18n.language,options).format(date(day));
 const currentDay=()=>data?.today||today();
 const releaseRatings=()=>{ratings.forEach(r=>r.destroy());ratings=[];};
 function face(value){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.1','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  const part=(name,attrs)=>{const n=document.createElementNS(svg.namespaceURI,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);};part('circle',{cx:12,cy:12,r:10.5});for(const x of [8.5,15.5])part('circle',{cx:x,cy:9.4,r:.55,fill:'currentColor',stroke:'none'});
  part('path',{d:['M7 17q5-7 10 0 M6.5 7.2 9 8 M15 8l2.5-.8','M8 16q4-4 8 0','M8 15h8','M7.5 14q4.5 7 9 0','M7.5 13.5h9c0 7-9 7-9 0'][value-1]});return svg;
 }
 function setDraft(){const record=data?.days.find(d=>d.day===selected)?.entry;revision=record?.revision||0;draft=record?Object.fromEntries(Object.keys(blank()).map(k=>[k,structuredClone(record[k])])):blank();dirty=false;}
 function noteChange(){dirty=true;message='';const status=root.querySelector('.wellbeing-status');if(status)status.textContent='';busyState();}
 function busyState(){for(const c of root.querySelectorAll('button,textarea'))c.disabled=saving||loading||c.dataset.future==='true';const save=root.querySelector('.wellbeing-save');if(save&&!revision&&!['mood','sleep','energy','digestion'].some(k=>draft[k]!==null)&&!draft.observations.length&&!draft.notes.trim())save.disabled=true;root.setAttribute('aria-busy',String(saving||loading));}
 function render({restoreScroll=false}={}){
  const scroller=root.closest('dialog'),scroll=scroller?.scrollTop||0;releaseRatings();root.replaceChildren();language=i18n.language;
  const dayNav=make('div',undefined,'wellbeing-date-nav'),prev=button('',()=>void changeDay(shift(selected,-1)),'wellbeing-date-arrow'),next=button('',()=>void changeDay(shift(selected,1)),'wellbeing-date-arrow');prev.append(icon('back'));next.append(icon('chevron'));prev.setAttribute('aria-label',t('appJournalPrevious'));next.setAttribute('aria-label',t('appJournalNext'));prev.dataset.future=String(selected<='2000-01-01');next.dataset.future=String(selected>=currentDay());
  const title=format(selected,{month:'long',day:'numeric'});dayNav.append(prev,make('strong',selected===currentDay()?t('appJournalToday',{date:title}):format(selected,{year:'numeric',month:'long',day:'numeric'})),next);root.append(dayNav);
  const days=make('div',undefined,'wellbeing-week');days.setAttribute('role','group');days.setAttribute('aria-label',t('appJournalChooseDay'));
  const from=monday(selected);for(let day=from;day<=shift(from,6);day=shift(day,1)){const value=day,b=button('',()=>void changeDay(value),'wellbeing-day');b.dataset.day=day;b.dataset.future=String(day>currentDay()||day<'2000-01-01');b.setAttribute('aria-pressed',String(day===selected));b.setAttribute('aria-label',format(day,{dateStyle:'full'}));if(day===currentDay())b.setAttribute('aria-current','date');b.append(make('span',format(day,{weekday:'short'}).replace(/^./,letter=>letter.toLocaleUpperCase(i18n.language))),make('strong',String(+day.slice(8))));days.append(b);}root.append(days);
  if(error){const box=make('div',undefined,'wellbeing-error');box.append(element('p',{text:error,attributes:{role:'alert'}}),button(t(dirty?'appJournalReload':'appUsageRetry'),()=>void reload(),'secondary'));root.append(box);}
  if(loading&&!data){const p=make('p',t('appJournalLoading'),'wellbeing-loading');p.setAttribute('role','status');root.append(p);busyState();return;}
  if(!data){busyState();return;}
  const form=element('form',{className:'wellbeing-form',attributes:{'data-wellbeing-form':''}}),mood=make('section',undefined,'wellbeing-card wellbeing-mood');mood.append(make('h3',t('appJournalHow')));
  const moodRoot=make('div',undefined,'wellbeing-rating wellbeing-face-rating');moodRoot.dataset.field='mood';mood.append(moodRoot);ratings.push(createRatingGroup({root:moodRoot,label:t('appJournalHow'),labels:[1,2,3,4,5].map(v=>t('appJournalMood_'+v)),value:draft.mood,renderOption:face,onChange:v=>{draft.mood=v;noteChange();}}));
  const extremes=make('div',undefined,'wellbeing-extremes');extremes.append(make('span',t('appJournalPoor')),make('span',t('appJournalGreat')));mood.append(extremes);form.append(mood);
  const metrics=make('section',undefined,'wellbeing-card wellbeing-metrics');
  for(const [field,glyph]of [['sleep','moon'],['energy','bolt'],['digestion','leaf']]){const row=make('div',undefined,'wellbeing-metric'),title=make('div',undefined,'wellbeing-metric-label'),label=t('appJournal_'+field);title.append(icon(glyph),make('span',label));const options=make('div',undefined,'wellbeing-rating wellbeing-dot-rating');options.dataset.field=field;ratings.push(createRatingGroup({root:options,label,labels:[1,2,3,4,5].map(value=>t('appJournalRating',{label,value})),value:draft[field],renderOption:()=>make('span',undefined,'wellbeing-dot'),onChange:v=>{draft[field]=v;noteChange();}}));row.append(title,options);metrics.append(row);}form.append(metrics);
  const noticed=make('section',undefined,'wellbeing-observations');noticed.append(make('h3',t('appJournalNoticed')));const toggles=make('div',undefined,'wellbeing-tags');toggles.setAttribute('role','group');toggles.setAttribute('aria-label',t('appJournalNoticed'));
  for(const id of observations){const selected=draft.observations.includes(id),b=button('',()=>{const active=draft.observations.includes(id);draft.observations=active?draft.observations.filter(v=>v!==id):observations.filter(v=>v===id||draft.observations.includes(v));noteChange();render({restoreScroll:true});},'wellbeing-tag');b.dataset.observation=id;b.setAttribute('aria-pressed',String(selected));if(selected)b.append(icon('check'));b.append(make('span',t('appJournalObservation_'+id)));toggles.append(b);}noticed.append(toggles);form.append(noticed);
  const notes=element('textarea',{className:'wellbeing-notes',attributes:{name:'notes',rows:3,maxlength:1000,placeholder:t('appJournalNotes'),'aria-label':t('appJournalNotes')}});notes.value=draft.notes;notes.addEventListener('input',()=>{draft.notes=notes.value;noteChange();});form.append(notes);
  const record=data.days.find(d=>d.day===selected),summary=make('p',undefined,'wellbeing-intake-summary');summary.append(icon('check'),make('span',t(selected===currentDay()?'appJournalIntakesToday':'appJournalIntakes',{done:record?.taken||0,total:record?.total||0})));form.append(summary);
  const status=make('p',message,'wellbeing-status');status.setAttribute('role','status');status.hidden=!message;const submit=element('button',{text:t(saving?'appJournalSaving':'save'),className:'primary wellbeing-save',attributes:{type:'submit'}});form.append(status,submit);form.addEventListener('submit',event=>{event.preventDefault();void save();});root.append(form);busyState();
  if(restoreScroll&&scroller)scroller.scrollTop=scroll;
 }
 async function refresh(){
  if(!isActive()||dirty||saving)return;controller?.abort();controller=new AbortController();const version=++epoch;loading=true;error='';render({restoreScroll:true});const from=monday(selected),timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  try{const result=await request('/v1/wellbeing?'+new URLSearchParams({from,to:shift(from,6),timezone}),{signal:controller.signal});if(version!==epoch||!isActive())return;data=result;if(selected>result.today)selected=result.today;setDraft();}
  catch(e){if(version!==epoch||e.name==='AbortError')return;error=i18n.message(e?.data?.error||e.message||'REQUEST_FAILED');}
  finally{if(version===epoch){loading=false;render({restoreScroll:true});}}
 }
 async function reload(){if(!await allowLeave())return;dirty=false;data=null;await refresh();}
 async function allowLeave(){if(saving)return false;if(!dirty)return true;if(confirmation)return confirmation;const version=epoch;confirmation=Promise.resolve(confirm(t('appJournalDiscard'))).then(ok=>Boolean(ok&&version===epoch)).finally(()=>confirmation=null);return confirmation;}
 async function changeDay(day){if(day>currentDay()||day<'2000-01-01'||day===selected||loading||saving)return;if(!await allowLeave())return;dirty=false;message='';error='';selected=day;if(data?.days.some(d=>d.day===day)){setDraft();render();}else{data=null;await refresh();}}
 async function save(){
  if(saving||loading||!data)return;
  const version=epoch,day=selected;saving=true;error='';message='';busyState();const submit=root.querySelector('.wellbeing-save');submit.textContent=t('appJournalSaving');
  try{const result=await request('/v1/wellbeing/'+day,{method:'PUT',body:{entry:structuredClone(draft),revision,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}});if(version!==epoch||!isActive())return;const record=data.days.find(d=>d.day===day);record.entry=result.entry;setDraft();message=t('appJournalSaved');}
  catch(e){if(version!==epoch)return;error=i18n.message(e?.data?.error||e.message||'REQUEST_FAILED');}
  finally{if(version===epoch){saving=false;render({restoreScroll:true});}}
 }
 return {open(){selected=today();data=null;draft=blank();revision=0;dirty=false;message='';void refresh();},refresh,allowLeave,discard(){dirty=false;},get dirty(){return dirty;},get saving(){return saving;},languageChanged(){if(language!==i18n.language&&isActive())render({restoreScroll:true});},reset(){epoch++;controller?.abort();releaseRatings();data=null;draft=blank();revision=0;dirty=false;saving=false;loading=false;error='';message='';selected=today();root.replaceChildren();},destroy(){this.reset();}};
}
