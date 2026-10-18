/** Opt-in owner-scoped JSON workflow persistence. SQL table is explicitly migrated
 * by the host; no automatic DB provisioning. All mutations lock one record and may
 * update domain rows through the SAME connection. Never persist keys/raw photos.
 * See WORKFLOWS.md; server-only, mysql-compatible pool injected by caller.
 */
import {randomUUID,createHash} from 'node:crypto';
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const valid=(owner,kind,id)=>{if(typeof owner!=='string'||!owner||owner.length>191||!/^[\x21-\x7e]+$/.test(owner)||!['job','proposals','report','history'].includes(kind)||typeof id!=='string'||!id||id.length>191||!/^[\x21-\x7e]+$/.test(id))throw new TypeError('Invalid workflow scope');};
export function createSqlWorkflowStore(pool){
 return {
  async read(owner,kind,id){valid(owner,kind,id);const [rows]=await pool.execute('SELECT document,revision FROM app_workflows WHERE owner_id=? AND kind=? AND id=?',[owner,kind,id]);return rows[0]?{...parse(rows[0].document),revision:Number(rows[0].revision)}:null;},
  async list(owner,kind){valid(owner,kind,'list');const [rows]=await pool.execute('SELECT document,revision FROM app_workflows WHERE owner_id=? AND kind=? ORDER BY updated_at,id',[owner,kind]);return rows.map(row=>({...parse(row.document),revision:Number(row.revision)}));},
  async create(owner,kind,id,document){valid(owner,kind,id);const text=JSON.stringify(document);if(text.length>262144)throw new RangeError('Workflow too large');await pool.execute('INSERT IGNORE INTO app_workflows(owner_id,kind,id,document) VALUES (?,?,?,?)',[owner,kind,id,text]);return this.read(owner,kind,id);},
  async mutate(owner,kind,id,change){valid(owner,kind,id);const db=await pool.getConnection();try{await db.beginTransaction();const [rows]=await db.execute('SELECT document,revision FROM app_workflows WHERE owner_id=? AND kind=? AND id=? FOR UPDATE',[owner,kind,id]);if(!rows[0])throw new Error('WORKFLOW_NOT_FOUND');const current={...parse(rows[0].document),revision:Number(rows[0].revision)},next=await change(structuredClone(current),db);if(next){const {revision,...document}=next,text=JSON.stringify(document);if(text.length>262144)throw new RangeError('Workflow too large');await db.execute('UPDATE app_workflows SET document=?,revision=revision+1 WHERE owner_id=? AND kind=? AND id=?',[text,owner,kind,id]);}await db.commit();return next?{...next,revision:current.revision+1}:current;}catch(e){await db.rollback();throw e;}finally{db.release();}},
  async removeOwner(owner,{db=pool}={}){valid(owner,'job','all');await db.execute('DELETE FROM app_workflows WHERE owner_id=?',[owner]);}
 };
}
/** Hash only the caller-selected semantic input; exclude Taken/display caches and
 * forbidden personal fields BEFORE calling. This is not an encryption function. */
