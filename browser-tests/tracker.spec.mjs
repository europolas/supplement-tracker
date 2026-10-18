import {intakeSlots} from '../modules/src/intake-plan.js';
/** UI contract checks use fake accounts/provider results; never touch production DB. */
import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const group='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const user={id:'33333333-3333-4333-8333-333333333333',email:'test@example.test',name:'Test',role:'user'};
async function mock(page,{waitAnalysis=false,failAnalysis=false,batch=false,progressive=false,queue=false,fallback=false,unknownDose=false,preloaded=false,labelProduct=false,conflict=false,basic=false,groupReview=false,hybrid=false,gemini=false,compatibilityMode='',partialDiagnostics=false,localization=false,detailFailed=false,design=false,compactReport=false,routine=false,routineProfile=null,intake=false}={}){
 let paused=false,resumeOn=null,intakePlan=null,intakeRevision=0,stockRemaining=null,stockThreshold=7;const intakeDone=new Map();
 let savedRoutine=structuredClone(routineProfile),routineRevision=0,routineSaveFails=false;
 let localeReady=false,completed=false,added=preloaded,started=hybrid||gemini,configured=true,release,terminalJob=null,researchRequested=false,reviewApplied=false,released=false,detailsReady=!progressive;
 let routineStarted=false,routineReady=false;const routineDecisions=new Map(),routineGroups=new Map(),routineJob='99999999-9999-4999-8999-999999999999',routineIds=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
 let customGroupIcon='',groupOrder=[];const uploads=[],requests=[];release=()=>{released=true;};
 await page.route('https://perimove.com/supplement-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/supplement-api','');requests.push({path,method:request.method()});
  let result={ok:true},httpStatus=200;
  const ai={configured,routine:savedRoutine,routineRevision,model:gemini?'gemini-3.8-flash':'grok-4.7',models:[gemini?'gemini-3.8-flash':'grok-4.7']};
  if(intake&&path.endsWith('/intake')){const body=request.postDataJSON();if(body.revision!==intakeRevision){await route.fulfill({status:409,json:{error:'INTAKE_CHANGED'}});return;}intakePlan=body.plan;stockRemaining=body.stock.remaining;stockThreshold=body.stock.lowThreshold;intakeRevision++;await route.fulfill({json:{ok:true,revision:intakeRevision,scheduleChanged:true,effectiveDay:new Date().toLocaleDateString('sv-SE')}});return;}
  if(intake&&path.endsWith('/completion')){const body=request.postDataJSON(),slot=body.slot||'daily';if(body.completed&&!intakeDone.has(slot)){const debit=stockRemaining===null?0:Math.min(stockRemaining,intakePlan?.quantity||1);if(stockRemaining!==null)stockRemaining-=debit;intakeDone.set(slot,debit);intakeRevision++;}else if(!body.completed&&intakeDone.has(slot)){if(stockRemaining!==null)stockRemaining+=intakeDone.get(slot);intakeDone.delete(slot);intakeRevision++;}await route.fulfill({json:{ok:true}});return;}
  if(path==='/v1/settings/routine'){if(request.method()==='PUT'){const body=request.postDataJSON();if(routineSaveFails){routineSaveFails=false;await route.fulfill({status:500,json:{error:'REQUEST_FAILED'}});return;}if(body.revision!==routineRevision){await route.fulfill({status:409,json:{error:'COLLECTION_CHANGED'}});return;}savedRoutine=body.routine;routineRevision++;}await route.fulfill({json:{routine:savedRoutine,revision:routineRevision}});return;}
  if(routine&&path==='/v1/rechecks'&&request.method()==='POST'){routineStarted=true;routineReady=false;await route.fulfill({json:{id:routineJob,status:'running'}});return;}
  if(routine&&path==='/v1/rechecks'){const proposals=routineReady?routineIds.filter(id=>!routineDecisions.has(id)).map((proposalId,i)=>({jobId:routineJob,id:proposalId,supplementId:i?'77777777-7777-4777-8777-777777777777':id,name:i?'Second supplement':'Example supplement',manufacturer:i?'Other brand':'Example',from:{id:group,name:'With a meal'},to:{id:'44444444-4444-4444-8444-444444444444',name:'With fats'},reason:'With food.'})):[];const latest=routineStarted?{id:routineJob,status:routineReady?'complete':'running',phase:'enriching',total_count:3,proposedCount:2}:null;await route.fulfill({json:{active:routineStarted&&!routineReady?latest:null,latest,proposals}});return;}
  if(routine&&path.startsWith('/v1/rechecks/')&&request.method()==='PATCH'){const proposalId=path.split('/').at(-1),action=request.postDataJSON().action;routineDecisions.set(proposalId,action);if(action==='accept')routineGroups.set(proposalId===routineIds[0]?id:'77777777-7777-4777-8777-777777777777','44444444-4444-4444-8444-444444444444');await route.fulfill({json:{ok:true}});return;}
  if(path==='/v1/supplements/localize'&&request.method()==='POST'){localeReady=true;await route.fulfill({json:{id:'locale-job',status:'running',phase:'enriching',result:{kind:'localization',items:[]}}});return;}
  if(localization&&localeReady&&path==='/v1/supplements/jobs'){await route.fulfill({json:{job:{id:'locale-job',status:'complete',phase:'done',result:{kind:'localization',items:[]}},active:[]}});return;}
  if(path==='/health')result={ok:true,passwordRecoveryAvailable:false};
  else if(path==='/v1/login')result={token:'a'.repeat(64),expiresAt:null,user};
  else if(path==='/v1/me')result={user,expiresAt:null};
  else if(path==='/v1/settings/ai'){configured=request.method()!=='DELETE';result={...ai,configured};}
  else if(path==='/v1/supplements/jobs'&&request.method()==='POST'){started=true;if(queue){const body=request.postDataJSON();result={id:'upload-'+(uploads.length+1),status:'running',phase:uploads.length?'queued':'recognizing',language:body.language,created_at:new Date(Date.now()+uploads.length*1000).toISOString(),result:{submission:{name:body.name,kind:body.images?.length||body.image?'photo':'name'},items:[],skipped:[]}};uploads.push(result);}else result={id:'test-job',status:'running'};}
  else if(queue&&path==='/v1/supplements/jobs')result={job:uploads.at(-1)||null,active:uploads.filter(job=>job.status==='running'),recent:[...uploads].reverse()};
  else if(path==='/v1/supplements/jobs'||path==='/v1/supplements/jobs/test-job'){
   const running={id:'test-job',status:'running',phase:'recognizing'};
   if(!started)result={job:null,active:[]};
   else if(waitAnalysis&&!released)result={job:running,active:[running]};
   else if(failAnalysis)result={job:{id:'test-job',status:'failed',phase:'done',error_code:'AI_SOURCES_UNVERIFIED'},active:[]};
   else{
    added=true;terminalJob={id:'test-job',status:detailsReady?'complete':'running',phase:detailsReady?'done':'enriching',supplement_id:id,...((batch||progressive)?{total_count:batch?2:1,processed_count:detailsReady?(batch?2:1):0,result:{items:[{id,name:'Readable vitamin',status:'added',research:detailsReady?'complete':'researching'},...(batch?[{name:'Unconfirmed magnesium',status:'failed',error:'AI_SOURCES_UNVERIFIED'}]:[])],skipped:batch?[{location:'Back row',reason:'Brand is blurred.'}]:[]}}:{})};result={job:terminalJob,active:detailsReady?[]:[terminalJob]};
   }
   if(path.endsWith('/test-job'))result=result.job;
  }
  else if(path==='/v1/groups/order'&&request.method()==='PUT'){groupOrder=request.postDataJSON().ids;}
  else if(path==='/v1/groups/'+group&&request.method()==='PATCH'){customGroupIcon=request.postDataJSON().icon||'';}
  else if(path.endsWith('/apply-groups')){reviewApplied=true;}
  else if(path==='/v1/supplements'&&request.method()==='DELETE'){added=false;started=false;terminalJob=null;}
  else if(path.endsWith('/research')){researchRequested=true;result={id:'detail-job',status:'running',phase:'enriching',result:{items:[],skipped:[]}};}
  else if(path.endsWith('/pause')){paused=request.postDataJSON().paused;resumeOn=request.postDataJSON().resumeOn||null;}
  else if(path.endsWith('/completion'))completed=request.postDataJSON().completed;
  else if(path==='/v1/dashboard')result={day:new Date().toLocaleDateString('sv-SE'),groups:[{id:group,icon:customGroupIcon,name:'With a meal',description:'Energy and everyday support'}],supplements:added?[{id,group_id:group,name:'Example <b>supplement</b>',completed,analysis:{manufacturer:'Example',dosage:{directions:'1 tablet daily',servingSize:'1 tablet'},nutrients:[{name:'Vitamin C',amount:1000,unit:'mg',amountNote:'Per tablet',reference:{amount:80,unit:'mg'},dailyAmountMin:1000,dailyAmountMax:1000,dailyPercentMin:1250,dailyPercentMax:1250}],sources:[{url:'https://manufacturer.example/label',title:'Official product label',kind:'manufacturer'}],research:{checkedAt:'2026-10-14T10:00:00Z',omittedSourceCount:1},benefitSummary:'Energy, cellular support',benefits:['A detailed explanation of the evidence, uncertainty and potential benefit that belongs only inside the supplement information page.'],howToUse:'Check the label.',whenToUse:'With food.',labelDirections:null,cautions:['Confirm suitability.'],needsReview:true,evidenceNote:'Example only.',compatibility:{summary:'Review your routine.',assessments:[]}}}]:[],ai};
  if(path==='/v1/dashboard'&&progressive&&added){const a=result.supplements[0].analysis;a.schemaVersion=detailsReady?'1.3':'draft-1';a.language='en';a.enrichment={status:detailsReady?'complete':'researching'};}
  if(path==='/v1/dashboard'&&fallback&&added){result.supplements[0].analysis.dosage={directions:null,servingSize:null,dailyServingsMin:null};result.supplements[0].analysis.doseFallback={basis:'established_adult_intake',ingredient:'Example ingredient',dailyAmountMin:25,dailyAmountMax:50,unit:'mg',sourceUrl:'https://guideline.example/reference',explanation:'General adult reference; no verified product capsule strength.'};}
  if(path==='/v1/dashboard'&&unknownDose&&added){result.supplements[0].analysis.dosage={directions:null,servingSize:null};result.supplements[0].analysis.doseFallback={basis:'unavailable',explanation:'No verified dose.'};}
  if(path==='/v1/dashboard'&&labelProduct&&added){result.supplements[0].name='Trans Resveratrolis (300 mg kapsulės, 60 vnt.)';result.supplements[0].analysis.manufacturer='L Cell';result.supplements[0].analysis.variant='300 mg kapsulės, 60 vnt.';}
  if(path==='/v1/dashboard'&&compatibilityMode&&added){const a=result.supplements[0].analysis;a.research.scope='full-product-details';result.groups.push({id:'44444444-4444-4444-8444-444444444444',name:'Evening · before bed',description:''});a.compatibility={summary:'Every routine compatibility paragraph should be hidden.',assessments:[{supplementId:'old',status:'duplicate',reason:'Ordinary overlap should be hidden.'},{supplementId:'uncertain',status:'insufficient_information',reason:'Missing quantities should be hidden.'},...(compatibilityMode==='severe'?[{supplementId:'existing',supplementName:'Conflicting product',status:'potential_conflict',severity:'severe',reason:'A significant same-time conflict.',canSeparate:true,recommendedGroupId:'44444444-4444-4444-8444-444444444444',recommendation:'Move to the evening group to separate intake.',sourceUrl:'https://manufacturer.example/label'}]:[])]};}
  if(path==='/v1/dashboard'&&conflict&&added)result.supplements[0].analysis.compatibility.assessments=[{supplementId:'existing',supplementName:'Other magnesium',status:'duplicate',reason:'Review total magnesium before combining.'}];
  if(path==='/v1/dashboard'&&localization&&added){const a=result.supplements[0].analysis;a.language=localeReady?'en':'lt';a.localizationNeeded=!localeReady;a.benefitSummary=localeReady?'Immunity, collagen':'Imunitetas';a.benefits=[localeReady?'Potential benefit.':'Lietuviška nauda'];a.dosage.directions=localeReady?'1 capsule daily.':'1 kapsulė per dieną';a.whenToUse='';a.howToUse='';}
  if(path==='/v1/dashboard'&&basic&&added){const a=result.supplements[0].analysis;a.schemaVersion='basic-1';a.enrichment={status:researchRequested?'researching':detailFailed?'failed':'complete'};}
  if(groupReview&&path==='/v1/dashboard'){result.groups.push({id:'55555555-5555-4555-8555-555555555555',name:'With fats'});if(reviewApplied&&result.supplements.length)result.supplements[0].group_id=result.groups[1].id;}
  if(groupReview&&result.job?.status==='complete'){result.job.total_count=1;result.job.result={items:[{id,name:'Vitamin',status:'added',research:'complete'}],review:{status:reviewApplied?'applied':'ready',groups:[{id:group,name:'With a meal'},{id:'55555555-5555-4555-8555-555555555555',name:'With fats'}],changes:[{id}],assessments:[{id,name:'Vitamin',from:group,to:'55555555-5555-4555-8555-555555555555',reason:'Manufacturer recommends a fat-containing meal.',sourceUrl:'https://manufacturer.example/timing'}]}};}
  if(hybrid&&path==='/v1/dashboard'&&added){const a=result.supplements[0].analysis;a.schemaVersion='basic-1';a.composition={ingredients:[{name:'Vitamin C',labelAmount:''}],complete:false};a.benefitTags=[{id:'immunity',en:'Immunity',lt:'Imunitetas'},{id:'antioxidant',en:'Antioxidant',lt:'Antioksidantas'}];}
  if(gemini&&result.job){Object.assign(result.job,{created_at:'2026-10-16T10:00:00Z',finished_at:'2026-10-16T10:00:10Z',total_count:16,result:{items:[],monitor:{pipeline:'gemini-single',model:'gemini-3.8-flash',geminiMs:10000,totalMs:10000,recognized:16,calls:1,inputTokens:4000,outputTokens:1000,thinkingTokens:100}}});result.recent=[result.job];}
  if(partialDiagnostics&&result.job){Object.assign(result.job,{status:'complete',error_code:null,result:{monitor:{pipeline:'gemini-single',model:'gemini-3.8-flash',calls:1,autoResearch:true},timings:{geminiMs:7980,detailsMs:185090,totalMs:193070},items:[{name:'Successful product',research:'complete'},{name:'Failed Q10',research:'failed',error:'AI_INVALID_RESPONSE'}]}});result.recent=[result.job];}
  if(hybrid&&result.job){Object.assign(result.job,{created_at:'2026-10-15T10:00:00Z',finished_at:'2026-10-15T10:00:15Z',total_count:16,result:{items:[],monitor:{pipeline:'grok-jev',grokModel:'grok-4.7',jevModel:'jev-1.14.0',grokCacheHit:true,grokMs:12000,jevMs:1000,totalMs:13000,recognized:16,grokCalls:1,jevCompleted:4,jevBatches:4,questions:1616,jevInputTokens:12345,completeComposition:0,partialComposition:15,unknownComposition:1}}});result.recent=[result.job];}
  if(design&&path==='/v1/dashboard'){
   result.groups=[{id:group,name:'Morning · empty stomach',description:'Kickstart your day'},{id:'44444444-4444-4444-8444-444444444444',name:'Meals · with fats',description:'Take with a meal containing fats'},{id:'55555555-5555-4555-8555-555555555555',name:'Any time day or evening',description:'Flexible timing'},{id:'66666666-6666-4666-8666-666666666666',name:'Evening · before bed',description:'Wind down for rest'}];
   result.supplements=result.groups.flatMap((g,i)=>Array.from({length:[4,5,3,4][i]},(_,n)=>({id:g.id.slice(0,-2)+String(n).padStart(2,'0'),group_id:g.id,name:'Supplement '+n,analysis:{manufacturer:'Example',benefitSummary:'Energy',schemaVersion:'basic-1'},completed:false})));
  }
  if(compactReport&&path==='/v1/dashboard'&&added){const original=result.supplements[0];result.groups.push({id:'44444444-4444-4444-8444-444444444444',name:'With fats',description:''});result.supplements=['Ready product','Failed product','Pending product'].map((name,i)=>({...original,id:i?String(i).repeat(8)+'-4444-4444-8444-444444444444':id,name,analysis:{...original.analysis,enrichment:{status:['complete','failed','researching'][i]}}}));}
  if(compactReport&&result.job?.status==='complete'){result.job.total_count=3;result.job.result={groupChangesTracked:true,items:[{id,name:'Ready product',status:'added',research:'complete',groupChange:{from:{id:group,name:'With a meal'},to:{id:'44444444-4444-4444-8444-444444444444',name:'With fats'}}},{id:'11111111-4444-4444-8444-444444444444',name:'Failed product',status:'added',research:'failed'},{id:'22222222-4444-4444-8444-444444444444',name:'Pending product',status:'added',research:'researching'}],skipped:[]};}
  if(routine&&path==='/v1/dashboard'&&added){const original=result.supplements[0];result.groups.push({id:'44444444-4444-4444-8444-444444444444',name:'With fats',description:'With fat-containing food'});result.supplements=[{...original,name:'Example supplement'},...['Second supplement','Unchanged supplement'].map((name,i)=>({...original,id:i?'88888888-8888-4888-8888-888888888888':'77777777-7777-4777-8777-777777777777',name,analysis:{...original.analysis,manufacturer:i?'Third brand':'Other brand'}}))].map(p=>({...p,group_id:routineGroups.get(p.id)||p.group_id}));}
  if(path==='/v1/dashboard')result.supplements=result.supplements.map(s=>({...s,paused,resume_on:resumeOn}));
  if(intake&&path==='/v1/dashboard'&&added){const item=result.supplements[0],occurrences=intakeSlots(intakePlan,result.day).map(s=>({...s,completed:intakeDone.has(s.slot)}));Object.assign(item,{intake_plan:intakePlan,intake_revision:intakeRevision,stock_remaining:stockRemaining,stock_threshold:stockThreshold,occurrences,scheduledToday:occurrences.length>0,completed:occurrences.length>0&&occurrences.every(s=>s.completed)});}
  if(path==='/v1/dashboard'&&groupOrder.length)result.groups.sort((a,b)=>groupOrder.indexOf(a.id)-groupOrder.indexOf(b.id));
  await route.fulfill({status:httpStatus,json:result});
 });
 return {release,requests,uploads,failRoutineSave:()=>{routineSaveFails=true;},changeRoutineElsewhere:()=>{routineRevision++;},releaseRecheck:()=>{routineReady=true;},releaseResearch:()=>{detailsReady=true;}};
}
async function login(page){await page.goto('/');await page.locator('#login-form [name=email]').fill(user.email);await page.locator('#login-form [name=password]').fill('A long example password');await page.locator('#login-form button[type=submit]').click();await expect(page.locator('#app-nav')).toBeVisible();await expect(page.locator('[data-screen="/"]')).toBeVisible();}
test('shared login opens English routine and preserves iPhone layout',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await mock(page);await login(page);
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#routine-groups h2')).toHaveText('With a meal');await expect(page.locator('.group-benefit')).toHaveCount(0);await expect(page.locator('.supplement-table thead')).toHaveCount(0);
 const layout=await page.evaluate(()=>({bottom:document.querySelector('main').getBoundingClientRect().bottom,height:innerHeight,scroll:getComputedStyle(document.querySelector('main')).scrollbarWidth}));expect(layout.bottom).toBe(layout.height);expect(layout.scroll).toBe('none');expect(errors).toEqual([]);
});
test('analysis disables send, reports completion and renders safe table/details',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Example manufacturer supplement');await page.locator('#analyze-form button[type=submit]').click();
 await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('#analysis-status')).toContainText('Recognizing');fake.release();await expect(page.locator('#analysis-status')).toContainText('complete');await page.locator('#close-add').click();
 await expect(page.locator('.supplement-row td:first-child button')).toHaveAttribute('aria-pressed','false');await page.locator('.check-button').click();await expect(page.locator('.supplement-row')).toHaveClass(/is-done/);await expect(page.locator('#today-progress')).toContainText('1 of 1');await expect(page.locator('.supplement-row .product-title b')).toHaveCount(0);
 await expect(page.locator('.supplement-row td')).toHaveCount(2);await expect(page.locator('.supplement-open .summary')).toHaveText('Example · Energy, cellular support');await expect(page.locator('.product-manufacturer')).toHaveText('Example');await expect(page.locator('.supplement-row')).not.toContainText('A detailed explanation');
 await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).toContainText('A detailed explanation');await expect(page.locator('#route-header h1')).toHaveText('<b>supplement</b>');await expect(page.locator('#supplement-detail')).not.toContainText('Compatibility with your routine');await expect(page.locator('.composition-list')).toContainText('Vitamin C · 1,000 mg');await expect(page.locator('.source-list a')).toHaveAttribute('href','https://manufacturer.example/label');await expect(page.locator('.doctor-note')).toHaveCount(0);
});
test('Lithuanian and light/dark/auto preferences persist and auto follows OS',async({page})=>{
 await mock(page);await page.goto('/');await expect(page.locator('#settings-form')).toBeVisible();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('#settings-form [name=theme]')).toHaveValue('dark');
 await page.locator('#settings-form [name=theme]').selectOption('system');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('PWA caches only public assets and logout clears private screen state',async({page})=>{
 await mock(page);await login(page);await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const urls=await page.evaluate(async()=>{const all=[];for(const key of await caches.keys())for(const req of await(await caches.open(key)).keys())all.push(req.url);return all;});expect(urls.some(url=>url.includes('/supplement-api/'))).toBe(false);
 await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#app-nav')).toBeHidden();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('supplement-tracker:auth'))).toBe(null);
});

test('server job resumes after reload and the next add form is usable',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('A public test product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Recognizing');await page.locator('#close-add').click();await page.reload();await expect(page.locator('#progress-ring')).toHaveAttribute('aria-busy','true');await expect(page.locator('#upload-queue-spinner')).toHaveJSProperty('hidden',false);fake.release();await expect(page.locator('.supplement-row')).toHaveCount(1);await expect(page.locator('#progress-ring')).toHaveAttribute('aria-busy','false');await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('#analyze-form [name=name]')).toHaveValue('');
});
test('a failed source check shows an error and never adds an item',async({page})=>{
 await mock(page,{failAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Unconfirmed product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Nothing was added');await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('.supplement-row')).toHaveCount(0);
});
test('selected photos are re-encoded and invalid files never reach AI',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();
 await expect(page.locator('#analyze-form [name=photo]')).not.toHaveAttribute('capture');await expect(page.locator('#analyze-form [name=camera]')).toHaveCount(0);
 await expect(page.getByText('Upload photo',{exact:true})).toBeVisible();
 await page.locator('#analyze-form [name=photo]').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});await expect(page.locator('#analysis-status')).toContainText('readable image');await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();expect(fake.requests.some(r=>r.path==='/v1/supplements/jobs'&&r.method==='POST')).toBe(false);
 const bytes=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;canvas.getContext('2d').fillRect(0,0,20,20);return canvas.toDataURL('image/png').split(',')[1];});await page.locator('#analyze-form [name=photo]').setInputFiles({name:'label.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});await expect(page.locator('#photo-preview')).toBeVisible();await expect(page.locator('#photo-preview')).toHaveAttribute('src',new RegExp('^data:image/jpeg;base64,'));await page.locator('#remove-photo').click();await expect(page.locator('#photo-preview')).toBeHidden();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();
});

