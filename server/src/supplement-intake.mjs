/** Owner lock + product lock are acquired by caller before these helpers run.
 * A saved version becomes effective today only if no occurrence was recorded;
 * otherwise tomorrow. Completed doses keep their amount/time/group snapshot.
 * Inventory is actual units, never inferred from ingredient mg or AI output.
 */
import {ApiError} from './security.mjs';
import {normalizeIntakePlan,intakeSlots,stockChange} from './intake-plan.mjs';
import {dateOnly} from './supplement-pause.mjs';
export const json=value=>typeof value==='string'?JSON.parse(value):value;
export const nextDay=day=>new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
export function planOn(history,id,day){const version=history.filter(h=>h.supplement_id===id&&dateOnly(h.effective_day)<=day).sort((a,b)=>dateOnly(b.effective_day).localeCompare(dateOnly(a.effective_day))||Number(b.id)-Number(a.id))[0];return version?json(version.plan):null;}
export async function saveIntake(db,owner,row,body,day){
 let plan;try{plan=normalizeIntakePlan(body.plan);}catch{throw new ApiError(400,'INVALID_INTAKE_PLAN');}
 const stock=body.stock;
 if(!stock||!(stock.remaining===null||Number.isSafeInteger(stock.remaining)&&stock.remaining>=0&&stock.remaining<=1000000)||!Number.isSafeInteger(stock.lowThreshold)||stock.lowThreshold<0||stock.lowThreshold>1000000||!Number.isSafeInteger(body.revision))throw new ApiError(400,'INVALID_INPUT');
 if(Number(row.intake_revision)!==body.revision)throw new ApiError(409,'INTAKE_CHANGED');
 const changed=JSON.stringify(json(row.intake_plan))!==JSON.stringify(plan);
 let effectiveDay=day;
 if(changed){const [[count]]=await db.execute('SELECT COUNT(*) AS n FROM supplement_completions WHERE supplement_id=? AND user_id=? AND local_day=?',[row.id,owner,day]);effectiveDay=Number(count.n)?nextDay(day):day;
  await db.execute('INSERT INTO supplement_intake_history(user_id,supplement_id,effective_day,plan) VALUES (?,?,?,?)',[owner,row.id,effectiveDay,plan===null?null:JSON.stringify(plan)]);
 }
 const epoch=Number(row.stock_epoch)+(Boolean(row.stock_remaining===null)!==Boolean(stock.remaining===null)?1:0);
 await db.execute('UPDATE supplements SET intake_plan=?,stock_remaining=?,stock_threshold=?,stock_epoch=?,intake_revision=intake_revision+1 WHERE id=? AND user_id=?',[plan===null?null:JSON.stringify(plan),stock.remaining,stock.lowThreshold,epoch,row.id,owner]);
 return {ok:true,revision:body.revision+1,effectiveDay,scheduleChanged:changed};
}
export async function setIntakeCompletion(db,owner,row,body,day){
 const [history]=await db.execute('SELECT id,supplement_id,effective_day,plan FROM supplement_intake_history WHERE user_id=? AND supplement_id=? AND effective_day<=? ORDER BY effective_day DESC,id DESC',[owner,row.id,day]);
 const slots=intakeSlots(planOn(history,row.id,day),day),slot=body.slot===undefined?(slots.length===1?slots[0].slot:'daily'):body.slot;
 if(typeof slot!=='string'||!['daily',...slots.map(s=>s.slot)].includes(slot))throw new ApiError(400,'INVALID_INTAKE_SLOT');
 const [rows]=await db.execute('SELECT slot,quantity,unit,stock_debited,stock_epoch FROM supplement_completions WHERE user_id=? AND supplement_id=? AND local_day=? AND slot=? FOR UPDATE',[owner,row.id,day,slot]);
 const existing=rows[0],target=slots.find(s=>s.slot===slot);
 if(body.completed){
  if(!target)throw new ApiError(409,'NOT_SCHEDULED');
  if(existing)return;
  const stock=stockChange(row.stock_remaining,target.quantity);
  await db.execute('INSERT INTO supplement_completions(user_id,supplement_id,local_day,slot,quantity,unit,stock_debited,stock_epoch) VALUES (?,?,?,?,?,?,?,?)',[owner,row.id,day,slot,target.quantity,target.unit,stock.debited,row.stock_epoch]);
  await db.execute('UPDATE supplements SET stock_remaining=?,intake_revision=intake_revision+1 WHERE id=? AND user_id=?',[stock.remaining,row.id,owner]);
 }else if(existing){
  const sameEpoch=Number(existing.stock_epoch)===Number(row.stock_epoch),stock=stockChange(row.stock_remaining,Number(existing.quantity),{undo:true,debited:sameEpoch?Number(existing.stock_debited):0});
  await db.execute('DELETE FROM supplement_completions WHERE supplement_id=? AND user_id=? AND local_day=? AND slot=?',[row.id,owner,day,slot]);
  await db.execute('UPDATE supplements SET stock_remaining=?,intake_revision=intake_revision+1 WHERE id=? AND user_id=?',[stock.remaining,row.id,owner]);
 }
}
export function decorateIntake(row,day,history,completions){
 const records=completions.filter(c=>c.supplement_id===row.id),slots=intakeSlots(planOn(history,row.id,day),day),occurrences=slots.map(s=>({...s,completed:records.some(c=>(c.slot||'daily')===s.slot)}));
 return {...row,intake_plan:json(row.intake_plan),intake_revision:Number(row.intake_revision||0),stock_remaining:row.stock_remaining===null||row.stock_remaining===undefined?null:Number(row.stock_remaining),stock_threshold:Number(row.stock_threshold||0),occurrences,scheduledToday:slots.length>0,completed:slots.length>0&&occurrences.every(s=>s.completed)};
}