export function workflowFingerprint(value){const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function createJobService(store,{now=()=>new Date()}={}){
 const instant=()=>now().toISOString();
 return {
  async submit(owner,{requestId,type,total=0,metadata={}}){if(typeof requestId!=='string'||!requestId||requestId.length>191||!Number.isInteger(total)||total<0||typeof type!=='string'||type.length>100)throw new TypeError('Invalid job');const id=createHash('sha256').update(JSON.stringify([owner,requestId])).digest('hex');return store.create(owner,'job',id,{id,requestId,type,status:'queued',phase:'queued',total,processed:0,metadata,createdAt:instant(),items:[]});},
  read:(owner,id)=>store.read(owner,'job',id),list:owner=>store.list(owner,'job'),
  start(owner,id){return store.mutate(owner,'job',id,job=>{if(job.status!=='queued')throw new Error('JOB_ALREADY_STARTED');return {...job,status:'running',phase:'working',startedAt:instant()};});},
  progress(owner,id,{processed,phase='working',items=[]}){return store.mutate(owner,'job',id,job=>{if(job.status!=='running')throw new Error('JOB_NOT_RUNNING');if(!Number.isInteger(processed)||processed<job.processed||processed>job.total||typeof phase!=='string'||phase.length>80||!Array.isArray(items))throw new TypeError('Invalid progress');return {...job,processed,phase,items};});},
  finish(owner,id,result){return store.mutate(owner,'job',id,job=>{if(job.status!=='running')throw new Error('JOB_NOT_RUNNING');return {...job,status:'complete',phase:'done',processed:job.total,result,finishedAt:instant()};});},
  fail(owner,id,code='REQUEST_FAILED'){if(!/^[A-Z_]{1,80}$/.test(code))throw new TypeError('Use a safe error code');return store.mutate(owner,'job',id,job=>['queued','running'].includes(job.status)?{...job,status:'failed',phase:'done',error:code,finishedAt:instant()}:null);},
  async interrupt(owner){for(const job of await store.list(owner,'job'))if(['queued','running'].includes(job.status))await this.fail(owner,job.id,'INTERRUPTED');}
 };
}
export function createProposalService(store){return {
 create:(owner,id,items)=>{if(!Array.isArray(items)||new Set(items.map(i=>i.id)).size!==items.length)throw new TypeError('Duplicate proposals');return store.create(owner,'proposals',id,{id,items:items.map(item=>({...item,status:'pending'}))});},
 read:(owner,id)=>store.read(owner,'proposals',id),
 resolve(owner,id,itemId,action,{validate=()=>true,apply=async()=>{}}={}){if(!['accept','remove'].includes(action))throw new TypeError('Invalid action');return store.mutate(owner,'proposals',id,async(record,db)=>{const item=record.items.find(i=>i.id===itemId);if(!item)throw new Error('PROPOSAL_NOT_FOUND');const status=action==='accept'?'accepted':'removed';if(item.status===status)return null;if(item.status!=='pending')throw new Error('PROPOSAL_RESOLVED');if(action==='accept'){if(!await validate(item,db))throw new Error('STALE_PROPOSAL');await apply(item,db);}item.status=status;return record;});}
};}
export function createReportService(store,{now=()=>new Date()}={}){return {
 async read(owner,id,input){const record=await store.read(owner,'report',id);return record?{...record,stale:Boolean(record.report&&record.fingerprint!==workflowFingerprint(input))}:null;},
 async begin(owner,id,input){await store.create(owner,'report',id,{id,status:'idle',report:null});const token=randomUUID();return store.mutate(owner,'report',id,record=>{if(record.status==='running')throw new Error('REPORT_BUSY');return {...record,status:'running',token,pendingFingerprint:workflowFingerprint(input),error:null};});},
 complete(owner,id,token,report){return store.mutate(owner,'report',id,record=>{if(record.status!=='running'||record.token!==token)throw new Error('STALE_REPORT');return {...record,status:'complete',report,fingerprint:record.pendingFingerprint,generatedAt:now().toISOString(),pendingFingerprint:null,token:null};});},
 fail(owner,id,token,error='REQUEST_FAILED'){if(!/^[A-Z_]{1,80}$/.test(error))throw new TypeError('Use a safe error code');return store.mutate(owner,'report',id,record=>record.token===token?{...record,status:'failed',error,token:null}:null);}
};}
/** Explicit projection: omitted/null/empty optional fields never leave the server.
 * Call on private synthesis only, not on public research/search requests. */
export function allowedProfile(profile,{consent=false,fields=[]}={}){return consent?Object.fromEntries(fields.filter(k=>profile?.[k]!==null&&profile?.[k]!==undefined&&profile[k]!==''&&(!Array.isArray(profile[k])||profile[k].length)).map(k=>[k,structuredClone(profile[k])])):{};}