test('login persists after closing the browser and logout clears the saved session',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'tracker-auth-'));let context;
 try{
  context=await chromium.launchPersistentContext(directory,{headless:true});let page=context.pages()[0];await mock(page);await login(page);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('supplement-tracker:auth')));expect(Object.keys(stored).sort()).toEqual(['expiresAt','token']);expect(stored.expiresAt).toBe(null);
  await context.close();context=await chromium.launchPersistentContext(directory,{headless:true});page=context.pages()[0];await mock(page);await page.goto('http://127.0.0.1:4175/');await expect(page.locator('#app-nav')).toBeVisible();await expect(page.locator('#login-form')).toBeHidden();
  await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('supplement-tracker:auth'))).toBe(null);
  await context.close();context=await chromium.launchPersistentContext(directory,{headless:true});page=context.pages()[0];await mock(page);await page.goto('http://127.0.0.1:4175/');await expect(page.locator('#login-form')).toBeVisible();
 }finally{await context?.close();await rm(directory,{recursive:true,force:true});}
});

test('batch report exposes each success, failure and unreadable label and clears on logout',async({page})=>{
 await mock(page,{batch:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Several products');await page.locator('#analyze-form button[type=submit]').click();
 await expect(page.locator('#analysis-results')).toContainText('1 of 2');await expect(page.locator('#analysis-results')).toContainText('Unconfirmed magnesium');await expect(page.locator('#analysis-results')).toContainText('Brand is blurred.');await expect(page.locator('#view-added')).toBeHidden();
 await page.locator('#toggle-upload-queue').click();await page.locator('#analysis-results .upload-product-button:enabled').click();await expect(page.locator('#route-header h1')).toBeVisible();await page.reload();await expect(page.locator('#app-nav')).toBeVisible();await expect(page.locator('#route-dialog')).toBeHidden();await expect(page.locator('#home-report,#home-analysis-results')).toHaveCount(0);await page.locator('#add-supplement').click();await expect(page.locator('#analysis-results')).toContainText('Brand is blurred.');await page.locator('#close-add').click();await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#analysis-results')).toBeEmpty();
});

test('recognized products appear before research completes and a second add flow is available',async({page})=>{
 const fake=await mock(page,{progressive:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Several products');await page.locator('#analyze-form button[type=submit]').click();
 await expect(page.locator('#analysis-status')).toContainText('recognized');await page.locator('#close-add').click();await expect(page.locator('.supplement-row')).toHaveCount(1);await expect(page.locator('.supplement-open .research-badge')).toContainText('Checking');
 await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await page.locator('#close-add').click();await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail .research-badge')).toContainText('Checking');
 await page.screenshot({path:'.runtime/focused-details.png',animations:'disabled'});fake.releaseResearch();await expect(page.locator('[data-detail-section=dose]')).toContainText('1 tablet daily');await expect(page.locator('#supplement-detail')).not.toContainText('Provisional grouping');
});

test('upload dialog preserves full queue, accepts a photo during recognition and protects the next draft',async({page})=>{
 const fake=await mock(page,{queue:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('First product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-results details')).toHaveCount(1);await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();
 await page.locator('#close-add').click();await page.locator('#add-supplement').click();await expect(page.locator('#analysis-results')).toContainText('First product');
 const bytes=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;return canvas.toDataURL('image/png').split(',')[1];});const photo={name:'labels.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')};
 await page.locator('#analyze-form [name=name]').fill('Second <b>photo</b>');await page.locator('#analyze-form [name=photo]').setInputFiles(photo);await expect(page.locator('#photo-preview')).toBeVisible();await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-results details')).toHaveCount(2);await expect(page.locator('[data-job-id="upload-2"]')).toContainText('Waiting in queue');await expect(page.locator('#analysis-results b')).toHaveCount(0);
 await page.locator('#analyze-form [name=name]').fill('Keep this next draft');await page.locator('#analyze-form [name=photo]').setInputFiles(photo);await expect(page.locator('#photo-preview')).toBeVisible();fake.uploads[0].phase='enriching';fake.uploads[0].total_count=1;fake.uploads[0].result.items=[{name:'First product',status:'added',research:'researching'}];
 await expect(page.locator('[data-job-id="upload-1"] .upload-job-phase')).toHaveText('Collecting detailed information');await expect(page.locator('#analyze-form [name=name]')).toHaveValue('Keep this next draft');await expect(page.locator('#photo-preview')).toBeVisible();await page.locator('#close-add').click();await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form [name=name]')).toHaveValue('Keep this next draft');await expect(page.locator('#analysis-results details')).toHaveCount(2);
 await page.reload();await page.locator('#add-supplement').click();await expect(page.locator('#analysis-results details')).toHaveCount(2);expect(fake.requests.filter(r=>r.path==='/v1/supplements/jobs'&&r.method==='POST')).toHaveLength(2);await page.locator('#close-add').click();await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#analysis-results')).toBeEmpty();
});

test('missing manufacturer dose shows a separately labeled adult reference without capsule instructions',async({page})=>{
 await mock(page,{fallback:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Example ingredient');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('complete');await page.locator('#close-add').click();await page.locator('.supplement-open').click();
 await expect(page.locator('#supplement-detail')).toContainText('Adult reference amount');await expect(page.locator('#supplement-detail')).toContainText('Example ingredient: 25–50 mg');await expect(page.locator('#supplement-detail')).toContainText('Adult reference amount');await expect(page.locator('#supplement-detail a[href="https://guideline.example/reference"]')).toHaveCount(1);
});

test('detail shows only three primary sections and disclosure survives polling redraws with localized controls',async({page})=>{
 const fake=await mock(page,{progressive:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Example');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('.supplement-row')).toHaveCount(1);await page.locator('#close-add').click();await page.locator('.supplement-open').click();
 const primary=page.locator('#detail-primary'),extra=page.locator('#detail-extra-content'),toggle=page.locator('.detail-more>summary');
 await expect(toggle).toHaveCount(0);await expect(page.locator('.detail-research-button')).toBeVisible();await expect(page.locator('.detail-research-button')).toBeDisabled();fake.releaseResearch();await expect(page.locator('[data-detail-section=dose]')).toContainText('1 tablet daily');
 await expect(primary.locator('section')).toHaveCount(3);await expect(primary.locator('h3')).toHaveText(['Composition','Usage','Potential benefits']);await expect(primary.locator('.nutrient-table')).toHaveCount(0);await expect(extra).toBeHidden();await expect(toggle).toHaveText('More information');await expect(page.getByRole('button',{name:'Refresh information'})).toBeVisible();
 await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveText('Less information');await expect(extra).toBeVisible();await expect(primary).toContainText('Check the label.');await expect(page.locator('#supplement-detail')).not.toContainText('Confirm suitability.');
 await page.screenshot({path:'.runtime/focused-details.png',animations:'disabled'});fake.releaseResearch();await expect(page.locator('[data-detail-section=dose]')).toContainText('1 tablet daily');await expect(extra).toBeVisible();await expect(page.locator('.composition-list')).toBeVisible();await expect(page.locator('.source-list')).toBeVisible();
 await toggle.click();await expect(toggle).toHaveText('More information');await expect(extra).toBeHidden();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(extra).toBeHidden();
 await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#app-nav [data-route="/"]').click();await page.locator('.supplement-open').click();await expect(toggle).toHaveText('Daugiau informacijos');await expect(page.locator('.doctor-note')).toHaveCount(0);await expect(primary.locator('h3')).toHaveText(['Sudėtis','Vartojimas','Galima nauda']);await expect(extra).toBeHidden();await toggle.click();await expect(toggle).toHaveText('Mažiau informacijos');await expect(extra).toBeVisible();
});


test('Sage routine and routed sheets preserve scroll, Back, draft and compact unknown dose',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,{unknownDose:true,preloaded:true});await login(page);
 await expect(page.locator('#progress-count')).toHaveText('0 / 1');await page.locator('.check-button').click();await expect(page.locator('#progress-count')).toHaveText('1 / 1');await expect(page.locator('#progress-arc')).toHaveAttribute('stroke-dasharray','100 100');
 await page.screenshot({animations:'disabled',path:'.runtime/sage-home.png'});
 await page.locator('.supplement-open').click();await expect(page.locator('#route-dialog')).toBeVisible();await expect(page.locator('[data-detail-section=dose]')).toContainText('not determined');
 await expect(page.locator('.dose-unknown em')).toHaveCSS('font-style','italic');await expect(page.locator('.dose-unknown')).toHaveCSS('font-size','11px');await expect(page.locator('#detail-extra-content')).toBeHidden();
 await page.screenshot({animations:'disabled',path:'.runtime/sage-detail.png'});
 await page.goBack();await expect(page.locator('#route-dialog')).not.toBeVisible();
 await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Magnesium bisglycinate');await page.screenshot({animations:'disabled',path:'.runtime/sage-add.png'});
 await page.keyboard.press('Escape');await expect(page.locator('#add-dialog')).not.toBeVisible();await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form [name=name]')).toHaveValue('Magnesium bisglycinate');await page.locator('#close-add').click();
 await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#app-nav [data-route="/"]').click();await page.locator('.supplement-open').click();await expect(page.locator('.dose-unknown em')).toHaveText('nenustatyta');await page.screenshot({animations:'disabled',path:'.runtime/sage-detail-dark.png'});
 await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('[data-route="/groups"]').click();await page.locator('#new-group').click();await expect(page.locator('#group-dialog')).toBeVisible();await page.locator('#group-form [name=name]').fill('Test draft');await page.locator('#group-dialog [data-sheet-close]').click();await expect(page.locator('[data-screen="/groups"]')).toBeVisible();
 expect(errors).toEqual([]);
});

test('Sage pages and sheets fit narrow phones, tablets and keyboard height',async({page})=>{
 await mock(page,{preloaded:true});await login(page);
 for(const width of [320,768]){
  await page.setViewportSize({width,height:874});await page.locator('#add-supplement').click();
  await expect(page.locator('#add-title')).toBeFocused();await expect.poll(()=>page.locator('#add-dialog').evaluate(d=>d.getAnimations().length)).toBe(0);
  const sizes=await page.locator('#add-dialog').evaluate(d=>({width:d.getBoundingClientRect().width,overflow:d.scrollWidth>d.clientWidth,bottom:d.getBoundingClientRect().bottom}));
  expect(sizes.width).toBeLessThanOrEqual(Math.min(width,600));expect(sizes.overflow).toBe(false);expect(Math.round(sizes.bottom)).toBe(874);
  await page.locator('#close-add').click();await expect(page.locator('#add-dialog')).not.toBeVisible();
 }
 await page.setViewportSize({width:402,height:874});await page.locator('#add-supplement').click();
 await page.evaluate(()=>document.documentElement.style.setProperty('--app-height','480px'));
 await expect.poll(()=>page.locator('#add-dialog').evaluate(d=>Math.round(d.getBoundingClientRect().bottom))).toBe(480);
 await page.locator('#analyze-form [name=name]').fill('Keyboard draft');await page.locator('#close-add').click();
});


test('compact labels and a real touch pull close product and upload sheets',async({page})=>{
 await mock(page,{preloaded:true,labelProduct:true});await login(page);
 await expect(page.locator('.supplement-open .product-title')).toHaveText('Trans Resveratrolis');await expect(page.locator('.supplement-open .summary')).toHaveText('L Cell · Energy, cellular support');await expect(page.locator('.supplement-table thead,.group-benefit')).toHaveCount(0);
 await page.locator('.supplement-open').click();await expect(page.locator('.detail-name')).toHaveText('Trans Resveratrolis');await expect(page.locator('.product-subtitle')).toHaveText('L Cell · 300 mg kapsulės, 60 vnt.');await expect(page.locator('#route-title')).toBeHidden();
 const cdp=await page.context().newCDPSession(page);
 async function pull(selector){
  await expect.poll(()=>page.locator(selector).evaluate(n=>n.closest('dialog').getAnimations().length)).toBe(0);
  const box=await page.locator(selector).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(const distance of [4,15,35,60,100])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+distance}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await pull('.detail-name');await expect(page.locator('#route-dialog')).not.toBeVisible();
 await page.locator('#add-supplement').click();await pull('#add-title');await expect(page.locator('#add-dialog')).not.toBeVisible();await cdp.detach();
});


test('Home omits historical compatibility badges and details omit ungraded assessments',async({page})=>{
 await mock(page,{preloaded:true,conflict:true,labelProduct:true});await login(page);
 await expect(page.locator('.group-block .supplement-row')).toHaveCount(1);await expect(page.locator('.review-combination')).toHaveCount(0);
 await page.screenshot({animations:'disabled',path:'.runtime/speed-warning-home.png'});
 await page.locator('.supplement-open').click();await expect(page.locator('[data-detail-section=compatibility]')).toHaveCount(0);await expect(page.locator('.doctor-note')).toHaveCount(0);
 await page.screenshot({animations:'disabled',path:'.runtime/speed-warning-detail.png'});
});

 test('compact product only requests details on explicit click and disables the pending action',async({page})=>{
 const m=await mock(page,{preloaded:true,basic:true,labelProduct:true});await login(page);await expect(page.locator('#routine-note')).toBeHidden();await page.locator('.supplement-open').click();await expect(page.locator('#detail-primary section')).toHaveCount(1);await expect(page.locator('[data-detail-section=benefits]')).toContainText('Energy, cellular support');await expect(page.getByRole('button',{name:'Refresh information'})).toBeVisible();await expect(page.locator('.detail-more')).toHaveCount(0);await expect(page.locator('#route-dialog')).toBeVisible();await expect.poll(()=>page.locator('#route-dialog').evaluate(d=>d.getAnimations().length)).toBe(0);await page.screenshot({path:'.runtime/basic-detail.png',animations:'disabled'});expect(m.requests.filter(r=>r.path.endsWith('/research'))).toHaveLength(0);const action=page.getByRole('button',{name:'Refresh information'});await action.click();await expect(action).toBeDisabled();expect(m.requests.filter(r=>r.path.endsWith('/research'))).toHaveLength(1);
 });

test('account clear requires confirmation, removes supplements and keeps groups',async({page})=>{
 const m=await mock(page,{preloaded:true,basic:true});await login(page);await page.locator('.account-link').click();await page.locator('#clear-supplements').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(m.requests.filter(r=>r.method==='DELETE'&&r.path==='/v1/supplements')).toHaveLength(0);
 await page.locator('#clear-supplements').click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.locator('.supplement-open')).toHaveCount(0);expect(m.requests.filter(r=>r.method==='DELETE'&&r.path==='/v1/supplements')).toHaveLength(1);await expect(page.locator('.group-block')).toHaveCount(1);await expect(page.locator('#progress-ring')).toHaveAttribute('aria-busy','false');await page.locator('#app-nav [data-route="/"]').click();await expect(page.locator('#progress-count')).toHaveText('0 / 0');await expect(page.locator('#progress-ring')).not.toHaveClass(/is-loading/);await expect(page.locator('.routine-loading-arc')).toBeHidden();await page.screenshot({path:'.runtime/clear-home-settled.png'});
});

test('multiple photos stay in the draft and are sent as one request',async({page})=>{
 await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();const input=page.locator('[name=photo]');await expect(input).toHaveAttribute('multiple','');
 const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=40;c.getContext('2d').fillRect(0,0,40,40);return c.toDataURL().split(',')[1];});const file=name=>({name,mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
 await input.setInputFiles([file('one.png'),file('two.png')]);await expect(page.locator('#more-photo-previews img')).toHaveCount(1);await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await page.locator('#close-add').click();await page.locator('#add-supplement').click();await expect(page.locator('#more-photo-previews img')).toHaveCount(1);
 await input.setInputFiles(Array.from({length:5},(_,i)=>file(i+'.png')));await expect(page.locator('#analysis-status')).toContainText('up to 6');await expect(page.locator('#more-photo-previews img')).toHaveCount(1);
 await expect.poll(()=>page.locator('#add-dialog').evaluate(d=>d.getAnimations().length)).toBe(0);await page.screenshot({path:'.runtime/multiple-photos.png',animations:'disabled'});
 await input.setInputFiles(Array.from({length:4},(_,i)=>file('accepted-'+i+'.png')));await expect(page.locator('#more-photo-previews img')).toHaveCount(5);await page.screenshot({path:'.runtime/six-photos.png',animations:'disabled'});
 const requests=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/supplements/jobs'))requests.push(r.postDataJSON());});await page.locator('#analyze-form button[type=submit]').click();await expect.poll(()=>requests.length).toBe(1);expect(requests[0].images).toHaveLength(6);expect(requests[0].image).toBeUndefined();await expect(page.locator('#photo-preview')).toBeHidden();await expect(page.locator('#more-photo-previews img')).toHaveCount(0);
});

test('individual photo removal preserves remaining images and never submits deleted data',async({page})=>{
 await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();
 const colors=await page.evaluate(()=>['red','green','blue'].map(color=>{const c=document.createElement('canvas');c.width=40;c.height=40;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,40,40);return c.toDataURL().split(',')[1];}));
 await page.locator('[name=photo]').setInputFiles(colors.map((data,i)=>({name:i+'.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})));await expect(page.locator('.photo-remove')).toHaveCount(3);await expect.poll(()=>page.locator('#add-dialog').evaluate(d=>d.getAnimations().length)).toBe(0);await page.screenshot({path:'.runtime/photo-remove-controls.png',animations:'disabled'});
 const original=await page.locator('#photo-previews img').evaluateAll(nodes=>nodes.map(n=>n.src));await page.getByRole('button',{name:'Remove photo 2',exact:true}).click();await expect(page.locator('.photo-remove')).toHaveCount(2);expect(await page.locator('#photo-previews img').evaluateAll(nodes=>nodes.map(n=>n.src))).toEqual([original[0],original[2]]);
 await page.locator('#close-add').click();await page.locator('#add-supplement').click();await expect(page.locator('.photo-remove')).toHaveCount(2);
 const request=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/supplements/jobs'));await page.locator('#analyze-form button[type=submit]').click();expect((await request).postDataJSON().images).toEqual([original[0],original[2]]);
 await expect(page.locator('#photo-previews')).toBeHidden();await page.locator('[name=photo]').setInputFiles({name:'last.png',mimeType:'image/png',buffer:Buffer.from(colors[0],'base64')});await page.getByRole('button',{name:'Remove photo 1',exact:true}).click();await expect(page.locator('#photo-previews')).toBeHidden();await expect(page.locator('#remove-photo')).toBeHidden();
});

test('group review shows proposed move and source, applies only after explicit acceptance',async({page})=>{
 const m=await mock(page,{basic:true,groupReview:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Vitamin');await page.locator('#analyze-form button[type=submit]').click();const review=page.locator('#analysis-results .group-review');await expect(review).toContainText('With a meal → With fats');await expect(review.locator('a')).toHaveAttribute('href','https://manufacturer.example/timing');expect(m.requests.filter(r=>r.path.endsWith('/apply-groups'))).toHaveLength(0);await page.locator('#toggle-upload-queue').click();await review.scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/group-review-preview.png',animations:'disabled'});await review.getByRole('button',{name:'Apply suggested group changes'}).click();await expect(review).toContainText('Group changes applied.');expect(m.requests.filter(r=>r.path.endsWith('/apply-groups'))).toHaveLength(1);
});

test('photo controls enlarge the full image, zoom locally and return to the preserved draft',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();
 const buffer=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=900;const ctx=c.getContext('2d');ctx.fillStyle='#829c6e';ctx.fillRect(0,0,300,900);ctx.fillStyle='white';ctx.font='40px sans-serif';ctx.fillText('TOP',20,60);ctx.fillText('BOTTOM',20,850);return c.toDataURL().split(',')[1];}),'base64');
 await page.locator('[name=photo]').setInputFiles({name:'label.png',mimeType:'image/png',buffer});await expect(page.locator('.photo-zoom')).toHaveCount(1);
 const source=await page.locator('#photo-preview').getAttribute('src');await page.getByRole('button',{name:'Enlarge photo 1',exact:true}).click();
 const viewer=page.locator('.local-image-viewer');await expect(viewer).toBeVisible();await expect(viewer.locator('img')).toHaveAttribute('src',source);await expect(viewer).toHaveAttribute('data-enlarged','false');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(viewer).toHaveAttribute('data-enlarged','true');await expect(viewer.locator('.local-image-stage')).toBeVisible();
 await page.getByRole('button',{name:'Fit image',exact:true}).click();await expect(viewer).toHaveAttribute('data-enlarged','false');await page.screenshot({path:'.runtime/photo-viewer.png',animations:'disabled'});
 await page.keyboard.press('Escape');await expect(viewer).not.toBeVisible();await expect(viewer.locator('img')).not.toHaveAttribute('src',/.+/);await expect(page.locator('#add-dialog')).toBeVisible();await expect(page.locator('.photo-zoom')).toBeFocused();
 expect(fake.requests.filter(r=>r.method==='POST'&&r.path==='/v1/supplements/jobs')).toHaveLength(0);
 await page.getByRole('button',{name:'Remove photo 1',exact:true}).click();await expect(page.locator('#photo-previews')).toBeHidden();
});

test('hybrid composition, localized tags and owner diagnostics fit the Sage sheet',async({page})=>{
 await mock(page,{preloaded:true,hybrid:true});await login(page);
 await expect(page.locator('.supplement-open .summary')).toContainText('Immunity, Antioxidant');await page.locator('.supplement-open').click();
 await expect(page.locator('[data-detail-section="composition"]')).toContainText('Vitamin C');await expect(page.locator('[data-detail-section="composition"]')).toContainText('Partial composition');
 await page.screenshot({path:'.runtime/hybrid-detail.png'});
 await page.evaluate(()=>location.hash='/account');await page.locator('#diagnostics-link').click();await expect(page.locator('#route-title')).toHaveText('AI dashboard');await expect(page.locator('#ai-dashboard')).toContainText('grok-jev');await expect(page.locator('#ai-dashboard')).toContainText('12 s');await expect(page.locator('#ai-dashboard')).toContainText('1616');await expect(page.locator('#ai-dashboard')).toContainText('Reused (no Grok call)');
 expect(await page.locator('#ai-dashboard').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);await page.screenshot({path:'.runtime/hybrid-dashboard.png'});
 await page.evaluate(()=>location.hash='/account');await page.locator('#settings-form select[name="language"]').selectOption('lt');await page.locator('#diagnostics-link').click();await expect(page.locator('#route-title')).toHaveText('AI diagnostika');await expect(page.locator('#ai-dashboard')).toContainText('Atpažinti produktai');
 await page.evaluate(()=>location.hash='/');await page.locator('.supplement-open').click();await expect(page.locator('[data-detail-section="benefits"]')).toContainText('Imunitetas');
});

test('Gemini account and diagnostic screen show one request without JEV',async({page})=>{
 await mock(page,{preloaded:true,gemini:true});await login(page);
 await page.goto('/#/diagnostics');await expect(page.locator('#ai-dashboard')).toContainText('gemini-3.8-flash');await expect(page.locator('#ai-dashboard')).toContainText('Recognition requests');await expect(page.locator('#ai-dashboard')).not.toContainText('JEV classification');
 await page.screenshot({path:'.runtime/gemini-dashboard.png'});
});

test('background research pulses rows until completion and respects reduced motion',async({page})=>{
 const fake=await mock(page,{preloaded:true,progressive:true});await login(page);const row=page.locator('.supplement-row');await expect(row).toHaveClass(/is-researching/);await expect(row).toHaveAttribute('aria-busy','true');expect(await row.evaluate(n=>getComputedStyle(n).animationName)).toBe('supplement-research-pulse');await expect(page.locator('#route-dialog')).not.toBeVisible();await page.screenshot({path:'.runtime/auto-research-home.png'});
 await page.emulateMedia({reducedMotion:'reduce'});expect(await row.evaluate(n=>getComputedStyle(n).animationName)).toBe('none');fake.releaseResearch();await page.reload();await expect(page.locator('.supplement-row')).not.toHaveClass(/is-researching/);await expect(page.locator('.supplement-row')).toHaveAttribute('aria-busy','false');
});
test('group editor saves Bootstrap icon and SVG while refusing active markup',async({page})=>{
 await mock(page,{preloaded:true});await login(page);await page.locator('.group-edit').click();await page.locator('#group-form [name=icon]').fill('<i class="bi bi-0-circle"></i>');await page.locator('#group-form button[type=submit]').click();await expect(page.locator('#group-dialog')).not.toBeVisible();await expect(page.locator('.group-symbol .bi-0-circle')).toBeVisible();await page.screenshot({path:'.runtime/custom-group-icon.png'});
 const result=await page.evaluate(async()=>{const {parseCustomIcon}=await import('./custom-icon.js');const svg=parseCustomIcon('<svg xmlns="http://www.w3.org/2000/svg" class="bi bi-circle" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="currentColor"/></svg>');let rejected=0;for(const code of ['<svg onload="alert(1)"></svg>','<svg><script>alert(1)</script></svg>','<svg><image href="https://example.com/pixel"/></svg>','<svg><path fill="url(https://example.com/pixel)"/></svg>','<i class="bi bi-0-circle" onclick="alert(1)"></i>'])try{parseCustomIcon(code);}catch{rejected++;}return {tag:svg.localName,circles:svg.querySelectorAll('circle').length,rejected};});expect(result).toEqual({tag:'svg',circles:1,rejected:5});
});

test('original app icons can be picked, saved and restored to automatic without code',async({page})=>{
 await mock(page,{preloaded:true});await login(page);await page.locator('.group-edit').click();
 await expect(page.locator('#group-icon-options button span')).toHaveText(['Automatic','Morning','Meal','Evening','Training','Sleep','Supplement','Shield']);
 for(const name of ['Training','Sleep']){
  const selected=page.locator('#group-icon-options button').filter({hasText:name});await selected.click();const svg=await page.locator('#group-form [name=icon]').inputValue();await expect(selected).toHaveAttribute('aria-pressed','true');
  await page.locator('#group-form button[type=submit]').click();await expect(page.locator('#group-dialog')).toBeHidden();await expect(page.locator('.group-symbol svg')).toBeVisible();
  await page.locator('.group-edit').click();await expect(page.locator('#group-form [name=icon]')).toHaveValue(svg);await expect(page.locator('#group-icon-options button').filter({hasText:name})).toHaveAttribute('aria-pressed','true');
 }
 const moon=page.locator('#group-icon-options button').filter({hasText:'Evening'});await moon.click();await expect(moon).toHaveAttribute('aria-pressed','true');await expect(page.locator('#group-form [name=icon]')).toHaveValue(/M20 15A9/);await expect(page.locator('#group-icon-preview svg')).toHaveCount(1);
 await page.screenshot({path:'.runtime/app-icon-picker.png'});await page.locator('#group-form button[type=submit]').click();await expect(page.locator('#group-dialog')).not.toBeVisible();await expect(page.locator('.group-symbol svg path')).toHaveAttribute('d',/M20 15A9/);
 await page.locator('.group-edit').click();await expect(page.locator('#group-icon-options button').filter({hasText:'Evening'})).toHaveAttribute('aria-pressed','true');await page.locator('#group-icon-options button').filter({hasText:'Automatic'}).click();await expect(page.locator('#group-form [name=icon]')).toHaveValue('');await page.locator('#group-form button[type=submit]').click();await expect(page.locator('#group-dialog')).not.toBeVisible();await expect(page.locator('.group-symbol svg path')).toHaveAttribute('d',/^M5 3v7/);
});

test('details show only severe conflicts and a suggested existing group without automatic moves',async({page})=>{
 await mock(page,{preloaded:true,compatibilityMode:'severe'});await login(page);await expect(page.locator('.review-combination')).toHaveCount(0);await page.locator('.supplement-open').click();const section=page.locator('[data-detail-section=compatibility]');await expect(section).toContainText('Conflicting product');await expect(section).toContainText('Suggested group: Evening');await expect(section.locator('.interaction-alert')).toHaveCount(1);await expect(section).not.toContainText('should be hidden');await section.scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/severe-conflict-detail.png'});
});
test('details omit the compatibility section when no severe alert exists',async({page})=>{
 await mock(page,{preloaded:true,compatibilityMode:'benign'});await login(page);await page.locator('.supplement-open').click();await expect(page.locator('[data-detail-section=compatibility]')).toHaveCount(0);await expect(page.locator('#supplement-detail')).not.toContainText('should be hidden');
});

test('diagnostics distinguishes a completed partial batch and full workflow duration',async({page})=>{
 await mock(page,{preloaded:true,gemini:true,partialDiagnostics:true});await login(page);await page.goto('/#/diagnostics');const panel=page.locator('#ai-dashboard');await expect(panel).toContainText('Completed with issues');await expect(panel).not.toContainText('REQUEST_FAILED');await expect(panel).toContainText('193.07 s');await expect(panel).toContainText('1 / 1 / 2');
});

test('restrictions stay collapsed while refresh and deletion remain outside the disclosure',async({page})=>{
 await mock(page,{preloaded:true,compatibilityMode:'benign',labelProduct:true});await login(page);await page.locator('.supplement-open').click();
 const restrictions=page.locator('[data-detail-section=restrictions]'),more=page.locator('.detail-more'),action=page.locator('.detail-research-button');
 await expect(page.locator('#detail-primary section')).toHaveCount(3);await expect(restrictions).toBeHidden();await expect(more.locator('[data-detail-section=restrictions]')).toHaveCount(1);
 await expect(action).toHaveText('Refresh information');await expect(action).toBeVisible();await expect(page.locator('.detail-actions .danger-link')).toBeVisible();await more.locator('summary').click();await expect(action).toBeVisible();await expect(action).toBeEnabled();
 expect(await action.evaluate(n=>n.parentElement.classList.contains('detail-actions'))).toBe(true);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const width of [320,402]){
   await page.setViewportSize({width,height:874});await action.scrollIntoViewIfNeeded();
   const sizes=await action.evaluate(n=>({button:n.getBoundingClientRect().width,container:n.parentElement.getBoundingClientRect().width,gap:n.parentElement.getBoundingClientRect().top-n.parentElement.previousElementSibling.getBoundingClientRect().bottom,overflow:n.closest('dialog').scrollWidth>n.closest('dialog').clientWidth}));
   expect(Math.abs(sizes.button-sizes.container)).toBeLessThan(1);expect(sizes.gap).toBeGreaterThanOrEqual(12);expect(sizes.overflow).toBe(false);
   await page.screenshot({path:`.runtime/detail-actions-${theme}-${width}.png`,animations:'disabled'});
  }
 }
 await expect(restrictions).toBeVisible();await expect(restrictions).toContainText('Confirm suitability.');await action.scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/detail-actions-expanded.png',animations:'disabled'});
 await more.locator('summary').click();await expect(restrictions).toBeHidden();await expect(action).toBeVisible();
});

test('login and registration password eyes preserve values and caret, remask on tab change and localize',async({page})=>{
 const fake=await mock(page);await page.goto('/');const loginForm=page.locator('#login-form'),password=loginForm.locator('[name=password]'),eye=loginForm.locator('.password-toggle');
 await expect(password).toHaveAttribute('type','password');await expect(eye).toHaveAttribute('aria-label','Show password');await expect(eye.locator('svg')).toHaveCSS('opacity','0.8');
 await password.fill('Private testing phrase');await password.evaluate(n=>n.setSelectionRange(4,9));await eye.click();await expect(password).toHaveAttribute('type','text');await expect(password).toHaveValue('Private testing phrase');await expect(eye).toHaveAttribute('aria-label','Hide password');await expect(eye).toHaveAttribute('aria-pressed','true');expect(await password.evaluate(n=>[n.selectionStart,n.selectionEnd])).toEqual([4,9]);
 await eye.click();await expect(password).toHaveAttribute('type','password');await expect(password).toHaveAttribute('autocomplete','current-password');
 await eye.click();await page.locator('[data-auth-mode=register][aria-pressed]').click();await expect(password).toHaveAttribute('type','password');const register=page.locator('#register-form');await expect(register.locator('.password-toggle')).toHaveCount(2);
 for(const field of ['password','confirmation']){await register.locator('[name='+field+']').fill('New testing password phrase');const control=register.locator('[name='+field+']').locator('..').locator('button');await control.click();await expect(register.locator('[name='+field+']')).toHaveAttribute('type','text');}
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.screenshot({path:'.runtime/password-register-'+theme+'.png',animations:'disabled'});}
 await register.evaluate(n=>n.reset());await expect(register.locator('input[type=password]')).toHaveCount(2);await page.locator('[data-auth-mode=login][aria-pressed]').click();await expect(eye).toHaveAttribute('aria-pressed','false');
 expect(fake.requests.filter(r=>r.method==='POST')).toHaveLength(0);
 await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#logout-button').click();await expect(eye).toHaveAttribute('aria-label','Rodyti slaptažodį');await password.fill('Local test only');await eye.click();await expect(eye).toHaveAttribute('aria-label','Slėpti slaptažodį');
 await page.screenshot({path:'.runtime/password-login-lt-dark.png',animations:'disabled'});
});

test('floating reference navigation has three tabs, stays at the bottom and leaves Home uncluttered',async({page})=>{
 await mock(page,{preloaded:true});await login(page);const nav=page.locator('#app-nav');
 await expect(page.locator('main nav,#home-report,#home-analysis-results,.brand .account-link')).toHaveCount(0);await expect(nav.locator('a')).toHaveText(['Home','Groups','Account']);await expect(nav.locator('[aria-current=page]')).toHaveAttribute('data-route','/');
 for(const width of [320,402,768]){
  await page.setViewportSize({width,height:874});await expect(nav).toBeVisible();const before=await nav.boundingBox();await page.locator('main').evaluate(n=>n.scrollTop=n.scrollHeight);const after=await nav.boundingBox();expect(after.y).toBe(before.y);expect(Math.round(after.y+after.height)).toBe(862);expect(after.x).toBeGreaterThanOrEqual(0);expect(after.x+after.width).toBeLessThanOrEqual(width);
  const measure=()=>nav.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),a=n.querySelector('a'),t=getComputedStyle(a),i=getComputedStyle(a.querySelector('.icon'));return {x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,radius:s.borderRadius,background:s.background,shadow:s.boxShadow,font:t.fontSize,gap:t.gap,itemPadding:t.padding,iconWidth:i.width,iconHeight:i.height};});
  const home=await measure();for(const route of ['/groups','/account','/']){await nav.locator('[data-route="'+route+'"]').click();await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-route',route);expect(await measure()).toEqual(home);}
 }
 await page.setViewportSize({width:402,height:874});await page.locator('main').evaluate(n=>n.scrollTop=0);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:34,right:0}});
 const iphone=await nav.boundingBox();expect(Math.round(874-iphone.y-iphone.height)).toBe(20);
 await page.screenshot({path:'.runtime/navigation-lowered-iphone.png',animations:'disabled'});
 await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:0}});
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);for(const route of ['/','/groups','/account']){await nav.locator('[data-route="'+route+'"]').click();await page.screenshot({path:'.runtime/unified-nav-'+(route.slice(1)||'home')+'-'+theme+'.png',animations:'disabled'});}}
 await nav.locator('[data-route="/groups"]').click();await expect(page.locator('[data-screen="/groups"]')).toBeVisible();await expect(nav.locator('[aria-current=page]')).toHaveAttribute('data-route','/groups');
 await nav.locator('[data-route="/account"]').click();await expect(page.locator('#account-screen')).toBeVisible();await expect(page.locator('#route-dialog')).toBeHidden();await expect(nav).toBeVisible();await expect(nav.locator('[aria-current=page]')).toHaveAttribute('data-route','/account');await nav.locator('[data-route="/groups"]').click();await expect(nav.locator('[aria-current=page]')).toHaveAttribute('data-route','/groups');
 await nav.locator('[data-route="/"]').click();await expect(page.locator('[data-screen="/"]')).toBeVisible();await page.evaluate(()=>document.documentElement.dataset.keyboard='true');await expect(nav).toBeHidden();await page.evaluate(()=>delete document.documentElement.dataset.keyboard);await expect(nav).toBeVisible();
});

