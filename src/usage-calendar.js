import {element,localDay,productLabel} from './modules/index.js';
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const date=day=>new Date(day+'T12:00:00');
const monday=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
/** Session-only history view. Abort/generation guards prevent old account, date or
 * language responses repainting the current view. No records or calendar caches
 * are persisted. Read-only: clicking a product opens its existing detail sheet. */
export function createUsageCalendar({root,i18n,icon,groupIcon,request,onProduct,onBack,isActive}){
 let selected=localDay(),mode='week',filter='all',data=null,error='',loading=false,epoch=0,controller,language=i18n.language;
 const t=(key,values)=>i18n.t(key,values),text=(tag,value,cls='')=>element(tag,{text:value,className:cls});
 const button=(label,action,cls='',aria=label)=>{const b=element('button',{text:label,className:cls,attributes:{type:'button',...(aria?{'aria-label':aria}:{})}});b.addEventListener('click',action);return b;};
 const format=(day,options)=>new Intl.DateTimeFormat(i18n.language,options).format(date(day));
 const titleDay=day=>{const value=format(day,{month:'long',day:'numeric'});return value[0].toLocaleUpperCase(i18n.language)+value.slice(1);};
 function windowRange(){if(mode==='week'){const from=monday(selected);return {from,to:shift(from,6)};}const first=selected.slice(0,7)+'-01',last=new Date(Date.UTC(+selected.slice(0,4),+selected.slice(5,7),0)).toISOString().slice(0,10),from=monday(first),end=shift(monday(last),6);return {from,to:end};}
 async function refresh(resetScroll=false){
  if(!isActive())return;controller?.abort();controller=new AbortController();const version=++epoch;loading=true;error='';const range=windowRange();if(data?.from!==range.from||data?.to!==range.to)data=null;render();
  try{const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',result=await request('/v1/usage?'+new URLSearchParams({...range,timezone:zone}),{signal:controller.signal});if(version!==epoch)return;data=result;}
  catch(e){if(version!==epoch||e.name==='AbortError')return;error=i18n.message(e?.data?.error||e.message||'REQUEST_FAILED');}
  finally{if(version===epoch){loading=false;render();if(resetScroll)requestAnimationFrame(()=>{if(version===epoch&&isActive())root.closest('main').scrollTop=0;});}}
 }
 function changeDay(day){selected=day;filter='all';const range=windowRange();if(data?.from===range.from&&data.to===range.to)render();else void refresh();}
 function navigate(direction){
  if(mode==='week')selected=shift(selected,direction*7);
  else{const d=date(selected),original=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+direction);const end=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(original,end));selected=localDay(d);}
  filter='all';void refresh();
 }
 function stateGlyph(status){const glyph=element('span',{className:'usage-state usage-state-'+status,attributes:{'aria-hidden':'true'}});if(status==='taken')glyph.append(icon('check'));else if(status==='paused')glyph.append(icon('pause'));else if(status==='missed')glyph.append(text('span','−'));else glyph.append(icon('clock'));return glyph;}
 function productRow(item,paused=false){
  const row=button('',()=>onProduct(item.id),'usage-product'),label=productLabel({name:item.name,manufacturer:item.manufacturer});
  if(!paused)row.append(stateGlyph(item.status));const copy=element('span',{className:'usage-product-copy'});copy.append(text('strong',label.name));
  if(paused){const returning=item.resumeOn?t('appUsageReturns',{date:titleDay(item.resumeOn)}):t('appPausedManual'),historical=(data.days.find(d=>d.day===selected)?.groups||[]).find(g=>g.key===item.groupKey),name=historical?(historical.unknown?t('appUsageUnknownGroup'):historical.name||t('appUnassigned')):'';copy.append(text('small',(name?name+' · ':'')+returning));}else if(label.manufacturer)copy.append(text('small',label.manufacturer));
  row.append(copy);if(!paused){const value=item.status==='taken'?new Intl.DateTimeFormat(i18n.language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:data.timezone}).format(new Date(item.completedAt)):t('appUsageStatus_'+item.status);row.append(text('span',value,'usage-product-time'));}return row;
 }
 function render(){
  language=i18n.language;root.replaceChildren();const wrap=element('div',{className:'usage-calendar',attributes:{'aria-busy':String(loading)}});
  const back=button('',onBack,'usage-back',t('appUsageBack'));back.append(icon('back'));wrap.append(back,text('h1',t('appUsageTitle')));
  const tabs=element('div',{className:'usage-tabs',attributes:{role:'group','aria-label':t('appUsageView')}});
  for(const value of ['week','month']){const b=button(t(value==='week'?'appUsageWeek':'appUsageMonth'),()=>{if(mode===value)return;mode=value;void refresh();});b.dataset.mode=value;b.setAttribute('aria-pressed',String(mode===value));tabs.append(b);}wrap.append(tabs);
  const range=windowRange(),toolbar=element('div',{className:'usage-period'}),prev=button('',()=>navigate(-1),'',t('appUsagePrevious')),next=button('',()=>navigate(1),'',t('appUsageNext'));prev.append(icon('back'));next.append(icon('chevron'));
  const rangeText=mode==='month'?format(selected,{year:'numeric',month:'long'}):new Intl.DateTimeFormat(i18n.language,{month:'long',day:'numeric'}).formatRange(date(range.from),date(range.to));toolbar.append(prev,text('strong',rangeText),next);wrap.append(toolbar);
  const calendar=element('div',{className:'usage-days usage-days-'+mode,attributes:{role:'group','aria-label':t('appUsageSelectDay')}}),today=data?.today||localDay();
  if(mode==='month')for(let i=0;i<7;i++)calendar.append(text('span',format(shift('2026-10-12',i),{weekday:'short'}),'usage-weekday'));
  for(let day=range.from;day<=range.to;day=shift(day,1)){
   const stat=data?.days.find(d=>d.day===day),b=button('',()=>changeDay(day),'usage-day',format(day,{dateStyle:'full'}));b.dataset.day=day;b.setAttribute('aria-pressed',String(selected===day));
   if(day===today)b.setAttribute('aria-current','date');if(day>today)b.classList.add('is-future');if(mode==='month'&&day.slice(0,7)!==selected.slice(0,7))b.classList.add('is-outside');
   if(mode==='week')b.append(text('small',format(day,{weekday:'short'})));b.append(text('strong',String(+day.slice(8))));const marker=element('span',{className:'usage-day-dot',attributes:{'aria-hidden':'true'}});if(stat?.total&&stat.counts.taken)marker.classList.add('has-taken');else if(stat?.counts.missed)marker.classList.add('has-missed');b.append(marker);calendar.append(b);
  }wrap.append(calendar);
  if(loading&&!data){const status=text('p',t('appUsageLoading'),'usage-loading');status.setAttribute('role','status');wrap.append(status);}
  else if(error){const status=text('p',error,'status-error');status.setAttribute('role','alert');wrap.append(status,button(t('appUsageRetry'),()=>void refresh(),'secondary'));}
  else if(data){
   const day=data.days.find(d=>d.day===selected);if(day){
    const summary=element('section',{className:'usage-summary'});summary.append(text('h2',titleDay(selected)),text('p',t('appUsageProgress',{done:day.counts.taken,total:day.total})));
    const bar=element('div',{className:'usage-progress',attributes:{role:'progressbar','aria-label':t('appUsageProgress',{done:day.counts.taken,total:day.total}),'aria-valuemin':'0','aria-valuemax':String(day.total||1),'aria-valuenow':String(day.counts.taken)}}),fill=element('span');fill.style.setProperty('--usage-progress',String(day.total?100*day.counts.taken/day.total:0)+'%');bar.append(fill);summary.append(bar);
    const counts=element('div',{className:'usage-counts'});counts.append(text('span',t('appUsageTakenCount',{count:day.counts.taken})),text('span',t(selected===data.today?'appUsagePendingCount':'appUsageMissedCount',{count:selected===data.today?day.counts.pending:day.counts.missed})));summary.append(counts);wrap.append(summary);
    const filters=element('div',{className:'usage-filters',attributes:{role:'group','aria-label':t('appUsageFilter')}});for(const value of ['all','taken','missed','paused']){const b=button(t('appUsageFilter_'+value),()=>{filter=value;render();});b.dataset.filter=value;b.setAttribute('aria-pressed',String(filter===value));filters.append(b);}wrap.append(filters);
    const visible=day.items.filter(i=>filter==='all'||filter===i.status),active=visible.filter(i=>i.status!=='paused'),paused=visible.filter(i=>i.status==='paused');
    if(active.length){
     const journal=element('section',{className:'usage-journal'}),groups=[...(day.groups||data.groups)];
     const itemKey=item=>item.groupKey??item.groupId,groupKey=group=>group.key??group.id;
     if(active.some(item=>!groups.some(group=>groupKey(group)===itemKey(item))))groups.push({id:null,name:t('appUnassigned')});
     for(const group of groups){const items=active.filter(item=>(groups.some(g=>groupKey(g)===itemKey(item))?itemKey(item):null)===groupKey(group));if(!items.length)continue;
      const section=element('section',{className:'usage-journal-group'}),title=element('h2'),name=group.unknown?t('appUsageUnknownGroup'):group.name||t('appUnassigned');
      title.append(group.unknown||!group.id?icon('info'):groupIcon({...group,name}),text('span',name));section.append(title,...items.map(item=>productRow(item)));journal.append(section);
     }wrap.append(journal);
    }
    if(paused.length){const box=element('section',{className:'usage-paused'}),title=element('h2');title.append(icon('pause-circle'),text('span',t('appUsagePausedCount',{count:paused.length})));box.append(title,...paused.map(i=>productRow(i,true)),text('p',t('appUsagePauseNote'),'usage-pause-note'));wrap.append(box);}
    if(!visible.length){const message=text('p',t(day.future?'appUsageFuture':day.items.length?'appUsageNoMatch':'appUsageEmpty'),'usage-empty');message.setAttribute('role','status');wrap.append(message);}
   }
  }
  root.append(wrap);
 }
 return {open:({resetScroll=false}={})=>void refresh(resetScroll),refreshDay(){if(isActive())void refresh();},languageChanged(){if(language!==i18n.language&&isActive())void refresh();},reset(){epoch++;controller?.abort();data=null;error='';loading=false;selected=localDay();mode='week';filter='all';root.replaceChildren();},render};
}
