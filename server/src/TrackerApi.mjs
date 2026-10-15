import {basicProductsSchema,basicProductsMessages,validBasicProducts,normalizeBasicProducts} from './photo-products.mjs';
/** User-scoped tracker endpoints. All ownership is derived from the bearer session.
 * AI results are validated before a transaction writes a supplement. Raw photos/keys
 * are never persisted in this class's results or logs. Completion day is derived on
 * the server using a validated device timezone; no midnight background worker is needed.
 */
import {routineGrouping} from './grouping.mjs';
import {createTaskQueue} from './task-queue.mjs';
import {randomUUID} from 'node:crypto';
import {ApiError} from './security.mjs';
import {ProviderError} from './structured-chat.mjs';
import {analysisSchema,validAnalysis,analysisMessages,finalizeAnalysis} from './analysis.mjs';
import {photoProductsSchema,validPhotoProducts,photoProductsMessages,productRequestId,uniqueProducts,productIdentity,draftAnalysis} from './photo-products.mjs';
const jobColumns='id,status,supplement_id,error_code,total_count,processed_count,result,phase,language,created_at,finished_at';
const jobResult=row=>row?{...row,result:typeof row.result==='string'?JSON.parse(row.result):row.result}:null;
const safeCode=error=>error instanceof ProviderError?error.code:error instanceof ApiError?(/^[A-Z_]+$/.test(error.message)?error.message:error.status===429?'AI_RATE_LIMITED':error.status===401?'SESSION_EXPIRED':'REQUEST_FAILED'):'REQUEST_FAILED';
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
export class TrackerApi {
 constructor(pool,auth,{vault,chat,discover,singlePass=true,discoveryModel='grok-4.3',models=['grok-4.7'],now=()=>new Date()}){this.singlePass=singlePass;this.pool=pool;this.auth=auth;this.vault=vault;this.chat=chat;this.discover=discover;this.discoveryModel=discoveryModel;this.models=models;this.now=now;this.running=new Set();this.activeJobs=new Set();this.jobOwners=new Map();this.recognitionQueues=new Map();this.providerQueue=createTaskQueue({concurrency:4,maxPending:16});this.backgroundQueue=createTaskQueue({concurrency:3,maxPending:320});this.progressWrites=new Map();}
 get providers(){return this.providerQueue.running;}
 async provider(task,options){return this.providerQueue.enqueue(task,options);}
 async settings(user){
  const [keys]=await this.pool.execute('SELECT updated_at FROM provider_credentials WHERE user_id=?',[user]);
  const [prefs]=await this.pool.execute('SELECT model,timezone FROM tracker_preferences WHERE user_id=?',[user]);
  return {configured:keys.length>0,updatedAt:keys[0]?.updated_at||null,model:prefs[0]?.model||this.models[0],timezone:prefs[0]?.timezone||'UTC',models:this.models};
 }
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
  if(method==='POST'&&path==='/bootstrap')return [200,await this.bootstrap(owner,body)];
  if(path==='/settings/ai'){
   if(method==='GET')return [200,await this.settings(owner)];
   if(method==='PUT'){
    await this.auth.limit('key-change',owner,10,3600);
    if(!this.models.includes(body.model))throw new ApiError(400,'INVALID_MODEL');
    if(body.key!==undefined&&body.key!==''){
     const key=text(body.key,500);if(!/^[A-Za-z0-9_.-]{16,500}$/.test(key))throw new ApiError(400,'AI_KEY_INVALID');
     const sealed=this.vault.seal(key,{owner,provider:'xai'});
     await this.pool.execute('INSERT INTO provider_credentials(user_id,encrypted_key) VALUES (?,?) ON DUPLICATE KEY UPDATE encrypted_key=VALUES(encrypted_key),updated_at=UTC_TIMESTAMP(3)',[owner,sealed]);
    }
    await this.pool.execute('UPDATE tracker_preferences SET model=? WHERE user_id=?',[body.model,owner]);return [200,await this.settings(owner)];
   }
   if(method==='DELETE'){await this.pool.execute('DELETE FROM provider_credentials WHERE user_id=?',[owner]);return [200,await this.settings(owner)];}
  }
  if(method==='GET'&&path==='/dashboard'){
   const zone=timezone(query.get('timezone')||'UTC'),day=calendarDay(zone,this.now());
   const [groups]=await this.pool.execute('SELECT id,name,description,position FROM day_groups WHERE user_id=? ORDER BY position,name',[owner]);
   const [rows]=await this.pool.execute('SELECT s.id,s.group_id,s.name,s.analysis,s.model,s.created_at,IF(c.supplement_id IS NULL,0,1) AS completed FROM supplements s LEFT JOIN supplement_completions c ON c.supplement_id=s.id AND c.local_day=? WHERE s.user_id=? ORDER BY s.created_at',[day,owner]);
   return [200,{day,groups,supplements:rows.map(row=>({...row,completed:Boolean(row.completed),analysis:typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis})),ai:await this.settings(owner)}];
  }
  if(method==='POST'&&path==='/groups'){
   const name=text(body.name,120),description=text(body.description||'',500,false),id=randomUUID();
   const [count]=await this.pool.execute('SELECT COUNT(*) AS n FROM day_groups WHERE user_id=?',[owner]);if(count[0].n>=30)throw new ApiError(400,'GROUP_LIMIT');
   await this.pool.execute('INSERT INTO day_groups(id,user_id,name,description,position) VALUES (?,?,?,?,?)',[id,owner,name,description,count[0].n]);return [201,{id}];
  }
  const group=/^\/groups\/([a-f0-9-]{36})$/.exec(path);
  if(group){
   if(method==='PATCH'){
    const [result]=await this.pool.execute('UPDATE day_groups SET name=?,description=? WHERE id=? AND user_id=?',[text(body.name,120),text(body.description||'',500,false),group[1],owner]);if(!result.affectedRows)throw new ApiError(404,'NOT_FOUND');return [200,{ok:true}];
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
   if(method==='GET'){const [rows]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 1`,[owner]);const [recent]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? ORDER BY GREATEST(created_at,COALESCE(finished_at,created_at)) DESC LIMIT 20`,[owner]);const [active]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE user_id=? AND status='running' ORDER BY created_at`,[owner]);return [200,{job:jobResult(rows[0]),active:active.map(jobResult),recent:recent.map(jobResult)}];}
  }
  const job=/^\/supplements\/jobs\/([a-f0-9-]{36})$/.exec(path);
  if(job&&method==='GET'){const [rows]=await this.pool.execute(`SELECT ${jobColumns} FROM analysis_jobs WHERE id=? AND user_id=?`,[job[1],owner]);if(!rows.length)throw new ApiError(404,'NOT_FOUND');return [200,jobResult(rows[0])];}
  if(method==='POST'&&path==='/supplements/analyze'){if(this.singlePass)throw new ApiError(404,'NOT_FOUND');return this.analyze(owner,body,authorization);}
  const research=/^\/supplements\/([a-f0-9-]{36})\/research$/.exec(path);
  if(research&&method==='POST')return [202,await this.startResearch(owner,research[1],body,authorization)];
  const supplement=/^\/supplements\/([a-f0-9-]{36})(\/completion)?$/.exec(path);
  if(supplement){
   const id=supplement[1];
   if(method==='PUT'&&supplement[2]){
    if(typeof body.completed!=='boolean')throw new ApiError(400,'INVALID_INPUT');
    const day=calendarDay(timezone(body.timezone||'UTC'),this.now());
    await this.auth.transaction(async db=>{
     const [owned]=await db.execute('SELECT id FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[id,owner]);if(!owned.length)throw new ApiError(404,'NOT_FOUND');
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
 async startAnalysis(owner,body,authorization){
  if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');
  const name=text(body.name||'',250,false),image=validatePhoto(body.image),language=body.language==='lt'?'lt':'en';if(!name&&!image)throw new ApiError(400,'NAME_OR_PHOTO_REQUIRED');
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
   const report={submission:{kind:image?'photo':'name',name},items:[],skipped:[],language};
   await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,result) VALUES (?,?,?,'running','queued',?,?)",[id,owner,body.requestId,language,JSON.stringify(report)]);result={id,status:'running',phase:'queued',language,result:report,created_at:new Date().toISOString(),supplement_id:null,error_code:null};
  });}catch(error){this.activeJobs.delete(id);throw error;}
  if(result.id!==id||result.status==='complete'){this.activeJobs.delete(id);return result;}
  // The task owns a private mutable payload; it drops image bytes before enqueueing
  // any research. Waiting research contains names/IDs, never a raw photo or key.
  void this.runProgressive(owner,{requestId:body.requestId,name,image,language},authorization,id);
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
  let report={submission:{kind:body.image?'photo':'name',name:body.name},items:[],skipped:[],language:body.language};
  let sealed,failurePhase='queued';
  try{
   let recognition=this.recognitionQueues.get(owner);if(!recognition){recognition=createTaskQueue({concurrency:1,maxPending:3});this.recognitionQueues.set(owner,recognition);}
   // Release the owner recognition slot immediately after committing the preview,
   // so queued photos do not wait for slow web research of an earlier upload.
   await recognition.enqueue(async()=>{
   failurePhase='recognizing';await this.auth.authenticate(authorization);this.jobOwners.set(owner,id);
   await this.pool.execute("UPDATE analysis_jobs SET phase='recognizing' WHERE id=? AND user_id=?",[id,owner]);
   const [groups]=await this.pool.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);if(!groups.length)throw new ApiError(400,'CREATE_GROUP_FIRST');
   const [keys]=await this.pool.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');sealed=keys[0].encrypted_key;
   const [supplements]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);
   const context=JSON.stringify(groups),started=Date.now(),language=body.language,settings=await this.settings(owner);
   let {result,model}=await this.provider(()=>this.discover({key:this.vault.open(keys[0].encrypted_key,{owner,provider:'xai'}),model:this.discoveryModel||settings.model,messages:(this.singlePass?basicProductsMessages:photoProductsMessages)({...body,groups,supplements}),schema:this.singlePass?basicProductsSchema(groups,language):photoProductsSchema(groups,supplements,language),validate:v=>this.singlePass?validBasicProducts(v,groups,language):validPhotoProducts(v,groups,supplements,language),name:this.singlePass?'supplement_basics_v1':'quick_supplement_routine_v2',maxTokens:5000}),{priority:10});
   if(this.singlePass){if(!validBasicProducts(result,groups,language))throw new ApiError(502,'AI_INVALID_RESPONSE');result=normalizeBasicProducts(result);}
   body.image=null; // No background research request resends a photo.
   if(!validPhotoProducts(result,groups,supplements,language))throw new ApiError(502,'AI_INVALID_RESPONSE');
   await this.auth.authenticate(authorization);await this.checkKey(owner,keys[0].encrypted_key);
   report={submission:report.submission,items:[],skipped:[...result.skipped],language,recognitionMs:Date.now()-started,recognitionModel:model};
   const products=uniqueProducts(result.products);if(!products.length&&!report.skipped.length)report.skipped.push({location:'',reasonCode:'SUPPLEMENT_NOT_IDENTIFIED'});if(result.overflow)report.skipped.push({location:'',reasonCode:'PHOTO_PRODUCT_LIMIT'});
   await this.auth.transaction(async db=>{
    await db.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[owner]);
    const [latestGroups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position FOR UPDATE',[owner]);if(JSON.stringify(latestGroups)!==context)throw new ApiError(409,'COLLECTION_CHANGED');
    const [rows]=await db.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);
    let capacity=40-rows.length;
    for(const [index,product] of products.entries()){
     const identity=productIdentity(product),matches=rows.filter(row=>{const a=typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis;return productIdentity(a.identity||{...a,name:row.name})===identity;}),existing=matches.find(row=>row.id===product.existingId)||matches.find(row=>row.group_id)||matches[0];
     if(existing){
      const a=typeof existing.analysis==='string'?JSON.parse(existing.analysis):existing.analysis;
      if(this.singlePass){report.items.push({id:existing.id,name:existing.name,status:'added',reused:true,research:'reused'});continue;}
      const fresh=a.enrichment?.status!=='failed'&&(!a.enrichment||a.enrichment.status==='complete')&&a.language===language&&a.research?.checkedAt&&Date.now()-Date.parse(a.research.checkedAt)<30*86400000&&a.sources?.length;
      // Another live job owns this same product; reuse its queue item instead of billing twice.
      const pending=['queued','researching'].includes(a.enrichment?.status);
      if(!fresh&&!pending){a.identity=product;a.enrichment={status:'queued',jobId:id,language};await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),existing.id,owner]);}
      report.items.push({id:existing.id,name:existing.name,status:'added',reused:true,research:fresh||pending?'reused':'queued'});continue;
     }
     if(capacity<=0){report.skipped.push({name:product.name,reasonCode:'SUPPLEMENT_LIMIT'});continue;}capacity--;
     const draft=draftAnalysis({...product,requestedName:body.name||null},{language,jobId:id}),recordId=randomUUID();
     if(this.singlePass){draft.schemaVersion='basic-1';draft.enrichment={status:'complete',jobId:id,language};draft.needsReview=product.review;draft.productName=product.name;}
     await db.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) VALUES (?,?,?,?,?,?,?)',[recordId,owner,product.groupId,draft.productName,JSON.stringify(draft),model,productRequestId(body.requestId,index)]);
     report.items.push({id:recordId,name:draft.productName,status:'added',research:this.singlePass?'complete':'queued'});
    }
    await db.execute('UPDATE analysis_jobs SET phase=\'enriching\',total_count=?,result=? WHERE id=? AND user_id=?',[report.items.length,JSON.stringify(report),id,owner]);
   });
   if(this.jobOwners.get(owner)===id)this.jobOwners.delete(owner);await this.jobProgress(owner,id,report);
   });failurePhase='enriching';
   await Promise.all(report.items.filter(item=>item.research==='queued').map(async item=>{
    const queuedAt=Date.now();
    try{await this.backgroundQueue.enqueue(async()=>{item.research='researching';item.queueMs=Date.now()-queuedAt;await this.jobProgress(owner,id,report);await this.enrich(owner,item.id,body.language,authorization,id,sealed);});item.research='complete';}
    catch(error){item.research='failed';item.error=safeCode(error);await this.markResearchFailed(owner,item.id,id,item.error);}
    item.elapsedMs=Date.now()-queuedAt;await this.jobProgress(owner,id,report);
   }));
   await this.jobProgress(owner,id,report,'done');await this.pool.execute("UPDATE analysis_jobs SET status=?,error_code=?,finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[report.items.length?'complete':'failed',report.items.length?null:'SUPPLEMENT_NOT_IDENTIFIED',id,owner]);
  }catch(error){body.image=null;report.failedPhase=failurePhase;const code=safeCode(error);for(const item of report.items){if(!['queued','researching'].includes(item.research))continue;item.research='failed';item.error=code;try{await this.markResearchFailed(owner,item.id,id,code);}catch{ /* DB may be unavailable; startup also marks interrupted drafts. */ }}try{await this.jobProgress(owner,id,report,'done');await this.pool.execute("UPDATE analysis_jobs SET status='failed',phase='done',error_code=?,finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[code,id,owner]);}catch{ /* Deleted accounts have no surviving private job metadata. */ }}
  finally{body.image=null;this.activeJobs.delete(id);if(this.jobOwners.get(owner)===id)this.jobOwners.delete(owner);const queue=this.recognitionQueues.get(owner);if(queue&&!queue.running&&!queue.size){queue.close();this.recognitionQueues.delete(owner);}}
 }
 /** Explicit refresh/retry never performs recognition and never adds a second row.
  * It uses the selected UI language; a completed result is retained while refreshing.
  */
 async startResearch(owner,supplementId,body,authorization){
  if(this.singlePass)throw new ApiError(404,'NOT_FOUND');
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
   const id=randomUUID(),report={items:[{id:supplementId,name:rows[0].name,status:'added',research:'queued',reused:true}],skipped:[],language};a.enrichment={status:'queued',jobId:id,language};
   await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),supplementId,owner]);
   await db.execute("INSERT INTO analysis_jobs(id,user_id,request_id,status,phase,language,total_count,result) VALUES (?,?,?,'running','enriching',?,1,?)",[id,owner,body.requestId,language,JSON.stringify(report)]);job={id,status:'running',phase:'enriching',language,total_count:1,processed_count:0,result:report};
  });
  if(job.status!=='running'||this.activeJobs.has(job.id))return job;this.activeJobs.add(job.id);
  void (async()=>{const item=job.result.items[0];try{await this.backgroundQueue.enqueue(async()=>{item.research='researching';await this.jobProgress(owner,job.id,job.result);await this.enrich(owner,supplementId,language,authorization,job.id,sealed);});item.research='complete';}
   catch(error){item.research='failed';item.error=safeCode(error);await this.markResearchFailed(owner,supplementId,job.id,item.error);}
   finally{try{await this.jobProgress(owner,job.id,job.result,'done');await this.pool.execute("UPDATE analysis_jobs SET status='complete',finished_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",[job.id,owner]);}catch{ /* Deleted account. */ }this.activeJobs.delete(job.id);}
  })().catch(()=>{this.activeJobs.delete(job.id);});return job;
 }
 async checkKey(owner,encrypted){const [keys]=await this.pool.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');if(encrypted&&keys[0].encrypted_key!==encrypted)throw new ApiError(409,'AI_KEY_CHANGED');return keys[0].encrypted_key;}
 async markResearchFailed(owner,id,jobId,error){
  await this.auth.transaction(async db=>{const [rows]=await db.execute('SELECT analysis FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[id,owner]);if(!rows.length)return;const a=typeof rows[0].analysis==='string'?JSON.parse(rows[0].analysis):rows[0].analysis;if(a.enrichment?.jobId!==jobId)return;a.enrichment={...a.enrichment,status:'failed',error};await db.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(a),id,owner]);});
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
  previous.enrichment.status='researching';await this.pool.execute('UPDATE supplements SET analysis=? WHERE id=? AND user_id=?',[JSON.stringify(previous),id,owner]);
  const supplements=rows.filter(row=>row.id!==id),snapshot=JSON.stringify(rows.map(row=>[row.id,row.name,row.group_id,row.id===id?null:row.analysis]));
  const {result,model}=await this.requestResearch(owner,{name:target.name,image:null,language,target:previous.identity||null,groups,supplements,settings,sealed},authorization);
  await this.auth.transaction(async db=>{
   const [latest]=await db.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id FOR UPDATE',[owner]);const row=latest.find(r=>r.id===id);if(!row)throw new ApiError(404,'NOT_FOUND');
   const a=typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis;if(a.enrichment?.jobId!==jobId)throw new ApiError(409,'COLLECTION_CHANGED');
   const changed=JSON.stringify(latest.map(r=>[r.id,r.name,r.group_id,r.id===id?null:r.analysis]))!==snapshot;
   if(changed){result.compatibility.stale=true;result.compatibility.requiresReview=true;result.needsReview=true;}
   // Planning and safety are separate: a conflict remains visible without erasing
   // the user's schedule. Concurrent/manual grouping always takes precedence.
   const [owned]=await db.execute('SELECT id FROM day_groups WHERE user_id=?',[owner]);
   const grouping=routineGrouping({proposed:result.groupId,previous:target.group_id,ownedIds:owned.map(g=>g.id),manual:a.grouping?.basis==='manual'||row.group_id!==target.group_id,current:row.group_id});
   const groupId=grouping.groupId;result.grouping=grouping;
   if(grouping.basis==='provisional'){result.needsReview=true;}
   result.identity=previous.identity;result.enrichment={status:'complete',jobId,language};
   await db.execute('UPDATE supplements SET name=?,analysis=?,model=?,group_id=? WHERE id=? AND user_id=?',[result.productName,JSON.stringify(result),model,groupId,id,owner]);
  });
 }
 async requestResearch(owner,{name,image,language,target,groups,supplements,settings,sealed},authorization){
  const started=Date.now();const data=await this.provider(()=>this.chat({key:this.vault.open(sealed,{owner,provider:'xai'}),model:settings.model,messages:analysisMessages({name,image,groups,supplements,language,target}),schema:analysisSchema(groups,supplements,language),validate:value=>validAnalysis(value,groups,supplements,language),name:'supplement_analysis_v1_4',maxTokens:Math.min(12000,4500+supplements.length*190)}));
  const {result,citations}=data;if(!result.identified)throw new ApiError(422,'SUPPLEMENT_NOT_IDENTIFIED');finalizeAnalysis(result,{citations,image:Boolean(image),now:this.now()});result.research.elapsedMs=Date.now()-started;await this.auth.authenticate(authorization);await this.checkKey(owner,sealed);
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
  const [keys]=await this.pool.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');
  const settings=await this.settings(owner);if(!this.models.includes(settings.model))throw new ApiError(400,'INVALID_MODEL');
  const [supplements]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);
  if(supplements.length>=40)throw new ApiError(400,'SUPPLEMENT_LIMIT');
  const snapshot=JSON.stringify([groups,supplements]);
  if(this.running.size>=4)throw new ApiError(503,'AI_BUSY');
  this.running.add(owner);
  try{
   const key=this.vault.open(keys[0].encrypted_key,{owner,provider:'xai'});
   const {result,model,citations}=await this.provider(()=>this.chat({key,model:settings.model,messages:analysisMessages({name,image,groups,supplements,language,target}),schema:analysisSchema(groups,supplements,language),validate:value=>validAnalysis(value,groups,supplements,language),name:'supplement_analysis_v1_4',maxTokens:Math.min(12000,4500+supplements.length*190)}));
   if(!result.identified)throw new ApiError(422,'SUPPLEMENT_NOT_IDENTIFIED');
   finalizeAnalysis(result,{citations,image:Boolean(image),now:this.now()});
   await this.auth.authenticate(authorization);
   const [current]=await this.pool.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);
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