test('English preference automatically translates historical AI text and avoids mixed-language display',async({page})=>{
 const m=await mock(page,{preloaded:true,localization:true});const request=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/supplements/localize'));await login(page);expect((await request).postDataJSON().language).toBe('en');await expect(page.locator('.supplement-open .summary')).not.toContainText('Imunitetas');await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).not.toContainText('Lietuviška nauda');await expect(page.locator('[data-detail-section=dose]')).toContainText('1 capsule daily.');await expect(page.locator('[data-detail-section=benefits]')).toContainText('Potential benefit.');expect(m.requests.filter(r=>r.path==='/v1/supplements/localize')).toHaveLength(1);
});

test('photo picker cancellation keeps the sheet and draft without an upload',async({page})=>{
 const m=await mock(page);await login(page);await page.locator('#add-supplement').click();
 const input=page.locator('#analyze-form input[type=file]');
 await page.locator('#analyze-form [name=name]').fill('Keep this draft');
 await expect(page.locator('#progress-ring')).toHaveAttribute('aria-busy','false');const dashboards=m.requests.filter(r=>r.path==='/v1/dashboard').length;
 await page.evaluate(()=>{window.homeMutations=0;new MutationObserver(()=>window.homeMutations++).observe(document.querySelector('#routine-groups'),{childList:true,subtree:true});});
 const chooser=page.waitForEvent('filechooser');await page.locator('.photo-picker').click();await chooser;
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await input.dispatchEvent('cancel',{bubbles:true});await input.setInputFiles([]);
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);
 expect(m.requests.filter(r=>r.path==='/v1/dashboard')).toHaveLength(dashboards);expect(await page.evaluate(()=>window.homeMutations)).toBe(0);
 await expect(page.locator('#analyze-form [name=name]')).toHaveAttribute('placeholder','Supplement name and manufacturer');await expect(page.locator('#add-dialog .ai-consent')).toHaveCount(0);await expect(page.locator('.upload-footer')).toHaveCSS('justify-content','center');await expect(page.locator('.upload-footer')).toHaveCSS('margin-top','4px');

 await expect(page.locator('#add-dialog')).toBeVisible();
 await expect(page.locator('#analyze-form [name=name]')).toHaveValue('Keep this draft');
 expect(m.requests.filter(r=>r.path==='/v1/supplements/jobs'&&r.method==='POST')).toHaveLength(0);
 await expect(page.locator('#upload-queue')).toBeHidden();
 await page.locator('#toggle-upload-queue').click();await expect(page.locator('#upload-queue')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#add-dialog')).toBeHidden();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(()=>m.requests.filter(r=>r.path==='/v1/dashboard').length).toBeGreaterThan(dashboards);
});
test('saved session launches through themed loader without ever opening login',async({page})=>{
 await mock(page,{preloaded:true});await login(page);
 await page.locator('.account-link').click();await page.locator('#settings-form [name=theme]').selectOption('dark');
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/v1/me',async route=>{await gate;await route.fulfill({json:{user,expiresAt:null}});});
 await page.addInitScript(()=>{window.loginFlashes=0;new MutationObserver(()=>{if(document.querySelector('#route-dialog')?.open&&document.querySelector('#login-form')?.getBoundingClientRect().height&&!document.querySelector('#startup-screen')?.checkVisibility())window.loginFlashes++;}).observe(document,{subtree:true,attributes:true,childList:true});});
 await page.reload();await expect(page.locator('#startup-screen')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('#route-dialog')).not.toHaveAttribute('open','');
 await page.screenshot({path:'.runtime/startup-dark.png'});release();
 await expect(page.locator('#startup-screen')).toBeHidden();await expect(page.locator('[data-screen="/"]')).toBeVisible();expect(await page.evaluate(()=>window.loginFlashes)).toBe(0);
});

