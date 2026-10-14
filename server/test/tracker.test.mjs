/** Isolated database workflow. Run only with DB_TEST_HOST and a disposable server.
 * No production compose/env/password files are accepted by this runner. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import mysql from 'mysql2/promise';
import {AuthApi} from '../src/AuthApi.mjs';
import {hashPassword,decrypt} from '../src/security.mjs';
import {TrackerApi,calendarDay,validatePhoto} from '../src/TrackerApi.mjs';
import {createCredentialVault} from '../src/credential-vault.mjs';
import {validAnalysis} from '../src/analysis.mjs';
import {ProviderError} from '../src/structured-chat.mjs';
test('calendar boundary and image validation',()=>{
 assert.equal(calendarDay('Europe/Vilnius',new Date('2026-10-14T20:59:59Z')),'2026-10-14');assert.equal(calendarDay('Europe/Vilnius',new Date('2026-10-14T21:00:00Z')),'2026-10-15');assert.throws(()=>validatePhoto('https://example.com/label.jpg'));assert.throws(()=>validatePhoto('data:image/jpeg;base64,YWJjZGVmZ2g='));
});
test('tracker ownership, encrypted credentials, validated AI and daily records',async t=>{
 assert.equal(process.env.DB_TEST_HOST,'tracker-checks-db','A disposable test host is required');
 const root=await mysql.createConnection({host:process.env.DB_TEST_HOST,user:'root',password:readFileSync('/run/secrets/test_db_root','utf8').trim(),multipleStatements:true});
 const database='tracker_checks_'+randomBytes(5).toString('hex'),account='checks_'+randomBytes(5).toString('hex'),secret=randomBytes(32).toString('hex');let pool;
 try{
  await root.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);await root.query(`USE ${database}`);await root.query(readFileSync('/app/schema.sql','utf8'));await root.query(readFileSync('/app/migrations/002_tracker.sql','utf8'));await root.query(readFileSync('/app/migrations/003_analysis_jobs.sql','utf8'));await root.query(readFileSync('/app/migrations/004_persistent_sessions.sql','utf8'));await root.query(readFileSync('/app/migrations/005_photo_batches.sql','utf8'));await root.query(readFileSync('/app/migrations/006_progressive_analysis.sql','utf8'));await root.query(readFileSync('/app/migrations/007_account_group_cascade.sql','utf8'));await root.query(readFileSync('/app/migrations/008_upload_queue.sql','utf8'));await root.query("CREATE USER ?@'%' IDENTIFIED BY ?",[account,secret]);await root.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${database}.* TO ?@'%'`,[account]);
  pool=mysql.createPool({host:process.env.DB_TEST_HOST,user:account,password:secret,database,timezone:'Z'});
  const config={persistentSessions:true,secret:randomBytes(32).toString('hex'),mailConfigured:false,encryptionKey:randomBytes(32),appUrl:'https://app.example/'};
  const auth=new AuthApi(pool,config,await hashPassword('A long dummy secret phrase'));
  const password='A long isolated testing password';
  for(const name of ['alice','bob'])await auth.register({email:name+'@example.test',name,password},name);
  const a=await auth.login({email:'alice@example.test',password},'a'),b=await auth.login({email:'bob@example.test',password},'b');
  let now=new Date('2026-10-14T20:59:59Z'),calls=0,lastInput,mode='valid',pauseResearch=null,enteredResearch=null;
  const vault=createCredentialVault(randomBytes(32));
  const chat=async input=>{
   calls++;lastInput=input;if(pauseResearch){enteredResearch?.();await pauseResearch;}const context=JSON.parse(input.messages[1].content[0].text);
   if(mode==='batch'){assert.ok(context.selectedTarget);assert.ok(context.existingSupplements.length>=2);if(context.selectedTarget.name==='Unreadable source')throw new ProviderError('AI_SOURCES_UNVERIFIED');}
   const result={schemaVersion:'1.3',language:context.responseLanguage,manufacturer:'Example',variant:'1000 mg',dosage:{directions:'1 tablet daily',servingSize:'1 tablet',dailyServingsMin:1,dailyServingsMax:1,sourceUrl:'https://manufacturer.example/product',evidence:'manufacturer'},nutrients:[{name:'Vitamin C',amount:1000,unit:'mg',originalUnit:null,nrvCode:'vitamin_c',nrvComparable:true,amountNote:'Per tablet',sourceUrl:'https://manufacturer.example/product',evidence:'manufacturer'}],sources:[{url:'https://manufacturer.example/product',title:'Official label',kind:'manufacturer'}],identified:true,productName:context.selectedTarget?.name||'Example manufacturer product',groupId:context.groups[0].id,benefits:[context.responseLanguage==='lt'?'Galima nauda':'Potential benefit'],howToUse:'Check label.',whenToUse:'With food.',labelDirections:null,cautions:['Check interactions.'],confidence:'medium',needsReview:true,reviewReason:'Missing label.',evidenceNote:'General information.',compatibility:{summary:'Review needed.',requiresReview:false,assessments:context.existingSupplements.map(s=>({supplementId:s.id,status:mode==='conflict'?'duplicate':'insufficient_information',reason:'Unknown amount.'}))}};
   assert.equal(input.validate(result),true);return {result,model:input.model,citations:['https://manufacturer.example/product']};
  };
  let discoveryCalls=0;const discover=async input=>{discoveryCalls++;const context=JSON.parse(input.messages[1].content[0].text);const result={...discovery,language:context.responseLanguage,products:discovery.products.map(p=>({...p,groupId:context.groups[0].id}))};assert.equal(input.validate(result),true);return {result,model:input.model};};
  const product=name=>({name,manufacturer:'Example',variant:'1000 mg',labelText:'',groupId:null,reason:'With a meal',benefit:'Possible support',review:false,existingId:null});
  const products=['Batch C','Unreadable source','Batch magnesium'].map(product);
  let discovery={version:'2',products:[product('manufacturer product')],skipped:[],overflow:false};
  const tracker=new TrackerApi(pool,auth,{vault,chat,discover,now:()=>now});
  const request=(session,method,path,body={},query)=>tracker.handle(method,path,body,'Bearer '+session.token,'test',query);
  const query=new URLSearchParams({timezone:'Europe/Vilnius'});
  await request(a,'POST','/bootstrap',{timezone:'Europe/Vilnius',language:'en'});await request(b,'POST','/bootstrap',{timezone:'Europe/Vilnius',language:'lt'});
  let dashboard=(await request(a,'GET','/dashboard',{},query))[1];assert.equal(dashboard.groups.length,4);const group=dashboard.groups[0].id;
  await t.test('permanent sessions have no clock expiry but remain revocable',async()=>{
   assert.equal(a.expiresAt,null);assert.equal((await auth.authenticate('Bearer '+a.token)).expiresAt,null);
   const [stored]=await pool.query('SELECT expires_at FROM auth_sessions WHERE user_id=?',[a.user.id]);assert.equal(stored[0].expires_at,null);
   await pool.query("DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP(3)");await auth.authenticate('Bearer '+a.token);
   config.persistentSessions=false;const finite=await auth.login({email:'alice@example.test',password},'finite');assert.ok(Date.parse(finite.expiresAt)>Date.now());
   await pool.query("UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=SHA2(?,256)",[finite.token]);await assert.rejects(auth.authenticate('Bearer '+finite.token),e=>e.status===401);
   const legacy=await auth.login({email:'alice@example.test',password},'legacy-valid');
   await root.query(readFileSync('/app/migrations/004_persistent_sessions.sql','utf8'));
   assert.equal((await auth.authenticate('Bearer '+legacy.token)).expiresAt,null);await assert.rejects(auth.authenticate('Bearer '+finite.token),e=>e.status===401);
   await auth.dispatch('POST','/logout',{},'Bearer '+legacy.token,'legacy-logout');
   await auth.dispatch('POST','/logout',{},'Bearer '+a.token,'logout');await assert.rejects(auth.authenticate('Bearer '+a.token),e=>e.status===401);
   config.persistentSessions=true;const reopened=await auth.login({email:'alice@example.test',password},'reopened');a.token=reopened.token;assert.equal(reopened.expiresAt,null);
  });
  await t.test('recovery fails honestly when disabled and reset links are encrypted and one-use',async()=>{
   await assert.rejects(auth.forgot({email:'bob@example.test'},'disabled-recovery'),e=>e.status===503);
   config.mailConfigured=true;await auth.forgot({email:'bob@example.test'},'working-recovery');
   const [jobs]=await pool.query('SELECT encrypted_payload FROM email_outbox WHERE user_id=?',[b.user.id]);assert.equal(jobs.length,1);assert.equal(jobs[0].encrypted_payload.includes('bob@example.test'),false);
   const payload=decrypt(jobs[0].encrypted_payload,config.encryptionKey),token=new URL(payload.link).hash.slice('#reset='.length);
   await auth.reset({token,password},'reset-success');await assert.rejects(auth.reset({token,password},'reset-reuse'),e=>e.status===400);await assert.rejects(auth.authenticate('Bearer '+b.token),e=>e.status===401);
   const fresh=await auth.login({email:'bob@example.test',password},'bob-restored');b.token=fresh.token;config.mailConfigured=false;
  });
  await t.test('credentials are encrypted, owner-bound and never returned',async()=>{
   const key='xai-test-only-not-real-key';await request(a,'PUT','/settings/ai',{key,model:'grok-4.7'});
   const [rows]=await pool.query('SELECT encrypted_key FROM provider_credentials');assert.equal(rows[0].encrypted_key.includes(key),false);assert.equal(vault.open(rows[0].encrypted_key,{owner:a.user.id,provider:'xai'}),key);assert.throws(()=>vault.open(rows[0].encrypted_key,{owner:b.user.id,provider:'xai'}));assert.equal(JSON.stringify((await request(a,'GET','/settings/ai'))).includes(key),false);
  });
  let first;
  await t.test('AI receives all groups; saved request IDs do not rebill',async()=>{
   const body={requestId:randomUUID(),name:'Example manufacturer product'};first=(await request(a,'POST','/supplements/analyze',body))[1].id;assert.equal(calls,1);await request(a,'POST','/supplements/analyze',body);assert.equal(calls,1);assert.equal(JSON.parse(lastInput.messages[1].content[0].text).groups.length,4);
  });
  await t.test('cross-account reads and writes cannot access another routine',async()=>{
   const other=(await request(b,'GET','/dashboard',{},query))[1];assert.equal(other.supplements.length,0);
   for(const [method,path,body] of [['DELETE','/supplements/'+first,{}],['PUT','/supplements/'+first+'/completion',{completed:true}],['PATCH','/groups/'+group,{name:'attack'}]])await assert.rejects(request(b,method,path,body),e=>e.status===404);
  });
  await t.test('completion is idempotent and automatically resets at local midnight',async()=>{
   await request(a,'PUT','/supplements/'+first+'/completion',{completed:true,timezone:'Europe/Vilnius'});await request(a,'PUT','/supplements/'+first+'/completion',{completed:true,timezone:'Europe/Vilnius'});assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements[0].completed,true);
   now=new Date('2026-10-14T21:00:00Z');assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements[0].completed,false);const [rows]=await pool.query('SELECT * FROM supplement_completions');assert.equal(rows.length,1);
  });
  await t.test('AI receives all existing supplements and conflicts are kept unassigned',async()=>{
   mode='conflict';const second=(await request(a,'POST','/supplements/analyze',{requestId:randomUUID(),name:'Another product'}))[1].id;const context=JSON.parse(lastInput.messages[1].content[0].text);assert.equal(context.existingSupplements[0].id,first);
   dashboard=(await request(a,'GET','/dashboard',{},query))[1];const item=dashboard.supplements.find(s=>s.id===second);assert.equal(item.group_id,null);assert.equal(item.analysis.needsReview,true);assert.equal(item.analysis.compatibility.assessments[0].supplementName,'Example manufacturer product');
  });
  await t.test('background job is owner-scoped, idempotent and reaches a terminal state',async()=>{
   // Same product request ID reuses a saved supplement without another paid request.
   const [stored]=await pool.query('SELECT request_id FROM supplements WHERE id=?',[first]);
   const body={requestId:stored[0].request_id,name:'Example product'};
   const [,job]=await request(a,'POST','/supplements/jobs',body);
   await assert.rejects(request(b,'GET','/supplements/jobs/'+job.id),e=>e.status===404);
   let done;for(let i=0;i<30;i++){done=(await request(a,'GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.status,'complete');assert.equal(done.supplement_id,first);assert.equal(calls,2);
   const [,same]=await request(a,'POST','/supplements/jobs',body);assert.equal(same.id,job.id);assert.equal(calls,2);
  });
  await t.test('photo batches save readable targets, preserve partial successes and compare siblings',async()=>{
   // Isolated database only: make this scenario's submission quota independent.
   await pool.query('DELETE FROM auth_rate_limits');
   mode='batch';discovery={version:'2',products:[...products,products[0]],skipped:[{location:'Back left',reason:'Brand is not readable.'}],overflow:false};let release;pauseResearch=new Promise(r=>release=r);const entered=new Promise(r=>enteredResearch=r);const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,0,0,0,0,0]).toString('base64');
   const body={requestId:randomUUID(),image,language:'lt'};
   const [,job]=await request(a,'POST','/supplements/jobs',body);
   await assert.rejects(request(b,'GET','/supplements/jobs/'+job.id),e=>e.status===404);
   await entered;const early=(await request(a,'GET','/supplements/jobs/'+job.id))[1];assert.equal(early.phase,'enriching');assert.equal(early.total_count,3);assert.equal(early.processed_count,0);const beforeResearch=(await request(a,'GET','/dashboard',{},query))[1];assert.equal(beforeResearch.supplements.filter(s=>s.analysis.schemaVersion==='draft-1').length,3);assert.ok(beforeResearch.supplements.filter(s=>s.analysis.schemaVersion==='draft-1').every(s=>s.group_id===group));
   const [,parallel]=await request(a,'POST','/supplements/jobs',{...body,requestId:randomUUID()});assert.ok(parallel.id!==job.id);let reused;for(let i=0;i<50;i++){reused=(await request(a,'GET','/supplements/jobs/'+parallel.id))[1];if(reused.status!=='running')break;await new Promise(r=>setTimeout(r,20));}assert.equal(reused.status,'complete');assert.ok(reused.result.items.every(item=>item.research==='reused'));release();pauseResearch=null;
   let done;for(let i=0;i<100;i++){done=(await request(a,'GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.status,'complete');assert.equal(done.total_count,3);assert.equal(done.processed_count,3);assert.equal(discoveryCalls,3);assert.equal(done.result.items.filter(i=>i.status==='added').length,3);assert.equal(done.result.items[1].research,'failed');assert.equal(done.result.items[1].error,'AI_SOURCES_UNVERIFIED');assert.equal(done.result.skipped[0].location,'Back left');
   const context=JSON.parse(lastInput.messages[1].content[0].text);assert.equal(context.selectedTarget.name,'Batch magnesium');assert.ok(context.existingSupplements.some(s=>s.name==='Batch C'),'Later target must see earlier batch successes');
   const [stored]=await pool.query('SELECT * FROM analysis_jobs WHERE id=?',[job.id]);assert.equal(JSON.stringify(stored).includes(image),false);assert.equal(JSON.stringify(stored).includes('xai-test-only'),false);
   const before=calls;const [,same]=await request(a,'POST','/supplements/jobs',body);assert.equal(same.id,job.id);assert.equal(calls,before);assert.equal(discoveryCalls,3);
   // No readable identities is a terminal report, not a fabricated supplement.
   discovery={version:'2',products:[],skipped:[{location:'All bottles',reason:'Names are blurred.'}],overflow:false};
   const [,empty]=await request(a,'POST','/supplements/jobs',{...body,requestId:randomUUID()});
   let failed;for(let i=0;i<100;i++){failed=(await request(a,'GET','/supplements/jobs/'+empty.id))[1];if(failed.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(failed.status,'failed');assert.equal(failed.result.items.length,0);assert.equal(failed.result.skipped.length,1);assert.equal(calls,before);
  });
  await t.test('explicit language refresh uses one research call, preserves manual grouping and reuses fresh info',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');mode='valid';const records=(await request(a,'GET','/dashboard',{},query))[1];const target=records.supplements.find(s=>s.analysis.enrichment?.status==='failed');assert.ok(target);
   let release;pauseResearch=new Promise(r=>release=r);const entered=new Promise(r=>enteredResearch=r);const previousCalls=calls,previousDiscovery=discoveryCalls;
   const [,job]=await request(a,'POST','/supplements/'+target.id+'/research',{requestId:randomUUID(),language:'en'});await entered;
   await assert.rejects(request(a,'POST','/supplements/'+target.id+'/research',{requestId:randomUUID(),language:'en'}),e=>e.message==='AI_BUSY');
   const chosen=records.groups[1].id;await request(a,'PATCH','/supplements/'+target.id,{groupId:chosen});release();pauseResearch=null;
   let done;for(let i=0;i<100;i++){done=(await request(a,'GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.status,'complete');assert.equal(done.result.items[0].research,'complete');assert.equal(calls,previousCalls+1);assert.equal(discoveryCalls,previousDiscovery);
   const saved=(await request(a,'GET','/dashboard',{},query))[1].supplements.find(s=>s.id===target.id);assert.equal(saved.analysis.language,'en');assert.equal(saved.group_id,chosen);assert.equal(saved.analysis.compatibility.stale,true);
   discovery={version:'2',products:[product('Unreadable source')],skipped:[],overflow:false};const [,reuse]=await request(a,'POST','/supplements/jobs',{requestId:randomUUID(),name:'Exact same product',language:'en'});
   for(let i=0;i<100;i++){done=(await request(a,'GET','/supplements/jobs/'+reuse.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}assert.equal(done.result.items[0].research,'reused');assert.equal(calls,previousCalls+1);
  });
  await t.test('uploads queue during recognition, stay owner-scoped and release the slot before enrichment',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r),original=tracker.discover,order=[];let concurrent=0,maximum=0;
   tracker.discover=async input=>{const context=JSON.parse(input.messages[1].content[0].text);order.push(context.note);concurrent++;maximum=Math.max(maximum,concurrent);if(order.length===1){enter();await gate;}concurrent--;return {model:input.model,result:{version:'2',language:context.responseLanguage,products:[],skipped:[{location:'Input',reason:'No readable products'}],overflow:false}};};
   const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,0,0,0,0,0]).toString('base64');
   const firstBody={requestId:randomUUID(),name:'Upload 1',image};const [,firstJob]=await request(a,'POST','/supplements/jobs',firstBody);await entered;
   const [,same]=await request(a,'POST','/supplements/jobs',firstBody);assert.equal(same.id,firstJob.id);
   const jobs=[firstJob];for(let index=2;index<=4;index++){const [,job]=await request(a,'POST','/supplements/jobs',{requestId:randomUUID(),name:'Upload '+index,image});jobs.push(job);}
   const queued=(await request(a,'GET','/supplements/jobs/'+jobs[1].id))[1];assert.equal(queued.phase,'queued');assert.equal(queued.result.submission.kind,'photo');assert.equal(queued.result.submission.name,'Upload 2');assert.equal(order.length,1);
   await assert.rejects(request(a,'POST','/supplements/jobs',{requestId:randomUUID(),name:'Overflow'}),e=>e.message==='AI_QUEUE_FULL');
   const own=(await request(a,'GET','/supplements/jobs'))[1],other=(await request(b,'GET','/supplements/jobs'))[1];assert.equal(own.active.length,4);assert.ok(own.recent.some(job=>job.id===queued.id));assert.equal(other.recent.some(job=>jobs.some(own=>own.id===job.id)),false);assert.equal(JSON.stringify(own).includes(image),false);
   release();for(let i=0;i<100;i++){const active=(await request(a,'GET','/supplements/jobs'))[1].active;if(!active.length)break;await new Promise(r=>setTimeout(r,20));}
   assert.deepEqual(order,['Upload 1','Upload 2','Upload 3','Upload 4']);assert.equal(maximum,1);const history=(await request(a,'GET','/supplements/jobs'))[1];assert.equal(history.active.length,0);assert.ok(jobs.every(job=>history.recent.some(saved=>saved.id===job.id&&saved.status==='failed')));tracker.discover=original;
  });
  await t.test('photo discovery rechecks the key and serializes submissions before paid research',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');let enter,release;
   const entered=new Promise(resolve=>enter=resolve),gate=new Promise(resolve=>release=resolve),original=tracker.discover;
   tracker.discover=async input=>{enter();await gate;const context=JSON.parse(input.messages[1].content[0].text);return {result:{version:'2',language:context.responseLanguage,products:products.map(p=>({...p,groupId:context.groups[0].id})),skipped:[],overflow:false}};};
   const body={requestId:randomUUID(),image:'data:image/jpeg;base64,'+Buffer.from([255,216,255,0,0,0,0,0]).toString('base64')};
   const before=calls;const [,job]=await request(a,'POST','/supplements/jobs',body);await entered;
   const [,same]=await request(a,'POST','/supplements/jobs',body);assert.equal(same.id,job.id);

   await assert.rejects(request(a,'POST','/supplements/analyze',{...body,requestId:randomUUID(),background:true,skipRateLimit:true}),e=>e.message==='AI_BUSY');
   await request(a,'PUT','/settings/ai',{key:'xai-changed-test-only-key',model:'grok-4.7'});release();
   let done;for(let i=0;i<50;i++){done=(await request(a,'GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.status,'failed');assert.equal(done.error_code,'AI_KEY_CHANGED');assert.equal(calls,before);assert.equal(tracker.providers,0);tracker.discover=original;
  });
  await t.test('foreign groups and malformed provider results are rejected',async()=>{
   const foreign=(await request(b,'GET','/dashboard',{},query))[1].groups[0].id;await assert.rejects(request(a,'PATCH','/supplements/'+first,{groupId:foreign}),e=>e.status===404);assert.equal(validAnalysis({productName:'wrong'},dashboard.groups,dashboard.supplements),false);
  });
  await t.test('group deletion keeps supplements; account deletion cascades private records',async()=>{
   await request(a,'DELETE','/groups/'+group);assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements.find(s=>s.id===first).group_id,null);
   await auth.dispatch('DELETE','/me',{password,confirmation:'DELETE'},'Bearer '+a.token,'delete');
   for(const table of ['tracker_preferences','provider_credentials','day_groups','supplements','supplement_completions','analysis_jobs']){const [rows]=await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`,[a.user.id]);assert.equal(rows[0].n,0);}
  });
 }finally{await pool?.end();await root.query(`DROP DATABASE IF EXISTS ${database}`);await root.query("DROP USER IF EXISTS ?@'%'",[account]);await root.end();}
});
