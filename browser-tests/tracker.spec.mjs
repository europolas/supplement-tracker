/** UI contract checks use fake accounts/provider results; never touch production DB. */
import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const group='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const user={id:'33333333-3333-4333-8333-333333333333',email:'test@example.test',name:'Test',role:'user'};
async function mock(page,{waitAnalysis=false,failAnalysis=false,batch=false,progressive=false,queue=false,fallback=false,unknownDose=false,preloaded=false,labelProduct=false,conflict=false,basic=false,groupReview=false,hybrid=false,gemini=false,compatibilityMode='',partialDiagnostics=false}={}){
 let completed=false,added=preloaded,started=hybrid||gemini,configured=true,release,terminalJob=null,researchRequested=false,reviewApplied=false,released=false,detailsReady=!progressive;
 let customGroupIcon='';const uploads=[],requests=[];release=()=>{released=true;};
 await page.route('https://perimove.com/supplement-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/supplement-api','');requests.push({path,method:request.method()});
  let result={ok:true},httpStatus=200;
  const ai={configured,model:gemini?'gemini-3.8-flash':'grok-4.7',models:[gemini?'gemini-3.8-flash':'grok-4.7']};
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
  if(path==='/v1/dashboard'&&basic&&added){const a=result.supplements[0].analysis;a.schemaVersion='basic-1';a.enrichment={status:researchRequested?'researching':'complete'};}
  if(groupReview&&path==='/v1/dashboard'){result.groups.push({id:'55555555-5555-4555-8555-555555555555',name:'With fats'});if(reviewApplied&&result.supplements.length)result.supplements[0].group_id=result.groups[1].id;}
  if(groupReview&&result.job?.status==='complete'){result.job.total_count=1;result.job.result={items:[{id,name:'Vitamin',status:'added',research:'complete'}],review:{status:reviewApplied?'applied':'ready',groups:[{id:group,name:'With a meal'},{id:'55555555-5555-4555-8555-555555555555',name:'With fats'}],changes:[{id}],assessments:[{id,name:'Vitamin',from:group,to:'55555555-5555-4555-8555-555555555555',reason:'Manufacturer recommends a fat-containing meal.',sourceUrl:'https://manufacturer.example/timing'}]}};}
  if(hybrid&&path==='/v1/dashboard'&&added){const a=result.supplements[0].analysis;a.schemaVersion='basic-1';a.composition={ingredients:[{name:'Vitamin C',labelAmount:''}],complete:false};a.benefitTags=[{id:'immunity',en:'Immunity',lt:'Imunitetas'},{id:'antioxidant',en:'Antioxidant',lt:'Antioksidantas'}];}
  if(gemini&&result.job){Object.assign(result.job,{created_at:'2026-10-16T10:00:00Z',finished_at:'2026-10-16T10:00:10Z',total_count:16,result:{items:[],monitor:{pipeline:'gemini-single',model:'gemini-3.8-flash',geminiMs:10000,totalMs:10000,recognized:16,calls:1,inputTokens:4000,outputTokens:1000,thinkingTokens:100}}});result.recent=[result.job];}
  if(partialDiagnostics&&result.job){Object.assign(result.job,{status:'complete',error_code:null,result:{monitor:{pipeline:'gemini-single',model:'gemini-3.8-flash',calls:1,autoResearch:true},timings:{geminiMs:7980,detailsMs:185090,totalMs:193070},items:[{name:'Successful product',research:'complete'},{name:'Failed Q10',research:'failed',error:'AI_INVALID_RESPONSE'}]}});result.recent=[result.job];}
  if(hybrid&&result.job){Object.assign(result.job,{created_at:'2026-10-15T10:00:00Z',finished_at:'2026-10-15T10:00:15Z',total_count:16,result:{items:[],monitor:{pipeline:'grok-jev',grokModel:'grok-4.7',jevModel:'jev-1.14.0',grokCacheHit:true,grokMs:12000,jevMs:1000,totalMs:13000,recognized:16,grokCalls:1,jevCompleted:4,jevBatches:4,questions:1616,jevInputTokens:12345,completeComposition:0,partialComposition:15,unknownComposition:1}}});result.recent=[result.job];}
  await route.fulfill({status:httpStatus,json:result});
 });
 return {release,requests,uploads,releaseResearch:()=>{detailsReady=true;}};
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
 await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).toContainText('A detailed explanation');await expect(page.locator('#supplement-detail h1')).toHaveText('<b>supplement</b>');await expect(page.locator('#supplement-detail')).not.toContainText('Compatibility with your routine');await expect(page.locator('.composition-list')).toContainText('Vitamin C · 1,000 mg');await expect(page.locator('.source-list a')).toHaveAttribute('href','https://manufacturer.example/label');await expect(page.locator('.doctor-note')).toHaveText('Consult a doctor before using each supplement.');
});
test('Lithuanian and light/dark/auto preferences persist and auto follows OS',async({page})=>{
 await mock(page);await page.goto('/');await expect(page.locator('#settings-form')).toBeVisible();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#settings-form button').click();await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('#settings-form [name=theme]')).toHaveValue('dark');
 await page.locator('#settings-form [name=theme]').selectOption('system');await page.locator('#settings-form button').click();await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('PWA caches only public assets and logout clears private screen state',async({page})=>{
 await mock(page);await login(page);await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const urls=await page.evaluate(async()=>{const all=[];for(const key of await caches.keys())for(const req of await(await caches.open(key)).keys())all.push(req.url);return all;});expect(urls.some(url=>url.includes('/supplement-api/'))).toBe(false);
 await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#app-nav')).toBeHidden();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('supplement-tracker:auth'))).toBe(null);
});

test('server job resumes after reload and the next add form is usable',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('A public test product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Recognizing');await page.locator('#close-add').click();await page.reload();await expect(page.locator('#home-status')).toContainText('Recognizing');fake.release();await expect(page.locator('.supplement-row')).toHaveCount(1);await expect(page.locator('#home-status')).toHaveText('');await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('#analyze-form [name=name]')).toHaveValue('');
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
 await page.locator('#analysis-results button').click();await expect(page.locator('#supplement-detail h1')).toBeVisible();await page.reload();await expect(page.locator('#home-analysis-results')).toContainText('Brand is blurred.');await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#home-analysis-results')).toBeEmpty();await expect(page.locator('#analysis-results')).toBeEmpty();
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
 await expect(primary.locator('section')).toHaveCount(3);await expect(primary.locator('h3')).toHaveText(['Composition','Usage','Potential benefits']);await expect(primary.locator('.nutrient-table')).toHaveCount(0);await expect(extra).toBeHidden();await expect(toggle).toHaveText('More information');await expect(page.getByRole('button',{name:'Refresh information'})).toBeHidden();
 await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveText('Less information');await expect(extra).toBeVisible();await expect(primary).toContainText('Check the label.');await expect(page.locator('#supplement-detail')).not.toContainText('Confirm suitability.');
 await page.screenshot({path:'.runtime/focused-details.png',animations:'disabled'});fake.releaseResearch();await expect(page.locator('[data-detail-section=dose]')).toContainText('1 tablet daily');await expect(extra).toBeVisible();await expect(page.locator('.composition-list')).toBeVisible();await expect(page.locator('.source-list')).toBeVisible();
 await toggle.click();await expect(toggle).toHaveText('More information');await expect(extra).toBeHidden();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(extra).toBeHidden();
 await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form button').click();await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.supplement-open').click();await expect(toggle).toHaveText('Daugiau informacijos');await expect(page.locator('.doctor-note')).toHaveText('Dėl kiekvieno papildo vartojimo būtina pasitarti su gydytoju.');await expect(primary.locator('h3')).toHaveText(['Sudėtis','Vartojimas','Galima nauda']);await expect(extra).toBeHidden();await toggle.click();await expect(toggle).toHaveText('Mažiau informacijos');await expect(extra).toBeVisible();
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
 await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#settings-form button').click();await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.supplement-open').click();await expect(page.locator('.dose-unknown em')).toHaveText('nenustatyta');await page.screenshot({animations:'disabled',path:'.runtime/sage-detail-dark.png'});
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
 await page.locator('.supplement-open').click();await expect(page.locator('[data-detail-section=compatibility]')).toHaveCount(0);await expect(page.locator('.doctor-note')).toHaveText('Consult a doctor before using each supplement.');
 await page.screenshot({animations:'disabled',path:'.runtime/speed-warning-detail.png'});
});

 test('compact product only requests details on explicit click and disables the pending action',async({page})=>{
 const m=await mock(page,{preloaded:true,basic:true,labelProduct:true});await login(page);await expect(page.locator('#routine-note')).toBeHidden();await page.locator('.supplement-open').click();await expect(page.locator('#detail-primary section')).toHaveCount(1);await expect(page.locator('[data-detail-section=benefits]')).toContainText('Energy, cellular support');await expect(page.getByRole('button',{name:'Refresh information'})).toBeHidden();await expect(page.locator('#route-dialog')).toBeVisible();await expect.poll(()=>page.locator('#route-dialog').evaluate(d=>d.getAnimations().length)).toBe(0);await page.screenshot({path:'.runtime/basic-detail.png',animations:'disabled'});expect(m.requests.filter(r=>r.path.endsWith('/research'))).toHaveLength(0);await page.locator('.detail-more>summary').click();const action=page.getByRole('button',{name:'Refresh information'});await action.click();await expect(action).toBeDisabled();expect(m.requests.filter(r=>r.path.endsWith('/research'))).toHaveLength(1);
 });