test('a waiting app update activates during loading before login is displayed',async({page})=>{
 await mock(page);await page.addInitScript(()=>{
  const registration=new EventTarget();registration.update=async()=>{};
  registration.waiting={postMessage:message=>window.appliedStartupUpdate=message.type};
  const workers=new EventTarget();workers.controller={};workers.register=async()=>registration;
  Object.defineProperty(navigator,'serviceWorker',{value:workers});
 });
 await page.goto('/');await expect.poll(()=>page.evaluate(()=>window.appliedStartupUpdate)).toBe('ACTIVATE_UPDATE');
 await expect(page.locator('#startup-screen')).toBeVisible();await expect(page.locator('#route-dialog')).not.toHaveAttribute('open','');
});

test('revoked saved session reveals login only after validation',async({page})=>{
 await mock(page);await login(page);await page.route('**/v1/me',route=>route.fulfill({status:401,json:{error:'UNAUTHORIZED'}}));
 await page.reload();await expect(page.locator('#startup-screen')).toBeHidden();await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#app-nav')).toBeHidden();
});

test('Account is a main page with reachable navigation, editable profile and settings',async({page})=>{
 await mock(page,{preloaded:true});await login(page);await expect(page.locator('.daily-summary')).toHaveCSS('margin-bottom','18px');
 await page.locator('#app-nav [data-route="/account"]').click();await expect(page.locator('main #account-screen')).toBeVisible();await expect(page.locator('#route-dialog')).toBeHidden();await expect(page.locator('#profile-email')).toHaveText(user.email);
 for(const width of [320,402,1024]){
  await page.setViewportSize({width,height:874});await expect(page.locator('#app-nav')).toBeVisible();
  expect(await page.locator('#account-screen').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);
  await page.locator('main').evaluate(n=>n.scrollTop=n.scrollHeight);await expect(page.locator('#app-nav')).toBeVisible();
 }
 await page.setViewportSize({width:402,height:874});await page.locator('main').evaluate(n=>n.scrollTop=0);
 await page.locator('#edit-profile-name').click();await page.locator('#profile-form [name=name]').fill('Changed name');await page.locator('#app-nav [data-route="/groups"]').click();await page.locator('#app-nav [data-route="/account"]').click();await expect(page.locator('#profile-form [name=name]')).toHaveValue('Changed name');
 await page.locator('#diagnostics-link').click();await expect(page.locator('#route-dialog')).toBeVisible();await page.locator('#route-dialog [data-sheet-close]').click();await expect(page.locator('#account-screen')).toBeVisible();await expect(page.locator('#app-nav')).toBeVisible();
 await page.locator('#app-nav [data-route="/"]').click();await expect(page.locator('[data-screen="/"]')).toBeVisible();
});

test('logo-free Home has balanced summary spacing and ends above navigation; version belongs to Account',async({page})=>{
 await mock(page,{preloaded:true});await login(page);await expect(page.locator('.brand,.wordmark')).toHaveCount(0);await expect(page.locator('main>footer')).toHaveCount(0);await expect(page.locator('#app-version')).toBeHidden();
 const top=await page.locator('.daily-summary').boundingBox(),first=await page.locator('#routine-groups').boundingBox();expect(Math.round(top.y)).toBe(18);expect(Math.round(first.y-top.y-top.height)).toBe(18);
 await page.evaluate(()=>{const groups=document.querySelector('#routine-groups');for(let i=0;i<8;i++)groups.append(groups.firstElementChild.cloneNode(true));});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:54,left:0,bottom:34,right:0}});
 await page.locator('main').evaluate(n=>n.scrollTop=n.scrollHeight);const last=await page.locator('#recheck-home').boundingBox(),nav=await page.locator('#app-nav').boundingBox();expect(Math.round(nav.y-last.y-last.height)).toBe(16);
 await page.screenshot({path:'.runtime/home-footer-compact.png',animations:'disabled'});
 await page.locator('#app-nav [data-route="/account"]').click();await expect(page.locator('#account-screen #app-version')).toBeVisible();
});

test('failed basic information has no empty disclosure and always offers refresh and delete',async({page})=>{
 const m=await mock(page,{preloaded:true,basic:true,detailFailed:true});await login(page);await page.locator('.supplement-open').click();await expect(page.locator('.detail-more')).toHaveCount(0);await expect(page.locator('.doctor-note')).toHaveCount(0);await expect(page.locator('.detail-research-button')).toBeVisible();await expect(page.locator('.detail-actions .danger-link')).toHaveText('Delete supplement');await expect(page.locator('.detail-actions .danger-link')).toBeVisible();await expect(page.locator('.detail-group-controls select')).toBeVisible();await expect(page.locator('#supplement-detail')).toContainText('Details unavailable');await page.locator('.detail-research-button').click();expect(m.requests.filter(r=>r.path.endsWith('/research'))).toHaveLength(1);await expect(page.locator('.detail-research-button')).toBeDisabled();
});

test('selected Groups B offers counts, working quick templates and group menus without removed controls',async({page})=>{
 await mock(page,{preloaded:true});await login(page);await page.locator('#app-nav [data-route="/groups"]').click();await expect(page.locator('.groups-page-heading h1')).toHaveText('Groups');await expect(page.locator('#group-count')).toHaveText('1');await expect(page.locator('#group-supplement-count')).toHaveText('1');await expect(page.locator('.groups-page')).not.toContainText('Daily order');await expect(page.getByRole('button',{name:'Reorder',exact:true})).toHaveCount(0);
 await page.locator('#quick-training').click();await expect(page.locator('#group-form [name=name]')).toHaveValue('Training');await expect(page.locator('#group-form [name=icon]')).toHaveValue(/svg/);await page.locator('#group-dialog [data-sheet-close]').click();
 await page.locator('#quick-sleep').click();await expect(page.locator('#group-form [name=name]')).toHaveValue('Sleep');await page.locator('#group-dialog [data-sheet-close]').click();await page.locator('.group-menu summary').click();await page.locator('.group-menu-actions').getByRole('button',{name:'Edit',exact:true}).click();await expect(page.locator('#group-form [name=name]')).toHaveValue('With a meal');
});
test('Account A applies preferences immediately, preserves them after reload and edits profile inline',async({page})=>{
 await mock(page);await login(page);await page.locator('#app-nav [data-route="/account"]').click();await expect(page.locator('#account-display-name')).toHaveText('Test');await expect(page.locator('#account-initials')).toHaveText('T');await expect(page.locator('#settings-form button')).toHaveCount(0);await expect(page.locator('#profile-form')).toBeHidden();
 await expect(page.locator('#ai-settings')).toHaveCount(0);await expect(page.locator('#account-tools #connection-editor')).toHaveCount(1);const sizing=await page.evaluate(()=>[...document.querySelectorAll('#settings-form select')].map(n=>({font:getComputedStyle(n).fontSize,rowFont:getComputedStyle(n.closest('label')).fontSize,height:n.closest('label').getBoundingClientRect().height})));for(const value of sizing){expect(value.font).toBe(value.rowFont);expect(value.height).toBe(64);}await expect(page.locator('#preferences')).toHaveCSS('padding-bottom','0px');
 await page.locator('#settings-form [name=theme]').selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#settings-form [name=language]').selectOption('lt');await expect(page.locator('html')).toHaveAttribute('lang','lt');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('html')).toHaveAttribute('lang','lt');await page.locator('#app-nav [data-route="/account"]').click();await expect(page.locator('#settings-form [name=language]')).toHaveValue('lt');await page.locator('#edit-profile-name').click();await expect(page.locator('#profile-form')).toBeVisible();await page.locator('#connection-editor>summary').click();await expect(page.locator('#ai-form')).toBeVisible();await page.locator('#ai-form [name=key]').fill('');await expect(page.locator('#ai-form [name=key]')).toBeFocused();
});

test('selected reference layouts render comparable light previews',async({page})=>{
 await mock(page,{preloaded:true,design:true});await login(page);await page.setViewportSize({width:862,height:1825});await page.locator('#app-nav [data-route="/groups"]').click();await page.screenshot({path:'.runtime/selected-groups-B.png',animations:'disabled'});
 await page.setViewportSize({width:821,height:1916});await page.locator('#app-nav [data-route="/account"]').click();await page.screenshot({path:'.runtime/selected-account-A.png',animations:'disabled'});
 const typography=await page.evaluate(()=>{const group=getComputedStyle(document.querySelector('.groups-page-heading h1')),account=getComputedStyle(document.querySelector('.account-page-heading'));return {group:[group.fontFamily,group.fontSize,group.fontWeight],account:[account.fontFamily,account.fontSize,account.fontWeight],families:[...new Set([...document.querySelectorAll('h1,h2,h3,p,button,input,select,textarea,summary,strong')].map(n=>getComputedStyle(n).fontFamily))]};});expect(typography.account).toEqual(typography.group);expect(typography.families).toEqual([typography.group[0]]);
 for(const width of [320,402]){await page.setViewportSize({width,height:874});for(const path of ['/groups','/account']){await page.locator('#app-nav [data-route="'+path+'"]').click();expect(await page.locator('main').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.screenshot({path:'.runtime/selected-'+path.slice(1)+'-'+width+'.png',animations:'disabled'});}}
});

test('detail has connected information, equal spacing and equal confirmation actions',async({page})=>{
 const m=await mock(page,{preloaded:true,compatibilityMode:'benign'});await login(page);await page.locator('.supplement-open').click();await expect(page.locator('.detail-group-controls h3')).toHaveCount(0);const more=page.locator('.detail-more');await more.locator('summary').click();await expect(more.locator('.detail-extra-content')).toBeVisible();expect(await more.evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');await expect(page.locator('.detail-group-controls')).toHaveCSS('margin-top','12px');await expect(page.locator('.detail-actions')).toHaveCSS('gap','12px');
 await page.locator('.detail-actions .danger-link').click();const confirmation=page.locator('dialog[open][aria-labelledby^="dialog-"]'),buttons=confirmation.locator(':scope>button');await expect.poll(()=>confirmation.evaluate(n=>n.getAnimations().length)).toBe(0);const cancel=await buttons.nth(0).boundingBox(),confirm=await buttons.nth(1).boundingBox();expect(Math.abs(cancel.width-confirm.width)).toBeLessThan(1);expect(Math.abs(cancel.y-confirm.y)).toBeLessThan(1);expect(confirm.x-cancel.x-cancel.width).toBeGreaterThanOrEqual(11);await page.screenshot({path:'.runtime/confirmation-equal-buttons.png',animations:'disabled'});await buttons.nth(0).click();expect(m.requests.some(r=>r.method==='DELETE'&&r.path.includes('/supplements/'))).toBe(false);await more.scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/connected-information-block.png',animations:'disabled'});
});

test('group order saves from keyboard and pointer grip without a Reorder button',async({page})=>{
 await mock(page,{preloaded:true,design:true});await login(page);await page.locator('#app-nav [data-route="/groups"]').click();const first=page.locator('.managed-group').first();const id=await first.getAttribute('data-group-id');await first.locator('.group-grip').focus();let request=page.waitForRequest(r=>r.url().endsWith('/groups/order')&&r.method()==='PUT');await page.keyboard.press('ArrowDown');expect((await request).postDataJSON().ids[1]).toBe(id);await expect(page.locator('.managed-group').nth(1)).toHaveAttribute('data-group-id',id);
 await expect(page.locator('.managed-group').first().locator('.group-grip')).toBeEnabled();const grip=await page.locator('.managed-group').first().locator('.group-grip').boundingBox(),target=await page.locator('.managed-group').nth(1).boundingBox();request=page.waitForRequest(r=>r.url().endsWith('/groups/order')&&r.method()==='PUT');await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(target.x+grip.width,target.y+target.height-2,{steps:6});await page.mouse.up();await request;await expect(page.locator('.managed-group').first()).toHaveAttribute('data-group-id',id);
});


test('upload results are compact full-width status buttons and show actual group moves below',async({page})=>{
 await mock(page,{compactReport:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Three products');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-results .upload-product-button')).toHaveCount(3);await page.locator('#toggle-upload-queue').click();const buttons=page.locator('#analysis-results .upload-product-button');await expect(buttons.nth(0)).toHaveText('Ready product');await expect(buttons.nth(0)).toHaveAttribute('data-state','complete');await expect(buttons.nth(1)).toHaveAttribute('data-state','failed');await expect(buttons.nth(2)).toHaveAttribute('data-state','pending');await expect(page.locator('.upload-product-list .research-badge,.upload-product-list li')).toHaveCount(0);await expect(page.locator('.upload-group-changes')).toContainText('With a meal → With fats');
 const metrics=await buttons.evaluateAll(ns=>ns.map(n=>({width:n.getBoundingClientRect().width,parent:n.parentElement.getBoundingClientRect().width,height:n.getBoundingClientRect().height,bg:getComputedStyle(n).backgroundColor})));for(const m of metrics){expect(Math.abs(m.width-m.parent)).toBeLessThan(1);expect(m.height).toBeLessThanOrEqual(44);}expect(new Set(metrics.map(m=>m.bg)).size).toBe(3);
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await buttons.nth(0).scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/compact-upload-results-'+theme+'.png',animations:'disabled'});}
 await buttons.nth(0).click();await expect(page.locator('#route-header h1')).toHaveText('Ready product');
});


test('composer layout, SVG add discs and deletion checkbox stay compact at phone and desktop sizes',async({page})=>{
 await mock(page);await login(page);
 for(const width of [320,402,862]){await page.setViewportSize({width,height:1000});await page.locator('#app-nav [data-route="/"]').click();await expect(page.locator('.group-empty')).toHaveCSS('text-align','left');const disc=page.locator('#home-empty svg');await expect(disc.locator('circle')).toHaveCount(1);const b=await disc.boundingBox();expect(Math.abs(b.width-b.height)).toBeLessThan(1);await page.screenshot({path:'.runtime/refined-empty-home-'+width+'.png',animations:'disabled'});await page.locator('#app-nav [data-route="/groups"]').click();const add=page.locator('#new-group');await expect(add.locator('svg circle')).toHaveCount(1);const size=await add.boundingBox();expect(Math.abs(size.width-size.height)).toBeLessThan(1);await page.screenshot({path:'.runtime/refined-groups-'+width+'.png',animations:'disabled'});}
 await page.setViewportSize({width:402,height:874});await page.locator('#app-nav [data-route="/"]').click();await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form [name=name]')).toHaveAttribute('placeholder','Supplement name and manufacturer');await page.screenshot({path:'.runtime/refined-composer-light.png',animations:'disabled'});await page.locator('#close-add').click();await page.locator('#app-nav [data-route="/account"]').click();const deletion=page.locator('#delete-account-form').locator('..');await deletion.locator('summary').click();const checkbox=page.locator('[name=confirmDelete]');const box=await checkbox.boundingBox();expect(box.width).toBe(20);expect(box.height).toBe(20);await page.locator('.delete-confirm').click();await expect(checkbox).toBeChecked();await page.locator('.delete-confirm').click();await expect(checkbox).not.toBeChecked();await page.locator('.delete-confirm').scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/refined-delete-confirm.png',animations:'disabled'});expect(await page.locator('#account-screen').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);
 await deletion.locator('summary').click();await page.locator('#diagnostics-link').click();await expect(page.locator('#ai-dashboard .diagnostic-ai-info')).toContainText('Gemini 3.8 Flash');await page.locator('.diagnostic-ai-info>summary').click();await expect(page.locator('.diagnostic-ai-info')).toHaveAttribute('open','');await page.waitForTimeout(1100);await expect(page.locator('.diagnostic-ai-info')).toHaveAttribute('open','');await page.screenshot({path:'.runtime/refined-ai-diagnostics.png',animations:'disabled'});await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('#app-nav [data-route="/groups"]').click();await page.locator('#new-group').click();await expect(page.locator('#group-form [name=description]')).toHaveCSS('height','46px');await expect(page.locator('#group-form [name=icon]')).toHaveCSS('height','46px');await page.screenshot({path:'.runtime/refined-group-editor.png',animations:'disabled'});
});


test('recheck sheet resumes after reload and accepts or removes persisted suggestions individually',async({page})=>{
 const m=await mock(page,{preloaded:true,routine:true});await login(page);await page.locator('#recheck-all').scrollIntoViewIfNeeded();await page.locator('#recheck-all').click();await expect(page.locator('#recheck-dialog')).toBeVisible();await expect(page.locator('.recheck-progress')).toContainText('3 supplements');await expect(page.locator('.recheck-progress [role="progressbar"]')).not.toHaveAttribute('aria-valuenow');
 const sweep=page.locator('.recheck-progress-track>span');await expect(sweep).toHaveCSS('animation-direction','alternate');await expect(sweep).toHaveCSS('animation-timing-function','ease-in-out');await sweep.evaluate(el=>window.recheckAnimation=el.getAnimations()[0]);await page.waitForTimeout(1500);expect(await sweep.evaluate(el=>el.getAnimations()[0]===window.recheckAnimation)).toBe(true);await page.emulateMedia({reducedMotion:'reduce'});await expect(sweep).toHaveCSS('animation-name','none');await page.emulateMedia({reducedMotion:'no-preference'});expect(m.requests.filter(r=>r.path==='/v1/rechecks'&&r.method==='POST')).toHaveLength(1);await page.screenshot({path:'.runtime/recheck-progress.png',animations:'disabled'});
 await page.locator('#recheck-dialog [data-sheet-close]').click();await page.locator('#recheck-all').click();expect(m.requests.filter(r=>r.path==='/v1/rechecks'&&r.method==='POST')).toHaveLength(1);await page.reload();await expect(page.locator('#recheck-all')).toHaveText('Checking groups…');await page.locator('#recheck-all').click();await expect(page.locator('.recheck-progress')).toBeVisible();m.releaseRecheck();await expect(page.locator('.recheck-proposal')).toHaveCount(2);await expect(page.locator('.recheck-proposals')).not.toContainText('Unchanged supplement');await page.reload();await expect(page.locator('#recheck-pending')).toContainText('(2)');await page.locator('#recheck-pending').click();await expect(page.locator('.recheck-proposal')).toHaveCount(2);expect(m.requests.filter(r=>r.path==='/v1/rechecks'&&r.method==='POST')).toHaveLength(1);
 const first=page.locator('.recheck-proposal').first();await expect(first.locator('h3')).toHaveText('Example supplement');await expect(first.locator('.recheck-manufacturer')).toHaveText('Example');await expect(first.locator('.recheck-move')).toHaveText('With a meal → With fats');await page.setViewportSize({width:320,height:874});expect(await page.locator('#recheck-dialog').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.screenshot({path:'.runtime/recheck-suggestions-320.png',animations:'disabled'});await page.setViewportSize({width:402,height:874});await page.screenshot({path:'.runtime/recheck-suggestions-light.png',animations:'disabled'});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:'.runtime/recheck-suggestions-dark.png',animations:'disabled'});await page.evaluate(()=>document.documentElement.dataset.theme='light');await first.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.locator('.recheck-proposal')).toHaveCount(1);await expect(page.locator('#recheck-pending')).toContainText('(1)');await page.locator('.recheck-proposal').getByRole('button',{name:'Remove',exact:true}).click();await expect(page.locator('.recheck-proposal')).toHaveCount(0);await expect(page.locator('#recheck-pending')).toBeHidden();await expect(page.locator('#recheck-content')).toContainText('All suggestions have been reviewed.');expect(m.requests.filter(r=>r.method==='DELETE'&&r.path.includes('/supplements'))).toHaveLength(0);await page.locator('#recheck-dialog [data-sheet-close]').click();await expect(page.locator('.supplement-row')).toHaveCount(3);await expect(page.locator('.group-block').filter({has:page.getByRole('heading',{name:'With fats',exact:true})})).toContainText('supplement');
});


