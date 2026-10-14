/** Optional paid end-to-end check in a DISPOSABLE DB only. CI skips it. No existing
 * user records are read, no production DB secret is accepted, no key is printed. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import mysql from 'mysql2/promise';
import {AuthApi} from '../src/AuthApi.mjs';
import {hashPassword} from '../src/security.mjs';
import {TrackerApi} from '../src/TrackerApi.mjs';
import {createCredentialVault} from '../src/credential-vault.mjs';
import {createStructuredResearch} from '../src/structured-research.mjs';
test('live xAI job adds a sourced supplement, calculated daily NRV and completion',{skip:process.env.LIVE_RESEARCH!=='1',timeout:360000},async()=>{
 assert.equal(process.env.DB_TEST_HOST,'tracker-checks-db');
 const root=await mysql.createConnection({host:process.env.DB_TEST_HOST,user:'root',password:readFileSync('/run/secrets/test_db_root','utf8').trim(),multipleStatements:true});
 const database='live_checks_'+randomBytes(5).toString('hex'),user='live_'+randomBytes(5).toString('hex'),secret=randomBytes(32).toString('hex');let pool;
 try{
  await root.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);await root.query(`USE ${database}`);for(const file of ['schema.sql','migrations/002_tracker.sql','migrations/003_analysis_jobs.sql'])await root.query(readFileSync('/app/'+file,'utf8'));
  await root.query("CREATE USER ?@'%' IDENTIFIED BY ?",[user,secret]);await root.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${database}.* TO ?@'%'`,[user]);pool=mysql.createPool({host:process.env.DB_TEST_HOST,user,password:secret,database,timezone:'Z'});
  const auth=new AuthApi(pool,{secret:randomBytes(32).toString('hex'),mailConfigured:false},await hashPassword(randomUUID()));const password=randomBytes(24).toString('hex');await auth.register({email:'live@example.test',name:'Isolated live check',password},'live');const login=await auth.login({email:'live@example.test',password},'live');
  const tracker=new TrackerApi(pool,auth,{vault:createCredentialVault(randomBytes(32)),chat:createStructuredResearch()});const call=(method,path,body={},query)=>tracker.handle(method,path,body,'Bearer '+login.token,'live',query);
  await call('POST','/bootstrap',{timezone:'Europe/Vilnius'});await call('PUT','/settings/ai',{key:readFileSync('/run/secrets/provider_test_key','utf8').trim(),model:'grok-4.7'});
  const request={requestId:randomUUID(),name:'NOW Foods Vitamin C-1000 Tablets US SKU 0685 UPC 733739006851, 100 tablets, with rose hips and citrus bioflavonoids (not sustained release)'};
  const [accepted,job]=await call('POST','/supplements/jobs',request);assert.equal(accepted,202);assert.equal(job.status,'running');
  let result=job;const deadline=Date.now()+320000;while(result.status==='running'&&Date.now()<deadline){await new Promise(r=>setTimeout(r,2000));result=(await call('GET','/supplements/jobs/'+job.id))[1];}
  assert.equal(result.status,'complete',result.error_code||'Job did not complete');
  const query=new URLSearchParams({timezone:'Europe/Vilnius'});const [,dashboard]=await call('GET','/dashboard',{},query);assert.equal(dashboard.supplements.length,1);const item=dashboard.supplements[0];assert.equal(item.id,result.supplement_id);assert.ok(item.analysis.sources.some(s=>s.kind==='manufacturer'));assert.ok(item.analysis.dosage.directions);const c=item.analysis.nutrients.find(n=>n.nrvCode==='vitamin_c');assert.equal(c.reference.amount,80);assert.equal(c.dailyPercentMin,1250);
  const [,same]=await call('POST','/supplements/jobs',request);assert.equal(same.id,job.id);
  await call('PUT','/supplements/'+item.id+'/completion',{completed:true,timezone:'Europe/Vilnius'});assert.equal((await call('GET','/dashboard',{},query))[1].supplements[0].completed,true);await call('DELETE','/supplements/'+item.id);assert.equal((await call('GET','/dashboard',{},query))[1].supplements.length,0);
  console.log('Live isolated account → encrypted key → background AI research → sources/dose/NRV → save/check/delete passed.');
 }finally{await pool?.end();await root.query(`DROP DATABASE IF EXISTS ${database}`);await root.query("DROP USER IF EXISTS ?@'%'",[user]);await root.end();}
});
