/** Pure recurring intake plans and stock arithmetic; no medical/dose advice.
 * Days are local YYYY-MM-DD supplied by the caller (never browser locale inferred).
 * Persist plan versions and occurrence snapshots in the same transaction as edits.
 * One stable slot per wall-clock time; daily is the backwards-compatible untimed
 * slot. Completion/undo must be idempotent in the caller's owner-scoped DB lock.
 */
export const intakeUnits=Object.freeze(['capsule','tablet','softgel','drop','scoop','ml','unit']);
const isDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function normalizeIntakePlan(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='object'||Array.isArray(value)||value.version!==1||!['daily','weekdays','interval'].includes(value.mode)||!Number.isSafeInteger(value.quantity)||value.quantity<1||value.quantity>100||!intakeUnits.includes(value.unit)||!Array.isArray(value.times)||value.times.length>6||value.times.some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||new Set(value.times).size!==value.times.length)throw new TypeError('Invalid intake plan');
 const plan={version:1,mode:value.mode,quantity:value.quantity,unit:value.unit,times:[...value.times].sort()};
 if(value.mode==='weekdays'){
  if(!Array.isArray(value.weekdays)||!value.weekdays.length||value.weekdays.length>7||value.weekdays.some(n=>!Number.isSafeInteger(n)||n<1||n>7)||new Set(value.weekdays).size!==value.weekdays.length)throw new TypeError('Invalid weekdays');
  plan.weekdays=[...value.weekdays].sort((a,b)=>a-b);
 }
 if(value.mode==='interval'){
  if(!Number.isSafeInteger(value.intervalDays)||value.intervalDays<2||value.intervalDays>90||!isDay(value.startDate))throw new TypeError('Invalid interval');
  plan.intervalDays=value.intervalDays;plan.startDate=value.startDate;
 }
 return plan;
}
export function intakeSlots(plan,day){
 if(!isDay(day))throw new TypeError('Invalid intake day');
 const p=normalizeIntakePlan(plan);
 if(p?.mode==='weekdays'&&!p.weekdays.includes(new Date(day+'T12:00:00Z').getUTCDay()||7))return [];
 if(p?.mode==='interval'){const diff=(Date.parse(day)-Date.parse(p.startDate))/86400000;if(diff<0||diff%p.intervalDays!==0)return [];}
 return (p?.times.length?p.times:['daily']).map(slot=>({slot,time:slot==='daily'?null:slot,quantity:p?.quantity||1,unit:p?.unit||'unit'}));
}
export function stockChange(remaining,quantity,{undo=false,debited=0}={}){
 if(remaining===null||remaining===undefined)return {remaining:null,debited:0};
 if(!Number.isSafeInteger(remaining)||remaining<0||remaining>1000000||!Number.isSafeInteger(quantity)||quantity<1||quantity>100||!Number.isSafeInteger(debited)||debited<0||debited>100)throw new TypeError('Invalid stock');
 const change=undo?-Math.min(debited,1000000-remaining):Math.min(remaining,quantity);
 return {remaining:remaining-change,debited:undo?0:change};
}