test('Taken ring reports completion writes and routine reads without shifting Home, and settles on failure',async({page})=>{
 await mock(page,{preloaded:true});await login(page);
 const ring=page.locator('#progress-ring'),arc=page.locator('.routine-loading-arc');
 await expect(ring).toHaveAttribute('aria-busy','false');await expect(page.locator('#home-status')).toHaveCount(0);
 const top=await page.locator('#routine-groups').evaluate(el=>el.getBoundingClientRect().top);
 let releaseWrite,releaseRead;const writeGate=new Promise(resolve=>releaseWrite=resolve),readGate=new Promise(resolve=>releaseRead=resolve);
 await page.route('**/v1/supplements/*/completion',async route=>{await writeGate;await route.fallback();});
 await page.route('**/v1/dashboard?**',async route=>{await readGate;await route.fallback();});
 await page.locator('.check-button').click();await expect(ring).toHaveAttribute('aria-busy','true');
 await expect(arc).toHaveCSS('animation-name','routine-ring-spin');await expect(page.locator('#progress-count')).toHaveText('0 / 1');
 expect(await page.locator('#routine-groups').evaluate(el=>el.getBoundingClientRect().top)).toBe(top);
 await page.screenshot({path:'.runtime/taken-loading-light.png'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:'.runtime/taken-loading-dark.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await expect(arc).toHaveCSS('animation-name','none');
 releaseWrite();await page.waitForTimeout(150);await expect(ring).toHaveAttribute('aria-busy','true');
 releaseRead();await expect(page.locator('#progress-count')).toHaveText('1 / 1');await expect(ring).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#progress-arc')).toHaveAttribute('stroke-dasharray','100 100');
 expect(await page.locator('#routine-groups').evaluate(el=>el.getBoundingClientRect().top)).toBe(top);
 await page.route('**/v1/supplements/*/completion',route=>route.fulfill({status:500,json:{error:'REQUEST_FAILED'}}));
 await page.locator('.check-button').click();await expect(ring).toHaveAttribute('aria-busy','false');await expect(page.locator('#progress-count')).toHaveText('1 / 1');await expect(page.locator('.check-button')).toBeEnabled();
});

for(const preloaded of [false,true])test('Home update is one spaced button and Recheck only appears with products: '+preloaded,async({page})=>{
 await mock(page,{preloaded});await page.addInitScript(()=>{
  const registration=new EventTarget();registration.update=async()=>{};
  const workers=new EventTarget();workers.controller={};workers.register=async()=>registration;
  Object.defineProperty(navigator,'serviceWorker',{value:workers});
  window.announceTestUpdate=()=>{registration.waiting={postMessage:m=>window.testUpdateApplied=m.type};registration.installing=new EventTarget();registration.dispatchEvent(new Event('updatefound'));registration.installing.dispatchEvent(new Event('statechange'));};
 });
 await login(page);await expect(page.locator('#update-button')).toBeHidden();
 if(preloaded)await expect(page.locator('#recheck-home')).toBeVisible();else await expect(page.locator('#recheck-home')).toBeHidden();
 await page.evaluate(()=>window.announceTestUpdate());const update=page.locator('#update-button');await expect(update).toBeVisible();await expect(update).toHaveText('Update Application');await expect(page.locator('#update-card')).toHaveCount(0);expect(await update.evaluate(el=>el.parentElement.tagName)).toBe('MAIN');
 await page.locator('main').evaluate(n=>n.scrollTop=n.scrollHeight);
 if(preloaded){const recheck=await page.locator('#recheck-home').boundingBox(),b=await update.boundingBox();expect(Math.round(b.y-recheck.y-recheck.height)).toBe(26);}
 await page.screenshot({path:'.runtime/home-update-'+(preloaded?'products':'empty')+'.png'});
 await update.click();await expect.poll(()=>page.evaluate(()=>window.testUpdateApplied)).toBe('ACTIVATE_UPDATE');
});

const dailyRoutine={version:1,meals:{breakfast:{status:'yes',timing:{mode:'exact',start:'08:00',end:null}},lunch:{status:'yes',timing:{mode:'approximate',start:'12:00',end:'14:00'}},dinner:{status:'yes',timing:{mode:'approximate',start:'18:00',end:'20:00'}}},exercise:{status:'yes',frequency:'2-3',timing:{mode:'approximate',start:'17:00',end:'21:00'}},sleep:{timing:{mode:'exact',start:'23:00',end:null}},days:'similar',strategy:'rhythm',restEvening:true};
test('Routine B collects choices, saves only preferences, survives reload, and safely cancels edits',async({page})=>{
 const m=await mock(page,{preloaded:true});await login(page);await page.locator('.account-link').click();await page.locator('#open-routine-wizard').click();const wizard=page.locator('#routine-wizard-dialog'),editor=page.locator('#routine-time-dialog');await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.getByRole('button',{name:'Continue',exact:true}).click();await expect(wizard.locator('[data-routine-error]')).not.toBeEmpty();
 async function edit(key,run){await wizard.locator('[data-routine-event="'+key+'"]').click();await expect(editor).toBeVisible();await run();await editor.getByRole('button',{name:'Save',exact:true}).click();await expect(editor).toBeHidden();}
 await edit('breakfast',async()=>{await editor.locator('.routine-presence [data-value="no"]').click();await expect(editor.locator('select')).toHaveCount(0);});
 await expect(wizard.locator('[data-routine-event="breakfast"]')).toContainText('Skipped');
 await edit('lunch',()=>editor.locator('[data-range="day"]').click());
 await edit('dinner',()=>editor.getByLabel('Exact time',{exact:true}).selectOption('18:30'));
 await edit('exercise',async()=>{await editor.getByLabel('How often do you exercise?').selectOption('2-3');await editor.locator('[data-range="evening"]').click();});
 await edit('sleep',()=>editor.locator('[data-range="later"]').click());
 await wizard.locator('.routine-days [data-value="varies"]').click();await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.locator('[data-strategy="fewer"]').click();await wizard.getByRole('switch').click();await wizard.getByRole('button',{name:'Edit',exact:true}).click();await expect(wizard.locator('[data-routine-event="sleep"]')).toContainText('23:00–01:00');await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.getByRole('button',{name:'Continue',exact:true}).click();
 await wizard.getByRole('button',{name:'Save routine',exact:true}).click();await expect(wizard).toBeHidden();expect(m.requests.filter(r=>r.path==='/v1/settings/routine'&&r.method==='PUT')).toHaveLength(1);expect(m.requests.filter(r=>r.method==='POST'&&/rechecks|supplements/.test(r.path))).toHaveLength(0);
 expect(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('restEvening')))).toBe(false);
 await page.reload();await page.locator('.account-link').click();await page.locator('#open-routine-wizard').click();await expect(wizard.locator('[data-routine-event="dinner"]')).toContainText('18:30');await expect(wizard.locator('[data-routine-event="breakfast"]')).toContainText('Skipped');await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.getByRole('button',{name:'Continue',exact:true}).click();await expect(wizard.locator('[data-strategy="fewer"]')).toHaveAttribute('aria-pressed','true');await expect(wizard.getByRole('switch')).toHaveAttribute('aria-checked','false');
 await wizard.getByRole('button',{name:'Edit',exact:true}).click();await wizard.locator('[data-routine-event="dinner"]').click();await editor.getByLabel('Exact time',{exact:true}).selectOption('20:00');await editor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(wizard.locator('[data-routine-event="dinner"]')).toContainText('18:30');
 await wizard.locator('.routine-days [data-value="similar"]').click();await wizard.locator('.routine-toolbar .icon-button').last().click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(wizard).toBeVisible();await wizard.locator('.routine-toolbar .icon-button').last().click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(wizard).toBeHidden();
});
test('Routine B matches selected light design, works in dark/narrow layouts and retains draft on save errors',async({page})=>{
 const m=await mock(page,{preloaded:true,routineProfile:dailyRoutine});await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#open-routine-wizard').click();const wizard=page.locator('#routine-wizard-dialog'),editor=page.locator('#routine-time-dialog');await expect(wizard.locator('h2')).toHaveText('Dienos rutina');await expect(wizard.locator('.routine-wizard-actions')).toHaveCSS('position','static');await page.setViewportSize({width:402,height:640});await expect.poll(()=>wizard.evaluate(n=>n.scrollHeight-n.clientHeight)).toBeGreaterThan(80);const movement=await wizard.evaluate(n=>{n.scrollTop=0;const action=n.querySelector('.routine-wizard-actions'),before=action.getBoundingClientRect().top;n.scrollTop=80;return before-action.getBoundingClientRect().top;});expect(movement).toBeCloseTo(80,0);await page.setViewportSize({width:402,height:874});await wizard.evaluate(n=>n.scrollTop=0);await page.screenshot({animations:'disabled',path:'.runtime/routine-b-timeline-light.png'});
 await wizard.locator('[data-routine-event="breakfast"]').click();await editor.locator('.routine-time-mode [data-value="approximate"]').click();await editor.locator('[data-range="morning"]').click();await page.screenshot({animations:'disabled',path:'.runtime/routine-b-editor-light.png'});await editor.getByRole('button',{name:'Atšaukti',exact:true}).click();await wizard.getByRole('button',{name:'Toliau',exact:true}).click();await wizard.getByRole('button',{name:'Toliau',exact:true}).click();await expect(wizard.locator('.routine-wizard-actions')).toHaveCSS('position','static');await wizard.locator('.routine-wizard-actions button').scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:'.runtime/routine-b-preferences-light.png'});
 for(const width of [320,402,768]){await page.setViewportSize({width,height:874});expect(await wizard.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({animations:'disabled',path:'.runtime/routine-b-dark-'+width+'.png'});}
 await page.setViewportSize({width:402,height:874});await wizard.locator('[data-strategy="keep"]').click();m.failRoutineSave();await wizard.getByRole('button',{name:'Išsaugoti rutiną',exact:true}).click();await expect(wizard.locator('[data-routine-error]')).not.toBeEmpty();await expect(wizard.locator('[data-strategy="keep"]')).toHaveAttribute('aria-pressed','true');await wizard.getByRole('button',{name:'Išsaugoti rutiną',exact:true}).click();await expect(wizard).toBeHidden();
 await page.locator('#open-routine-wizard').click();await wizard.getByRole('button',{name:'Toliau',exact:true}).click();await wizard.getByRole('button',{name:'Toliau',exact:true}).click();m.changeRoutineElsewhere();await wizard.getByRole('button',{name:'Išsaugoti rutiną',exact:true}).click();await expect(wizard.locator('[data-routine-error]')).not.toBeEmpty();await expect(wizard).toBeVisible();
});

test('pause and resume retain inventory, preserve taken status and exclude paused products from daily progress',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));const fake=await mock(page,{preloaded:true});await login(page);
 await page.locator('.check-button').click();await expect(page.locator('#progress-count')).toHaveText('1 / 1');
 await page.locator('.supplement-open').click();await page.locator('.pause-supplement').click();await expect(page.locator('#pause-dialog')).toBeVisible();
 await page.locator('#pause-form [name=returnChoice]').selectOption('date');await expect(page.locator('#pause-date-label')).toBeVisible();const date=await page.locator('#pause-form [name=resumeOn]').inputValue();expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
 await page.screenshot({path:'.runtime/pause-date-light.png'});
 await page.locator('#pause-form [type=submit]').click();await expect(page.locator('#pause-dialog')).not.toBeVisible();await expect(page.locator('.pause-status')).toContainText('Returns');await expect(page.locator('.pause-supplement')).toHaveText('Resume');
 await page.locator('#route-dialog [data-sheet-close]').click();await expect(page.locator('#progress-count')).toHaveText('0 / 0');await expect(page.locator('.supplement-row')).toHaveCount(0);await expect(page.locator('#paused-supplements')).toContainText('Example');await expect(page.locator('#home-empty')).toBeHidden();await expect(page.locator('#recheck-home')).toBeHidden();
 await page.locator('#paused-supplements').scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/paused-home-light.png'});
 await page.locator('.paused-resume').click();await expect(page.locator('#progress-count')).toHaveText('1 / 1');await expect(page.locator('#paused-supplements')).toBeHidden();await expect(page.locator('.check-button')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#recheck-home')).toBeVisible();
 await page.locator('.supplement-open').click();await page.locator('.pause-supplement').click();await page.locator('#pause-dialog [data-sheet-close]').first().click();expect(fake.requests.filter(r=>r.path.endsWith('/pause'))).toHaveLength(2);expect(errors).toEqual([]);
});
test('Lithuanian pause form follows app typography, theme and logout cleanup',async({page})=>{
 await mock(page,{preloaded:true});await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#app-nav [data-route="/"]').click();await page.locator('.supplement-open').click();await page.locator('.pause-supplement').click();await expect(page.locator('#pause-title')).toHaveText('Pristabdyti papildą');await expect(page.locator('#pause-date-label')).toBeHidden();await page.screenshot({path:'.runtime/pause-dark-lt.png'});
 await page.locator('#pause-form [type=submit]').click();await expect(page.locator('.pause-status')).toHaveText('Pristabdyta iki grąžinimo');await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#paused-supplements')).toBeEmpty();await expect(page.locator('#pause-dialog')).not.toBeVisible();
});

