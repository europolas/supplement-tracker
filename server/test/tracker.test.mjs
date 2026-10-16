import {createPhotoInventoryDiscovery} from '../src/photo-inventory.mjs';
/** Isolated database workflow. Run only with DB_TEST_HOST and a disposable server.
 * No production compose/env/password files are accepted by this runner. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import mysql from 'mysql2/promise';
import {AuthApi} from '../src/AuthApi.mjs';
import {hashPassword,decrypt} from '../src/security.mjs';
import {validatePhotos,TrackerApi,calendarDay,validatePhoto} from '../src/TrackerApi.mjs';
import {createCredentialVault} from '../src/credential-vault.mjs';
import {validAnalysis} from '../src/analysis.mjs';
import {createGeminiPipeline} from '../src/providers/gemini.mjs';
import {ProviderError} from '../src/structured-chat.mjs';
test('calendar boundary and image validation',()=>{
 assert.equal(calendarDay('Europe/Vilnius',new Date('2026-10-14T20:59:59Z')),'2026-10-14');assert.equal(calendarDay('Europe/Vilnius',new Date('2026-10-14T21:00:00Z')),'2026-10-15');assert.throws(()=>validatePhoto('https://example.com/label.jpg'));assert.throws(()=>validatePhoto('data:image/jpeg;base64,YWJjZGVmZ2g='));
});
test('tracker ownership, encrypted credentials, validated AI and daily records',async t=>{
 assert.equal(process.env.DB_TEST_HOST,'tracker-checks-db','A disposable test host is required');
 const root=await mysql.createConnection({host:process.env.DB_TEST_HOST,user:'root',password:readFileSync('/run/secrets/test_db_root','utf8').trim(),multipleStatements:true});
 const database='tracker_checks_'+randomBytes(5).toString('hex'),account='checks_'+randomBytes(5).toString('hex'),secret=randomBytes(32).toString('hex');let pool;
 try{
  await root.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);await root.query(`USE ${database}`);await root.query(readFileSync('/app/schema.sql','utf8'));await root.query(readFileSync('/app/migrations/002_tracker.sql','utf8'));await root.query(readFileSync('/app/migrations/003_analysis_jobs.sql','utf8'));await root.query(readFileSync('/app/migrations/004_persistent_sessions.sql','utf8'));await root.query(readFileSync('/app/migrations/005_photo_batches.sql','utf8'));await root.query(readFileSync('/app/migrations/006_progressive_analysis.sql','utf8'));await root.query(readFileSync('/app/migrations/007_account_group_cascade.sql','utf8'));await root.query(readFileSync('/app/migrations/008_upload_queue.sql','utf8'));await root.query(readFileSync('/app/migrations/009_google_credentials.sql','utf8'));await root.query(readFileSync('/app/migrations/010_group_icons.sql','utf8'));await root.query(readFileSync('/app/migrations/011_routine_preferences.sql','utf8'));await root.query(readFileSync('/app/migrations/012_supplement_pauses.sql','utf8'));await root.query("CREATE USER ?@'%' IDENTIFIED BY ?",[account,secret]);await root.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${database}.* TO ?@'%'`,[account]);
  pool=mysql.createPool({host:process.env.DB_TEST_HOST,user:account,password:secret,database,timezone:'Z'});
  const config={persistentSessions:true,secret:randomBytes(32).toString('hex'),mailConfigured:false,encryptionKey:randomBytes(32),appUrl:'https://app.example/'};
  const auth=new AuthApi(pool,config,await hashPassword('A long dummy secret phrase'));
  const password='A long isolated testing password';
  for(const name of ['alice','bob'])await auth.register({email:name+'@example.test',name,password},name);
  const a=await auth.login({email:'alice@example.test',password},'a'),b=await auth.login({email:'bob@example.test',password},'b');
  let now=new Date('2026-10-14T20:59:59Z'),calls=0,lastInput,mode='valid',pauseResearch=null,enteredResearch=null,activeResearch=0,maxActiveResearch=0;
  const vault=createCredentialVault(randomBytes(32));
  const chat=async input=>{
   activeResearch++;maxActiveResearch=Math.max(maxActiveResearch,activeResearch);try{
   calls++;lastInput=input;if(pauseResearch){enteredResearch?.();await pauseResearch;}const context=JSON.parse(input.messages[1].content[0].text);
   if(mode==='batch'){assert.ok(context.selectedTarget);assert.ok(context.existingSupplements.length>=2);if(context.selectedTarget.name==='Unreadable source')throw new ProviderError('AI_SOURCES_UNVERIFIED');}
   const result={schemaVersion:'1.4',benefitSummary:'Energy, cellular support',doseFallback:{basis:'not_needed',ingredient:null,dailyAmountMin:null,dailyAmountMax:null,unit:null,sourceUrl:null,explanation:''},language:context.responseLanguage,manufacturer:'Example',variant:'1000 mg',dosage:{directions:'1 tablet daily',servingSize:'1 tablet',dailyServingsMin:1,dailyServingsMax:1,sourceUrl:'https://manufacturer.example/product',evidence:'manufacturer'},nutrients:[{name:'Vitamin C',amount:1000,unit:'mg',originalUnit:null,nrvCode:'vitamin_c',nrvComparable:true,amountNote:'Per tablet',sourceUrl:'https://manufacturer.example/product',evidence:'manufacturer'}],sources:[{url:'https://manufacturer.example/product',title:'Official label',kind:'manufacturer'}],identified:true,productName:context.selectedTarget?.name||'Example manufacturer product',groupId:context.groups?.[0]?.id||null,benefits:[context.responseLanguage==='lt'?'Galima nauda':'Potential benefit'],howToUse:'Check label.',whenToUse:'With food.',labelDirections:null,cautions:['Check interactions.'],confidence:'medium',needsReview:true,reviewReason:'Missing label.',evidenceNote:'General information.',compatibility:{summary:'Review needed.',requiresReview:false,assessments:(context.existingSupplements||[]).map(s=>({supplementId:s.id,status:mode==='conflict'?'duplicate':'insufficient_information',reason:'Unknown amount.'}))}};
   if(mode==='uncertain-dose'){result.confidence='low';result.dosage.evidence='unknown';result.reviewReason='Manufacturer daily dose unavailable';result.doseFallback.basis='unavailable';result.doseFallback.explanation='No applicable adult reference found.';}
   if(input.name==='supplement_product_details'){result.groupId=null;if(context.existingSupplements===undefined)assert.equal(context.existingSupplements,undefined);result.cautions=[];result.reviewReason=null;result.evidenceNote='';result.compatibility={summary:'',requiresReview:false,assessments:[]};}
   assert.equal(input.validate(result),true);return {result,model:input.model,citations:['https://manufacturer.example/product']};
   }finally{activeResearch--;}
  };
  let discoveryCalls=0;const discover=async input=>{discoveryCalls++;const context=JSON.parse(input.messages[1].content[0].text);const result={...discovery,language:context.responseLanguage,products:discovery.products.map(p=>({...p,groupId:context.groups[0].id}))};assert.equal(input.validate(result),true);return {result,model:input.model};};
  const product=name=>({name,manufacturer:'Example',variant:'1000 mg',labelText:'',groupId:null,reason:'With a meal',benefit:'Possible support',review:false,existingId:null});
  const products=['Batch C','Unreadable source','Batch magnesium'].map(product);
  let discovery={version:'2',products:[product('manufacturer product')],skipped:[],overflow:false};
  const tracker=new TrackerApi(pool,auth,{vault,chat,discover,singlePass:false,now:()=>now});
  const request=(session,method,path,body={},query)=>tracker.handle(method,path,body,'Bearer '+session.token,'test',query);
  const query=new URLSearchParams({timezone:'Europe/Vilnius'});
  await request(a,'POST','/bootstrap',{timezone:'Europe/Vilnius',language:'en'});await request(b,'POST','/bootstrap',{timezone:'Europe/Vilnius',language:'lt'});
  let dashboard=(await request(a,'GET','/dashboard',{},query))[1];assert.equal(dashboard.groups.length,4);const group=dashboard.groups[0].id;
  await t.test('routine preferences persist per owner with validation, revision conflicts and no AI calls',async()=>{
   const timing={mode:'exact',start:'08:00',end:null},routine={version:1,meals:Object.fromEntries(['breakfast','lunch','dinner'].map(k=>[k,{status:'yes',timing}])),exercise:{status:'no',frequency:'varies',timing:{mode:'varies',start:null,end:null}},sleep:{timing:{mode:'approximate',start:'23:00',end:'01:00'}},days:'varies',strategy:'rhythm',restEvening:true},before=calls;
   assert.deepEqual((await request(a,'GET','/settings/routine'))[1],{routine:null,revision:0});
   const saved=(await request(a,'PUT','/settings/routine',{routine,revision:0}))[1];assert.equal(saved.revision,1);assert.deepEqual(saved.routine,routine);assert.equal(calls,before);
   assert.equal((await request(b,'GET','/settings/routine'))[1].routine,null);
   const fresh=new TrackerApi(pool,auth,{vault,chat,discover,singlePass:false,now:()=>now});assert.deepEqual((await fresh.handle('GET','/settings/routine',{},'Bearer '+a.token,'test'))[1],saved);
   await assert.rejects(()=>request(a,'PUT','/settings/routine',{routine,revision:0}),e=>e.status===409);
   await assert.rejects(()=>request(a,'PUT','/settings/routine',{routine:{...routine,strategy:'ignore manufacturer'},revision:1}),e=>e.status===400);
   assert.deepEqual((await request(a,'GET','/dashboard',{},query))[1].ai.routine,routine);
   await request(a,'DELETE','/supplements',{confirm:true});assert.deepEqual((await request(a,'GET','/settings/routine'))[1],saved);
   await request(a,'PUT','/settings/routine',{routine:null,revision:1});assert.equal((await request(a,'GET','/settings/routine'))[1].routine,null);
  });
  await t.test('Google credentials remain isolated from legacy xAI and other owners',async()=>{
   const google=new TrackerApi(pool,auth,{vault,chat,discover,credentialProvider:'google',models:['gemini-3.8-flash']});
   assert.equal((await google.settings(a.user.id)).configured,false);
   await google.handle('PUT','/settings/ai',{key:'google-private-testing-key',model:'gemini-3.8-flash'},'Bearer '+a.token,'test');
   assert.equal((await google.settings(a.user.id)).configured,true);assert.equal((await tracker.settings(a.user.id)).configured,false);assert.equal((await google.settings(b.user.id)).configured,false);
   const [rows]=await pool.execute('SELECT encrypted_key FROM google_provider_credentials WHERE user_id=?',[a.user.id]);assert.equal(vault.open(rows[0].encrypted_key,{owner:a.user.id,provider:'google'}),'google-private-testing-key');assert.throws(()=>vault.open(rows[0].encrypted_key,{owner:a.user.id,provider:'xai'}));
   await google.handle('DELETE','/settings/ai',{},'Bearer '+a.token,'test');assert.equal((await google.settings(a.user.id)).configured,false);
  });
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
  await t.test('pause preserves completion/history, enforces ownership and resumes at saved-zone midnight',async()=>{
   const pause='/supplements/'+first+'/pause',originalNow=now,before=(await request(a,'GET','/dashboard',{},query))[1].supplements[0],beforeCalls=calls;
   await assert.rejects(request(b,'PUT',pause,{paused:true}),e=>e.status===404);
   for(const resumeOn of ['2026-10-15','2026-02-30','bad',123])await assert.rejects(request(a,'PUT',pause,{paused:true,resumeOn,timezone:'Europe/Vilnius'}),e=>e.status===400);
   await request(a,'PUT',pause,{paused:true,resumeOn:'2026-10-16',timezone:'Europe/Vilnius'});await request(a,'PUT',pause,{paused:true,resumeOn:'2026-10-16',timezone:'Europe/Vilnius'});
   let item=(await request(a,'GET','/dashboard',{},query))[1].supplements[0];assert.equal(item.paused,true);assert.equal(item.resume_on,'2026-10-16');assert.equal(item.group_id,before.group_id);assert.deepEqual(item.analysis,before.analysis);
   await assert.rejects(request(a,'PUT','/supplements/'+first+'/completion',{completed:true,timezone:'Europe/Vilnius'}),e=>e.status===409&&e.message==='SUPPLEMENT_PAUSED');
   let [periods]=await pool.query('SELECT * FROM supplement_pauses WHERE supplement_id=?',[first]);assert.equal(periods.length,1);let [records]=await pool.query('SELECT * FROM supplement_completions WHERE supplement_id=?',[first]);assert.equal(records.length,1);
   // Reading from another device zone cannot move the saved return date.
   now=new Date('2026-10-15T20:59:59Z');assert.equal((await request(a,'GET','/dashboard',{},new URLSearchParams({timezone:'America/Los_Angeles'})))[1].supplements[0].paused,true);
   now=new Date('2026-10-15T21:00:00Z');assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements[0].paused,false);
   await request(a,'PUT',pause,{paused:true,timezone:'Europe/Vilnius'});now=new Date('2026-10-20T12:00:00Z');assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements[0].paused,true);
   await request(a,'PUT',pause,{paused:false});await request(a,'PUT',pause,{paused:false});item=(await request(a,'GET','/dashboard',{},query))[1].supplements[0];assert.equal(item.paused,false);assert.equal(item.pause_revision,3);
   [periods]=await pool.query('SELECT * FROM supplement_pauses WHERE supplement_id=?',[first]);assert.equal(periods.length,2);assert.ok(periods.every(p=>p.resumed_at));assert.equal(calls,beforeCalls);now=originalNow;
  });
  await t.test('AI receives all existing supplements and conflicts retain a planning group with review warnings',async()=>{
   mode='conflict';const second=(await request(a,'POST','/supplements/analyze',{requestId:randomUUID(),name:'Another product'}))[1].id;const context=JSON.parse(lastInput.messages[1].content[0].text);assert.equal(context.existingSupplements[0].id,first);
   dashboard=(await request(a,'GET','/dashboard',{},query))[1];const item=dashboard.supplements.find(s=>s.id===second);assert.equal(item.group_id,group);assert.equal(item.analysis.needsReview,true);assert.equal(item.analysis.compatibility.assessments[0].supplementName,'Example manufacturer product');
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
   const [,parallel]=await request(a,'POST','/supplements/jobs',{...body,requestId:randomUUID()});assert.ok(parallel.id!==job.id);let reused;for(let i=0;i<50;i++){reused=(await request(a,'GET','/supplements/jobs/'+parallel.id))[1];if(reused.status!=='running')break;await new Promise(r=>setTimeout(r,20));}assert.equal(reused.status,'complete');assert.ok(reused.result.items.every(item=>item.research==='reused'));
   // Observe all workers entering the held provider, rather than racing DB reads.
   for(let i=0;i<200&&activeResearch<3;i++)await new Promise(r=>setTimeout(r,10));assert.equal(activeResearch,3);release();pauseResearch=null;
   let done;for(let i=0;i<100;i++){done=(await request(a,'GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.status,'complete');assert.equal(done.total_count,3);assert.equal(done.processed_count,3);assert.equal(discoveryCalls,2);assert.equal(done.result.items.filter(i=>i.status==='added').length,3);assert.equal(done.result.items[1].research,'failed');assert.equal(done.result.items[1].error,'AI_SOURCES_UNVERIFIED');assert.equal(done.result.skipped[0].location,'Back left');
   const context=JSON.parse(lastInput.messages[1].content[0].text);assert.ok(context.selectedTarget);assert.ok(context.existingSupplements.some(s=>s.name.includes('Batch')),'Concurrent research sees all sibling drafts');assert.equal(maxActiveResearch,3,'Three products researched concurrently');assert.equal(done.result.recognitionModel,'grok-4.7','Fast model remains explicit in progress metadata');
   const [stored]=await pool.query('SELECT * FROM analysis_jobs WHERE id=?',[job.id]);assert.equal(JSON.stringify(stored).includes(image),false);assert.equal(JSON.stringify(stored).includes('xai-test-only'),false);
   const before=calls;const [,same]=await request(a,'POST','/supplements/jobs',body);assert.equal(same.id,job.id);assert.equal(calls,before);assert.equal(discoveryCalls,2);
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
  await t.test('uncertain manufacturer dose retains a clear timing group and review in both add and background paths',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');mode='uncertain-dose';
   const [,created]=await request(a,'POST','/supplements/analyze',{requestId:randomUUID(),name:'Timing-only product'});
   let row=(await request(a,'GET','/dashboard',{},query))[1].supplements.find(s=>s.id===created.id);assert.equal(row.group_id,group);assert.equal(row.analysis.dosage.directions,null);assert.equal(row.analysis.needsReview,true);
   const [,job]=await request(a,'POST','/supplements/'+created.id+'/research',{requestId:randomUUID(),language:'lt'});
   let done;for(let i=0;i<100;i++){done=(await request(a,'GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.result.items[0].research,'complete');row=(await request(a,'GET','/dashboard',{},query))[1].supplements.find(s=>s.id===created.id);assert.equal(row.group_id,group);assert.equal(row.analysis.confidence,'low');assert.equal(row.analysis.dosage.dailyServingsMin,null);assert.equal(row.analysis.benefitSummary,'Energy, cellular support');mode='valid';
  });
  await t.test('foreign groups and malformed provider results are rejected',async()=>{
   const foreign=(await request(b,'GET','/dashboard',{},query))[1].groups[0].id;await assert.rejects(request(a,'PATCH','/supplements/'+first,{groupId:foreign}),e=>e.status===404);assert.equal(validAnalysis({productName:'wrong'},dashboard.groups,dashboard.supplements),false);
  });
  await t.test('default single pass saves a whole photo with one discovery and zero research calls',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');
   discovery={version:'2',products:[product('Quick product one'),product('Quick product two')],skipped:[],overflow:false};
   const quick=new TrackerApi(pool,auth,{vault,discover:createPhotoInventoryDiscovery(async input=>{discoveryCalls++;assert.equal(input.messages[1].content.filter(p=>p.type==='image_url').length,2);const c=JSON.parse(input.messages[1].content[0].text);const result={language:c.responseLanguage,photos:discovery.products.map((p,index)=>({photoIndex:index+1,products:[{name:p.name,manufacturer:p.manufacturer,groupId:c.groups[0].id,benefit:p.benefit,position:'foreground'}],skipped:[]}))};assert.ok(input.validate(result));return {result,model:input.model};}),chat,now:()=>now});
   const before=discoveryCalls,beforeResearch=calls,body={requestId:randomUUID(),name:'Two products',images:Array(2).fill('data:image/jpeg;base64,'+Buffer.from([255,216,255,0,0,0,0,0]).toString('base64')),language:'lt'};
   const call=(method,path,data={})=>quick.handle(method,path,data,'Bearer '+a.token,'test',query);
   const [,job]=await call('POST','/supplements/jobs',body);let done;
   for(let i=0;i<100;i++){done=(await call('GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(done.status,'complete');assert.equal(done.processed_count,2);assert.deepEqual(done.result.photoInventory.map(p=>p.recognized),[1,1]);assert.equal(discoveryCalls,before+1);assert.ok(done.result.items.every(x=>x.research==='complete'));
   const [,view]=await call('GET','/dashboard');for(const item of done.result.items){const saved=view.supplements.find(s=>s.id===item.id);assert.equal(saved.analysis.schemaVersion,'basic-1');assert.equal(saved.analysis.enrichment.status,'complete');assert.equal(saved.analysis.language,'lt');assert.ok(saved.group_id);assert.ok(saved.analysis.benefitSummary);}
   const [,again]=await call('POST','/supplements/jobs',body);assert.equal(again.id,job.id);assert.equal(discoveryCalls,before+1);
   assert.equal(calls,beforeResearch,'Adding never requests detailed research');
   await call('PATCH','/supplements/'+done.supplement_id,{groupId:view.supplements.find(s=>s.id===done.supplement_id).group_id});
   const beforeDetails=(await call('GET','/dashboard'))[1].supplements.find(s=>s.id===done.supplement_id);
   const requestBody={requestId:randomUUID(),language:'lt'};
   const [,detailJob]=await call('POST','/supplements/'+done.supplement_id+'/research',requestBody);
   for(let i=0;i<100;i++){const j=(await call('GET','/supplements/jobs/'+detailJob.id))[1];if(j.status!=='running'){assert.equal(j.result.items[0].research,'complete');break;}await new Promise(r=>setTimeout(r,20));}
   assert.equal(calls,beforeResearch+1,'Explicit action researches only selected product');assert.equal(discoveryCalls,before+1);
   const detailed=(await call('GET','/dashboard'))[1].supplements.find(s=>s.id===done.supplement_id);assert.equal(detailed.group_id,view.supplements.find(s=>s.id===done.supplement_id).group_id);assert.deepEqual(detailed.analysis.grouping,{...beforeDetails.analysis.grouping,groupId:beforeDetails.group_id});assert.equal(detailed.analysis.research.scope,'product-details');assert.deepEqual(detailed.analysis.compatibility.assessments,[]);
   const [,sameDetail]=await call('POST','/supplements/'+done.supplement_id+'/research',requestBody);assert.equal(sameDetail.id,detailJob.id);assert.equal(calls,beforeResearch+1);

   await assert.rejects(call('POST','/supplements/analyze',body),e=>e.status===404);
  });
  await t.test('automatic review proposes sourced changes without moving products; apply is owned and stale-safe',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');let release,entered,reviewCalls=0,discoveryCalls=0;
   let gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
   const checked=new TrackerApi(pool,auth,{vault,chat,discover:async input=>{discoveryCalls++;const c=JSON.parse(input.messages[1].content[0].text);return {model:input.model,result:{language:'en',products:[{name:'Review test '+discoveryCalls,manufacturer:'Example',groupId:c.groups[0].id,benefit:'Energy, cells'}],skipped:[]}};},review:async input=>{reviewCalls++;entered();await gate;const c=JSON.parse(input.messages[1].content);assert.equal(input.model,'grok-4.7');const result={assignments:c.targets.map(id=>({supplementId:id,groupId:c.groups[1].id,reason:'Manufacturer recommends a meal with fats.',sourceUrl:'https://manufacturer.example/timing'}))};assert.ok(input.validate(result));return {result,model:input.model,citations:['https://manufacturer.example/timing']};}});
   const call=(method,path,body={})=>checked.handle(method,path,body,'Bearer '+a.token,'test',query);
   const [,job]=await call('POST','/supplements/jobs',{requestId:randomUUID(),name:'Review one'});await started;
   const early=(await call('GET','/supplements/jobs/'+job.id))[1];assert.equal(early.result.review.status,'checking');const target=early.result.items[0].id;assert.equal((await call('GET','/dashboard'))[1].supplements.find(s=>s.id===target).group_id,group);release();
   let done;for(let i=0;i<100;i++){done=(await call('GET','/supplements/jobs/'+job.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,10));}
   assert.equal(done.result.review.status,'ready');assert.equal(done.result.review.changes.length,1);assert.equal(reviewCalls,1);assert.equal(discoveryCalls,1);assert.equal((await call('GET','/dashboard'))[1].supplements.find(s=>s.id===target).group_id,group);
   await assert.rejects(checked.handle('POST','/supplements/jobs/'+job.id+'/apply-groups',{},'Bearer '+b.token,'test'),e=>e.status===404);
   const invalidReport=structuredClone(done.result);invalidReport.review.changes[0].to=null;await pool.execute('UPDATE analysis_jobs SET result=? WHERE id=?',[JSON.stringify(invalidReport),job.id]);await assert.rejects(call('POST','/supplements/jobs/'+job.id+'/apply-groups'),e=>e.status===409);assert.equal((await call('GET','/dashboard'))[1].supplements.find(s=>s.id===target).group_id,group);await pool.execute('UPDATE analysis_jobs SET result=? WHERE id=?',[JSON.stringify(done.result),job.id]);
   await call('POST','/supplements/jobs/'+job.id+'/apply-groups');await call('POST','/supplements/jobs/'+job.id+'/apply-groups');assert.equal((await call('GET','/dashboard'))[1].supplements.find(s=>s.id===target).group_id,done.result.review.changes[0].to);
   const [,next]=await call('POST','/supplements/jobs',{requestId:randomUUID(),name:'Review two'});for(let i=0;i<100;i++){done=(await call('GET','/supplements/jobs/'+next.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,10));}assert.equal(done.result.review.status,'ready');await call('PATCH','/supplements/'+done.result.items[0].id,{groupId:group});await assert.rejects(call('POST','/supplements/jobs/'+next.id+'/apply-groups'),e=>e.status===409);
   const originalReview=checked.review;checked.review=async input=>({...await originalReview(input),citations:[]});
   const [,unsupported]=await call('POST','/supplements/jobs',{requestId:randomUUID(),name:'Review three'});for(let i=0;i<100;i++){done=(await call('GET','/supplements/jobs/'+unsupported.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,10));}assert.equal(done.result.review.status,'ready');assert.equal(done.result.review.changes.length,0,'Uncited source cannot justify a move');
   checked.review=async()=>{throw new ProviderError('AI_PROVIDER_FAILED');};const [,failed]=await call('POST','/supplements/jobs',{requestId:randomUUID(),name:'Review four'});for(let i=0;i<100;i++){done=(await call('GET','/supplements/jobs/'+failed.id))[1];if(done.status!=='running')break;await new Promise(r=>setTimeout(r,10));}assert.equal(done.status,'complete');assert.equal(done.result.review.status,'failed');assert.equal(done.result.items.length,1,'Review failure keeps the recognized product');

  });
  await t.test('clear keeps groups/key/other accounts and rejects late recognition results',async()=>{
   await pool.query('DELETE FROM auth_rate_limits');
   await request(b,'PUT','/settings/ai',{key:'xai-test-only-private-key-for-bob',model:'grok-4.7'});
   const beforeA=(await request(a,'GET','/dashboard',{},query))[1],beforeB=(await request(b,'GET','/dashboard',{},query))[1];
   const savedId=randomUUID();await pool.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) SELECT ?,?,?,name,analysis,model,? FROM supplements WHERE id=?',[savedId,b.user.id,beforeB.groups[0].id,randomUUID(),first]);
   await request(b,'PUT','/supplements/'+savedId+'/completion',{completed:true,timezone:'Europe/Vilnius'});
   let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
   const slow=new TrackerApi(pool,auth,{vault,chat,discover:async input=>{entered();await gate;const c=JSON.parse(input.messages[1].content[0].text);return {model:input.model,result:{language:'en',products:[{name:'Delayed vitamin',manufacturer:'Example',groupId:c.groups[0].id,benefit:'Possible support'}],skipped:[]}};}});
   const [,job]=await slow.handle('POST','/supplements/jobs',{requestId:randomUUID(),name:'Delayed vitamin'},'Bearer '+b.token,'test');await started;
   await assert.rejects(request(b,'DELETE','/supplements'),e=>e.status===400);
   await request(b,'DELETE','/supplements',{confirm:true,user_id:a.user.id});release();
   for(let i=0;i<100&&slow.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));assert.equal(slow.activeJobs.size,0);
   const after=(await request(b,'GET','/dashboard',{},query))[1];assert.deepEqual(after.groups,beforeB.groups);assert.equal(after.supplements.length,0);assert.equal(after.ai.configured,true);
   assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements.length,beforeA.supplements.length);
   await assert.rejects(request(b,'GET','/supplements/jobs/'+job.id),e=>e.status===404);assert.equal((await request(b,'GET','/supplements/jobs'))[1].recent.length,0);
  });
  await t.test('hybrid stores composition and bilingual tags with owner-only diagnostics',async()=>{
   await auth.register({email:'hybrid@example.test',name:'Hybrid',password},'hybrid');const h=await auth.login({email:'hybrid@example.test',password},'hybrid');
   const hybrid=new TrackerApi(pool,auth,{vault,chat,discover:async input=>{const c=JSON.parse(input.messages[1].content[0].text);await input.onMetrics({pipeline:'grok-jev',stage:'grok',grokCalls:1});await input.beforeClassification();await input.onMetrics({stage:'jev',grokMs:12,jevCalls:1});return {model:'grok-4.7',pipeline:'grok-jev',timings:{grokMs:12,jevMs:5,totalMs:17},productMetadata:{'example|hybrid vitamin|':{composition:{ingredients:[{name:'Vitamin C',labelAmount:''}],complete:false,basis:'label'},benefitTags:[{id:'immunity',en:'Immunity',lt:'Imunitetas',score:3,confidence:1}],classification:{groupConfidence:.9,model:'jev-1.14.0'}}},result:{language:'en',products:[{name:'Hybrid vitamin',manufacturer:'Example',groupId:c.groups[0].id,benefit:'Immunity'}],skipped:[]}};}});
   const call=(m,p,b={})=>hybrid.handle(m,p,b,'Bearer '+h.token,'hybrid');await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'fake-hybrid-key-123456',model:'grok-4.7'});const [,job]=await call('POST','/supplements/jobs',{name:'Hybrid vitamin',requestId:randomUUID()});
   for(let i=0;i<100&&hybrid.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));const [,done]=await call('GET','/supplements/jobs/'+job.id);assert.equal(done.status,'complete');assert.equal(done.result.monitor.grokCalls,1);assert.equal(done.result.timings.totalMs,17);
   const [,dash]=await call('GET','/dashboard');assert.equal(dash.supplements.length,1);assert.equal(dash.supplements[0].analysis.composition.ingredients[0].name,'Vitamin C');assert.equal(dash.supplements[0].analysis.benefitTags[0].lt,'Imunitetas');await assert.rejects(hybrid.handle('GET','/supplements/jobs/'+job.id,{},'Bearer '+b.token,'other'),e=>e.status===404);
   // Repeat identification refreshes metadata without inserting another row or moving the group.
   const originalGroup=dash.supplements[0].group_id;
   await call('POST','/supplements/jobs',{name:'Hybrid vitamin',requestId:randomUUID()});
   for(let i=0;i<100&&hybrid.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
   const [,again]=await call('GET','/dashboard');assert.equal(again.supplements.length,1);assert.equal(again.supplements[0].group_id,originalGroup);assert.equal(again.supplements[0].analysis.benefitTags[0].id,'immunity');

  });
  await t.test('Gemini single call saves composition, metrics and one group without research',async()=>{
   await auth.register({email:'gemini@example.test',name:'Gemini',password},'gemini');const session=await auth.login({email:'gemini@example.test',password},'gemini');let n=0;
   const pipeline=createGeminiPipeline({provider:async input=>{n++;const c=JSON.parse(input.messages[1].content[0].text);return {model:'gemini-3.8-flash',result:{products:[{name:'Vitamin C',manufacturer:'Example',ingredients:['Vitamin C'],groupId:c.groups[0].id,benefit:'Immunity, collagen'}]}};},research:async()=>{throw Error('No automatic research allowed');}});
   const api=new TrackerApi(pool,auth,{vault,...pipeline,autoResearch:false});const call=(m,p,b={})=>api.handle(m,p,b,'Bearer '+session.token,'gemini');
   await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'google-private-gemini-test',model:'gemini-3.8-flash'});const [,job]=await call('POST','/supplements/jobs',{name:'Vitamin C',requestId:randomUUID()});
   for(let i=0;i<100&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
   const [,done]=await call('GET','/supplements/jobs/'+job.id);assert.equal(done.status,'complete');assert.equal(n,1);assert.equal(done.result.monitor.calls,1);assert.equal(done.result.monitor.pipeline,'gemini-single');assert.equal(done.result.review,undefined);
   const [,dash]=await call('GET','/dashboard');assert.equal(dash.supplements.length,1);assert.equal(dash.supplements[0].analysis.composition.ingredients[0].name,'Vitamin C');assert.equal(dash.supplements[0].analysis.classification.provider,'google');assert.ok(dash.groups.some(g=>g.id===dash.supplements[0].group_id));
  });
  await t.test('new products auto-research, refresh unknown manufacturer, preserve manual group and deduplicate original identity',async()=>{
   await auth.register({email:'auto@example.test',name:'Auto',password},'auto');const session=await auth.login({email:'auto@example.test',password},'auto');let lookups=0,release;const paused=new Promise(r=>{release=r;});
   const discover=async input=>{const c=JSON.parse(input.messages[1].content[0].text);return {model:'gemini-3.8-flash',pipeline:'gemini-single',timings:{geminiMs:1,totalMs:1},result:{language:'en',products:[{name:'Unbranded product',manufacturer:'Unknown',groupId:c.groups[0].id,benefit:'Immunity, collagen'}],skipped:[]}};};
   const research=async input=>{lookups++;await paused;return chat(input);};
   const api=new TrackerApi(pool,auth,{vault,discover,chat:research,autoResearch:true,fullResearch:true,credentialProvider:'google',models:['gemini-3.8-flash']});const call=(m,p,b={})=>api.handle(m,p,b,'Bearer '+session.token,'auto');
   await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'google-private-auto-test',model:'gemini-3.8-flash'});const [,job]=await call('POST','/supplements/jobs',{name:'Unbranded product',requestId:randomUUID()});
   let dash;for(let i=0;i<100;i++){dash=(await call('GET','/dashboard'))[1];if(dash.supplements.length&&lookups)break;await new Promise(r=>setTimeout(r,10));}assert.equal(dash.supplements.length,1);assert.equal(dash.supplements[0].analysis.enrichment.status,'researching');const id=dash.supplements[0].id,manual=dash.groups[1].id;
   await call('PATCH','/supplements/'+id,{groupId:manual});release();for(let i=0;i<200&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
   const [,done]=await call('GET','/supplements/jobs/'+job.id);assert.equal(done.status,'complete');assert.equal(done.result.items[0].research,'complete');assert.ok(done.result.timings.detailsMs>=0);assert.ok(done.result.timings.totalMs>=done.result.recognitionMs);assert.equal(done.error_code,null);dash=(await call('GET','/dashboard'))[1];assert.equal(dash.supplements[0].analysis.manufacturer,'Example');assert.equal(dash.supplements[0].analysis.identity.manufacturer,'Example');assert.equal(dash.supplements[0].group_id,manual);assert.equal(dash.supplements[0].analysis.research.scope,'full-product-details');assert.equal(dash.supplements[0].analysis.enrichment.status,'complete');
   await call('POST','/supplements/jobs',{name:'Unbranded product',requestId:randomUUID()});for(let i=0;i<200&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));assert.equal((await call('GET','/dashboard'))[1].supplements.length,1);assert.equal(lookups,1);
  });
  await t.test('automatic timing corrections persist atomically while manual moves and changed groups win',async()=>{
   for(const scenario of ['automatic','manual-same','manual-other','manual-unassign','group-edited','profile-existing','profile-changed']){
    const email=scenario+'-timing@example.test';await auth.register({email,name:scenario,password},scenario);const session=await auth.login({email,password},scenario);let release,entered,refreshManual=false;const pause=new Promise(r=>release=r),started=new Promise(r=>entered=r);
    const discover=async input=>{const c=JSON.parse(input.messages[1].content[0].text);return {model:'gemini-3.8-flash',result:{language:'en',products:[{name:'Meal product',manufacturer:'Example',groupId:c.groups[0].id,benefit:'Energy, cells'}],skipped:[]}};};
    const research=async input=>{const c=JSON.parse(input.messages[1].content[0].text);if(refreshManual){assert.equal(c.groups,undefined);assert.equal(c.selectedTarget.groupId,undefined);assert.doesNotMatch(JSON.stringify(input.messages),/group|existingSupplements/i);}else{assert.equal(c.groups.length,4);assert.equal(c.selectedTarget.groupId,c.groups[0].id);}entered();await pause;const data=await chat(input);data.result.groupId=refreshManual?null:c.groups[2].id;data.result.reviewReason=refreshManual?null:'Manufacturer recommends taking with a meal.';assert.equal(input.validate(data.result),true);return data;};
    const api=new TrackerApi(pool,auth,{vault,discover,chat:research,autoResearch:true,fullResearch:true,credentialProvider:'google',models:['gemini-3.8-flash']}),call=(m,p,b={})=>api.handle(m,p,b,'Bearer '+session.token,scenario);
    await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'private-timing-testing-key',model:'gemini-3.8-flash'});const varying={mode:'varies',start:null,end:null},profile={version:1,meals:Object.fromEntries(['breakfast','lunch','dinner'].map(k=>[k,{status:'varies',timing:varying}])),exercise:{status:'no',frequency:'varies',timing:varying},sleep:{timing:varying},days:'varies',strategy:'rhythm',restEvening:true};if(scenario==='profile-existing')await call('PUT','/settings/routine',{routine:profile,revision:0});const [,job]=await call('POST','/supplements/jobs',{name:'Meal product',requestId:randomUUID()});await started;
    const [,before]=await call('GET','/dashboard'),item=before.supplements[0];let expected=before.groups[2].id;
    if(scenario.startsWith('manual')){expected=scenario==='manual-same'?item.group_id:scenario==='manual-other'?before.groups[1].id:null;await call('PATCH','/supplements/'+item.id,{groupId:expected});}
    if(scenario==='group-edited'){await pool.execute('UPDATE day_groups SET description=? WHERE id=? AND user_id=?',['Changed timing meaning',before.groups[2].id,session.user.id]);expected=item.group_id;}
    if(scenario.startsWith('profile')){expected=item.group_id;if(scenario==='profile-changed')await call('PUT','/settings/routine',{routine:profile,revision:0});}
    release();for(let i=0;i<200&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
    const [,done]=await call('GET','/dashboard'),saved=done.supplements[0];assert.equal(saved.analysis.enrichment.status,'complete');assert.equal(saved.group_id,expected,scenario);assert.equal(saved.analysis.grouping.groupId,expected);if(scenario.startsWith('profile')){assert.equal(saved.analysis.groupingSuggestion.groupId,before.groups[2].id);assert.equal(saved.analysis.groupingSuggestion.routineRevision,1);}const [,history]=await call('GET','/supplements/jobs/'+job.id);assert.equal(history.result.groupChangesTracked,true);const change=history.result.items[0].groupChange;if(scenario==='automatic'){assert.deepEqual(change,{jobId:job.id,from:{id:item.group_id,name:before.groups[0].name},to:{id:expected,name:before.groups[2].name}});assert.deepEqual(saved.analysis.grouping.change,change);}else assert.equal(change,undefined);
    if(scenario==='automatic'){assert.equal(saved.analysis.grouping.basis,'researched');assert.match(saved.analysis.grouping.explanation,/with a meal/);assert.equal(saved.analysis.grouping.sourceUrl,'https://manufacturer.example/product');}else if(scenario.startsWith('manual'))assert.equal(saved.analysis.grouping.basis,'manual');
    if(scenario==='manual-same'){refreshManual=true;await call('POST','/supplements/'+item.id+'/research',{requestId:randomUUID()});for(let i=0;i<200&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));const [,again]=await call('GET','/dashboard');assert.equal(again.supplements[0].analysis.enrichment.status,'complete');assert.equal(again.supplements[0].group_id,expected);}
   }
  });
  await t.test('language-only jobs cache translations without changing dose, provenance or manual group',async()=>{
   const email='localize@example.test';await auth.register({email,name:'Localize',password},'localize');const session=await auth.login({email,password},'localize');let translations=0;
   const api=new TrackerApi(pool,auth,{vault,chat,localize:async({items,language})=>{translations++;assert.equal(language,'en');return {result:{products:items.map(i=>({id:i.id,fields:Object.fromEntries(Object.entries(i.fields).map(([key,value])=>[key,value.replace('Lietuviška nauda','English benefit').replace('1 kapsulė per dieną','1 capsule daily')]))}))}};}}),call=(m,p,b={},q)=>api.handle(m,p,b,'Bearer '+session.token,'localize',q);
   await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'private-localization-key',model:'grok-4.7'});const [,d]=await call('GET','/dashboard'),id=randomUUID(),original={language:'lt',schemaVersion:'basic-1',manufacturer:'Brand',benefitSummary:'Lietuviška nauda',benefits:['Lietuviška nauda'],dosage:{directions:'1 kapsulė per dieną',dailyServingsMin:1},grouping:{basis:'manual'}};
   await pool.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) VALUES (?,?,?,?,?,?,?)',[id,session.user.id,d.groups[0].id,'Product',JSON.stringify(original),'test',randomUUID()]);const q=new URLSearchParams({language:'en'});assert.equal((await call('GET','/dashboard',{},q))[1].supplements[0].analysis.localizationNeeded,true);
   const requestId=randomUUID(),[,job]=await call('POST','/supplements/localize',{requestId,language:'en'});for(let i=0;i<200&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));const [,done]=await call('GET','/supplements/jobs/'+job.id);assert.equal(done.status,'complete');assert.equal(done.result.kind,'localization');
   const translated=(await call('GET','/dashboard',{},q))[1].supplements[0];assert.equal(translated.analysis.benefitSummary,'English benefit');assert.equal(translated.analysis.dosage.directions,'1 capsule daily');assert.equal(translated.analysis.dosage.dailyServingsMin,1);assert.equal(translated.analysis.grouping.basis,'manual');assert.equal(translated.group_id,d.groups[0].id);assert.equal(translated.analysis.language,'en');
   const [raw]=await pool.execute('SELECT analysis FROM supplements WHERE id=?',[id]);const saved=typeof raw[0].analysis==='string'?JSON.parse(raw[0].analysis):raw[0].analysis;assert.equal(saved.language,'lt');assert.equal(saved.benefitSummary,'Lietuviška nauda');await call('POST','/supplements/localize',{requestId,language:'en'});assert.equal(translations,1);
   const noop=(await call('POST','/supplements/localize',{requestId:randomUUID(),language:'en'}))[1];assert.equal(noop.status,'complete');assert.equal(translations,1);
  });
  await t.test('timed batch keeps 15 successful details and one local failure without a global error',async()=>{
   await auth.register({email:'partial@example.test',name:'Partial',password},'partial');const session=await auth.login({email:'partial@example.test',password},'partial');let lookups=0;
   const discover=async input=>{const c=JSON.parse(input.messages[1].content[0].text);return {model:'gemini-3.8-flash',pipeline:'gemini-single',timings:{geminiMs:1,totalMs:1},result:{language:'en',products:Array.from({length:16},(_,i)=>({name:'Timed product '+i,manufacturer:'Example',groupId:c.groups[0].id,benefit:'Energy, cells'})),skipped:[]}};};
   const api=new TrackerApi(pool,auth,{vault,discover,chat:async input=>{lookups++;const c=JSON.parse(input.messages[1].content[0].text);if(c.selectedTarget.name==='Timed product 4'){const error=new ProviderError('AI_INVALID_RESPONSE');error.diagnostic={stage:'extraction',reason:'invalid_fields',body:'private provider body'};throw error;}return chat(input);},autoResearch:true,fullResearch:true,credentialProvider:'google',models:['gemini-3.8-flash']});const call=(m,p,b={})=>api.handle(m,p,b,'Bearer '+session.token,'partial');
   await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'private-partial-test-key',model:'gemini-3.8-flash'});const [,job]=await call('POST','/supplements/jobs',{name:'Sixteen products',requestId:randomUUID()});for(let i=0;i<500&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
   const [,done]=await call('GET','/supplements/jobs/'+job.id);assert.equal(done.status,'complete');assert.equal(done.error_code,null);assert.equal(done.total_count,16);assert.equal(done.result.items.filter(i=>i.research==='complete').length,15);assert.equal(done.result.items.filter(i=>i.research==='failed').length,1);assert.ok(done.result.timings.totalMs>=done.result.recognitionMs);assert.ok(done.result.timings.detailsMs>=0);assert.equal(lookups,16);const failed=done.result.items.find(i=>i.research==='failed');assert.deepEqual(failed.failure,{stage:'extraction',reason:'invalid_fields'});const [,dashboard]=await call('GET','/dashboard');assert.deepEqual(dashboard.supplements.find(i=>i.id===failed.id).analysis.enrichment.failure,failed.failure);assert.doesNotMatch(JSON.stringify(done),/private provider body/);
  });
  await t.test('group icons are owner-scoped, preserved by old clients and reject executable markup',async()=>{
   const [,created]=await request(b,'POST','/groups',{name:'Icon group',icon:'<i class="bi bi-0-circle"></i>'});
   const read=async()=>((await request(b,'GET','/dashboard'))[1].groups.find(g=>g.id===created.id));assert.match((await read()).icon,/bi-0-circle/);
   await assert.rejects(request(a,'PATCH','/groups/'+created.id,{name:'Other',icon:''}),e=>e.status===404);
   await request(b,'PATCH','/groups/'+created.id,{name:'Renamed'});assert.match((await read()).icon,/bi-0-circle/);
   await request(b,'PATCH','/groups/'+created.id,{name:'SVG',icon:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/></svg>'});assert.match((await read()).icon,/<circle/);
   await assert.rejects(request(b,'PATCH','/groups/'+created.id,{name:'Bad',icon:'<svg><script>alert(1)</script></svg>'}),e=>e.status===400);
   await request(b,'DELETE','/groups/'+created.id);
  });
  await t.test('group order is complete, atomic and owner-scoped',async()=>{
   const before=(await request(a,'GET','/dashboard'))[1].groups.map(g=>g.id),other=(await request(b,'GET','/dashboard'))[1].groups.map(g=>g.id),ids=[...before].reverse();
   await request(a,'PUT','/groups/order',{ids});assert.deepEqual((await request(a,'GET','/dashboard'))[1].groups.map(g=>g.id),ids);assert.deepEqual((await request(b,'GET','/dashboard'))[1].groups.map(g=>g.id),other);
   await assert.rejects(request(a,'PUT','/groups/order',{ids:[ids[0],ids[0]]}),e=>e.status===400);await assert.rejects(request(a,'PUT','/groups/order',{ids:other}),e=>e.status===409);await assert.rejects(request(a,'PUT','/groups/order',{ids:ids.slice(1)}),e=>e.status===409);assert.deepEqual((await request(a,'GET','/dashboard'))[1].groups.map(g=>g.id),ids);await request(a,'PUT','/groups/order',{ids:before});
  });
  await t.test('whole-routine checks persist per-product decisions, isolate owners, reject stale moves and cancel after clear',async()=>{
   const email='routine-recheck@example.test';await auth.register({email,name:'Routine',password},'routine');const session=await auth.login({email,password},'routine');let release,entered,mode='valid',checks=0;
   const makeGate=()=>{let go,start;const waiting=new Promise(r=>go=r),begun=new Promise(r=>start=r);release=go;entered=begun;return {waiting,start};};let gate=makeGate();
   const recheck=async input=>{checks++;const c=JSON.parse(input.messages[1].content);assert.equal(c.products.length,3);assert.equal(c.groups.length,4);assert.equal(c.products[0].information.nutrients[0].amount,400);assert.match(input.messages[0].content,/nothing is applied automatically/);gate.start();await gate.waiting;return {model:'gemini-3.8-flash',result:{assignments:c.products.map((p,i)=>({supplementId:p.id,groupId:mode==='invalid'?'foreign':i<2?c.groups[1].id:p.groupId,reason:'Stored manufacturer directions say with food.'}))}};};
   const options={vault,chat,recheck,credentialProvider:'google',models:['gemini-3.8-flash']},api=new TrackerApi(pool,auth,options),call=(m,p,b={})=>api.handle(m,p,b,'Bearer '+session.token,'routine');
   await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'private-routine-test-key',model:'gemini-3.8-flash'});let [,dash]=await call('GET','/dashboard');const original=dash.groups[0],target=dash.groups[1];
   const ids=[randomUUID(),randomUUID(),randomUUID()].sort();for(const [i,id]of ids.entries())await pool.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) VALUES (?,?,?,?,?,?,?)',[id,session.user.id,original.id,'Product '+i,JSON.stringify({manufacturer:'Brand '+i,nutrients:[{name:'Ingredient',amount:400,unit:'mg'}],dosage:{directions:'With food'},grouping:{basis:i?'provisional':'manual'}}),'test',randomUUID()]);
   const requestId=randomUUID(),[,job]=await call('POST','/rechecks',{requestId,language:'en'});await entered;assert.equal((await call('POST','/rechecks',{requestId:randomUUID()}))[1].id,job.id);assert.equal(checks,1);assert.equal((await call('GET','/rechecks'))[1].active.id,job.id);assert.equal((await call('GET','/supplements/jobs'))[1].active.length,0);assert.equal((await request(b,'GET','/rechecks'))[1].proposals.length,0);assert.ok((await call('GET','/dashboard'))[1].supplements.every(p=>p.group_id===original.id));
   release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));let report=(await call('GET','/rechecks'))[1];assert.equal(report.latest.status,'complete');assert.equal(report.proposals.length,2);assert.equal((await call('POST','/rechecks',{requestId}))[1].id,job.id);assert.equal(checks,1);
   const restart=new TrackerApi(pool,auth,options),again=(m,p,b={})=>restart.handle(m,p,b,'Bearer '+session.token,'routine');assert.equal((await again('GET','/rechecks'))[1].proposals.length,2);const first=report.proposals[0],second=report.proposals[1],path=p=>'/rechecks/'+p.jobId+'/'+p.id;
   await assert.rejects(request(b,'PATCH',path(first),{action:'accept'}),e=>e.status===404);await again('PATCH',path(first),{action:'accept'});await again('PATCH',path(first),{action:'accept'});dash=(await call('GET','/dashboard'))[1];assert.equal(dash.supplements.find(p=>p.id===first.supplementId).group_id,target.id);assert.equal(dash.supplements.find(p=>p.id===first.supplementId).analysis.grouping.basis,'manual');assert.equal((await call('GET','/rechecks'))[1].proposals.length,1);
   gate=makeGate();mode='invalid';await call('POST','/rechecks',{requestId:randomUUID()});await entered;release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));report=(await call('GET','/rechecks'))[1];assert.equal(report.latest.status,'failed');assert.equal(report.latest.error_code,'AI_INVALID_RESPONSE');assert.equal(report.proposals.length,1);
   await pool.execute('UPDATE day_groups SET description=? WHERE id=?',['Changed group meaning',target.id]);await assert.rejects(again('PATCH',path(second),{action:'accept'}),e=>e.status===409);await pool.execute('UPDATE day_groups SET description=? WHERE id=?',[target.description,target.id]);await call('PATCH','/supplements/'+second.supplementId,{groupId:dash.groups[2].id});await assert.rejects(again('PATCH',path(second),{action:'accept'}),e=>e.status===409);await again('PATCH',path(second),{action:'remove'});assert.equal((await call('GET','/rechecks'))[1].proposals.length,0);assert.equal((await call('GET','/dashboard'))[1].supplements.length,3);
   await pool.query('DELETE FROM auth_rate_limits');gate=makeGate();mode='valid';await call('POST','/rechecks',{requestId:randomUUID()});await entered;release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));const stale=(await call('GET','/rechecks'))[1].proposals[0];assert.ok(stale);
   const varying={mode:'varies',start:null,end:null},routine={version:1,meals:Object.fromEntries(['breakfast','lunch','dinner'].map(k=>[k,{status:'varies',timing:varying}])),exercise:{status:'no',frequency:'varies',timing:varying},sleep:{timing:varying},days:'varies',strategy:'rhythm',restEvening:true};
   await call('PUT','/settings/routine',{routine,revision:0});await assert.rejects(again('PATCH',path(stale),{action:'accept'}),e=>e.status===409);await again('PATCH',path(stale),{action:'remove'});
   gate=makeGate();await call('POST','/rechecks',{requestId:randomUUID()});await entered;await call('PUT','/settings/routine',{routine:{...routine,restEvening:false},revision:1});release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));const outdated=(await call('GET','/rechecks'))[1];assert.equal(outdated.latest.error_code,'COLLECTION_CHANGED');assert.equal(outdated.proposals.length,0);
   await pool.query('DELETE FROM auth_rate_limits');
   gate=makeGate();mode='valid';await call('POST','/rechecks',{requestId:randomUUID()});await entered;await call('DELETE','/supplements',{confirm:true});release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));report=(await call('GET','/rechecks'))[1];assert.equal(report.latest,null);assert.equal(report.proposals.length,0);assert.equal((await call('GET','/dashboard'))[1].supplements.length,0);
  });
  await t.test('pausing invalidates in-flight and stored recheck moves; new checks skip inactive products',async()=>{
   const email='pause-review@example.test';await auth.register({email,name:'Pause review',password},'pause-review');const session=await auth.login({email,password},'pause-review');let release,entered,received;
   const gate=()=>{let go,start;const wait=new Promise(r=>go=r);entered=new Promise(r=>start=r);release=go;return {wait,start};};let currentGate=gate();
   const recheck=async input=>{received=JSON.parse(input.messages[1].content);currentGate.start();await currentGate.wait;return {model:'test',result:{assignments:received.products.map(p=>({supplementId:p.id,groupId:received.groups[1].id,reason:'Use stored timing.'}))}};};
   const api=new TrackerApi(pool,auth,{vault,chat,recheck,credentialProvider:'google',models:['test']}),call=(m,p,b={})=>api.handle(m,p,b,'Bearer '+session.token,'pause-review');
   await call('POST','/bootstrap',{});await call('PUT','/settings/ai',{key:'private-pause-review-key',model:'test'});const groups=(await call('GET','/dashboard'))[1].groups,ids=[randomUUID(),randomUUID()];
   for(const id of ids)await pool.execute('INSERT INTO supplements(id,user_id,group_id,name,analysis,model,request_id) VALUES (?,?,?,?,?,?,?)',[id,session.user.id,groups[0].id,'Pause test',JSON.stringify({manufacturer:'Example'}),'test',randomUUID()]);
   await call('POST','/rechecks',{requestId:randomUUID()});await entered;assert.equal(received.products.length,2);
   await call('PUT','/supplements/'+ids[0]+'/pause',{paused:true});await call('PUT','/supplements/'+ids[0]+'/pause',{paused:false});release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
   let report=(await call('GET','/rechecks'))[1];assert.equal(report.proposals.length,1);assert.equal(report.latest.skippedCount,1);const proposal=report.proposals[0];
   await call('PUT','/supplements/'+proposal.supplementId+'/pause',{paused:true});assert.equal((await call('GET','/rechecks'))[1].proposals.length,0);await assert.rejects(call('PATCH','/rechecks/'+proposal.jobId+'/'+proposal.id,{action:'accept'}),e=>e.status===409);
   currentGate=gate();await call('POST','/rechecks',{requestId:randomUUID()});await entered;assert.equal(received.products.length,1);assert.notEqual(received.products[0].id,proposal.supplementId);release();for(let i=0;i<300&&api.activeJobs.size;i++)await new Promise(r=>setTimeout(r,10));
   await call('PUT','/supplements/'+proposal.supplementId+'/pause',{paused:false});report=(await call('GET','/rechecks'))[1];assert.ok(report.proposals.every(p=>p.id!==proposal.id));
   await call('DELETE','/supplements',{confirm:true});const [periods]=await pool.query('SELECT * FROM supplement_pauses WHERE user_id=?',[session.user.id]);assert.equal(periods.length,0);
  });
  await t.test('group deletion keeps supplements; account deletion cascades private records',async()=>{
   await request(a,'DELETE','/groups/'+group);assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements.find(s=>s.id===first).group_id,null);
   await auth.dispatch('DELETE','/me',{password,confirmation:'DELETE'},'Bearer '+a.token,'delete');
   for(const table of ['tracker_preferences','provider_credentials','day_groups','supplements','supplement_completions','supplement_pauses','analysis_jobs']){const [rows]=await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`,[a.user.id]);assert.equal(rows[0].n,0);}
  });
 }finally{await pool?.end();await root.query(`DROP DATABASE IF EXISTS ${database}`);await root.query("DROP USER IF EXISTS ?@'%'",[account]);await root.end();}
});

test('multi-photo validation bounds count, format and aggregate payload',()=>{
 const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,0,0,0,0,0]).toString('base64');assert.equal(validatePhotos({images:[image,image]}).length,2);assert.equal(validatePhotos({image}).length,1);assert.equal(validatePhotos({images:Array(6).fill(image)}).length,6);
 for(const body of [{images:Array(7).fill(image)},{images:['bad']},{images:[null]},{images:'bad'},{image,images:[image]}])assert.throws(()=>validatePhotos(body));
 const large='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(1800000)]).toString('base64');assert.throws(()=>validatePhotos({images:[large,large]}));
});