test('account clear requires confirmation, removes supplements and keeps groups',async({page})=>{
 const m=await mock(page,{preloaded:true,basic:true});await login(page);await page.locator('.account-link').click();await page.locator('#clear-supplements').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(m.requests.filter(r=>r.method==='DELETE'&&r.path==='/v1/supplements')).toHaveLength(0);
 await page.locator('#clear-supplements').click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.locator('.supplement-open')).toHaveCount(0);expect(m.requests.filter(r=>r.method==='DELETE'&&r.path==='/v1/supplements')).toHaveLength(1);await expect(page.locator('.group-block')).toHaveCount(1);await page.screenshot({path:'.runtime/clear-account.png',animations:'disabled'});
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
 const m=await mock(page,{basic:true,groupReview:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Vitamin');await page.locator('#analyze-form button[type=submit]').click();const review=page.locator('#analysis-results .group-review');await expect(review).toContainText('With a meal → With fats');await expect(review.locator('a')).toHaveAttribute('href','https://manufacturer.example/timing');expect(m.requests.filter(r=>r.path.endsWith('/apply-groups'))).toHaveLength(0);await review.scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/group-review-preview.png',animations:'disabled'});await review.getByRole('button',{name:'Apply suggested group changes'}).click();await expect(review).toContainText('Group changes applied.');expect(m.requests.filter(r=>r.path.endsWith('/apply-groups'))).toHaveLength(1);
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
 await page.evaluate(()=>location.hash='/account');await page.locator('#settings-form select[name="language"]').selectOption('lt');await page.locator('#settings-form button').click();await page.locator('#diagnostics-link').click();await expect(page.locator('#route-title')).toHaveText('AI diagnostika');await expect(page.locator('#ai-dashboard')).toContainText('Atpažinti produktai');
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

test('restrictions and the full-width refresh action stay inside the disclosure',async({page})=>{
 await mock(page,{preloaded:true,compatibilityMode:'benign',labelProduct:true});await login(page);await page.locator('.supplement-open').click();
 const restrictions=page.locator('[data-detail-section=restrictions]'),more=page.locator('.detail-more'),action=page.locator('.detail-research-button');
 await expect(page.locator('#detail-primary section')).toHaveCount(3);await expect(restrictions).toBeHidden();await expect(more.locator('[data-detail-section=restrictions]')).toHaveCount(1);
 await expect(action).toHaveText('Refresh information');await expect(action).toBeHidden();await more.locator('summary').click();await expect(action).toBeVisible();await expect(action).toBeEnabled();
 expect(await action.evaluate(n=>n.parentElement.id==='detail-extra-content')).toBe(true);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const width of [320,402]){
   await page.setViewportSize({width,height:874});await action.scrollIntoViewIfNeeded();
   const sizes=await action.evaluate(n=>({button:n.getBoundingClientRect().width,container:n.parentElement.getBoundingClientRect().width,gap:n.getBoundingClientRect().top-n.previousElementSibling.getBoundingClientRect().bottom,overflow:n.closest('dialog').scrollWidth>n.closest('dialog').clientWidth}));
   expect(Math.abs(sizes.button-sizes.container)).toBeLessThan(1);expect(sizes.gap).toBeGreaterThanOrEqual(12);expect(sizes.overflow).toBe(false);
   await page.screenshot({path:`.runtime/detail-actions-${theme}-${width}.png`,animations:'disabled'});
  }
 }
 await expect(restrictions).toBeVisible();await expect(restrictions).toContainText('Confirm suitability.');await action.scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/detail-actions-expanded.png',animations:'disabled'});
 await more.locator('summary').click();await expect(restrictions).toBeHidden();await expect(action).toBeHidden();
});