// The calendar reads owned API history; fixtures never create production records.
test.describe('usage calendar B',()=>{
 test.use({timezoneId:'Europe/Vilnius'});
 async function history(page,{delay=false,fail=false}={}){
  let release;const gate=new Promise(r=>release=r),requests=[];let failNext=fail;
  await page.clock.setFixedTime(new Date('2026-10-16T09:00:00Z'));
  await mock(page,{preloaded:true});
  await page.route('https://perimove.com/supplement-api/v1/usage?*',async route=>{
   const q=new URL(route.request().url()).searchParams;requests.push(Object.fromEntries(q));if(delay&&requests.length===1)await gate;
   if(failNext){failNext=false;await route.fulfill({status:503,json:{error:'REQUEST_FAILED'}});return;}
   const groups=[{id:group,name:'Rytas'},{id:'44444444-4444-4444-8444-444444444444',name:'Vakaras'}],days=[];
   for(let d=q.get('from');d<=q.get('to');d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10)){
    const future=d>'2026-10-16',items=future?[]:[{id,name:'L-Lysine',manufacturer:'Swanson',groupId:group,status:'taken',completedAt:d+'T05:10:00Z',resumeOn:null},{id:'55555555-5555-4555-8555-555555555555',name:'Vitamin C',manufacturer:'NOW',groupId:group,status:d==='2026-10-16'?'pending':'missed',completedAt:null,resumeOn:null},{id:'66666666-6666-4666-8666-666666666666',name:'L-Tryptophan',manufacturer:'ZeinPharma',groupId:groups[1].id,status:'taken',completedAt:d+'T18:45:00Z',resumeOn:null},{id:'77777777-7777-4777-8777-777777777777',name:'Magnesium Bisglycinate',manufacturer:'Zenyth',groupId:groups[1].id,status:'paused',completedAt:null,resumeOn:'2026-10-22'}];
    const counts=Object.fromEntries(['taken','missed','pending','paused'].map(status=>[status,items.filter(i=>i.status===status).length]));days.push({day:d,future,items,counts,total:items.length-counts.paused});
   }
   await route.fulfill({json:{from:q.get('from'),to:q.get('to'),timezone:q.get('timezone'),today:'2026-10-16',groups,days}});
  });return {release,requests};
 }
 async function openHistory(page){await login(page);await page.locator('.account-link').click();await page.locator('#usage-link').click();await expect(page.locator('.usage-calendar')).toBeVisible();}
 test('matches B composition, changes days/views/filters, opens details and returns to Account',async({page})=>{
  const fake=await history(page);await openHistory(page);await expect(page.locator('.usage-summary')).toContainText('2 of 3');await expect(page.locator('.usage-summary')).toContainText('1 remaining');await expect(page.locator('.usage-product-time')).toContainText(['08:10','Remaining','21:45']);
  await page.locator('.usage-day[data-day="2026-10-15"]').click();await expect(page.locator('.usage-summary')).toContainText('1 missed');await expect(page.locator('#app-nav .account-link')).toHaveAttribute('aria-current','page');
  await page.locator('.usage-filters [data-filter="missed"]').click();await expect(page.locator('.usage-product')).toHaveCount(1);await expect(page.locator('.usage-product')).toContainText('Vitamin C');await page.locator('.usage-filters [data-filter="paused"]').click();await expect(page.locator('.usage-journal')).toHaveCount(0);await expect(page.locator('.usage-paused')).toContainText('Magnesium');
  await page.locator('.usage-filters [data-filter="all"]').click();await page.screenshot({path:'.runtime/usage-calendar-en-light.png'});await page.locator('.usage-journal .usage-product').first().click();await expect(page.locator('#route-dialog')).toBeVisible();await page.locator('#route-dialog [data-sheet-close]').click();await expect(page.locator('.usage-calendar')).toBeVisible();await expect(page.locator('.usage-day[data-day="2026-10-15"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('.usage-tabs [data-mode="month"]').click();await expect(page.locator('.usage-days-month .usage-day')).toHaveCount(35);await page.locator('.usage-day[data-day="2026-10-18"]').click();await expect(page.locator('.usage-empty')).toContainText('Future dates');await page.locator('.usage-period button').first().click();await expect.poll(()=>fake.requests.at(-1).from).toBe('2026-08-31');await page.locator('#usage-dialog [data-sheet-close]').click();await expect(page.locator('#account-screen')).toBeVisible();
 });
 test('Lithuanian light reference, narrow and dark states fit the same shared scroller/navigation',async({page})=>{
  await history(page);await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#usage-link').click();await page.locator('.usage-day[data-day="2026-10-15"]').click();await expect(page.locator('.usage-summary')).toContainText('2 iš 3');await page.screenshot({path:'.runtime/usage-calendar-b-light.png'});
  const layout=await page.evaluate(()=>({overflow:document.querySelector('.usage-calendar').scrollWidth>document.querySelector('.usage-calendar').clientWidth,scrollers:document.querySelector('main').scrollHeight>document.querySelector('main').clientHeight,fonts:[...new Set([...document.querySelectorAll('.usage-calendar h1,.usage-calendar button,.usage-calendar p')].map(n=>getComputedStyle(n).fontFamily))]}));expect(layout.overflow).toBe(false);expect(layout.fonts).toHaveLength(1);
  await page.setViewportSize({width:320,height:700});expect(await page.locator('.usage-calendar').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);await page.locator('#usage-dialog [data-sheet-close]').click();await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#usage-link').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:'.runtime/usage-calendar-dark-narrow.png'});
 });
 test('retry, rapid range changes and logout do not expose stale account history',async({page})=>{
  await history(page,{fail:true});await openHistory(page);await expect(page.locator('.usage-calendar [role=alert]')).toBeVisible();await page.locator('.usage-calendar').getByRole('button',{name:'Try again'}).click();await expect(page.locator('.usage-summary')).toBeVisible();
  await page.locator('.usage-period button').first().click();await page.locator('.usage-period button').last().click();await expect(page.locator('.usage-day[data-day="2026-10-16"]')).toBeVisible();await page.locator('#usage-dialog [data-sheet-close]').click();await page.locator('#logout-button').click();await expect(page.locator('#usage-content')).toBeEmpty();await page.goto('/#/usage');await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#usage-content')).toBeEmpty();
 });
 test('late requests cannot replace a newer period; outside-month dates load their complete month',async({page})=>{
  const fake=await history(page,{delay:true});await openHistory(page);await expect(page.locator('.usage-loading')).toBeVisible();await page.locator('.usage-period button').first().click();await expect(page.locator('.usage-summary h2')).toContainText('October 9');fake.release();await expect(page.locator('.usage-day[data-day="2026-10-09"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('.usage-tabs [data-mode="month"]').click();await expect(page.locator('.usage-summary')).toBeVisible();await page.locator('.usage-day[data-day="2026-11-01"]').click();await expect.poll(()=>fake.requests.at(-1).from).toBe('2026-10-26');await expect(page.locator('.usage-days-month .usage-day')).toHaveCount(42);await expect(page.locator('.usage-period strong')).toContainText('November 2026');
 });

});

test('history keeps server-snapshotted deleted group labels, compact metadata and border-free group endings',async({page})=>{
 await mock(page,{preloaded:true});
 await page.route('https://perimove.com/supplement-api/v1/usage?*',async route=>{
  const q=new URL(route.request().url()).searchParams,days=[];for(let day=q.get('from');day<=q.get('to');day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))days.push({day,future:false,total:3,counts:{taken:1,missed:0,pending:2,paused:0},groups:[{key:'old-morning',id:'deleted-group',name:'Historical morning',icon:''},{key:'old-evening',id:'renamed-group',name:'Original evening',icon:''}],items:[{id,name:'First product',manufacturer:'Manufacturer A',groupId:'deleted-group',groupKey:'old-morning',status:'taken',completedAt:day+'T05:10:00Z'},{id:'two',name:'Second product',manufacturer:'Manufacturer B',groupId:'deleted-group',groupKey:'old-morning',status:'pending'},{id:'three',name:'Third product',manufacturer:'Manufacturer C',groupId:'renamed-group',groupKey:'old-evening',status:'pending'}]});await route.fulfill({json:{...Object.fromEntries(q),today:new Date().toLocaleDateString('sv-SE'),timezone:'UTC',groups:[],days}});
 });
 await login(page);await page.locator('.account-link').click();await page.locator('#usage-link').click();await expect(page.locator('.usage-journal-group')).toHaveCount(2);await expect(page.locator('.usage-journal h2')).toHaveText(['Historical morning','Original evening']);await expect(page.locator('.usage-subtitle,.usage-context-note')).toHaveCount(0);
 const style=await page.evaluate(()=>{const groups=[...document.querySelectorAll('.usage-journal-group')],last=groups.map(g=>getComputedStyle(g.querySelector('.usage-product:last-child'))),strong=getComputedStyle(document.querySelector('.usage-product-copy strong')),small=getComputedStyle(document.querySelector('.usage-product-copy small'));return {gap:parseFloat(getComputedStyle(groups[1]).marginTop),borders:last.map(s=>s.borderBottomWidth),title:parseFloat(strong.fontSize),manufacturer:parseFloat(small.fontSize),metadataGap:small.marginTop};});expect(style.gap).toBeGreaterThanOrEqual(20);expect(style.borders).toEqual(['0px','0px']);expect(style.title).toBeLessThan(14);expect(style.manufacturer).toBeLessThan(12);expect(style.metadataGap).toBe('0px');await page.screenshot({path:'.runtime/history-groups-light.png'});
});

test('all bottom sheets share centred header controls and Usage opens above Account',async({page})=>{
 await mock(page,{preloaded:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://perimove.com/supplement-api/v1/rechecks',route=>route.fulfill({json:{active:null,latest:null,proposals:[]}}));
 await page.route('https://perimove.com/supplement-api/v1/usage?*',route=>{const q=new URL(route.request().url()).searchParams;return route.fulfill({json:{from:q.get('from'),to:q.get('to'),today:new Date().toLocaleDateString('sv-SE'),timezone:'UTC',groups:[],days:[]}});});
 await login(page);const samples=[];
 async function check(selector,name){const dialog=page.locator(selector);await expect(dialog).toBeVisible();const header=dialog.locator('.sheet-header').first(),title=header.locator('h1:visible,h2:visible').first(),close=header.locator('button').last();
  const centreDelta=await header.evaluate(h=>{const a=[...h.querySelectorAll('h1,h2')].find(n=>n.getClientRects().length).getBoundingClientRect(),b=[...h.querySelectorAll('button')].at(-1).getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2);});expect(centreDelta,name).toBeLessThan(1);const sample=await dialog.evaluate(n=>{const s=getComputedStyle(n),h=getComputedStyle(n.querySelector('.sheet-header h1,.sheet-header h2'));return [n.getBoundingClientRect().width,s.paddingLeft,s.borderTopLeftRadius,h.fontSize,h.fontFamily];});samples.push(sample);await page.screenshot({path:'.runtime/sheet-'+name+'.png',animations:'disabled'});
 }
 await page.locator('#add-supplement').click();await check('#add-dialog','add');await page.locator('#close-add').click();
 await page.locator('#app-nav [data-route="/groups"]').click();await page.locator('#new-group').click();await check('#group-dialog','group');await page.locator('#group-dialog [data-sheet-close]').click();
 await page.locator('#app-nav [data-route="/"]').click();await page.locator('.supplement-open').click();await check('#route-dialog','product');await page.locator('.pause-supplement').click();await check('#pause-dialog','pause');await page.locator('#pause-dialog [data-sheet-close]').first().click();await page.locator('#supplement-detail .danger-link').click();const confirmation=page.locator('dialog[aria-labelledby^="dialog-"]');await check('dialog[aria-labelledby^="dialog-"]','confirmation');await confirmation.locator('.sheet-header button').click();await expect(confirmation).toHaveCount(0);await expect(page.locator('#route-dialog')).toBeVisible();await page.locator('#route-dialog [data-sheet-close]').click();
 await page.locator('#recheck-all').click();await check('#recheck-dialog','recheck');await page.locator('#recheck-dialog [data-sheet-close]').click();
 await page.locator('.account-link').click();await page.locator('#diagnostics-link').click();await check('#route-dialog','diagnostics');await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('#open-routine-wizard').click();await check('#routine-wizard-dialog','routine');await page.locator('[data-routine-event="breakfast"]').click();await check('#routine-time-dialog','time');await page.locator('#routine-time-dialog .sheet-header button').click();await page.locator('#routine-wizard-dialog .sheet-header button').click();
 await page.locator('#usage-link').click();await check('#usage-dialog','usage');await expect(page.locator('#account-screen')).toBeVisible();await page.locator('#usage-dialog [data-sheet-close]').click();await expect(page.locator('#usage-dialog')).toBeHidden();
 for(const sample of samples)expect(sample).toEqual(samples[0]);expect(errors).toEqual([]);
});

test('personal routine choices support 36 goals, max three, explicit consent, optional data and draft cancellation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,{preloaded:true,routineProfile:dailyRoutine});await login(page);await page.locator('.account-link').click();
 expect(await page.locator('.account-layout').evaluate(n=>[...n.children].filter(c=>!c.hidden).slice(0,3).map(c=>c.id))).toEqual(['account-forms','account-tools','preferences']);await expect(page.locator('#account-tools #open-routine-wizard')).toHaveCount(1);
 await page.locator('#open-routine-wizard').click();const wizard=page.locator('#routine-wizard-dialog'),goals=page.locator('#routine-goals-dialog');await expect(wizard.locator('.routine-tabs button')).toHaveText(['My day','About me','Preferences']);await wizard.getByRole('button',{name:'Continue',exact:true}).click();await expect(wizard.locator('h2')).toHaveText('About me');await expect(wizard.getByRole('switch')).toHaveAttribute('aria-checked','false');
 await wizard.locator('.routine-goals-open').click();await expect(goals.locator('[data-goal]')).toHaveCount(37);await goals.locator('[data-goal=sleep]').click();await goals.locator('[data-goal=energy]').click();await goals.locator('[data-goal=recovery]').click();await expect(goals.locator('[data-goal=skin]')).toBeDisabled();await expect(goals.locator('[data-goal][aria-pressed=true]')).toHaveCount(3);await page.screenshot({path:'.runtime/routine-goals-light.png',animations:'disabled'});await goals.locator('.sheet-header button').click();await expect(wizard.locator('.routine-goals-open')).toContainText('Not specified');
 await wizard.locator('.routine-goals-open').click();await goals.locator('[data-goal=sleep]').click();await goals.locator('[data-goal=recovery]').click();await goals.getByRole('button',{name:'Save',exact:true}).click();await expect(goals).toBeHidden();await wizard.getByLabel('Sex',{exact:true}).selectOption('male');await wizard.locator('[data-personal-choice=weightKg]').selectOption('set');await wizard.locator('[data-personal-input=weightKg]').selectOption('80');await expect(wizard.locator('[data-personal-input=weightKg]')).toHaveValue('80');await wizard.locator('[data-personal-choice=muscleKg]').selectOption('set');await wizard.locator('[data-personal-input=muscleKg]').selectOption('90');await expect(wizard.locator('[data-personal-input=weightKg]')).toHaveValue('80');await expect(wizard.locator('[data-personal-input=muscleKg]')).toHaveValue('90');await wizard.getByRole('button',{name:'Continue',exact:true}).click();await expect(wizard.locator('[data-routine-error]')).toContainText('cannot exceed');await wizard.locator('[data-personal-input=muscleKg]').selectOption('35');await wizard.getByRole('switch').click();await page.screenshot({path:'.runtime/routine-personal-light.png',animations:'disabled'});
 await wizard.getByRole('button',{name:'Continue',exact:true}).click();await expect(wizard.locator('.routine-back')).toHaveCount(0);await expect(wizard.getByText('Manufacturer directions come first. You approve each group change yourself.',{exact:true})).toHaveCount(0);
 const sent=page.waitForRequest(r=>r.url().endsWith('/v1/settings/routine')&&r.method()==='PUT');await wizard.getByRole('button',{name:'Save routine',exact:true}).click();const body=(await sent).postDataJSON();expect(body.routine.version).toBe(2);expect(body.routine.personal).toEqual({sex:'male',birthDate:null,heightCm:null,weightKg:80,muscleKg:35,goals:['sleep','recovery'],allowAI:true});await expect(wizard).toBeHidden();
 await page.reload();await page.locator('.account-link').click();await page.locator('#open-routine-wizard').click();await wizard.locator('.routine-tabs button').nth(1).click();await expect(wizard.getByRole('switch')).toHaveAttribute('aria-checked','true');await expect(wizard.locator('[data-personal-input=weightKg]')).toHaveValue('80');await wizard.locator('[data-personal-choice=weightKg]').selectOption('');await wizard.locator('[data-personal-input=muscleKg]').selectOption('40');await wizard.locator('.sheet-header button').click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(wizard).toBeHidden();expect(errors).toEqual([]);
});

test('conclusion sheet gates generation, preserves progress/results and supports separate group recommendations',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,{preloaded:true,routineProfile:dailyRoutine,routine:true});let ready=false,running=false,complete=false,failed=false,stale=false,report=null,generations=0;const decisions=[];
 const proposals=[{id:'p1',supplementId:id,name:'Example supplement',manufacturer:'Example',from:{id:group,name:'With a meal'},to:{id:'44444444-4444-4444-8444-444444444444',name:'With fats'},reason:'Existing evidence supports this timing.'},{id:'p2',supplementId:'77777777-7777-4777-8777-777777777777',name:'Second supplement',manufacturer:'Other brand',from:{id:group,name:'With a meal'},to:{id:'44444444-4444-4444-8444-444444444444',name:'With fats'},reason:'Supported timing.'}];
 await page.route('https://perimove.com/supplement-api/v1/conclusions**',async route=>{
  const r=route.request();if(r.method()==='POST'){generations++;running=true;complete=false;failed=false;await route.fulfill({status:202,json:{id:'report-job',status:'running'}});return;}
  if(r.method()==='PATCH'){const proposalId=new URL(r.url()).pathname.split('/').at(-1),action=r.postDataJSON().action;decisions.push({id:proposalId,action});report.proposals=report.proposals.filter(p=>p.id!==proposalId);if(action==='accept')stale=true;await route.fulfill({json:{ok:true}});return;}
  if(running&&complete){running=false;if(!failed)report={id:'report-job',createdAt:'2026-10-16T14:00:00Z',language:'en',stale,researchSources:[{id:'S1',title:'Clinical trial',url:'https://pubmed.ncbi.nlm.nih.gov/12345/'}],sections:{overview:'Your saved routine includes exercise.',benefits:'Potential benefits depend on the actual label amounts.',overlaps:'Amounts need verification.',recommendations:'Review known label directions.',research:'<script>window.injected=true</script> — trial findings [S1].',uncertainties:'Legacy section must be hidden'},proposals:structuredClone(proposals)};}
  await route.fulfill({json:{ready,hasSupplements:true,active:running?{id:'report-job',status:'running'}:null,error:failed?'AI_PROVIDER_FAILED':null,report:report?{...report,stale}:null}});
 });
 await login(page);await expect(page.locator('#conclusion-home')).toBeVisible();await page.locator('#open-conclusion').click();const sheet=page.locator('#conclusion-dialog');await expect(sheet.getByText(/Complete all Daily routine sections/)).toBeVisible();await expect(sheet.getByRole('button',{name:'Generate',exact:true})).toHaveCount(0);await sheet.getByRole('button',{name:'Complete Daily routine',exact:true}).click();await expect(page.locator('#routine-wizard-dialog h2')).toHaveText('About me');await page.locator('#routine-wizard-dialog .sheet-header button').click();ready=true;
 await page.locator('#open-conclusion').click();await sheet.getByRole('button',{name:'Generate',exact:true}).click();await expect(sheet.getByRole('progressbar')).toBeVisible();await sheet.locator('[data-sheet-close]').click();await page.reload();await page.locator('#open-conclusion').click();await expect(sheet.getByRole('progressbar')).toBeVisible();expect(generations).toBe(1);complete=true;await expect(sheet.locator('.conclusion-section')).toHaveCount(5);await expect(sheet.locator('[data-conclusion-proposal]')).toHaveCount(2);expect(await page.evaluate(()=>window.injected)).toBeUndefined();await expect(sheet.getByText('Legacy section must be hidden')).toHaveCount(0);await expect(sheet.locator('.conclusion-sources')).toHaveCount(0);await expect(sheet.locator('.conclusion-result')).not.toContainText('[S1]');await expect(sheet.getByRole('heading',{name:'What recent studies show',exact:true})).toBeVisible();await page.screenshot({path:'.runtime/conclusion-report-light.png',animations:'disabled'});
 await sheet.locator('[data-conclusion-proposal=p1]').getByRole('button',{name:'Accept',exact:true}).click();await expect(sheet.locator('.conclusion-warning')).toBeVisible();await expect(sheet.locator('[data-conclusion-proposal]')).toHaveCount(1);await sheet.locator('[data-conclusion-proposal=p2]').getByRole('button',{name:'Remove',exact:true}).click();await expect(sheet.locator('[data-conclusion-proposal]')).toHaveCount(0);expect(decisions).toEqual([{id:'p1',action:'accept'},{id:'p2',action:'remove'}]);
 await sheet.getByRole('button',{name:'Generate again',exact:true}).click();await expect(sheet.locator('.conclusion-section')).toHaveCount(5);failed=true;complete=true;await expect(sheet.locator('.conclusion-error')).toBeVisible();await expect(sheet.locator('.conclusion-section')).toHaveCount(5);await sheet.locator('[data-sheet-close]').click();await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(sheet).toBeHidden();await expect(page.locator('#conclusion-content')).toBeEmpty();expect(errors).toEqual([]);
});

