/** UI contract checks use fake accounts/provider results; never touch production DB. */
import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const group='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const user={id:'33333333-3333-4333-8333-333333333333',email:'test@example.test',name:'Test',role:'user'};
async function mock(page,{waitAnalysis=false,failAnalysis=false,batch=false,progressive=false,queue=false,fallback=false,unknownDose=false,preloaded=false,labelProduct=false,conflict=false,basic=false,groupReview=false,hybrid=false,gemini=false,compatibilityMode='',partialDiagnostics=false,localization=false,detailFailed=false,design=false,compactReport=false,routine=false}={}){
 let localeReady=false,completed=false,added=preloaded,started=hybrid||gemini,configured=true,release,terminalJob=null,researchRequested=false,reviewApplied=false,released=false,detailsReady=!progressive;
 let routineStarted=false,routineReady=false;const routineDecisions=new Map(),routineGroups=new Map(),routineJob='99999999-9999-4999-8999-999999999999',routineIds=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
 let customGroupIcon='',groupOrder=[];const uploads=[],requests=[];release=()=>{released=true;};
 await page.route('https://perimove.com/supplement-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/supplement-api','');requests.push({path,method:request.method()});
  let result={ok:true},httpStatus=200;
  const ai={configured,model:gemini?'gemini-3.8-flash':'grok-4.7',models:[gemini?'gemini-3.8-flash':'grok-4.7']};
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
  if(path==='/v1/dashboard'&&groupOrder.length)result.groups.sort((a,b)=>groupOrder.indexOf(a.id)-groupOrder.indexOf(b.id));
  await route.fulfill({status:httpStatus,json:result});
 });
 return {release,requests,uploads,releaseRecheck:()=>{routineReady=true;},releaseResearch:()=>{detailsReady=true;}};
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
 await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).toContainText('A detailed explanation');await expect(page.locator('#supplement-detail h1')).toHaveText('<b>supplement</b>');await expect(page.locator('#supplement-detail')).not.toContainText('Compatibility with your routine');await expect(page.locator('.composition-list')).toContainText('Vitamin C · 1,000 mg');await expect(page.locator('.source-list a')).toHaveAttribute('href','https://manufacturer.example/label');await expect(page.locator('.doctor-note')).toHaveCount(0);
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
 await page.locator('#toggle-upload-queue').click();await page.locator('#analysis-results .upload-product-button:enabled').click();await expect(page.locator('#supplement-detail h1')).toBeVisible();await page.reload();await expect(page.locator('#app-nav')).toBeVisible();await expect(page.locator('#route-dialog')).toBeHidden();await expect(page.locator('#home-report,#home-analysis-results')).toHaveCount(0);await page.locator('#add-supplement').click();await expect(page.locator('#analysis-results')).toContainText('Brand is blurred.');await page.locator('#close-add').click();await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#analysis-results')).toBeEmpty();
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
 }
 await page.setViewportSize({width:402,height:874});await page.locator('main').evaluate(n=>n.scrollTop=0);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:34,right:0}});
 const iphone=await nav.boundingBox();expect(Math.round(874-iphone.y-iphone.height)).toBe(20);
 await page.screenshot({path:'.runtime/navigation-lowered-iphone.png',animations:'disabled'});
 await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:0}});
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.screenshot({path:'.runtime/bottom-nav-'+theme+'.png',animations:'disabled'});}
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
 await expect(page.locator('#ai-settings')).toHaveCount(0);await expect(page.locator('#account-tools #connection-editor')).toHaveCount(1);const sizing=await page.evaluate(()=>[...document.querySelectorAll('#settings-form select')].map(n=>({font:getComputedStyle(n).fontSize,rowFont:getComputedStyle(n.closest('label')).fontSize,height:n.closest('label').getBoundingClientRect().height})));for(const value of sizing){expect(value.font).toBe(value.rowFont);expect(value.height).toBe(44);}await expect(page.locator('#preferences')).toHaveCSS('padding-bottom','6px');
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
 await buttons.nth(0).click();await expect(page.locator('#supplement-detail h1')).toHaveText('Ready product');
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
