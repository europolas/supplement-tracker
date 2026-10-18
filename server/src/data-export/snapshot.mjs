/** Owner-only point-in-time export. No provider, raw analysis, secret or public file.
 * Period observations are historical; routine/current inventory are clearly marked
 * as export-day values because the app has no past routine-profile versions. */
import {ApiError} from '../security.mjs';
import {usageRange,localMidnight,addDay,dayInZone} from '../usage-calendar.mjs';
import {dateOnly} from '../supplement-pause.mjs';
import {validScore,conclusionDisplayText} from '../routine-conclusion.mjs';
const json=v=>typeof v==='string'?JSON.parse(v):v;
export function exportRange(body,now){
 if(!body||Object.keys(body).some(k=>!['from','to','timezone','language'].includes(k))||typeof body.timezone!=='string')throw new ApiError(400,'INVALID_EXPORT_RANGE');
 try{new Intl.DateTimeFormat('en',{timeZone:body.timezone}).format(now);}catch{throw new ApiError(400,'INVALID_EXPORT_RANGE');}
 let from,to;try{({from,to}=usageRange(new URLSearchParams({from:body.from||'',to:body.to||''}),366));}catch{throw new ApiError(400,'INVALID_EXPORT_RANGE');}
 if(from<'2000-01-01'||to>dayInZone(now,body.timezone)||!['en','lt'].includes(body.language))throw new ApiError(400,'INVALID_EXPORT_RANGE');
 return {from,to,timezone:body.timezone,language:body.language};
}
export async function exportSnapshot(tracker,user,body){
 const now=tracker.now(),range=exportRange(body,now),start=localMidnight(range.from,range.timezone),end=localMidnight(addDay(range.to,1),range.timezone);
 return tracker.auth.transaction(async db=>{
  const [owners]=await db.execute('SELECT id,name FROM users WHERE id=? FOR UPDATE',[user.id]);if(!owners.length)throw new ApiError(401,'SESSION_EXPIRED');
  const query=new URLSearchParams({from:range.from,to:range.to,timezone:range.timezone});
  const usage=await tracker.usage(user.id,query,{db,maxDays:366});
  const [preferences]=await db.execute('SELECT routine FROM tracker_preferences WHERE user_id=?',[user.id]);
  const [inventory]=await db.execute('SELECT id,name,group_id,analysis,intake_plan,deleted_at FROM supplements WHERE user_id=? ORDER BY created_at,id',[user.id]);
  const [wellbeing]=await db.execute('SELECT local_day,mood,sleep,energy,digestion FROM wellbeing_entries WHERE user_id=? AND local_day BETWEEN ? AND ? ORDER BY local_day',[user.id,range.from,range.to]);
  const [history]=await db.execute('SELECT report FROM routine_conclusion_history WHERE user_id=? AND created_at>=? AND created_at<? ORDER BY created_at DESC,id DESC LIMIT 1001',[user.id,start,end]);
  if(history.length>1000)throw new ApiError(400,'EXPORT_TOO_LARGE');
  const [last]=await db.execute('SELECT report FROM routine_conclusion_history WHERE user_id=? AND created_at<? ORDER BY created_at DESC,id DESC LIMIT 1',[user.id,end]);
  const included=new Set(usage.days.flatMap(d=>d.items.map(i=>i.id))),labels=new Map(usage.days.flatMap(d=>d.items.filter(i=>i.status==='taken').map(i=>[i.id,{name:d.groups.find(g=>g.key===i.groupKey)?.name||null}])));
  const products=inventory.filter(p=>!p.deleted_at||included.has(p.id)).map(p=>({id:p.id,name:p.name,manufacturer:json(p.analysis)?.manufacturer||'',groupName:p.deleted_at?labels.get(p.id)?.name||null:usage.groups.find(g=>g.id===p.group_id)?.name||null,groupId:p.group_id,plan:json(p.intake_plan),deleted:Boolean(p.deleted_at)}));
  const saved=last[0]?json(last[0].report):null;
  return {...range,generatedAt:now.toISOString(),name:owners[0].name,routine:preferences[0]?.routine?json(preferences[0].routine):null,products,groups:usage.groups.map(g=>({id:g.id,name:g.name,count:products.filter(p=>!p.deleted&&p.groupId===g.id).length})),usage:usage.days.map(d=>({day:d.day,counts:d.counts,total:d.total})),wellbeing:wellbeing.map(d=>({...d,local_day:dateOnly(d.local_day)})),conclusion:saved?{createdAt:saved.createdAt,language:saved.language,score:validScore(saved.score)?saved.score:null,sections:Object.fromEntries(Object.entries(saved.sections).filter(([k])=>['overview','benefits','overlaps','research','recommendations'].includes(k)).map(([k,v])=>[k,conclusionDisplayText(v)]))}:null,history:history.map(row=>{const r=json(row.report);return {id:r.id,createdAt:r.createdAt,score:validScore(r.score)?r.score.value:null};}).filter(r=>r.createdAt!==saved?.createdAt||r.id!==saved?.id)};
 });
}