test('personal routine and goal sheets localize, fit narrow dark screens and keep unspecified consent off',async({page})=>{
 await mock(page,{preloaded:true,routineProfile:{...dailyRoutine,version:2,personal:{sex:null,birthDate:null,heightCm:null,weightKg:null,muscleKg:null,goals:[],allowAI:false}}});await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.setViewportSize({width:320,height:640});await page.locator('#open-routine-wizard').click();const wizard=page.locator('#routine-wizard-dialog');await wizard.locator('.routine-tabs button').nth(1).click();await expect(wizard.locator('h2')).toHaveText('Apie mane');await expect(wizard.getByRole('switch')).toHaveAttribute('aria-checked','false');expect(await wizard.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await wizard.locator('.routine-goals-open').click();const goals=page.locator('#routine-goals-dialog');await expect(goals.locator('[data-goal]')).toHaveCount(37);await expect(goals.locator('[data-goal=""]')).toHaveText('Nenurodyti');expect(await goals.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.screenshot({path:'.runtime/routine-goals-dark-lt-320.png',animations:'disabled'});await goals.locator('.sheet-header button').click();await expect(goals).toBeHidden();await wizard.locator('.sheet-header button').click();await expect(wizard).toBeHidden();
});

test('personal native pickers use integers and keep Safari date dimensions inside the card',async({page})=>{
 const personal={sex:'male',birthDate:'1986-06-23',heightCm:180.5,weightKg:80.4,muscleKg:35.7,goals:[],allowAI:false};await mock(page,{preloaded:true,routineProfile:{...dailyRoutine,version:2,personal}});await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#open-routine-wizard').click();const wizard=page.locator('#routine-wizard-dialog');await wizard.locator('.routine-tabs button').nth(1).click();await expect(wizard.getByLabel('Sex',{exact:true}).locator('option')).toHaveCount(3);await expect(wizard.getByLabel('Sex',{exact:true}).locator('option[value=other]')).toHaveCount(0);await expect(wizard.locator('input[type=number]')).toHaveCount(0);
 for(const [key,whole]of [['heightCm','181'],['weightKg','80'],['muscleKg','36']])await expect(wizard.locator('[data-personal-input='+key+']')).toHaveValue(whole);await expect(wizard.locator('[data-personal-fraction]')).toHaveCount(0);
 for(const width of [320,402,768]){await page.setViewportSize({width,height:874});const boxes=await wizard.evaluate(n=>{const date=n.querySelector('[data-personal-input=birthDate]').getBoundingClientRect(),choice=n.querySelector('[data-personal-choice=birthDate]').getBoundingClientRect();return {date:{width:date.width,height:date.height,right:date.right},choice:{width:choice.width,height:choice.height,right:choice.right},overflow:n.scrollWidth>n.clientWidth};});expect(boxes.date.width).toBeCloseTo(boxes.choice.width,0);expect(boxes.date.height).toBe(boxes.choice.height);expect(boxes.date.right).toBeLessThanOrEqual(boxes.choice.right+1);expect(boxes.overflow).toBe(false);}
 await page.setViewportSize({width:402,height:874});await wizard.evaluate(n=>n.scrollTop=0);await page.screenshot({path:'.runtime/personal-native-pickers-dark.png',animations:'disabled'});await wizard.locator('[data-personal-input=weightKg]').selectOption('500');await expect(wizard.locator('[data-personal-input=weightKg]')).toHaveValue('500');await wizard.locator('[data-personal-choice=weightKg]').selectOption('');await wizard.getByRole('button',{name:'Continue',exact:true}).click();const sent=page.waitForRequest(r=>r.url().endsWith('/v1/settings/routine')&&r.method()==='PUT');await wizard.getByRole('button',{name:'Save routine',exact:true}).click();expect((await sent).postDataJSON().routine.personal).toEqual({...personal,heightCm:181,weightKg:null,muscleKg:36});
});

test('failed translation keeps source details, reports translations instead of additions and retries only existing products',async({page})=>{
 const m=await mock(page,{preloaded:true});let retried=false;const failed={id:'locale-failed',status:'failed',phase:'done',language:'lt',error_code:'AI_INVALID_RESPONSE',total_count:1,processed_count:1,created_at:'2026-10-16T18:58:00Z',result:{kind:'localization',language:'lt',items:[{id,name:'Existing product',status:'added',research:'failed'}]}};
 await page.route('https://perimove.com/supplement-api/v1/supplements/jobs',async route=>route.fulfill({json:{job:failed,active:[],recent:[failed]}}));let body;
 await page.route('https://perimove.com/supplement-api/v1/supplements/localize',async route=>{body=route.request().postDataJSON();retried=true;await route.fulfill({json:{id:'translation-retry',status:'complete',phase:'done',total_count:1,processed_count:1,result:{kind:'localization',language:'lt',items:[{id,name:'Existing product',status:'existing',research:'complete'}]}}});});
 await login(page);await page.locator('#add-supplement').click();await page.locator('#toggle-upload-queue').click();const card=page.locator('[data-job-id=locale-failed]');await card.locator('summary').click();await expect(card).toContainText('Translated information for 0 of 1 supplements.');await expect(card).not.toContainText('Nothing was added');await expect(card).not.toContainText('Analysis complete: added');await expect(card.locator('.upload-steps')).toContainText('Translating information');await expect(card.locator('.upload-product-button')).toHaveAttribute('data-state','failed');await page.screenshot({path:'.runtime/translation-failure-corrected.png',animations:'disabled'});
 await card.getByRole('button',{name:'Retry translation',exact:true}).click();expect(retried).toBe(true);expect(body.supplementIds).toEqual([id]);expect(body.language).toBe('lt');expect(m.requests.filter(r=>r.path==='/v1/supplements/jobs'&&r.method==='POST')).toHaveLength(0);await page.locator('#close-add').click();await expect(page.locator('.supplement-row')).toHaveCount(1);
});

test('a failed language request leaves original quantities, benefits and details visible',async({page})=>{
 await mock(page,{preloaded:true,localization:true});let calls=0;await page.route('https://perimove.com/supplement-api/v1/supplements/localize',async route=>{calls++;await route.fulfill({json:{id:'failed-locale',status:'failed',phase:'done',error_code:'AI_INVALID_RESPONSE',result:{kind:'localization',items:[{id,name:'Example',status:'existing',research:'failed'}]}}});});
 await login(page);await expect(page.locator('.supplement-open .summary')).toContainText('Imunitetas');await expect(page.locator('.supplement-open')).toContainText('Original language');await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).toContainText('Translation is not ready. Showing the original information.');await expect(page.locator('[data-detail-section=dose]')).toContainText('1 kapsulė per dieną');await expect(page.locator('[data-detail-section=benefits]')).toContainText('Lietuviška nauda');await expect(page.locator('.composition-list')).toContainText('1,000 mg');expect(calls).toBe(1);
});

for(const legacyDictionary of [false,true])test('research heading is Lithuanian '+(legacyDictionary?'with a cached older dictionary':'with current translations'),async({page})=>{
 if(legacyDictionary)await page.route('**/translations/*.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('"appConclusionSection_research":','"unusedResearchHeading":')});});
 await mock(page,{preloaded:true});
 await page.route('https://perimove.com/supplement-api/v1/conclusions',route=>route.fulfill({json:{ready:true,hasSupplements:true,active:null,error:null,report:{id:'readable-report',createdAt:'2026-10-16T20:00:00Z',language:'lt',stale:false,sections:{research:'Naujesni tyrimai rodo, kad nauda gali būti nedidelė [S1].'},researchSources:[{id:'S1',title:'Tyrimas',url:'https://pubmed.ncbi.nlm.nih.gov/12345/'}],proposals:[]}}}));
 await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#app-nav [data-route="/"]').click();await page.locator('#open-conclusion').click();const sheet=page.locator('#conclusion-dialog');await expect(sheet.locator('.conclusion-section h3')).toHaveText(legacyDictionary?'Informacijos šaltiniai':'Ką rodo naujausi tyrimai');await expect(sheet).not.toContainText('appConclusionSection_');
});

// Exercise the consumer lifecycle, not just setupPwa's standalone contract.
async function startupWorker(page,{installing=false,blocked=false}={}){
 await page.addInitScript(({installing,blocked})=>{
  const registration=Object.assign(new EventTarget(),{waiting:null,installing:installing?Object.assign(new EventTarget(),{state:'installing'}):null,update:async()=>{window.workerChecks++;}});
  const worker=Object.assign(new EventTarget(),{controller:{},register:()=>blocked?new Promise(()=>{}):Promise.resolve(registration)});
  Object.defineProperty(navigator,'serviceWorker',{value:worker,configurable:true});
  window.workerChecks=0;window.activationRequests=[];window.mockWorker=worker;window.mockRegistration=registration;
  sessionStorage.setItem('upgradeBoots',String(Number(sessionStorage.getItem('upgradeBoots')||0)+1));
  window.offerUpdate=()=>{
   registration.waiting={postMessage:()=>window.activationRequests.push({loading:!document.querySelector('#startup-screen').hidden})};
   if(!registration.installing){registration.installing=Object.assign(new EventTarget(),{state:'installing'});registration.dispatchEvent(new Event('updatefound'));}
   registration.installing.state='installed';registration.installing.dispatchEvent(new Event('statechange'));
  };
 },{installing,blocked});
}
test('startup update stays behind loading screen and late activation cannot reload',async({page})=>{
 await mock(page);await startupWorker(page,{installing:true});await page.goto('/');
 await expect(page.locator('#startup-screen')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.workerChecks)).toBe(1);
 await page.evaluate(()=>window.offerUpdate());
 expect(await page.evaluate(()=>window.activationRequests)).toEqual([{loading:true}]);
 await expect(page.locator('#startup-screen')).toBeHidden({timeout:6500});
 await page.evaluate(()=>{window.mockRegistration.waiting=null;window.mockRegistration.installing=null;window.mockWorker.dispatchEvent(new Event('controllerchange'));});
 await expect(page.locator('#update-button')).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('upgradeBoots'))).toBe('1');
});
test('late updates and foreground/idle events never automatically activate or recheck',async({page})=>{
 await mock(page);await startupWorker(page);await login(page);
 const checks=await page.evaluate(()=>window.workerChecks);
 await page.evaluate(()=>{window.offerUpdate();document.dispatchEvent(new Event('app:idle'));document.dispatchEvent(new Event('app:saved'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('pageshow'));});
 await expect(page.locator('#update-button')).toBeVisible();
 expect(await page.evaluate(()=>window.activationRequests)).toEqual([]);
 expect(await page.evaluate(()=>window.workerChecks)).toBe(checks);
 expect(await page.evaluate(()=>sessionStorage.getItem('upgradeBoots'))).toBe('1');
 await page.locator('#update-button').click();
 expect(await page.evaluate(()=>window.activationRequests)).toEqual([{loading:false}]);
});
test('blocked worker registration releases launch screen within bounded startup budget',async({page})=>{
 await mock(page);await startupWorker(page,{blocked:true});await page.goto('/');
 await expect(page.locator('#startup-screen')).toBeVisible();
 await expect(page.locator('#startup-screen')).toBeHidden({timeout:6500});
 await expect(page.locator('#login-form')).toBeVisible();
});

test('product schedule and inventory save, separate occurrences debit and undo actual stock',async({page})=>{
 const fake=await mock(page,{preloaded:true,intake:true});await login(page);await page.locator('.supplement-open').click();
 await page.locator('.intake-settings>summary').click();const form=page.locator('[data-intake-form]');
 await form.locator('[name=count]').selectOption('2');await form.locator('[name=time0]').fill('08:00');await form.locator('[name=time1]').fill('20:00');await form.locator('[name=quantity]').selectOption('2');
 await form.locator('[name=tracking]').check();await form.locator('[name=remaining]').fill('3');await form.locator('[name=threshold]').fill('1');
 await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('saved');
 await page.screenshot({path:'.runtime/intake-settings-light.png',animations:'disabled'});
 await page.locator('#route-dialog [data-sheet-close]').click();await expect(page.locator('.supplement-row')).toHaveCount(2);await expect(page.locator('#progress-count')).toHaveText('0 / 2');
 await page.locator('.supplement-row[data-slot="08:00"] .check-button').click();await expect(page.locator('#progress-count')).toHaveText('1 / 2');await expect(page.locator('.stock-badge').first()).toContainText('1 remaining');
 await page.locator('.supplement-row[data-slot="20:00"] .check-button').click();await expect(page.locator('#progress-count')).toHaveText('2 / 2');await expect(page.locator('.stock-badge').first()).toContainText('0 remaining');
 await page.locator('.supplement-row[data-slot="20:00"] .check-button').click();await expect(page.locator('#progress-count')).toHaveText('1 / 2');await expect(page.locator('.stock-badge').first()).toContainText('1 remaining');
 expect(fake.requests.filter(r=>r.path.endsWith('/research')||r.path==='/v1/supplements/jobs'&&r.method==='POST')).toEqual([]);
});
test('off days remain reachable without counting as due and edits survive refresh with conflict recovery',async({page})=>{
 await mock(page,{preloaded:true,intake:true});await login(page);await page.locator('.supplement-open').click();await page.locator('.intake-settings>summary').click();let form=page.locator('[data-intake-form]');
 await form.locator('[name=mode]').selectOption('weekdays');const today=(new Date().getDay()||7),other=today===7?1:today+1;
 for(const b of await form.locator('[data-weekday]').all())if(await b.getAttribute('aria-pressed')==='true')await b.click();await form.locator(`[data-weekday="${other}"]`).click();
 await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.getByRole('status')).toContainText('saved');await page.locator('#route-dialog [data-sheet-close]').click();
 await expect(page.locator('.supplement-row')).toHaveCount(0);await expect(page.locator('#progress-count')).toHaveText('0 / 0');await page.locator('.rest-day-supplements>summary').click();await page.locator('.rest-day-open').click();await page.locator('.intake-settings>summary').click();form=page.locator('[data-intake-form]');
 await form.locator('[name=mode]').selectOption('interval');await form.locator('[name=intervalDays]').selectOption('3');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(form.locator('[name=intervalDays]')).toHaveValue('3');
 await page.route('**/supplements/*/intake',route=>route.fulfill({status:409,json:{error:'INTAKE_CHANGED'}}));await form.getByRole('button',{name:'Save',exact:true}).click();await expect(form.locator('.status-error')).toContainText('changed');await expect(form.locator('[name=intervalDays]')).toHaveValue('3');
 await form.getByRole('button',{name:'Cancel',exact:true}).click();await expect(form.locator('[name=mode]')).toHaveValue('weekdays');
});
test('intake native controls fit narrow phones and translate in dark mode',async({page})=>{
 await mock(page,{preloaded:true,intake:true});await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#app-nav [data-route="/"]').click();await page.locator('.supplement-open').click();await page.locator('.intake-settings>summary').click();
 const form=page.locator('[data-intake-form]');await expect(form).toContainText('Vartojimo grafikas');await form.locator('[name=mode]').selectOption('interval');await form.locator('[name=count]').selectOption('3');await form.locator('[name=tracking]').check();
 for(const width of [320,402,768]){await page.setViewportSize({width,height:874});expect(await form.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);for(const c of await form.locator('input:not([type=checkbox]),select').all()){if(await c.isVisible()){const fits=await c.evaluate(n=>{const r=n.getBoundingClientRect(),p=n.closest('form').getBoundingClientRect();return r.width>0&&r.height===46&&r.left>=p.left-1&&r.right<=p.right+1;});expect(fits).toBe(true);}}await form.locator('h3').first().scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/intake-dark-lt-'+width+'.png',animations:'disabled'});}
});

async function journalMock(page,{seeded=false,failRead=false}={}){
 const entries=new Map(),writes=[],reads=[];let conflict=false,saveError=false,saveGate=null,readGate=null;
 const entry={mood:4,sleep:4,energy:3,digestion:4,observations:['more_energy','better_sleep'],notes:'',revision:1,updatedAt:'2026-10-18T12:00:00Z'};
 if(seeded)entries.set('2026-10-18',entry);
 await page.clock.setFixedTime(new Date('2026-10-18T12:00:00Z'));
 await page.route('https://perimove.com/supplement-api/v1/wellbeing**',async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='PUT'){
   const day=url.pathname.split('/').at(-1),body=route.request().postDataJSON();writes.push({day,...body});if(saveGate)await saveGate;
   if(saveError){await route.fulfill({status:503,json:{error:'REQUEST_FAILED'}});return;}
   if(conflict||body.revision!==(entries.get(day)?.revision||0)){conflict=false;await route.fulfill({status:409,json:{error:'WELLBEING_CHANGED'}});return;}
   const entry={...body.entry,revision:body.revision+1,updatedAt:'2026-10-18T12:30:00Z'};entries.set(day,entry);await route.fulfill({json:{day,entry}});return;
  }
  const from=url.searchParams.get('from'),to=url.searchParams.get('to');reads.push({from,to});if(readGate)await readGate;
  if(failRead){failRead=false;await route.fulfill({status:503,json:{error:'REQUEST_FAILED'}});return;}
  const days=[];for(let day=from;day<=to;day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))days.push({day,entry:entries.get(day)||null,taken:day>'2026-10-18'?0:12,total:day>'2026-10-18'?0:16,future:day>'2026-10-18'});
  await route.fulfill({json:{from,to,today:'2026-10-18',days}});
 });
 return {entries,writes,reads,conflict(){conflict=true;},failSave(value=true){saveError=value;},delaySave(){let release;saveGate=new Promise(r=>release=r);return()=>{saveGate=null;release();};},delayRead(){let release;readGate=new Promise(r=>release=r);return()=>{readGate=null;release();};}};
}
async function openJournal(page){await page.locator('.account-link').click();await page.locator('#wellbeing-link').click();await expect(page.locator('[data-wellbeing-form]')).toBeVisible();}

test('wellbeing journal matches selected composition, saves all controls and restores the chosen day',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,{preloaded:true});const fake=await journalMock(page);await login(page);await openJournal(page);const sheet=page.locator('#wellbeing-dialog');
 await expect(sheet.locator('[data-field=mood] [role=radio]')).toHaveCount(5);await sheet.locator('[data-field=mood] [data-rating="4"]').click();for(const[f,v]of[['sleep',4],['energy',3],['digestion',4]])await sheet.locator(`[data-field=${f}] [data-rating="${v}"]`).click();
 await sheet.locator('[data-observation=more_energy]').click();await sheet.locator('[data-observation=better_sleep]').click();await sheet.locator('textarea').fill('<b>My own note</b>');expect(fake.writes).toHaveLength(0);
 await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet.getByRole('status')).toContainText('saved');expect(fake.writes).toHaveLength(1);expect(fake.writes[0].entry).toEqual({mood:4,sleep:4,energy:3,digestion:4,observations:['more_energy','better_sleep'],notes:'<b>My own note</b>'});
 await sheet.locator('[data-sheet-close]').click();await expect(sheet).toBeHidden();await page.locator('#wellbeing-link').click();await expect(sheet.locator('textarea')).toHaveValue('<b>My own note</b>');await expect(sheet.locator('textarea b')).toHaveCount(0);
 await sheet.locator('[data-day="2026-10-17"]').click();await expect(sheet.locator('textarea')).toHaveValue('');await sheet.locator('[data-field=mood] [data-rating="2"]').click();await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet.getByRole('status')).toContainText('saved');await sheet.locator('[data-day="2026-10-18"]').click();await expect(sheet.locator('[data-field=mood] [data-rating="4"]')).toHaveAttribute('aria-checked','true');await expect(sheet.locator('.wellbeing-intake-summary')).toContainText('12 of 16');expect(errors).toEqual([]);
});
test('journal draft guards dates, X and browser back; cancel preserves all values',async({page})=>{
 await mock(page,{preloaded:true});const fake=await journalMock(page);await login(page);await openJournal(page);const sheet=page.locator('#wellbeing-dialog'),confirmation=page.locator('dialog[aria-labelledby^="dialog-"]');await sheet.locator('textarea').fill('Unsaved private draft');
 await sheet.locator('[data-day="2026-10-17"]').click();await expect(confirmation).toContainText('Discard');await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirmation).toHaveCount(0);await expect(sheet.locator('[data-day="2026-10-18"]')).toHaveAttribute('aria-pressed','true');await expect(sheet.locator('textarea')).toHaveValue('Unsaved private draft');
 await sheet.locator('[data-sheet-close]').click();await expect(confirmation).toBeVisible();await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirmation).toHaveCount(0);await expect(sheet).toBeVisible();await expect(page).toHaveURL(/#\/wellbeing$/);
 await page.goBack();await expect(confirmation).toBeVisible();await confirmation.getByRole('button',{name:'Confirm',exact:true}).click();await expect(sheet).toBeHidden();expect(fake.writes).toHaveLength(0);await page.locator('#wellbeing-link').click();await expect(sheet.locator('textarea')).toHaveValue('');
});
test('journal retry/conflict keeps the draft and reload requires explicit discard',async({page})=>{
 await mock(page,{preloaded:true});const fake=await journalMock(page,{seeded:true,failRead:true});await login(page);await page.locator('.account-link').click();await page.locator('#wellbeing-link').click();const sheet=page.locator('#wellbeing-dialog');await expect(sheet.getByRole('alert')).toBeVisible();await sheet.getByRole('button',{name:'Try again',exact:true}).click();await expect(sheet.locator('[data-wellbeing-form]')).toBeVisible();
 await sheet.locator('textarea').fill('Keep on conflict');fake.conflict();await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet.getByRole('alert')).toContainText('changed');await expect(sheet.locator('textarea')).toHaveValue('Keep on conflict');await sheet.getByRole('button',{name:'Reload saved entry',exact:true}).click();const confirmation=page.locator('dialog[aria-labelledby^="dialog-"]');await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirmation).toHaveCount(0);await expect(sheet.locator('textarea')).toHaveValue('Keep on conflict');
 await sheet.getByRole('button',{name:'Reload saved entry',exact:true}).click();await confirmation.getByRole('button',{name:'Confirm',exact:true}).click();await expect(sheet.locator('textarea')).toHaveValue('');
 fake.failSave();await sheet.locator('textarea').fill('Network draft');await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet.getByRole('alert')).toBeVisible();await expect(sheet.locator('textarea')).toHaveValue('Network draft');fake.failSave(false);await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet.getByRole('status')).toContainText('saved');
});
test('journal ratings support clear and keyboard selection, dates cannot enter the future',async({page})=>{
 await mock(page,{preloaded:true});await journalMock(page);await login(page);await openJournal(page);const sheet=page.locator('#wellbeing-dialog'),energy=sheet.locator('[data-field=energy]');await energy.locator('[data-rating="3"]').click();await energy.locator('[data-rating="3"]').click();await expect(energy.locator('[aria-checked=true]')).toHaveCount(0);await energy.locator('[data-rating="1"]').focus();await page.keyboard.press('ArrowRight');await expect(energy.locator('[data-rating="2"]')).toHaveAttribute('aria-checked','true');await page.keyboard.press('End');await expect(energy.locator('[data-rating="5"]')).toHaveAttribute('aria-checked','true');await expect(sheet.getByRole('button',{name:'Next day',exact:true})).toBeDisabled();
 await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet.getByRole('status')).toContainText('saved');await sheet.getByRole('button',{name:'Previous day',exact:true}).click();await expect(sheet.locator('[data-day="2026-10-18"]')).toHaveAttribute('aria-pressed','false');
});
test('wellbeing reference remains balanced in Lithuanian light/dark, narrow and keyboard viewports',async({page})=>{
 await mock(page,{preloaded:true});await journalMock(page,{seeded:true});await login(page);await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#wellbeing-link').click();const sheet=page.locator('#wellbeing-dialog');await expect(sheet.locator('h2')).toHaveText('Savijautos dienoraštis');await expect(sheet.locator('[data-wellbeing-form]')).toBeVisible();
 for(const theme of ['light','dark'])for(const [width,height]of[[402,874],[320,740],[768,1000],[402,480]]){
  await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.setViewportSize({width,height});
  await expect.poll(()=>sheet.evaluate(n=>Math.abs(n.getBoundingClientRect().bottom-innerHeight))).toBeLessThan(1);
  const layout=await sheet.evaluate(n=>{const r=n.getBoundingClientRect(),title=n.querySelector('h2').getBoundingClientRect(),close=n.querySelector('[data-sheet-close]').getBoundingClientRect();return {overflow:n.scrollWidth>n.clientWidth,left:r.left,right:r.right,bottom:r.bottom,titleX:title.x+title.width/2,closeY:close.y+close.height/2,titleY:title.y+title.height/2,width:innerWidth,height:innerHeight,savePosition:getComputedStyle(n.querySelector('.wellbeing-save')).position};});
  expect(layout.overflow).toBe(false);expect(layout.left).toBeGreaterThanOrEqual(0);expect(layout.right).toBeLessThanOrEqual(width);expect(layout.bottom).toBeCloseTo(height,0);expect(layout.titleX).toBeCloseTo(width/2,0);expect(Math.abs(layout.titleY-layout.closeY)).toBeLessThan(1);expect(layout.savePosition).toBe('static');
  await sheet.evaluate(n=>n.scrollTop=0);await page.screenshot({path:`.runtime/journal-${theme}-${width}-${height}-top.png`,animations:'disabled'});await sheet.locator('.wellbeing-save').scrollIntoViewIfNeeded();await expect(sheet.locator('.wellbeing-save')).toBeInViewport();await page.screenshot({path:`.runtime/journal-${theme}-${width}-${height}-bottom.png`,animations:'disabled'});
 }
});
test('late journal reads after logout cannot show private notes in another session',async({page})=>{
 await mock(page,{preloaded:true});const fake=await journalMock(page,{seeded:true}),release=fake.delayRead();await login(page);await page.locator('.account-link').click();await page.locator('#wellbeing-link').click();await expect(page.locator('.wellbeing-loading')).toBeVisible();await page.locator('#wellbeing-dialog [data-sheet-close]').click();await page.locator('#logout-button').click();release();await expect(page.locator('#wellbeing-dialog')).toBeHidden();await expect(page.locator('#wellbeing-content')).toBeEmpty();
});

