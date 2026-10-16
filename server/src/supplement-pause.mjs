/** Return dates are inclusive: active from midnight on resume_on in the zone
 * captured when pausing. Reads need no cron/write and travel cannot shift that date.
 * Keep periods independently of completions; a pause never erases a taken record. */
import {ApiError} from './security.mjs';
export const dateOnly=value=>value instanceof Date?value.toISOString().slice(0,10):value;
export function pausedOn(row,now=new Date()){
 if(!row.paused_at)return false;
 if(!row.resume_on)return true;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:row.pause_timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=k=>parts.find(p=>p.type===k).value;
 return dateOnly(row.resume_on)>`${part('year')}-${part('month')}-${part('day')}`;
}
export function validReturnDate(value,day){
 if(value===null||value===undefined)return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value<=day||value>'9999-12-31')throw new ApiError(400,'INVALID_RETURN_DATE');
 return value;
}
