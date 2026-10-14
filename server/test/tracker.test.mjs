/** Isolated database workflow. Run only with DB_TEST_HOST and a disposable server.
 * No production compose/env/password files are accepted by this runner. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import mysql from 'mysql2/promise';
import {AuthApi} from '../src/AuthApi.mjs';
import {hashPassword} from '../src/security.mjs';
import {TrackerApi,calendarDay,validatePhoto} from '../src/TrackerApi.mjs';
import {createCredentialVault} from '../src/credential-vault.mjs';
import {validAnalysis} from '../src/analysis.mjs';
test('calendar boundary and image validation',()=>{
 assert.equal(calendarDay('Europe/Vilnius',new Date('2026-10-14T20:59:59Z')),'2026-10-14');assert.equal(calendarDay('Europe/Vilnius',new Date('2026-10-14T21:00:00Z')),'2026-10-15');assert.throws(()=>validatePhoto('https://example.com/label.jpg'));assert.throws(()=>validatePhoto('data:image/jpeg;base64,YWJjZGVmZ2g='));
});
test('tracker ownership, encrypted credentials, validated AI and daily records',async t=>{
 assert.equal(process.env.DB_TEST_HOST,'tracker-checks-db','A disposable test host is required');
 const root=await mysql.createConnection({host:process.env.DB_TEST_HOST,user:'root',password:readFileSync('/run/secrets/test_db_root','utf8').trim(),multipleStatements:true});
 const database='tracker_checks_'+randomBytes(5).toString('hex'),account='checks_'+randomBytes(5).toString('hex'),secret=randomBytes(32).toString('hex');let pool;
 try{
  await root.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);await root.query(`USE ${database}`);await root.query(readFileSync('/app/schema.sql','utf8'));await root.query(readFileSync('/app/migrations/002_tracker.sql','utf8'));await root.query("CREATE USER ?@'%' IDENTIFIED BY ?",[account,secret]);await root.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${database}.* TO ?@'%'`,[account]);
  pool=mysql.createPool({host:process.env.DB_TEST_HOST,user:account,password:secret,database,timezone:'Z'});
  const auth=new AuthApi(pool,{secret:randomBytes(32).toString('hex'),mailConfigured:false},await hashPassword('A long dummy secret phrase'));
  const password='A long isolated testing password';
  for(const name of ['alice','bob'])await auth.register({email:name+'@example.test',name,password},name);
  const a=await auth.login({email:'alice@example.test',password},'a'),b=await auth.login({email:'bob@example.test',password},'b');
  let now=new Date('2026-10-14T20:59:59Z'),calls=0,lastInput,mode='valid';
  const vault=createCredentialVault(randomBytes(32));
  const chat=async input=>{
   calls++;lastInput=input;const context=JSON.parse(input.messages[1].content[0].text);
   const result={schemaVersion:'1.1',identified:true,productName:'Example manufacturer product',groupId:context.groups[0].id,benefits:['Potential benefit'],howToUse:'Check label.',whenToUse:'With food.',labelDirections:null,cautions:['Check interactions.'],confidence:'medium',needsReview:true,reviewReason:'Missing label.',evidenceNote:'General information.',compatibility:{summary:'Review needed.',requiresReview:false,assessments:context.existingSupplements.map(s=>({supplementId:s.id,status:mode==='conflict'?'duplicate':'insufficient_information',reason:'Unknown amount.'}))}};
   assert.equal(input.validate(result),true);return {result,model:input.model};
  };
  const tracker=new TrackerApi(pool,auth,{vault,chat,now:()=>now});
  const request=(session,method,path,body={},query)=>tracker.handle(method,path,body,'Bearer '+session.token,'test',query);
  const query=new URLSearchParams({timezone:'Europe/Vilnius'});
  await request(a,'POST','/bootstrap',{timezone:'Europe/Vilnius',language:'en'});await request(b,'POST','/bootstrap',{timezone:'Europe/Vilnius',language:'lt'});
  let dashboard=(await request(a,'GET','/dashboard',{},query))[1];assert.equal(dashboard.groups.length,4);const group=dashboard.groups[0].id;
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
  await t.test('foreign groups and malformed provider results are rejected',async()=>{
   const foreign=(await request(b,'GET','/dashboard',{},query))[1].groups[0].id;await assert.rejects(request(a,'PATCH','/supplements/'+first,{groupId:foreign}),e=>e.status===404);assert.equal(validAnalysis({productName:'wrong'},dashboard.groups,dashboard.supplements),false);
  });
  await t.test('group deletion keeps supplements; account deletion cascades private records',async()=>{
   await request(a,'DELETE','/groups/'+group);assert.equal((await request(a,'GET','/dashboard',{},query))[1].supplements.find(s=>s.id===first).group_id,null);
   await auth.dispatch('DELETE','/me',{password,confirmation:'DELETE'},'Bearer '+a.token,'delete');
   for(const table of ['tracker_preferences','provider_credentials','day_groups','supplements','supplement_completions']){const [rows]=await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`,[a.user.id]);assert.equal(rows[0].n,0);}
  });
 }finally{await pool?.end();await root.query(`DROP DATABASE IF EXISTS ${database}`);await root.query("DROP USER IF EXISTS ?@'%'",[account]);await root.end();}
});
