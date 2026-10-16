/** Owner-scoped read model. Completion wins over a pause; future dates and days
 * before a product existed never become missed doses. Groups/identity are current
 * inventory labels, since the older database did not record their historical edits.
 * Past pauses are sampled at day end; today uses now, so manual resume is immediate.
 */
import {ApiError} from './security.mjs';
import {dateOnly} from './supplement-pause.mjs';
export const dayInZone=(value,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
export const addDay=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function usageRange(query){const from=query.get('from'),to=query.get('to');if(!validDay(from)||!validDay(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>41)throw new ApiError(400,'INVALID_CALENDAR_RANGE');return {from,to};}
// Convert a local midnight, not a fixed 24-hour subtraction: DST days vary in length.
export function localMidnight(day,zone){const desired=Date.parse(day+'T00:00:00Z');let stamp=desired;const format=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(let i=0;i<4;i++){const p=Object.fromEntries(format.formatToParts(new Date(stamp)).map(p=>[p.type,p.value])),local=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second),delta=desired-local;if(!delta)break;stamp+=delta;}return new Date(stamp);}
export function usageCalendar({from,to,zone,now,products,groups,completions,pauses}){
 const today=dayInZone(now,zone),records=new Map(completions.map(c=>[c.supplement_id+':'+dateOnly(c.local_day),c])),periods=new Map();
 for(const p of pauses){if(!periods.has(p.supplement_id))periods.set(p.supplement_id,[]);periods.get(p.supplement_id).push(p);}
 const days=[];
 for(let day=from;day<=to;day=addDay(day,1)){
  const future=day>today,cutoff=day===today?now:new Date(+localMidnight(addDay(day,1),zone)-1),items=[];
  if(!future)for(const product of products){
   const completion=records.get(product.id+':'+day);if(!completion&&new Date(product.created_at)>cutoff)continue;
   const pause=(periods.get(product.id)||[]).find(p=>new Date(p.started_at)<=cutoff&&(!p.resumed_at||new Date(p.resumed_at)>cutoff)&&(!p.resume_on||dayInZone(cutoff,p.timezone)<dateOnly(p.resume_on)));
   const analysis=typeof product.analysis==='string'?JSON.parse(product.analysis):product.analysis;
   items.push({id:product.id,name:product.name,manufacturer:analysis.manufacturer||'',groupId:product.group_id,status:completion?'taken':pause?'paused':day===today?'pending':'missed',completedAt:completion?new Date(completion.completed_at).toISOString():null,resumeOn:pause?dateOnly(pause.resume_on):null});
  }
  const counts=Object.fromEntries(['taken','missed','pending','paused'].map(s=>[s,items.filter(i=>i.status===s).length]));days.push({day,future,items,counts,total:items.length-counts.paused});
 }
 return {from,to,today,timezone:zone,groups,days};
}
