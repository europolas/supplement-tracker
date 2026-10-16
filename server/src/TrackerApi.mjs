import {pausedOn,dateOnly,validReturnDate} from './supplement-pause.mjs';
import {validRoutine,routineFromRow} from './routine-preferences.mjs';
import {routineRecheckSchema,validRoutineRecheck,routineRecheckMessages,productFingerprint,groupFingerprint,readAnalysis} from './routine-recheck.mjs';
import {analysisTexts,textFingerprint,localizedAnalysis,validLocalization} from './analysis-localization.mjs';
import {reviewSnapshot,groupReviewSchema,validGroupReview,groupReviewMessages} from './group-review.mjs';
import {citationUrl} from './structured-research.mjs';
import {basicProductsSchema,basicProductsMessages,validBasicProducts,normalizeBasicProducts} from './photo-products.mjs';
/** User-scoped tracker endpoints. All ownership is derived from the bearer session.
 * AI results are validated before a transaction writes a supplement. Raw photos/keys
 * are never persisted in this class's results or logs. Completion day is derived on
 * the server using a validated device timezone; no midnight background worker is needed.
 */
import {routineGrouping,researchedGrouping} from './grouping.mjs';
import {createTaskQueue} from './task-queue.mjs';
import {randomUUID} from 'node:crypto';
import {ApiError} from './security.mjs';
import {ProviderError} from './structured-chat.mjs';
import {analysisSchema,validAnalysis,analysisMessages,finalizeAnalysis} from './analysis.mjs';
import {groupIcon} from './group-icon.mjs';
import {detailsSchema,validDetails,detailsMessages} from './product-details.mjs';
import {photoProductsSchema,validPhotoProducts,photoProductsMessages,productRequestId,uniqueProducts,productIdentity,draftAnalysis} from './photo-products.mjs';
const jobColumns='id,status,supplement_id,error_code,total_count,processed_count,result,phase,language,created_at,finished_at';
const jobResult=row=>row?{...row,result:typeof row.result==='string'?JSON.parse(row.result):row.result}:null;
const safeCode=error=>error instanceof ProviderError?error.code:error instanceof ApiError?(/^[A-Z_]+$/.test(error.message)?error.message:error.status===429?'AI_RATE_LIMITED':error.status===401?'SESSION_EXPIRED':'REQUEST_FAILED'):'REQUEST_FAILED';
// Persist only closed diagnostic enums, never raw provider output or messages.
const researchFailure=error=>error instanceof ProviderError&&['lookup','extraction'].includes(error.diagnostic?.stage)?{stage:error.diagnostic.stage,reason:['invalid_json','incomplete_output','invalid_fields'].includes(error.diagnostic.reason)?error.diagnostic.reason:'provider_error'}:undefined;
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
function text(value,max,required=true){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||required&&!value.trim())throw new ApiError(400,'INVALID_INPUT');return value.trim();}
export function timezone(value){try{if(typeof value!=='string'||value.length>80)throw Error();return new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone;}catch{throw new ApiError(400,'INVALID_TIMEZONE');}}
export function calendarDay(zone,now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone(zone),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=k=>parts.find(p=>p.type===k).value;return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validatePhoto(image){
 if(image===undefined||image===null||image==='')return null;
 if(typeof image!=='string'||image.length>4300000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new ApiError(400,'IMAGE_INVALID');
 const bytes=Buffer.from(image.split(',')[1],'base64');
 if(bytes.length>3*1024*1024||bytes.length<8)throw new ApiError(400,'IMAGE_INVALID');
 const valid=image.startsWith('data:image/jpeg')?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(!valid)throw new ApiError(400,'IMAGE_INVALID');return image;
}
/** Keep the complete batch inside the existing HTTP/proxy body budget. */
export function validatePhotos(body){
 if(body.images!==undefined&&body.image)throw new ApiError(400,'IMAGE_INVALID');
 if(body.images===undefined){const image=validatePhoto(body.image);return image?[image]:[];}
 if(!Array.isArray(body.images)||body.images.length>6)throw new ApiError(400,'IMAGE_INVALID');
 const images=body.images.map(validatePhoto);if(images.some(x=>!x)||images.reduce((n,x)=>n+x.length,0)>4300000)throw new ApiError(400,'IMAGE_INVALID');return images;
}
export class TrackerApi {
 constructor(pool,auth,{vault,chat,discover,localize=null,credentialProvider='xai',review=null,recheck=null,autoResearch=false,fullResearch=false,singlePass=true,discoveryModel='grok-4.7',models=['grok-4.7'],now=()=>new Date()}){if(!['xai','google'].includes(credentialProvider))throw TypeError('Invalid credential provider');this.localize=localize;this.autoResearch=autoResearch;this.fullResearch=fullResearch;this.credentialProvider=credentialProvider;this.credentialTable=credentialProvider==='google'?'google_provider_credentials':'provider_credentials';this.review=review;this.recheck=recheck;this.singlePass=singlePass;this.pool=pool;this.auth=auth;this.vault=vault;this.chat=chat;this.discover=discover;this.discoveryModel=discoveryModel;this.models=models;this.now=now;this.running=new Set();this.activeJobs=new Set();this.jobOwners=new Map();this.recognitionQueues=new Map();this.providerQueue=createTaskQueue({concurrency:4,maxPending:16});this.backgroundQueue=createTaskQueue({concurrency:3,maxPending:320});this.progressWrites=new Map();}
 get providers(){return this.providerQueue.running;}
 async provider(task,options){return this.providerQueue.enqueue(task,options);}
 async settings(user){
  const [keys]=await this.pool.execute(`SELECT updated_at FROM ${this.credentialTable} WHERE user_id=?`,[user]);
  const [prefs]=await this.pool.execute('SELECT model,timezone,routine,routine_revision FROM tracker_preferences WHERE user_id=?',[user]);
  return {configured:keys.length>0,updatedAt:keys[0]?.updated_at||null,provider:this.credentialProvider,model:this.models.includes(prefs[0]?.model)?prefs[0].model:this.models[0],timezone:prefs[0]?.timezone||'UTC',models:this.models,...routineFromRow(prefs[0])};
 }
 async routineSnapshot(db,owner){const [rows]=await db.execute('SELECT routine,routine_revision FROM tracker_preferences WHERE user_id=? FOR UPDATE',[owner]);return routineFromRow(rows[0]);}
 async bootstrap(user,body){
  const zone=timezone(body.timezone||'UTC');const lt=body.language==='lt';
  await this.auth.transaction(async db=>{
   const [users]=await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[user]);if(!users.length)throw new ApiError(401,'SESSION_EXPIRED');
   const [prefs]=await db.execute('SELECT user_id FROM tracker_preferences WHERE user_id=?',[user]);
   if(!prefs.length){
    await db.execute('INSERT INTO tracker_preferences(user_id,timezone,model) VALUES (?,?,?)',[user,zone,this.models[0]]);
    const names=lt?['Ryte tuščiu skrandžiu','Su pusryčiais / pietumis (su riebalais)','Su valgiu','Vakaras / prieš miegą']:['Morning · empty stomach','With breakfast / lunch (with fats)','With a meal','Evening · before bed'];
    for(let i=0;i<names.length;i++)await db.execute('INSERT INTO day_groups(id,user_id,name,position) VALUES (?,?,?,?)',[randomUUID(),user,names[i],i]);
   }else await db.execute('UPDATE tracker_preferences SET timezone=? WHERE user_id=?',[zone,user]);
  });return {ok:true};
 }
 async handle(method,path,body,authorization,ip,query=new URLSearchParams()){
  const {user}=await this.auth.authenticate(authorization);const owner=user.id;
  await this.auth.limit('tracker',owner,180,60);
  if(method==='DELETE'&&path==='/supplements'){
   if(body.confirm!==true)throw new ApiError(400,'INVALID_INPUT');
   // Serialize against recognition's commit; deleting jobs invalidates in-flight
   // results without touching groups, credentials, preferences or other accounts.
   await this.auth.transaction(async db=>{
    await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
    await db.execute('DELETE FROM analysis_jobs WHERE user_id=?',[owner]);
    await db.execute('DELETE FROM supplements WHERE user_id=?',[owner]);
   });return [200,{ok:true}];
  }
  if(path==='/settings/routine'){
   if(method==='GET'){const settings=await this.settings(owner);return [200,{routine:settings.routine,revision:settings.routineRevision}];}
   if(method==='PUT'){
    if(!Number.isSafeInteger(body.revision)||body.revision<0||!Object.hasOwn(body,'routine')||!validRoutine(body.routine))throw new ApiError(400,'INVALID_INPUT');
    return [200,await this.auth.transaction(async db=>{
     await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
     const [rows]=await db.execute('SELECT routine,routine_revision FROM tracker_preferences WHERE user_id=? FOR UPDATE',[owner]);
     if(!rows.length)throw new ApiError(409,'COLLECTION_CHANGED');if(Number(rows[0].routine_revision)!==body.revision)throw new ApiError(409,'COLLECTION_CHANGED');
     await db.execute('UPDATE tracker_preferences SET routine=?,routine_revision=routine_revision+1 WHERE user_id=?',[body.routine===null?null:JSON.stringify(body.routine),owner]);return {routine:body.routine,revision:body.revision+1};
    })];
   }
  }
  if(path==='/rechecks'){
   if(method==='GET')return [200,await this.rechecks(owner)];
   if(method==='POST')return [202,await this.startRecheck(owner,body,authorization)];
  }
  const proposal=/^\/rechecks\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/.exec(path);
  if(proposal&&method==='PATCH')return [200,await this.resolveRecheck(owner,proposal[1],proposal[2],body.action)];
  if(method==='POST'&&path==='/supplements/localize')return [202,await this.startLocalization(owner,body,authorization)];
  if(method==='POST'&&path==='/bootstrap')return [200,await this.bootstrap(owner,body)];
  if(path==='/settings/ai'){
   if(method==='GET')return [200,await this.settings(owner)];
   if(method==='PUT'){
    await this.auth.limit('key-change',owner,10,3600);
    if(!this.models.includes(body.model))throw new ApiError(400,'INVALID_MODEL');
    if(body.key!==undefined&&body.key!==''){
     const key=text(body.key,500);if(!/^[A-Za-z0-9_.-]{16,500}$/.test(key))throw new ApiError(400,'AI_KEY_INVALID');
     const sealed=this.vault.seal(key,{owner,provider:this.credentialProvider});
     await this.pool.execute(`INSERT INTO ${this.credentialTable}(user_id,encrypted_key) VALUES (?,?) ON DUPLICATE KEY UPDATE encrypted_key=VALUES(encrypted_key),updated_at=UTC_TIMESTAMP(3)`,[owner,sealed]);
    }
    await this.pool.execute('UPDATE tracker_preferences SET model=? WHERE user_id=?',[body.model,owner]);return [200,await this.settings(owner)];
   }
   if(method==='DELETE'){await this.pool.execute(`DELETE FROM ${this.credentialTable} WHERE user_id=?`,[owner]);return [200,await this.settings(owner)];}
  }
  if(method==='GET'&&path==='/dashboard'){
   const zone=timezone(query.get('timezone')||'UTC'),day=calendarDay(zone,this.now());
   const [groups]=await this.pool.execute('SELECT id,name,description,position,icon FROM day_groups WHERE user_id=? ORDER BY position,name',[owner]);
   const [rows]=await this.pool.execute('SELECT s.id,s.group_id,s.name,s.analysis,s.model,s.created_at,s.paused_at,s.resume_on,s.pause_timezone,s.pause_revision,IF(c.supplement_id IS NULL,0,1) AS completed FROM supplements s LEFT JOIN supplement_completions c ON c.supplement_id=s.id AND c.local_day=? WHERE s.user_id=? ORDER BY s.created_at',[day,owner]);
   return [200,{day,groups,supplements:rows.map(row=>({...row,paused:pausedOn(row,this.now()),resume_on:dateOnly(row.resume_on),completed:Boolean(row.completed),analysis:query.has('language')?localizedAnalysis(typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis,query.get('language')==='lt'?'lt':'en'):typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis})),ai:await this.settings(owner)}];
  }
  if(method==='POST'&&path==='/groups'){
   const name=text(body.name,120),description=text(body.description||'',500,false),id=randomUUID();
   const [count]=await this.pool.execute('SELECT COUNT(*) AS n FROM day_groups WHERE user_id=?',[owner]);if(count[0].n>=30)throw new ApiError(400,'GROUP_LIMIT');
   await this.pool.execute('INSERT INTO day_groups(id,user_id,name,description,position,icon) VALUES (?,?,?,?,?,?)',[id,owner,name,description,count[0].n,groupIcon(body.icon)||'']);return [201,{id}];
  }
  if(method==='PUT'&&path==='/groups/order'){
   const ids=body.ids;if(!Array.isArray(ids)||ids.length>30||ids.some(id=>!uuid(id))||new Set(ids).size!==ids.length)throw new ApiError(400,'INVALID_INPUT');
   await this.auth.transaction(async db=>{
    const [owned]=await db.execute('SELECT id FROM day_groups WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);
    if(ids.length!==owned.length||owned.some(g=>!ids.includes(g.id)))throw new ApiError(409,'COLLECTION_CHANGED');
    for(const [position,id]of ids.entries())await db.execute('UPDATE day_groups SET position=? WHERE id=? AND user_id=?',[position,id,owner]);
   });return [200,{ok:true}];
  }
  const group=/^\/groups\/([a-f0-9-]{36})$/.exec(path);
  if(group){
   if(method==='PATCH'){
    const [result]=await this.pool.execute('UPDATE day_groups SET name=?,description=?,icon=COALESCE(?,icon) WHERE id=? AND user_id=?',[text(body.name,120),text(body.description||'',500,false),groupIcon(body.icon)??null,group[1],owner]);if(!result.affectedRows)throw new ApiError(404,'NOT_FOUND');return [200,{ok:true}];
   }
   if(method==='DELETE'){
    await this.auth.transaction(async db=>{
     const [rows]=await db.execute('SELECT id FROM day_groups WHERE id=? AND user_id=? FOR UPDATE',[group[1],owner]);if(!rows.length)throw new ApiError(404,'NOT_FOUND');
     await db.execute('UPDATE supplements SET group_id=NULL WHERE group_id=? AND user_id=?',[group[1],owner]);
     await db.execute('DELETE FROM day_groups WHERE id=? AND user_id=?',[group[1],owner]);
    });return [200,{ok:true}];
   }
  }
  if(path==='/supplements/jobs'){
   if(method==='POST')return [202,await this.startAnalysis(owner,body,authorization)];
   if(method==='GET'){const [rows]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind')),'')<>'routine_recheck' ORDER BY created_at DESC LIMIT 1`,[owner]);const [recent]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind')),'')<>'routine_recheck' ORDER BY GREATEST(created_at,COALESCE(finished_at,created_at)) DESC LIMIT 20`,[owner]);const [active]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND status='running' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind')),'')<>'routine_recheck' ORDER BY created_at`,[owner]);return [200,{job:jobResult(rows[0]),active:active.map(jobResult),recent:recent.map(jobResult)}];}
  }
  const apply=/^\/supplements\/jobs\/([a-f0-9-]{36})\/apply-groups$/.exec(path);
  if(apply&&method==='POST')return [200,await this.applyGroupReview(owner,apply[1])];
  const job=/^\/supplements\/jobs\/([a-f0-9-]{36})$/.exec(path);
  if(job&&method==='GET'){const [rows]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE id=? AND user_id=?`,[job[1],owner]);if(!rows.length)throw new ApiError(404,'NOT_FOUND');return [200,jobResult(rows[0])];}
  if(method==='POST'&&path==='/supplements/analyze'){if(this.singlePass)throw new ApiError(404,'NOT_FOUND');return this.analyze(owner,body,authorization);}
  const research=/^\/supplements\/([a-f0-9-]{36})\/research$/.exec(path);
  if(research&&method==='POST')return [202,await this.startResearch(owner,research[1],body,authorization)];
  const pause=/^\/supplements\/([a-f0-9-]{36})\/pause$/.exec(path);
  if(pause&&method==='PUT'){
   if(typeof body.paused!=='boolean')throw new ApiError(400,'INVALID_INPUT');
   const zone=timezone(body.timezone||'UTC'),now=this.now(),day=calendarDay(zone,now),resume=body.paused?validReturnDate(body.resumeOn,day):null;
   await this.auth.transaction(async db=>{
    await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
    const [rows]=await db.execute('SELECT id,paused_at,resume_on,pause_timezone,pause_revision FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[pause[1],owner]);
    if(!rows.length)throw new ApiError(404,'NOT_FOUND');const row=rows[0],activePause=pausedOn(row,now);
    if(body.paused&&activePause&&dateOnly(row.resume_on)===resume&&row.pause_timezone===zone||!body.paused&&!activePause)return;
    // A new choice closes the previous period; scheduled resume_on still bounds it
    // earlier than resumed_at. Both timestamps remain available for future history.
    await db.execute('UPDATE supplement_pauses SET resumed_at=? WHERE supplement_id=? AND user_id=? AND resumed_at IS NULL',[now,row.id,owner]);
    const [jobs]=await db.execute("SELECT id,result FROM analysis_jobs WHERE user_id=? AND JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind'))='routine_recheck' AND JSON_SEARCH(result,'one','pending',NULL,'$.proposals[*].status') IS NOT NULL FOR UPDATE",[owner]);
    for(const job of jobs){const result=typeof job.result==='string'?JSON.parse(job.result):job.result;let changed=false;for(const p of result.proposals||[])if(p.supplementId===row.id&&p.status==='pending'){p.status='removed';p.resolvedAt=now.toISOString();changed=true;}if(changed)await db.execute('UPDATE analysis_jobs SET result=? WHERE id=? AND user_id=?',[JSON.stringify(result),job.id,owner]);}
    if(body.paused)await db.execute('INSERT INTO supplement_pauses(id,user_id,supplement_id,started_at,resume_on,timezone) VALUES (?,?,?,?,?,?)',[randomUUID(),owner,row.id,now,resume,zone]);
    await db.execute('UPDATE supplements SET paused_at=?,resume_on=?,pause_timezone=?,pause_revision=pause_revision+1 WHERE id=? AND user_id=?',[body.paused?now:null,resume,body.paused?zone:null,row.id,owner]);
   });return [200,{ok:true}];
  }
  const supplement=/^\/supplements\/([a-f0-9-]{36})(\/completion)?$/.exec(path);
  if(supplement){
   const id=supplement[1];
   if(method==='PUT'&&supplement[2]){
    if(typeof body.completed!=='boolean')throw new ApiError(400,'INVALID_INPUT');
    const day=calendarDay(timezone(body.timezone||'UTC'),this.now());
    await this.auth.transaction(async db=>{
     // Match pause/clear/recheck lock order before completion FKs take owner locks.
     await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
     const [owned]=await db.execute('SELECT id,paused_at,resume_on,pause_timezone FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[id,owner]);if(!owned.length)throw new ApiError(404,'NOT_FOUND');
     if(body.completed&&pausedOn(owned[0],this.now()))throw new ApiError(409,'SUPPLEMENT_PAUSED');
     if(body.completed)await db.execute('INSERT INTO supplement_completions(user_id,supplement_id,local_day) VALUES (?,?,?) ON DUPLICATE KEY UPDATE completed_at=completed_at',[owner,id,day]);
     else await db.execute('DELETE FROM supplement_completions WHERE supplement_id=? AND user_id=? AND local_day=?',[id,owner,day]);
    });return [200,{day,completed:body.completed}];
   }
   if(method==='DELETE'&&!supplement[2]){
    const [result]=await this.pool.execute('DELETE FROM supplements WHERE id=? AND user_id=?',[id,owner]);if(!result.affectedRows)throw new ApiError(404,'NOT_FOUND');return [200,{ok:true}];
   }
   if(method==='PATCH'&&!supplement[2]){
    const groupId=body.groupId;
    if(groupId!==null&&!uuid(groupId))throw new ApiError(400,'INVALID_INPUT');
    await this.auth.transaction(async db=>{
     if(groupId){const [groups]=await db.execute('SELECT id FROM day_groups WHERE id=? AND user_id=? FOR UPDATE',[groupId,owner]);if(!groups.length)throw new ApiError(404,'NOT_FOUND');}
     const [result]=await db.execute("UPDATE supplements SET group_id=?,analysis=JSON_SET(analysis,'$.grouping',JSON_OBJECT('basis','manual')) WHERE id=? AND user_id=?",[groupId,id,owner]);if(!result.affectedRows)throw new ApiError(404,'NOT_FOUND');
    });return [200,{ok:true}];
   }
  }
  throw new ApiError(404,'NOT_FOUND');
 }
 /** Pending proposals are read independently of the 20-upload history window.
  * Completed rows retain owner decisions; clear/account deletion removes all jobs. */
 async rechecks(owner){
  const [pending]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind'))='routine_recheck' AND (status='running' OR JSON_SEARCH(result,'one','pending',NULL,'$.proposals[*].status') IS NOT NULL) ORDER BY created_at DESC`,[owner]);
  const [last]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind'))='routine_recheck' ORDER BY created_at DESC LIMIT 1`,[owner]);
  const publicJob=row=>{const j=jobResult(row);return j?{id:j.id,status:j.status,phase:j.phase,error_code:j.error_code,total_count:j.total_count,processed_count:j.processed_count,created_at:j.created_at,elapsedMs:j.result.elapsedMs,proposedCount:j.result.proposedCount||0,skippedCount:j.result.skippedCount||0}:null;};
  const [inventory]=await this.pool.execute('SELECT id,paused_at,resume_on,pause_timezone FROM supplements WHERE user_id=?',[owner]);const activeIds=new Set(inventory.filter(row=>!pausedOn(row,this.now())).map(row=>row.id));
  return {active:publicJob(pending.find(j=>j.status==='running')),latest:publicJob(last[0]),proposals:pending.flatMap(row=>{const j=jobResult(row);return (j.result.proposals||[]).filter(p=>p.status==='pending'&&activeIds.has(p.supplementId)).map(({id,supplementId,name,manufacturer,from,to,reason})=>({jobId:j.id,id,supplementId,name,manufacturer,from,to,reason}));})};
 }
 async startRecheck(owner,body,authorization){
  if(!this.recheck)throw new ApiError(503,'AI_PROVIDER_FAILED');if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');
  const language=body.language==='lt'?'lt':'en',sealed=await this.checkKey(owner),settings=await this.settings(owner);let job,groups,rows;
  await this.auth.transaction(async db=>{
   const [users]=await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);if(!users.length)throw new ApiError(401,'SESSION_EXPIRED');
   const [same]=await db.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND (request_id=? OR status='running' AND JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind'))='routine_recheck') ORDER BY created_at DESC LIMIT 1`,[owner,body.requestId]);
   if(same.length){job=jobResult(same[0]);if(job.result?.kind!=='routine_recheck')throw new ApiError(409,'COLLECTION_CHANGED');return;}
   Object.assign(settings,await this.routineSnapshot(db,owner));
   if(this.activeJobs.size>=8)throw new ApiError(409,'AI_BUSY');await this.auth.limit('recheck-minute',owner,3,60);await this.auth.limit('recheck-day',owner,30,86400);
   [rows]=await db.execute('SELECT id,name,group_id,analysis,paused_at,resume_on,pause_timezone,pause_revision FROM supplements WHERE user_id=? ORDER BY id',[owner]);[groups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
   rows=rows.filter(row=>!pausedOn(row,this.now()));
   if(!rows.length||!groups.length)throw new ApiError(400,'CREATE_GROUP_FIRST');
   const id=randomUUID(),result={kind:'routine_recheck',language,proposals:[]};
   await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,total_count,result) VALUES (?,?,?,'running','queued',?,?,?)",[id,owner,body.requestId,language,rows.length,JSON.stringify(result)]);job={id,status:'running',phase:'queued',language,total_count:rows.length,result};
  });
  if(!rows||job.status!=='running'||this.activeJobs.has(job.id))return {id:job.id,status:job.status};this.activeJobs.add(job.id);
  void (async()=>{const started=Date.now();try{
   await this.provider(async()=>{
    await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);const [exists]=await this.pool.execute('SELECT id FROM analysis_jobs WHERE id=? AND user_id=?',[job.id,owner]);if(!exists.length)throw new ApiError(409,'COLLECTION_CHANGED');
    await this.pool.execute("UPDATE analysis_jobs SET phase='enriching' WHERE id=? AND user_id=?",[job.id,owner]);
    const response=await this.recheck({key:this.vault.open(sealed,{owner,provider:this.credentialProvider}),model:settings.model,messages:routineRecheckMessages(groups,rows,language,settings.routine),schema:routineRecheckSchema(groups,rows),validate:v=>validRoutineRecheck(v,groups,rows),name:'routine_recheck',maxTokens:Math.min(24000,800+rows.length*120)});
    if(!validRoutineRecheck(response.result,groups,rows))throw new ProviderError('AI_INVALID_RESPONSE');await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);
    await this.auth.transaction(async db=>{
     await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);const [jobs]=await db.execute('SELECT result FROM analysis_jobs WHERE id=? AND user_id=? FOR UPDATE',[job.id,owner]);if(!jobs.length)throw new ApiError(409,'COLLECTION_CHANGED');
     if((await this.routineSnapshot(db,owner)).routineRevision!==settings.routineRevision)throw new ApiError(409,'COLLECTION_CHANGED');
     const [currentRows]=await db.execute('SELECT id,name,group_id,analysis,paused_at,resume_on,pause_timezone,pause_revision FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);const [currentGroups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position FOR UPDATE',[owner]);if(groupFingerprint(groups)!==groupFingerprint(currentGroups))throw new ApiError(409,'COLLECTION_CHANGED');
     // Refresh a still-pending proposal for the same product in place. Other
     // unresolved products survive new checks, even if not returned as changes.
     const [old]=await db.execute("SELECT id,result FROM analysis_jobs WHERE user_id=? AND id<>? AND JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind'))='routine_recheck' AND JSON_SEARCH(result,'one','pending',NULL,'$.proposals[*].status') IS NOT NULL ORDER BY created_at DESC FOR UPDATE",[owner,job.id]);const older=old.map(j=>({...j,data:typeof j.result==='string'?JSON.parse(j.result):j.result,dirty:false}));
     const proposals=[];let skippedCount=0,proposedCount=0;
     for(const a of response.result.assignments){const before=rows.find(r=>r.id===a.supplementId),now=currentRows.find(r=>r.id===a.supplementId);if(!now||pausedOn(now,this.now())||productFingerprint(before)!==productFingerprint(now)){skippedCount++;continue;}if(!a.groupId||a.groupId===now.group_id)continue;
      proposedCount++;const proposal={id:randomUUID(),supplementId:now.id,name:now.name,manufacturer:readAnalysis(now).manufacturer||'',from:{id:now.group_id,name:currentGroups.find(g=>g.id===now.group_id)?.name||null},to:{id:a.groupId,name:currentGroups.find(g=>g.id===a.groupId).name},reason:a.reason,status:'pending',routineRevision:settings.routineRevision,productFingerprint:productFingerprint(now),groupsFingerprint:groupFingerprint(currentGroups)};
      const prior=older.find(j=>j.data.proposals.some(p=>p.status==='pending'&&p.supplementId===now.id));if(prior){const p=prior.data.proposals.find(p=>p.status==='pending'&&p.supplementId===now.id);Object.assign(p,{...proposal,id:p.id});prior.dirty=true;}else proposals.push(proposal);
     }
     for(const j of older.filter(j=>j.dirty))await db.execute('UPDATE analysis_jobs SET result=? WHERE id=? AND user_id=?',[JSON.stringify(j.data),j.id,owner]);
     const result={kind:'routine_recheck',language,routineRevision:settings.routineRevision,proposals,proposedCount,skippedCount,elapsedMs:Date.now()-started,model:response.model||settings.model};await db.execute("UPDATE analysis_jobs SET status='complete',phase='done',processed_count=total_count,finished_at=UTC_TIMESTAMP(3),result=? WHERE id=? AND user_id=?",[JSON.stringify(result),job.id,owner]);
    });
   });
  }catch(error){await this.pool.execute("UPDATE analysis_jobs SET status='failed',phase='done',error_code=?,finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[safeCode(error),job.id,owner]);}finally{this.activeJobs.delete(job.id);}})().catch(()=>this.activeJobs.delete(job.id));return {id:job.id,status:job.status};
 }
 async resolveRecheck(owner,jobId,proposalId,action){
  if(!['accept','remove'].includes(action))throw new ApiError(400,'INVALID_INPUT');
  await this.auth.transaction(async db=>{
   await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);const [jobs]=await db.execute('SELECT result FROM analysis_jobs WHERE id=? AND user_id=? FOR UPDATE',[jobId,owner]);if(!jobs.length)throw new ApiError(404,'NOT_FOUND');const result=typeof jobs[0].result==='string'?JSON.parse(jobs[0].result):jobs[0].result;
   const p=result.kind==='routine_recheck'&&result.proposals.find(p=>p.id===proposalId);if(!p)throw new ApiError(404,'NOT_FOUND');const status=action==='accept'?'accepted':'removed';if(p.status===status)return;if(p.status!=='pending')throw new ApiError(409,'COLLECTION_CHANGED');
   if(action==='accept'){
    const [rows]=await db.execute('SELECT id,name,group_id,analysis,paused_at,resume_on,pause_timezone,pause_revision FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[p.supplementId,owner]);const [groups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position FOR UPDATE',[owner]);const row=rows[0];if((await this.routineSnapshot(db,owner)).routineRevision!==(p.routineRevision||0))throw new ApiError(409,'COLLECTION_CHANGED');if(!row||pausedOn(row,this.now())||productFingerprint(row)!==p.productFingerprint||groupFingerprint(groups)!==p.groupsFingerprint||!groups.some(g=>g.id===p.to.id))throw new ApiError(409,'COLLECTION_CHANGED');
    const a=readAnalysis(row);a.grouping={basis:'manual',groupId:p.to.id,explanation:p.reason};await db.execute('UPDATE supplements SET group_id=?,analysis=? WHERE id=? AND user_id=?',[p.to.id,JSON.stringify(a),row.id,owner]);
   }
   p.status=status;p.resolvedAt=this.now().toISOString();await db.execute('UPDATE analysis_jobs SET result=? WHERE id=? AND user_id=?',[JSON.stringify(result),jobId,owner]);
  });return {ok:true};
 }
 async startAnalysis(owner,body,authorization){
  if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');
  const name=text(body.name||'',250,false),images=validatePhotos(body),image=images[0]||null,language=body.language==='lt'?'lt':'en';if(!name&&!images.length)throw new ApiError(400,'NAME_OR_PHOTO_REQUIRED');
  const id=randomUUID();let result;
  if(this.activeJobs.size>=8)throw new ApiError(503,'AI_QUEUE_FULL');this.activeJobs.add(id);
  try{await this.auth.transaction(async db=>{
   const [users]=await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);if(!users.length)throw new ApiError(401,'SESSION_EXPIRED');
   const [same]=await db.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND request_id=?`,[owner,body.requestId]);if(same.length){result=jobResult(same[0]);return;}
   // Preserve idempotency for a request previously saved by the synchronous endpoint.
   // Identity matching alone is ambiguous when legacy records share a product name.
   const [saved]=await db.execute('SELECT id FROM supplements WHERE user_id=? AND request_id=?',[owner,body.requestId]);
   if(saved.length){
    await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,supplement_id,total_count,processed_count,finished_at) VALUES (?,?,?,'complete','done',?,?,1,1,UTC_TIMESTAMP(3))",[id,owner,body.requestId,language,saved[0].id]);
    const [completed]=await db.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE id=? AND user_id=?`,[id,owner]);result=jobResult(completed[0]);return;
   }
   const [active]=await db.execute("SELECT phase FROM analysis_jobs WHERE user_id=? AND status='running'",[owner]);if(active.length>=4)throw new ApiError(409,'AI_QUEUE_FULL');
   await this.auth.limit('ai-minute',owner,4,60);await this.auth.limit('ai-day',owner,30,86400);
   const report={groupChangesTracked:true,submission:{kind:image?'photo':'name',name},items:[],skipped:[],language};
   await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,result) VALUES (?,?,?,'running','queued',?,?)",[id,owner,body.requestId,language,JSON.stringify(report)]);result={id,status:'running',phase:'queued',language,result:report,created_at:new Date().toISOString(),supplement_id:null,error_code:null};
  });}catch(error){this.activeJobs.delete(id);throw error;}
  if(result.id!==id||result.status==='complete'){this.activeJobs.delete(id);return result;}
  // The task owns a private mutable payload; it drops image bytes before enqueueing
  // any research. Waiting research contains names/IDs, never a raw photo or key.
  void this.runProgressive(owner,{requestId:body.requestId,name,image,images,language},authorization,id);
  return result;
 }
 async jobProgress(owner,id,report,phase='enriching'){
  // Parallel products share one report. Serialize writes so a slower DB response
  // cannot overwrite a newer terminal count with an older progress snapshot.
  const previous=this.progressWrites.get(id)||Promise.resolve();
  const write=previous.catch(()=>{}).then(async()=>{
   const processed=report.items.filter(item=>['complete','reused','failed'].includes(item.research)).length;
   await this.pool.execute('UPDATE analysis_jobs SET phase=?,total_count=?,processed_count=?,result=?,supplement_id=? WHERE id=? AND user_id=?',[phase,report.items.length,processed,JSON.stringify(report),report.items[0]?.id||null,id,owner]);
  });this.progressWrites.set(id,write);
  try{await write;}finally{if(this.progressWrites.get(id)===write)this.progressWrites.delete(id);}
 }
 async runProgressive(owner,body,authorization,id){
  const workflowStarted=Date.now();
  let report={groupChangesTracked:true,submission:{kind:body.image?'photo':'name',name:body.name},items:[],skipped:[],language:body.language};
  let sealed,failurePhase='queued';
  try{
   let recognition=this.recognitionQueues.get(owner);if(!recognition){recognition=createTaskQueue({concurrency:1,maxPending:3});this.recognitionQueues.set(owner,recognition);}
   // Release the owner recognition slot immediately after committing the preview,
   // so queued photos do not wait for slow web research of an earlier upload.
   await recognition.enqueue(async()=>{
   failurePhase='recognizing';await this.auth.authenticate(authorization);this.jobOwners.set(owner,id);
   await this.pool.execute("UPDATE analysis_jobs SET phase='recognizing' WHERE id=? AND user_id=?",[id,owner]);
   const [liveJob]=await this.pool.execute('SELECT id FROM analysis_jobs WHERE id=? AND user_id=?',[id,owner]);if(!liveJob.length)throw new ApiError(409,'COLLECTION_CHANGED');
   const [groups]=await this.pool.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);if(!groups.length)throw new ApiError(400,'CREATE_GROUP_FIRST');
   const [keys]=await this.pool.execute(`SELECT encrypted_key FROM ${this.credentialTable} WHERE user_id=?`,[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');sealed=keys[0].encrypted_key;
   const [supplements]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);
   const context=JSON.stringify(groups),started=Date.now(),language=body.language,settings=await this.settings(owner);
   let {result,model,inventory,productMetadata,timings,pipeline}=await this.provider(()=>this.discover({key:this.vault.open(keys[0].encrypted_key,{owner,provider:this.credentialProvider}),model:this.discoveryModel||settings.model,cacheScope:owner,onMetrics:async update=>{report.monitor={...(report.monitor||{}),...update,autoResearch:this.autoResearch};await this.jobProgress(owner,id,report,['grok','gemini'].includes(update.stage)?'recognizing':'enriching');},compositionCache:supplements.map(r=>{const a=typeof r.analysis==='string'?JSON.parse(r.analysis):r.analysis;return {name:r.name,manufacturer:a.manufacturer,composition:a.composition||(a.research?.checkedAt&&a.nutrients?.length?{complete:false,basis:'verified_research',checkedAt:a.research.checkedAt,ingredients:a.nutrients.filter(n=>['manufacturer','label_photo'].includes(n.evidence)).map(n=>({name:n.name,labelAmount:''}))}:null)};}),beforeClassification:async()=>{await this.auth.authenticate(authorization);await this.checkKey(owner,keys[0].encrypted_key);const [jobs]=await this.pool.execute('SELECT id FROM analysis_jobs WHERE id=? AND user_id=?',[id,owner]);if(!jobs.length)throw new ApiError(409,'COLLECTION_CHANGED');await this.pool.execute("UPDATE analysis_jobs SET phase='enriching' WHERE id=? AND user_id=?",[id,owner]);},messages:(this.singlePass?basicProductsMessages:photoProductsMessages)({...body,groups,supplements,routine:settings.routine}),schema:this.singlePass?basicProductsSchema(groups,language):photoProductsSchema(groups,supplements,language),validate:v=>this.singlePass?validBasicProducts(v,groups,language):validPhotoProducts(v,groups,supplements,language),name:this.singlePass?'supplement_basics_v1':'quick_supplement_routine_v2',maxTokens:5000}),{priority:10});
   if(this.singlePass){if(!validBasicProducts(result,groups,language))throw new ApiError(502,'AI_INVALID_RESPONSE');result=normalizeBasicProducts(result);}
   body.image=null;body.images=[]; // No background research request resends a photo.
   if(!validPhotoProducts(result,groups,supplements,language))throw new ApiError(502,'AI_INVALID_RESPONSE');
   await this.auth.authenticate(authorization);await this.checkKey(owner,keys[0].encrypted_key);
   report={groupChangesTracked:true,submission:report.submission,...(report.monitor?{monitor:report.monitor}:{}),items:[],skipped:[...result.skipped],language,recognitionMs:Date.now()-started,recognitionModel:model,...(timings?{timings,pipeline}:{}),...(inventory?{photoInventory:inventory}:{})};
   const products=uniqueProducts(result.products);if(!products.length&&!report.skipped.length)report.skipped.push({location:'',reasonCode:'SUPPLEMENT_NOT_IDENTIFIED'});if(result.overflow)report.skipped.push({location:'',reasonCode:'PHOTO_PRODUCT_LIMIT'});
   await this.auth.transaction(async db=>{
    await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
    if((await this.routineSnapshot(db,owner)).routineRevision!==settings.routineRevision)throw new ApiError(409,'COLLECTION_CHANGED');
    const [liveJob]=await db.execute('SELECT id FROM analysis_jobs WHERE id=? AND user_id=? FOR UPDATE',[id,owner]);if(!liveJob.length)throw new ApiError(409,'COLLECTION_CHANGED');
    const [latestGroups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position FOR UPDATE',[owner]);if(JSON.stringify(latestGroups)!==context)throw new ApiError(409,'COLLECTION_CHANGED');
    const [rows]=await db.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);
    let capacity=40-rows.length;
    for(const [index,product] of products.entries()){
     const identity=productIdentity(product),matches=rows.filter(row=>{const a=typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis;return productIdentity(a.identity||{...a,name:row.name})===identity||(a.identityAliases||[]).includes(identity);}),existing=matches.find(row=>row.id===product.existingId)||matches.find(row=>row.group_id)||matches[0];
     if(existing){
      const a=typeof existing.analysis==='string'?JSON.parse(existing.analysis):existing.analysis;
      if(this.singlePass){
       // A second label photo can improve composition without duplicating the
       // supplement or moving an existing (possibly manually chosen) group.
       const metadata=productMetadata?.[identity];
       if(metadata){
        if(!a.composition?.complete||metadata.composition?.complete)a.composition=metadata.composition;
        a.benefitTags=metadata.benefitTags;
        await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),existing.id,owner]);
       }
       report.items.push({id:existing.id,name:existing.name,status:'added',reused:true,research:'reused'});continue;
      }
      const fresh=a.enrichment?.status!=='failed'&&(!a.enrichment||a.enrichment.status==='complete')&&a.language===language&&a.research?.checkedAt&&Date.now()-Date.parse(a.research.checkedAt)<30*86400000&&a.sources?.length;
      // Another live job owns this same product; reuse its queue item instead of billing twice.
      const pending=['queued','researching'].includes(a.enrichment?.status);
      if(!fresh&&!pending){a.identity=product;a.enrichment={status:'queued',jobId:id,language};await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),existing.id,owner]);}
      report.items.push({id:existing.id,name:existing.name,status:'added',reused:true,research:fresh||pending?'reused':'queued'});continue;
     }
     if(capacity<=0){report.skipped.push({name:product.name,reasonCode:'SUPPLEMENT_LIMIT'});continue;}capacity--;
     const draft=draftAnalysis({...product,requestedName:body.name||null},{language,jobId:id}),recordId=randomUUID();
     if(productMetadata?.[identity])Object.assign(draft,productMetadata[identity]);
     if(this.singlePass){draft.grouping={basis:'provisional',groupId:product.groupId};draft.schemaVersion='basic-1';draft.enrichment={status:this.autoResearch?'queued':'complete',jobId:id,language};draft.needsReview=productMetadata?.[identity]?typeof productMetadata[identity].classification.groupConfidence==='number'&&productMetadata[identity].classification.groupConfidence<.65:product.review;draft.productName=product.name;}
     await db.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) VALUES (?,?,?,?,?,?,?)',[recordId,owner,product.groupId,draft.productName,JSON.stringify(draft),model,productRequestId(body.requestId,index)]);
     report.items.push({id:recordId,name:draft.productName,status:'added',research:this.singlePass&&!this.autoResearch?'complete':'queued'});
    }
    await db.execute('UPDATE analysis_jobs SET phase=\'enriching\',total_count=?,result=? WHERE id=? AND user_id=?',[report.items.length,JSON.stringify(report),id,owner]);
   });
   if(this.jobOwners.get(owner)===id)this.jobOwners.delete(owner);await this.jobProgress(owner,id,report);
   });failurePhase='enriching';
   const detailsStarted=Date.now();
   await Promise.all(report.items.filter(item=>item.research==='queued').map(async item=>{
    const queuedAt=Date.now();
    try{await this.backgroundQueue.enqueue(async()=>{item.research='researching';item.queueMs=Date.now()-queuedAt;await this.jobProgress(owner,id,report);const change=await this.enrich(owner,item.id,body.language,authorization,id,sealed);if(change)item.groupChange=change;});item.research='complete';}
    catch(error){item.research='failed';item.error=safeCode(error);item.failure=researchFailure(error);await this.markResearchFailed(owner,item.id,id,item.error,item.failure);}
    item.elapsedMs=Date.now()-queuedAt;await this.jobProgress(owner,id,report);
   }));
   if(this.autoResearch&&report.timings){report.timings={...report.timings,detailsMs:Date.now()-detailsStarted,totalMs:Date.now()-workflowStarted};}
   if(this.singlePass&&this.review&&report.items.length)await this.reviewGroups(owner,id,report,authorization,sealed);
   await this.jobProgress(owner,id,report,'done');await this.pool.execute("UPDATE analysis_jobs SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[report.items.length?'complete':'failed',report.items.length?null:'SUPPLEMENT_NOT_IDENTIFIED',id,owner]);
  }catch(error){body.image=null;body.images=[];report.failedPhase=failurePhase;const code=safeCode(error);for(const item of report.items){if(!['queued','researching'].includes(item.research))continue;item.research='failed';item.error=code;try{await this.markResearchFailed(owner,item.id,id,code);}catch{ /* DB may be unavailable; startup also marks interrupted drafts. */ }}try{await this.jobProgress(owner,id,report,'done');await this.pool.execute("UPDATE analysis_jobs SET status='failed',phase='done',error_code=?,finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[code,id,owner]);}catch{ /* Deleted accounts have no surviving private job metadata. */ }}
  finally{body.image=null;body.images=[];this.activeJobs.delete(id);if(this.jobOwners.get(owner)===id)this.jobOwners.delete(owner);const queue=this.recognitionQueues.get(owner);if(queue&&!queue.running&&!queue.size){queue.close();this.recognitionQueues.delete(owner);}}
 }
 /** One optional second call per accepted batch. Errors retain recognized products. */
 async reviewGroups(owner,id,report,authorization,sealed){
  report.review={status:'checking',changes:[]};await this.jobProgress(owner,id,report);
  try{
   await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);
   const [jobs]=await this.pool.execute('SELECT id FROM analysis_jobs WHERE id=? AND user_id=?',[id,owner]);if(!jobs.length)return;
   const [groups]=await this.pool.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
   const [rows]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);
   const targets=rows.filter(r=>report.items.some(i=>i.id===r.id));if(!targets.length)return;
   const snapshot=reviewSnapshot(rows),started=Date.now();
   const response=await this.provider(()=>this.review({key:this.vault.open(sealed,{owner,provider:this.credentialProvider}),model:'grok-4.7',messages:groupReviewMessages({groups,rows,targets,language:report.language}),schema:groupReviewSchema(groups,targets),validate:v=>validGroupReview(v,groups,targets),name:'supplement_group_review',maxTokens:Math.min(10000,1000+targets.length*280)}));
   if(!validGroupReview(response.result,groups,targets))throw new ApiError(502,'AI_INVALID_RESPONSE');
   await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);
   const citations=new Set((response.citations||[]).map(citationUrl));
   const assessments=response.result.assignments.map(a=>{const target=targets.find(t=>t.id===a.supplementId),analysis=typeof target.analysis==='string'?JSON.parse(target.analysis):target.analysis,source=citationUrl(a.sourceUrl),verified=!!source&&citations.has(source),allowed=verified&&analysis.grouping?.basis!=='manual';return {id:target.id,name:target.name,from:target.group_id,to:allowed?a.groupId:target.group_id,reason:a.reason,sourceUrl:verified?source:null,unverified:!verified};});
   report.review={status:'ready',model:response.model,elapsedMs:Date.now()-started,groups,snapshot,assessments,changes:assessments.filter(a=>a.from!==a.to)};
  }catch(error){report.review={status:'failed',error:safeCode(error),changes:[]};}
 }
 async applyGroupReview(owner,id){
  await this.auth.transaction(async db=>{
   await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
   const [jobs]=await db.execute('SELECT result FROM analysis_jobs WHERE id=? AND user_id=? FOR UPDATE',[id,owner]);if(!jobs.length)throw new ApiError(404,'NOT_FOUND');
   const report=typeof jobs[0].result==='string'?JSON.parse(jobs[0].result):jobs[0].result,review=report?.review;
   if(review?.status==='applied')return;if(review?.status!=='ready'||!review.changes.length)throw new ApiError(409,'COLLECTION_CHANGED');
   const [groups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position FOR UPDATE',[owner]);
   const [rows]=await db.execute('SELECT id,name,group_id,analysis,paused_at,resume_on,pause_timezone FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);
   if(JSON.stringify(groups)!==JSON.stringify(review.groups)||reviewSnapshot(rows)!==review.snapshot)throw new ApiError(409,'COLLECTION_CHANGED');
   for(const change of review.changes){const row=rows.find(r=>r.id===change.id);if(!row||pausedOn(row,this.now())||!groups.some(g=>g.id===change.to))throw new ApiError(409,'COLLECTION_CHANGED');const a=typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis;a.grouping={basis:'manual',groupId:change.to,explanation:change.reason,sourceUrl:change.sourceUrl};await db.execute('UPDATE supplements SET group_id=?,analysis=? WHERE id=? AND user_id=?',[change.to,JSON.stringify(a),change.id,owner]);}
   review.status='applied';delete review.snapshot;await db.execute('UPDATE analysis_jobs SET result=? WHERE id=? AND user_id=?',[JSON.stringify(report),id,owner]);
  });return {ok:true};
 }
 /** Explicit refresh/retry never performs recognition and never adds a second row.
  * It uses the selected UI language; a completed result is retained while refreshing.
  */
 async startLocalization(owner,body,authorization){
  if(!this.localize)throw new ApiError(503,'AI_PROVIDER_FAILED');if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');
  const language=body.language==='lt'?'lt':'en',sealed=await this.checkKey(owner);let job,items=[];
  await this.auth.transaction(async db=>{
   await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
   const [same]=await db.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND (request_id=? OR status='running' AND JSON_UNQUOTE(JSON_EXTRACT(result,'$.kind'))='localization') ORDER BY created_at DESC LIMIT 1`,[owner,body.requestId]);if(same.length){job=jobResult(same[0]);return;}
   const [active]=await db.execute("SELECT COUNT(*) AS n FROM analysis_jobs WHERE user_id=? AND status='running'",[owner]);if(active[0].n>=4||this.activeJobs.size>=8)throw new ApiError(409,'AI_BUSY');
   const [rows]=await db.execute('SELECT id,name,analysis FROM supplements WHERE user_id=? ORDER BY created_at',[owner]);let size=0;
   for(const row of rows){const a=typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis;if(!localizedAnalysis(a,language).localizationNeeded||['queued','researching'].includes(a.enrichment?.status))continue;const fields=analysisTexts(a),length=JSON.stringify(fields).length;if(items.length&&(items.length>=4||size+length>48000))break;size+=length;items.push({id:row.id,name:row.name,fields,fingerprint:textFingerprint(a)});}
   if(!items.length){job={status:'complete',result:{kind:'localization',items:[]}};return;}
   await this.auth.limit('localization',owner,60,3600);
   const id=randomUUID(),report={kind:'localization',language,items:items.map(i=>({id:i.id,name:i.name,status:'added',research:'queued'}))};
   await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,total_count,result) VALUES (?,?,?,'running','enriching',?,?,?)",[id,owner,body.requestId,language,items.length,JSON.stringify(report)]);job={id,status:'running',phase:'enriching',language,result:report,total_count:items.length};
  });
  if(!job.id||job.status!=='running'||this.activeJobs.has(job.id))return job;this.activeJobs.add(job.id);
  void (async()=>{const started=Date.now();try{
   job.result.monitor={pipeline:'gemini-localization',model:this.models[0],calls:1};await this.jobProgress(owner,job.id,job.result);
   const response=await this.backgroundQueue.enqueue(()=>this.provider(()=>this.localize({key:this.vault.open(sealed,{owner,provider:this.credentialProvider}),items,language})));job.result.timings={localizationMs:Date.now()-started,totalMs:Date.now()-started};Object.assign(job.result.monitor,response.usage||{}, {model:response.model||this.models[0]});if(!validLocalization(response.result,items))throw new ProviderError('AI_INVALID_RESPONSE');await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);
   await this.auth.transaction(async db=>{for(const item of items){const [rows]=await db.execute('SELECT analysis FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[item.id,owner]);if(!rows.length)continue;const a=typeof rows[0].analysis==='string'?JSON.parse(rows[0].analysis):rows[0].analysis;if(textFingerprint(a)!==item.fingerprint)continue;a.localizations={...(a.localizations||{}),[language]:{fingerprint:item.fingerprint,fields:response.result.products.find(p=>p.id===item.id).fields}};await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),item.id,owner]);}});
   for(const item of job.result.items)item.research='complete';await this.jobProgress(owner,job.id,job.result,'done');await this.pool.execute("UPDATE analysis_jobs SET status='complete',finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[job.id,owner]);
  }catch(error){const code=safeCode(error);for(const item of job.result.items){item.research='failed';item.error=code;}await this.jobProgress(owner,job.id,job.result,'done');await this.pool.execute("UPDATE analysis_jobs SET status='failed',phase='done',error_code=?,finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[code,job.id,owner]);}finally{this.activeJobs.delete(job.id);}})().catch(()=>this.activeJobs.delete(job.id));return job;
 }
 async startResearch(owner,supplementId,body,authorization){
  // Single-pass applies to adding products; this explicit action opts into research.
  if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');const language=body.language==='lt'?'lt':'en';
  const sealed=await this.checkKey(owner);let job;
  if(this.activeJobs.size>=8)throw new ApiError(503,'AI_BUSY');
  await this.auth.transaction(async db=>{
   await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
   const [same]=await db.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND request_id=?`,[owner,body.requestId]);if(same.length){job=jobResult(same[0]);return;}
   const [rows]=await db.execute('SELECT name,analysis FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[supplementId,owner]);if(!rows.length)throw new ApiError(404,'NOT_FOUND');const a=typeof rows[0].analysis==='string'?JSON.parse(rows[0].analysis):rows[0].analysis;
   if(['queued','researching'].includes(a.enrichment?.status)){const [live]=await db.execute("SELECT id FROM analysis_jobs WHERE id=? AND user_id=? AND status='running'",[a.enrichment.jobId,owner]);if(live.length)throw new ApiError(409,'AI_BUSY');}
   const [active]=await db.execute("SELECT COUNT(*) AS n FROM analysis_jobs WHERE user_id=? AND status='running'",[owner]);if(active[0].n>=4)throw new ApiError(409,'AI_BUSY');
   await this.auth.limit('ai-minute',owner,4,60);await this.auth.limit('ai-day',owner,30,86400);
   const id=randomUUID(),report={groupChangesTracked:true,items:[{id:supplementId,name:rows[0].name,status:'added',research:'queued',reused:true}],skipped:[],language};a.enrichment={status:'queued',jobId:id,language};
   await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),supplementId,owner]);
   await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,total_count,result) VALUES (?,?,?,'running','enriching',?,1,?)",[id,owner,body.requestId,language,JSON.stringify(report)]);job={id,status:'running',phase:'enriching',language,total_count:1,processed_count:0,result:report};
  });
  if(job.status!=='running'||this.activeJobs.has(job.id))return job;this.activeJobs.add(job.id);
  void (async()=>{const item=job.result.items[0];try{await this.backgroundQueue.enqueue(async()=>{item.research='researching';await this.jobProgress(owner,job.id,job.result);const change=await this.enrich(owner,supplementId,language,authorization,job.id,sealed);if(change)item.groupChange=change;});item.research='complete';}
   catch(error){item.research='failed';item.error=safeCode(error);item.failure=researchFailure(error);await this.markResearchFailed(owner,supplementId,job.id,item.error,item.failure);}
   finally{try{await this.jobProgress(owner,job.id,job.result,'done');await this.pool.execute("UPDATE analysis_jobs SET status='complete',finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[job.id,owner]);}catch{ /* Deleted account. */ }this.activeJobs.delete(job.id);}
  })().catch(()=>{this.activeJobs.delete(job.id);});return job;
 }
 async checkKey(owner,encrypted){const [keys]=await this.pool.execute(`SELECT encrypted_key FROM ${this.credentialTable} WHERE user_id=?`,[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');if(encrypted&&keys[0].encrypted_key!==encrypted)throw new ApiError(409,'AI_KEY_CHANGED');return keys[0].encrypted_key;}
 async markResearchFailed(owner,id,jobId,error,failure){
  await this.auth.transaction(async db=>{const [rows]=await db.execute('SELECT analysis FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[id,owner]);if(!rows.length)return;const a=typeof rows[0].analysis==='string'?JSON.parse(rows[0].analysis):rows[0].analysis;if(a.enrichment?.jobId!==jobId)return;a.enrichment={...a.enrichment,status:'failed',error,...(failure?{failure}:{})};await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),id,owner]);});
 }
 /** Up to three background tasks see ALL drafts immediately; reserve the fourth
  * provider slot for recognition. Each result rechecks live collection state. Concurrent
  * user edits cannot be overwritten; collection changes retain sourced quantities
  * but explicitly invalidate any blanket compatibility clearance. */
 async enrich(owner,id,language,authorization,jobId,encrypted){
  await this.auth.authenticate(authorization);const sealed=await this.checkKey(owner,encrypted),settings=await this.settings(owner);
  const [groups]=await this.pool.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
  const [rows]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);const target=rows.find(row=>row.id===id);if(!target)throw new ApiError(404,'NOT_FOUND');
  const previous=typeof target.analysis==='string'?JSON.parse(target.analysis):target.analysis;if(previous.enrichment?.jobId!==jobId)throw new ApiError(409,'COLLECTION_CHANGED');
  await this.pool.execute("UPDATE supplements SET analysis=JSON_SET(analysis,'$.enrichment.status','researching') WHERE id=? AND user_id=?",[id,owner]);
  const supplements=rows.filter(row=>row.id!==id),snapshot=JSON.stringify(rows.map(row=>[row.id,row.name,row.group_id,row.id===id?null:row.analysis]));
  const {result,model,verifiedLabelSources=[]}=await this.requestResearch(owner,{name:target.name,image:null,language,target:{...(previous.identity||{name:target.name,manufacturer:previous.manufacturer||null,variant:previous.variant||null}),groupId:target.group_id,groupingBasis:previous.grouping?.basis||(previous.identity?.groupId===target.group_id?'provisional':'unknown'),originalBenefit:previous.benefitSummary,originalComposition:previous.composition?.ingredients||[]},groups,supplements,settings,sealed},authorization);
  return this.auth.transaction(async db=>{
   await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);const routineNow=await this.routineSnapshot(db,owner);
   const [latest]=await db.execute('SELECT id,name,group_id,analysis,paused_at,resume_on,pause_timezone FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);const row=latest.find(r=>r.id===id);if(!row)throw new ApiError(404,'NOT_FOUND');
   const a=typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis;if(a.enrichment?.jobId!==jobId)throw new ApiError(409,'COLLECTION_CHANGED');
   const changed=JSON.stringify(latest.map(r=>[r.id,r.name,r.group_id,r.id===id?null:r.analysis]))!==snapshot;
   if(changed&&!this.singlePass){result.compatibility.stale=true;result.compatibility.requiresReview=true;result.needsReview=true;}
   // Planning and safety are separate: a conflict remains visible without erasing
   // the user's schedule. Concurrent/manual grouping always takes precedence.
   const [owned]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
   // Details can correct an AI schedule, never a concurrent/manual user choice.
   // Source verification happens before this transaction; group edits invalidate
   // timing context without discarding otherwise useful product information.
   const timingSources=result.sources.filter(s=>s.kind==='manufacturer'||s.kind==='label_registry'&&verifiedLabelSources.includes(s.url)||this.singlePass&&s.kind==='retailer');
   const source=timingSources.find(s=>s.url===result.dosage?.sourceUrl)||timingSources[0];
   const grouping=pausedOn(row,this.now())?{...(a.grouping||{basis:'provisional'}),groupId:row.group_id}:this.singlePass&&this.fullResearch?researchedGrouping({analysis:a,previous:target.group_id,current:row.group_id,proposed:result.groupId,ownedIds:owned.map(g=>g.id),groupsUnchanged:JSON.stringify(owned)===JSON.stringify(groups)&&!routineNow.routine&&routineNow.routineRevision===settings.routineRevision,reason:result.reviewReason,sourceUrl:source?.url,checkedAt:this.now().toISOString()}):this.singlePass?{...(a.grouping||{basis:'provisional'}),groupId:owned.some(g=>g.id===row.group_id)?row.group_id:null}:routineGrouping({proposed:result.groupId,previous:target.group_id,ownedIds:owned.map(g=>g.id),manual:a.grouping?.basis==='manual'||row.group_id!==target.group_id,current:row.group_id});
   const groupId=grouping.groupId;result.grouping=grouping;if(routineNow.routine&&result.groupId&&result.groupId!==groupId&&owned.some(g=>g.id===result.groupId))result.groupingSuggestion={groupId:result.groupId,reason:result.reviewReason,routineRevision:routineNow.routineRevision};
   // Capture the actual transaction's before/after groups, never a proposed or
   // blocked manual move. Names are snapshots so later renames do not alter history.
   const change=grouping.basis==='researched'&&row.group_id!==groupId?{jobId,from:{id:row.group_id,name:owned.find(g=>g.id===row.group_id)?.name||null},to:{id:groupId,name:owned.find(g=>g.id===groupId)?.name||null}}:null;
   if(change)grouping.change=change;
   if(grouping.basis==='provisional'){result.needsReview=true;}
   result.identityAliases=[...new Set([...(a.identityAliases||[]),productIdentity(previous.identity||{...previous,name:target.name})])].slice(-8);
   const unknown=value=>!value||/^(unknown|not visible|not readable|n\/?a|nenustatyta|nežinoma)$/i.test(value.trim());
   if(unknown(result.manufacturer)&&!unknown(a.manufacturer))result.manufacturer=a.manufacturer;
   result.identity={...(previous.identity||{}),name:result.productName,manufacturer:result.manufacturer,variant:result.variant||previous.identity?.variant||''};for(const key of ['composition','benefitTags','classification'])if(a[key])result[key]=a[key];if(this.fullResearch)result.composition={ingredients:result.nutrients.map(n=>({name:n.name,labelAmount:n.amount==null?'':n.amount+' '+n.unit})),complete:false,basis:result.research?.reported?'reported_research':'verified_research',checkedAt:this.now().toISOString()};result.enrichment={status:'complete',jobId,language};
   await db.execute('UPDATE supplements SET name=?,analysis=?,model=?,group_id=? WHERE id=? AND user_id=?',[result.productName,JSON.stringify(result),model,groupId,id,owner]);
   return change;
  });
 }
 async requestResearch(owner,{name,image,language,target,groups,supplements,settings,sealed},authorization){
  const focused=this.singlePass,timing=Boolean(this.fullResearch&&target?.groupId&&['provisional','researched'].includes(target?.groupingBasis)&&groups.some(g=>g.id===target.groupId)),detailGroups=timing?groups:[];
  const started=Date.now();const data=await this.provider(()=>this.chat({key:this.vault.open(sealed,{owner,provider:this.credentialProvider}),model:settings.model,messages:focused?detailsMessages({name,image,language,target,groups:detailGroups,full:timing,routine:settings.routine}):analysisMessages({name,image,groups,supplements,language,target}),schema:focused?detailsSchema(detailGroups,language,[],timing):analysisSchema(groups,supplements,language),validate:value=>focused?validDetails(value,detailGroups,language,[],timing):validAnalysis(value,groups,supplements,language),name:focused?'supplement_product_details':'supplement_analysis_v1_4',maxTokens:focused?6000:Math.min(12000,4500+supplements.length*190)}));
  const {result,citations}=data;if(!result.identified)throw new ApiError(422,'SUPPLEMENT_NOT_IDENTIFIED');finalizeAnalysis(result,{citations,verifiedLabelSources:data.verifiedLabelSources||[],allowReported:focused,image:Boolean(image),now:this.now()});result.research.elapsedMs=Date.now()-started;if(data.extractionAttempts)result.research.extractionAttempts=data.extractionAttempts;if(focused)result.research.scope=this.fullResearch?'full-product-details':'product-details';await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);
  for(const assessment of result.compatibility.assessments){const s=supplements.find(s=>s.id===assessment.supplementId),a=typeof s.analysis==='string'?JSON.parse(s.analysis):s.analysis;assessment.supplementName=s.name;if(assessment.status==='no_known_issue'&&a.enrichment&&a.enrichment.status!=='complete')assessment.status='insufficient_information';}
  if(result.compatibility.assessments.some(a=>a.status!=='no_known_issue')){result.needsReview=true;result.compatibility.requiresReview=true;}return data;
 }
 async analyze(owner,body,authorization,{background=false,skipRateLimit=false,target=null}={}){
  if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');
  const name=text(body.name||'',250,false),image=validatePhoto(body.image),language=body.language==='lt'?'lt':'en';
  if(!name&&!image)throw new ApiError(400,'NAME_OR_PHOTO_REQUIRED');
  const [existing]=await this.pool.execute('SELECT id FROM supplements WHERE user_id=? AND request_id=?',[owner,body.requestId]);
  if(existing.length)return [200,{id:existing[0].id,reused:true}];
  if(this.running.has(owner)||!background&&this.jobOwners.has(owner))throw new ApiError(409,'AI_BUSY');
  if(!skipRateLimit){await this.auth.limit('ai-minute',owner,4,60);await this.auth.limit('ai-day',owner,30,86400);}
  const [groups]=await this.pool.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
  if(!groups.length)throw new ApiError(400,'CREATE_GROUP_FIRST');
  const [keys]=await this.pool.execute(`SELECT encrypted_key FROM ${this.credentialTable} WHERE user_id=?`,[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');
  const settings=await this.settings(owner);if(!this.models.includes(settings.model))throw new ApiError(400,'INVALID_MODEL');
  const [supplements]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);
  if(supplements.length>=40)throw new ApiError(400,'SUPPLEMENT_LIMIT');
  const snapshot=JSON.stringify([groups,supplements]);
  if(this.running.size>=4)throw new ApiError(503,'AI_BUSY');
  this.running.add(owner);
  try{
   const key=this.vault.open(keys[0].encrypted_key,{owner,provider:this.credentialProvider});
   const {result,model,citations}=await this.provider(()=>this.chat({key,model:settings.model,messages:analysisMessages({name,image,groups,supplements,language,target}),schema:analysisSchema(groups,supplements,language),validate:value=>validAnalysis(value,groups,supplements,language),name:'supplement_analysis_v1_4',maxTokens:Math.min(12000,4500+supplements.length*190)}));
   if(!result.identified)throw new ApiError(422,'SUPPLEMENT_NOT_IDENTIFIED');
   finalizeAnalysis(result,{citations,image:Boolean(image),now:this.now()});
   await this.auth.authenticate(authorization);
   const [current]=await this.pool.execute(`SELECT encrypted_key FROM ${this.credentialTable} WHERE user_id=?`,[owner]);
   if(current[0]?.encrypted_key!==keys[0].encrypted_key)throw new ApiError(409,'AI_KEY_CHANGED');
   const conflicts=result.compatibility.assessments.some(a=>['potential_conflict','duplicate'].includes(a.status));
   if(conflicts||result.compatibility.assessments.some(a=>a.status==='insufficient_information')){result.needsReview=true;result.compatibility.requiresReview=true;}
   for(const item of result.compatibility.assessments)item.supplementName=supplements.find(s=>s.id===item.supplementId).name;
   // Missing dose evidence alone must not erase a researched timing group.
   const id=randomUUID(),grouping=routineGrouping({proposed:result.groupId,ownedIds:groups.map(g=>g.id)}),groupId=grouping.groupId;result.grouping=grouping;
   await this.auth.transaction(async db=>{
    const [latestGroups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position FOR UPDATE',[owner]);
    const [latestSupplements]=await db.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);
    if(JSON.stringify([latestGroups,latestSupplements])!==snapshot)throw new ApiError(409,'COLLECTION_CHANGED');
    if(groupId){const [owned]=await db.execute('SELECT id FROM day_groups WHERE id=? AND user_id=? FOR UPDATE',[groupId,owner]);if(!owned.length)throw new ApiError(409,'GROUP_CHANGED');}
    await db.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) VALUES (?,?,?,?,?,?,?)',[id,owner,groupId,result.productName,JSON.stringify(result),model,body.requestId]);
   });return [201,{id}];
  }catch(error){if(error instanceof ProviderError)throw new ApiError(502,error.code);throw error;}
  finally{this.running.delete(owner);}
 }
}
