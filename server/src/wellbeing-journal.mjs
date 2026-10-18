/** Private owner/day notes; no AI, supplement mutation or inferred health claims.
 * Read joins owned immutable usage projections only for the daily intake summary.
 * Owner lock serializes insert/update and account deletion; revisions prevent a
 * second device silently overwriting an entry. Blank saves explicitly clear text.
 */
import {ApiError} from './security.mjs';
import {usageRange,addDay} from './usage-calendar.mjs';
import {dateOnly} from './supplement-pause.mjs';
export const observationIds=Object.freeze(['more_energy','better_sleep','fatigue','bloating','headache','other']);
export function normalizeWellbeing(value){
 const fields=['mood','sleep','energy','digestion','observations','notes'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k))||fields.slice(0,4).some(k=>!(value[k]===null||Number.isInteger(value[k])&&value[k]>=1&&value[k]<=5))||!Array.isArray(value.observations)||value.observations.length>observationIds.length||value.observations.some(v=>!observationIds.includes(v))||new Set(value.observations).size!==value.observations.length||typeof value.notes!=='string'||value.notes.length>1000)throw new ApiError(400,'INVALID_WELLBEING_ENTRY');
 return {...Object.fromEntries(fields.slice(0,4).map(k=>[k,value[k]])),observations:observationIds.filter(id=>value.observations.includes(id)),notes:value.notes.trim()};
}
const serialize=row=>row?{mood:row.mood,sleep:row.sleep,energy:row.energy,digestion:row.digestion,observations:typeof row.observations==='string'?JSON.parse(row.observations):row.observations,notes:row.notes,revision:Number(row.revision),updatedAt:new Date(row.updated_at).toISOString()}:null;
export async function readWellbeing(tracker,owner,query){
 const {from,to}=usageRange(query),history=await tracker.usage(owner,query);
 const [rows]=await tracker.pool.execute('SELECT local_day,mood,sleep,energy,digestion,observations,notes,revision,updated_at FROM wellbeing_entries WHERE user_id=? AND local_day BETWEEN ? AND ? ORDER BY local_day',[owner,from,to]);
 const entries=new Map(rows.map(r=>[dateOnly(r.local_day),serialize(r)]));
 return {from,to,today:history.today,days:history.days.map(d=>({day:d.day,future:d.future,entry:entries.get(d.day)||null,taken:d.counts.taken,total:d.total}))};
}
export async function saveWellbeing(tracker,owner,day,body,zone,today){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day))||addDay(day,0)!==day||day<'2000-01-01'||day>today)throw new ApiError(400,'INVALID_JOURNAL_DAY');
 if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new ApiError(400,'INVALID_INPUT');
 const entry=normalizeWellbeing(body.entry);
 return tracker.auth.transaction(async db=>{
  await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
  const [rows]=await db.execute('SELECT revision FROM wellbeing_entries WHERE user_id=? AND local_day=? FOR UPDATE',[owner,day]);
  if((Number(rows[0]?.revision)||0)!==body.revision)throw new ApiError(409,'WELLBEING_CHANGED');
  const values=['mood','sleep','energy','digestion'].map(k=>entry[k]),updated=tracker.now();
  if(rows.length)await db.execute('UPDATE wellbeing_entries SET mood=?,sleep=?,energy=?,digestion=?,observations=?,notes=?,revision=revision+1,timezone=?,updated_at=? WHERE user_id=? AND local_day=?',[...values,JSON.stringify(entry.observations),entry.notes,zone,updated,owner,day]);
  else await db.execute('INSERT INTO wellbeing_entries(user_id,local_day,mood,sleep,energy,digestion,observations,notes,timezone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[owner,day,...values,JSON.stringify(entry.observations),entry.notes,zone,updated,updated]);
  return {day,entry:{...entry,revision:body.revision+1,updatedAt:updated.toISOString()}};
 });
}