test('navigation stays above composited content at every scroll offset and tab',async({page})=>{
 await mock(page,{design:true,preloaded:true});await login(page);const nav=page.locator('#app-nav');
 // Stress the same layer boundary as accelerated iPhone table/card painting.
 // A large descendant z-index must remain confined to the main scroller.
 await page.evaluate(()=>document.styleSheets[document.styleSheets.length-1].insertRule('main .group-block,main .account-card,main .managed-group{position:relative;z-index:999;transform:translateZ(0)}'));
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  for(const route of ['/','/groups','/account']){
   await nav.locator(`[data-route="${route}"]`).click();await expect(nav.locator('[aria-current=page]')).toHaveAttribute('data-route',route);
   for(const ratio of [0,.3,.7,1]){
    await page.locator('main').evaluate((n,ratio)=>n.scrollTop=(n.scrollHeight-n.clientHeight)*ratio,ratio);
    const result=await nav.evaluate(n=>{const r=n.getBoundingClientRect(),css=getComputedStyle(n),glass=getComputedStyle(n,'::before');return {bottom:r.bottom,height:innerHeight,isolated:getComputedStyle(document.querySelector('main')).isolation,ownBlur:css.backdropFilter,glassBlur:glass.backdropFilter||glass.webkitBackdropFilter,above:[...n.querySelectorAll('a')].every(a=>{const b=a.getBoundingClientRect();return [0.25,0.5,0.75].every(y=>a.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height*y)));})};});
    expect(result.above).toBe(true);expect(result.isolated).toBe('isolate');expect(result.ownBlur).toBe('none');expect(result.glassBlur).toContain('blur');expect(result.bottom).toBeLessThanOrEqual(result.height);
   }
   await page.screenshot({path:'.runtime/nav-layer-'+theme+'-'+(route.slice(1)||'home')+'.png',animations:'disabled'});
  }
 }
 await nav.locator('[data-route="/"]').click();await page.locator('.supplement-open').first().click();await expect(page.locator('#route-dialog')).toBeVisible();const covered=await nav.evaluate(n=>{const r=n.getBoundingClientRect();return !n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});expect(covered).toBe(true);
});

test('conclusion history paginates, opens immutable prose, retries and clears private data at logout',async({page})=>{
 await mock(page,{preloaded:true});let fail=false,hold=false,release;const calls=[];
 const records=Array.from({length:3},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),createdAt:`2026-10-${18-i}T10:00:00Z`,language:'en',score:i===2?null:{value:i===0?0:100,explanation:'Assessment of the supplied plan.'},inventory:{totalProducts:16-i},sections:{overview:'Saved routine '+(i+1),benefits:'Saved benefit '+(i+1),research:'Readable finding [S1]',recommendations:'Saved recommendation'}}));
 await page.route('https://perimove.com/supplement-api/v1/conclusions**',async route=>{const p=new URL(route.request().url());calls.push(route.request().method()+' '+p.pathname);if(p.pathname.endsWith('/history')){if(fail){fail=false;await route.fulfill({status:500,json:{error:'REQUEST_FAILED'}});return;}const more=p.searchParams.has('before');await route.fulfill({json:{items:(more?records.slice(2):records.slice(0,2)).map(r=>({...r,preview:r.sections.overview})),next:more?null:records[1].id}});return;}if(p.pathname.includes('/history/')){if(hold)await new Promise(r=>release=r);await route.fulfill({json:{report:records.find(r=>r.id===p.pathname.split('/').at(-1))}}).catch(()=>{});return;}await route.fulfill({json:{ready:true,hasSupplements:true,report:{...records[0],stale:false,proposals:[]}}});});
 await login(page);await page.locator('.account-link').click();await page.locator('#conclusion-history-link').click();const sheet=page.locator('#conclusion-dialog');await expect(sheet.locator('.conclusion-history-item')).toHaveCount(2);await expect(sheet.locator('.conclusion-history-item').first()).toContainText('Score: 0 / 100');await expect(sheet.getByRole('button',{name:'History',exact:true})).toHaveAttribute('aria-pressed','true');await sheet.getByRole('button',{name:'Load more',exact:true}).click();await expect(sheet.locator('.conclusion-history-item')).toHaveCount(3);await sheet.locator('.conclusion-history-item').nth(2).click();await expect(sheet.locator('.conclusion-result')).toContainText('Saved routine 3');await expect(sheet.locator('.conclusion-score')).toContainText('before scoring was added');await expect(sheet.locator('.conclusion-result')).not.toContainText('[S1]');await expect(sheet.locator('[data-conclusion-proposal]')).toHaveCount(0);await expect(sheet.getByRole('button',{name:'Generate again',exact:true})).toHaveCount(0);
 for(const width of [320,402,768]){await page.setViewportSize({width,height:874});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await sheet.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.screenshot({path:`.runtime/conclusion-history-${width}-${theme}.png`,animations:'disabled'});}}
 await sheet.getByRole('button',{name:'All conclusions',exact:true}).click();await expect(sheet.locator('.conclusion-history-item')).toHaveCount(3);await sheet.getByRole('button',{name:'Current conclusion',exact:true}).click();await expect(sheet.locator('.conclusion-result')).toContainText('Saved routine 1');await expect(sheet.locator('.conclusion-score>strong')).toHaveText('0 / 100');await expect(sheet.locator('.conclusion-score')).toContainText('Assessment of the supplied plan.');await page.screenshot({path:'.runtime/conclusion-score-current.png',animations:'disabled'});await sheet.locator('[data-sheet-close]').click();fail=true;await page.locator('#conclusion-history-link').click();await expect(sheet.locator('.conclusion-error')).toBeVisible();await sheet.getByRole('button',{name:'Retry',exact:true}).click();await expect(sheet.locator('.conclusion-history-item')).toHaveCount(2);
 hold=true;await sheet.locator('.conclusion-history-item').first().click();await sheet.locator('[data-sheet-close]').click();await page.locator('#logout-button').click();release();await expect(sheet).toBeHidden();await expect(page.locator('#conclusion-content')).toBeEmpty();expect(calls.every(c=>c.startsWith('GET '))).toBe(true);
});

test('navigation top layer survives Taken refresh, masked edges and modal polling without reordering',async({page})=>{
 await mock(page,{preloaded:true});await login(page);const nav=page.locator('#app-nav');expect(await nav.evaluate(n=>n.matches(':popover-open'))).toBe(true);
 await page.evaluate(()=>{window.navPromotions=0;document.querySelector('#app-nav').addEventListener('beforetoggle',()=>window.navPromotions++);document.styleSheets[document.styleSheets.length-1].insertRule('body::after{z-index:2147483647!important}');});
 for(let i=0;i<3;i++){const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/v1/dashboard'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await response;await page.keyboard.press('Escape');expect(await nav.evaluate(n=>n.matches(':popover-open'))).toBe(true);await expect(nav.locator('a')).toHaveCount(3);}
 for(const route of ['/groups','/account','/']){await nav.locator(`[data-route="${route}"]`).click();for(const fraction of [0,.5,1]){await page.locator('main').evaluate((n,f)=>n.scrollTop=(n.scrollHeight-n.clientHeight)*f,fraction);expect(await nav.evaluate(n=>[...n.querySelectorAll('a')].every(a=>{const r=a.getBoundingClientRect();return a.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height*.8));}))).toBe(true);}}
 await page.locator('.supplement-row .check-button').first().click();await expect(page.locator('.supplement-row.is-done').first()).toBeVisible();expect(await page.evaluate(()=>window.navPromotions)).toBe(0);
 await page.locator('.supplement-open').first().click();const modal=page.locator('#route-dialog');await expect(modal).toBeVisible();const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/v1/dashboard'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await response;expect(await page.evaluate(()=>window.navPromotions)).toBe(0);expect(await nav.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(false);await modal.locator('[data-sheet-close]').click();await expect(modal).toBeHidden();await expect(nav).toBeVisible();
 await page.screenshot({path:'.runtime/nav-top-layer-stress.png',animations:'disabled'});await nav.locator('[data-route="/account"]').click();await page.locator('#logout-button').click();await expect(nav).toBeHidden();expect(await nav.evaluate(n=>n.matches(':popover-open'))).toBe(false);
});
test('older browsers keep fixed navigation without popover support',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(HTMLElement.prototype,'showPopover',{configurable:true,value:undefined}));await mock(page,{preloaded:true});await login(page);const nav=page.locator('#app-nav');await expect(nav).not.toHaveAttribute('popover');await expect(nav).toHaveCSS('position','fixed');await nav.locator('[data-route="/account"]').click();await expect(nav.locator('[aria-current=page]')).toHaveAttribute('data-route','/account');await page.locator('#logout-button').click();await expect(nav).toBeHidden();
});

test('removed products remain readable in usage history without opening a missing live record',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));await mock(page,{preloaded:true});
 await page.route('https://perimove.com/supplement-api/v1/usage?*',async route=>{const q=new URL(route.request().url()).searchParams,days=[];for(let day=q.get('from');day<=q.get('to');day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10)){const items=day==='2026-10-18'?[{id:'old-deleted',name:'Previously used supplement',manufacturer:'Original brand',groupKey:'old',groupId:null,deleted:true,status:'taken',completedAt:day+'T08:10:00Z'},{id,name:'Current supplement',manufacturer:'Example',groupKey:'old',groupId:group,status:'taken',completedAt:day+'T08:20:00Z'}]:[];days.push({day,items,groups:[{key:'old',id:null,name:'Historical group',icon:'sun',position:0}],counts:{taken:items.length,missed:0,pending:0,paused:0},total:items.length,future:day>'2026-10-18'});}await route.fulfill({json:{from:q.get('from'),to:q.get('to'),today:'2026-10-18',timezone:'UTC',groups:[],days}});});
 await login(page);await page.locator('.account-link').click();await page.locator('#usage-link').click();const archived=page.locator('.usage-product-archived');await expect(archived).toContainText('Original brand');await expect(archived).toContainText('Removed from routine');expect(await archived.evaluate(n=>n.tagName)).toBe('DIV');await archived.click();await expect(page.locator('#route-dialog')).toBeHidden();
 for(const width of [320,402,768]){await page.setViewportSize({width,height:874});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await page.locator('#usage-dialog').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.screenshot({path:`.runtime/retained-usage-${width}-${theme}.png`,animations:'disabled'});}}
 await page.locator('button.usage-product').click();await expect(page.locator('#route-dialog')).toBeVisible();
});

test('Account data export selects a period and downloads a private PDF without AI calls',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));const fake=await mock(page,{preloaded:true}),bodies=[];const pdf=Buffer.from('%PDF-1.7\nExample download fixture\n%%EOF').toString('base64');
 await page.route('https://perimove.com/supplement-api/v1/exports/pdf',async route=>{const b=route.request().postDataJSON();bodies.push(b);await route.fulfill({json:{mime:'application/pdf',filename:`supplement-tracker-${b.from}-${b.to}.pdf`,pdf}});});
 await login(page);await page.locator('.account-link').click();await page.locator('#data-export-link').click();const sheet=page.locator('#data-export-dialog');await expect(sheet.locator('h2')).toHaveText('Data export');await expect(sheet.locator('[name=period]')).toHaveValue('30');await expect(sheet.locator('[type=date]')).toHaveCount(0);for(const preset of ['7','90','30']){await sheet.locator('[name=period]').selectOption(preset);await expect(sheet.locator('[type=date]')).toHaveCount(0);}await sheet.locator('[name=period]').selectOption('custom');await expect(sheet.locator('[name=from]')).toHaveValue('2026-09-19');await expect(sheet.locator('[name=to]')).toHaveValue('2026-10-18');
 await sheet.locator('[name=from]').fill('2026-10-07');await sheet.locator('[name=from]').dispatchEvent('change');await expect(sheet.locator('[name=period]')).toHaveValue('custom');
 const download=page.waitForEvent('download');await sheet.getByRole('button',{name:'Download PDF',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toBe('supplement-tracker-2026-10-07-2026-10-18.pdf');await expect(sheet.getByRole('link',{name:'Download again'})).toBeVisible();expect(bodies).toHaveLength(1);expect(bodies[0]).toMatchObject({from:'2026-10-07',to:'2026-10-18',language:'en'});expect(fake.requests.some(r=>r.method==='POST'&&r.path.includes('/conclusions'))).toBe(false);
 for(const width of [320,402,768]){await page.setViewportSize({width,height:874});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await sheet.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);expect(await sheet.locator('.export-dates').evaluate(n=>{const box=n.getBoundingClientRect();return [...n.querySelectorAll('input')].every(i=>{const r=i.getBoundingClientRect();return r.width<=box.width&&r.right<=box.right+1&&Math.round(r.height)===46;});})).toBe(true);await page.screenshot({path:`.runtime/export-sheet-${width}-${theme}.png`,animations:'disabled'});}}
 await sheet.locator('[data-sheet-close]').click();await expect(page.locator('#data-export-content')).toBeEmpty();await page.locator('#data-export-link').click();await sheet.locator('[name=to]').fill('2026-10-01');await sheet.locator('[name=to]').dispatchEvent('change');await sheet.getByRole('button',{name:'Download PDF',exact:true}).click();await expect(sheet.getByRole('alert')).toBeVisible();expect(bodies).toHaveLength(1);await sheet.locator('[data-sheet-close]').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#data-export-link').click();await expect(sheet.locator('h2')).toHaveText('Duomenų eksportas');await expect(sheet.getByRole('button',{name:'Atsisiųsti PDF'})).toBeVisible();
});
test('closing an export cancels late downloads and a server failure keeps the selected range',async({page})=>{
 await mock(page,{preloaded:true});let hold=true,release,fail=false,calls=0;const downloads=[];page.on('download',d=>downloads.push(d));await page.route('https://perimove.com/supplement-api/v1/exports/pdf',async route=>{calls++;if(hold)await new Promise(r=>release=r);await route.fulfill(fail?{status:409,json:{error:'EXPORT_BUSY'}}:{json:{mime:'application/pdf',filename:'private.pdf',pdf:Buffer.from('%PDF-1.7\n%%EOF').toString('base64')}}).catch(()=>{});});
 await login(page);await page.locator('.account-link').click();await page.locator('#data-export-link').click();const sheet=page.locator('#data-export-dialog');await sheet.getByRole('button',{name:'Download PDF',exact:true}).click();await expect(sheet.getByRole('progressbar')).toBeVisible();await expect(sheet.locator('[name=period]')).toBeDisabled();await expect(sheet.locator('[type=date]')).toHaveCount(0);await sheet.locator('[data-sheet-close]').click();release();await expect(sheet).toBeHidden();await expect(page.locator('#data-export-content')).toBeEmpty();expect(downloads).toHaveLength(0);
 hold=false;fail=true;await page.locator('#data-export-link').click();await sheet.locator('[name=period]').selectOption('custom');const from=await sheet.locator('[name=from]').inputValue();await sheet.getByRole('button',{name:'Download PDF',exact:true}).click();await expect(sheet.getByRole('alert')).toContainText('Another PDF');await expect(sheet.locator('[name=from]')).toHaveValue(from);await expect(sheet.getByRole('button',{name:'Download PDF',exact:true})).toBeEnabled();await sheet.locator('[data-sheet-close]').click();await page.locator('#logout-button').click();await expect(page.locator('#data-export-content')).toBeEmpty();expect(calls).toBe(2);
});

test('navigation fits the visible iPhone viewport when screen height is taller',async({page})=>{
 // Installed iOS can report screen.height larger than the visible app viewport.
 // Keep the verified full-height scroller, but all three tab hit targets must fit.
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});
  Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
  Object.defineProperty(screen,'height',{configurable:true,get:()=>956});
  Object.defineProperty(screen,'width',{configurable:true,get:()=>402});
 });
 await mock(page,{design:true,preloaded:true});await login(page);const nav=page.locator('#app-nav');
 expect(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--app-height'))).toBe('956px');
 for(const height of [874,792,874]){
  await page.setViewportSize({width:402,height});
  for(const route of ['/','/groups','/account']){
   await nav.locator(`[data-route="${route}"]`).click({force:true});
   for(const fraction of [0,1]){
    await page.locator('main').evaluate((n,f)=>n.scrollTop=(n.scrollHeight-n.clientHeight)*f,fraction);
    await expect.poll(()=>nav.evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom<=visualViewport.height+visualViewport.offsetTop&&r.top>=visualViewport.offsetTop;})).toBe(true);
    expect(await nav.evaluate(n=>[...n.querySelectorAll('a')].every(a=>{const r=a.getBoundingClientRect();return a.contains(document.elementFromPoint(r.x+r.width/2,r.bottom-4));}))).toBe(true);
   }
  }
  await page.screenshot({path:'.runtime/nav-visible-viewport-'+height+'.png',animations:'disabled'});
 }
 // Safari can change only VisualViewport after keyboard/chrome restoration.
 await page.evaluate(()=>{window.navTestVisible=450;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.navTestVisible});const input=document.createElement('input');input.id='nav-test-editor';document.body.append(input);input.focus();visualViewport.dispatchEvent(new Event('resize'));});
 await expect(nav).toBeHidden();
 await page.evaluate(()=>{document.querySelector('#nav-test-editor').remove();window.navTestVisible=720;visualViewport.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('pageshow'));});
 await expect(nav).toBeVisible();
 await expect.poll(()=>nav.evaluate(n=>n.getBoundingClientRect().bottom<=720)).toBe(true);
});
