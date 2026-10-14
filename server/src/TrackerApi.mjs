/** User-scoped tracker endpoints. All ownership is derived from the bearer session.
 * AI results are validated before a transaction writes a supplement. Raw photos/keys
 * are never persisted in this class's results or logs. Completion day is derived on
 * the server using a validated device timezone; no midnight background worker is needed.
 */
import {randomUUID,createHash} from 'node:crypto';
import {ApiError} from './security.mjs';
import {ProviderError} from './structured-chat.mjs';
import {analysisSchema,validAnalysis,analysisMessages} from './analysis.mjs';
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
 constructor(pool,auth,{vault,chat,models=['grok-4.7'],now=()=>new Date()}){this.pool=pool;this.auth=auth;this.vault=vault;this.chat=chat;this.models=models;this.now=now;this.running=new Set();}
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
  if(method==='POST'&&path==='/supplements/analyze')return this.analyze(owner,body,authorization);
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
     const [result]=await db.execute('UPDATE supplements SET group_id=? WHERE id=? AND user_id=?',[groupId,id,owner]);if(!result.affectedRows)throw new ApiError(404,'NOT_FOUND');
    });return [200,{ok:true}];
   }
  }
  throw new ApiError(404,'NOT_FOUND');
 }
 async analyze(owner,body,authorization){
  if(!uuid(body.requestId))throw new ApiError(400,'INVALID_INPUT');
  const name=text(body.name||'',250,false),image=validatePhoto(body.image),language=body.language==='lt'?'lt':'en';
  if(!name&&!image)throw new ApiError(400,'NAME_OR_PHOTO_REQUIRED');
  const [existing]=await this.pool.execute('SELECT id FROM supplements WHERE user_id=? AND request_id=?',[owner,body.requestId]);
  if(existing.length)return [200,{id:existing[0].id,reused:true}];
  if(this.running.has(owner))throw new ApiError(409,'AI_BUSY');
  await this.auth.limit('ai-minute',owner,3,60);await this.auth.limit('ai-day',owner,30,86400);
  const [groups]=await this.pool.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
  if(!groups.length)throw new ApiError(400,'CREATE_GROUP_FIRST');
  const [keys]=await this.pool.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);if(!keys.length)throw new ApiError(400,'AI_KEY_REQUIRED');
  const settings=await this.settings(owner);if(!this.models.includes(settings.model))throw new ApiError(400,'INVALID_MODEL');
  const [supplements]=await this.pool.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);
  if(supplements.length>=40)throw new ApiError(400,'SUPPLEMENT_LIMIT');
  const snapshot=JSON.stringify([groups,supplements]);
  this.running.add(owner);
  try{
   const key=this.vault.open(keys[0].encrypted_key,{owner,provider:'xai'});
   const {result,model}=await this.chat({key,model:settings.model,messages:analysisMessages({name,image,groups,supplements,language}),schema:analysisSchema(groups,supplements),validate:value=>validAnalysis(value,groups,supplements),name:'supplement_analysis_v1_1',maxTokens:Math.min(8000,2400+supplements.length*140)});
   if(!result.identified)throw new ApiError(422,'SUPPLEMENT_NOT_IDENTIFIED');
   await this.auth.authenticate(authorization);
   const [current]=await this.pool.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);
   if(current[0]?.encrypted_key!==keys[0].encrypted_key)throw new ApiError(409,'AI_KEY_CHANGED');
   const conflicts=result.compatibility.assessments.some(a=>['potential_conflict','duplicate'].includes(a.status));
   if(conflicts){result.needsReview=true;result.compatibility.requiresReview=true;}
   for(const item of result.compatibility.assessments)item.supplementName=supplements.find(s=>s.id===item.supplementId).name;
   const id=randomUUID(),groupId=conflicts||result.confidence==='low'?null:result.groupId;
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
