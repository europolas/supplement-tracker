/** UI contract checks use fake accounts/provider results; never touch production DB. */
import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const group='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const user={id:'33333333-3333-4333-8333-333333333333',email:'test@example.test',name:'Test',role:'user'};
async function mock(page,{waitAnalysis=false,failAnalysis=false,batch=false,progressive=false,queue=false,fallback=false,unknownDose=false,preloaded=false,labelProduct=false}={}){
 let completed=false,added=preloaded,started=false,configured=true,release,terminalJob=null,released=false,detailsReady=!progressive;
 const uploads=[],requests=[];release=()=>{released=true;};
 await page.route('https://perimove.com/supplement-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/supplement-api','');requests.push({path,method:request.method()});
  let result={ok:true},httpStatus=200;
  const ai={configured,model:'grok-4.7',models:['grok-4.7']};
  if(path==='/health')result={ok:true,passwordRecoveryAvailable:false};
  else if(path==='/v1/login')result={token:'a'.repeat(64),expiresAt:null,user};
  else if(path==='/v1/me')result={user,expiresAt:null};
  else if(path==='/v1/settings/ai'){configured=request.method()!=='DELETE';result={...ai,configured};}
  else if(path==='/v1/supplements/jobs'&&request.method()==='POST'){started=true;if(queue){const body=request.postDataJSON();result={id:'upload-'+(uploads.length+1),status:'running',phase:uploads.length?'queued':'recognizing',language:body.language,created_at:new Date(Date.now()+uploads.length*1000).toISOString(),result:{submission:{name:body.name,kind:body.image?'photo':'name'},items:[],skipped:[]}};uploads.push(result);}else result={id:'test-job',status:'running'};}
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
  else if(path.endsWith('/completion'))completed=request.postDataJSON().completed;
  else if(path==='/v1/dashboard')result={day:new Date().toLocaleDateString('sv-SE'),groups:[{id:group,name:'With a meal',description:'Energy and everyday support'}],supplements:added?[{id,group_id:group,name:'Example <b>supplement</b>',completed,analysis:{manufacturer:'Example',dosage:{directions:'1 tablet daily',servingSize:'1 tablet'},nutrients:[{name:'Vitamin C',amount:1000,unit:'mg',amountNote:'Per tablet',reference:{amount:80,unit:'mg'},dailyAmountMin:1000,dailyAmountMax:1000,dailyPercentMin:1250,dailyPercentMax:1250}],sources:[{url:'https://manufacturer.example/label',title:'Official product label',kind:'manufacturer'}],research:{checkedAt:'2026-10-14T10:00:00Z',omittedSourceCount:1},benefitSummary:'Energy, cellular support',benefits:['A detailed explanation of the evidence, uncertainty and potential benefit that belongs only inside the supplement information page.'],howToUse:'Check the label.',whenToUse:'With food.',labelDirections:null,cautions:['Confirm suitability.'],needsReview:true,evidenceNote:'Example only.',compatibility:{summary:'Review your routine.',assessments:[]}}}]:[],ai};
  if(path==='/v1/dashboard'&&progressive&&added){const a=result.supplements[0].analysis;a.schemaVersion=detailsReady?'1.3':'draft-1';a.language='en';a.enrichment={status:detailsReady?'complete':'researching'};}
  if(path==='/v1/dashboard'&&fallback&&added){result.supplements[0].analysis.dosage={directions:null,servingSize:null,dailyServingsMin:null};result.supplements[0].analysis.doseFallback={basis:'established_adult_intake',ingredient:'Example ingredient',dailyAmountMin:25,dailyAmountMax:50,unit:'mg',sourceUrl:'https://guideline.example/reference',explanation:'General adult reference; no verified product capsule strength.'};}
  if(path==='/v1/dashboard'&&unknownDose&&added){result.supplements[0].analysis.dosage={directions:null,servingSize:null};result.supplements[0].analysis.doseFallback={basis:'unavailable',explanation:'No verified dose.'};}
  if(path==='/v1/dashboard'&&labelProduct&&added){result.supplements[0].name='Trans Resveratrolis (300 mg kapsulės, 60 vnt.)';result.supplements[0].analysis.manufacturer='L Cell';result.supplements[0].analysis.variant='300 mg kapsulės, 60 vnt.';}
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
 await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).toContainText('A detailed explanation');await expect(page.locator('#supplement-detail h1')).toHaveText('<b>supplement</b>');await expect(page.locator('#supplement-detail')).toContainText('Compatibility with your routine');await expect(page.locator('.nutrient-table')).toContainText('1,250 %');await expect(page.locator('.source-list a')).toHaveAttribute('href','https://manufacturer.example/label');await expect(page.locator('#supplement-detail')).toContainText('1 unverified extra source');
});
test('Lithuanian and light/dark/auto preferences persist and auto follows OS',async({page})=>{
 await mock(page);await page.goto('/');await expect(page.locator('#settings-form')).toBeVisible();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form [name=theme]').selectOption('dark');await page.locator('#settings-form button').click();await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','lt');await expect(page.locator('#settings-form [name=theme]')).toHaveValue('dark');
 await page.locator('#settings-form [name=theme]').selectOption('system');await page.locator('#settings-form button').click();await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('PWA caches only public assets and logout clears private screen state',async({page})=>{
 await mock(page);await login(page);await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const urls=await page.evaluate(async()=>{const all=[];for(const key of await caches.keys())for(const req of await(await caches.open(key)).keys())all.push(req.url);return all;});expect(urls.some(url=>url.includes('/supplement-api/'))).toBe(false);
 await page.locator('.account-link').click();await page.locator('#logout-button').click();await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#app-nav')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('supplement-tracker:auth'))).toBe(null);
});

test('server job resumes after reload and the next add form is usable',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('A public test product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Recognizing');await page.locator('#close-add').click();await page.reload();await expect(page.locator('#home-status')).toContainText('Recognizing');fake.release();await expect(page.locator('.supplement-row')).toHaveCount(1);await expect(page.locator('#home-status')).toHaveText('');await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('#analyze-form [name=name]')).toHaveValue('');
});
test('a failed source check shows an error and never adds an item',async({page})=>{
 await mock(page,{failAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Unconfirmed product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Nothing was added');await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('.supplement-row')).toHaveCount(0);
});
test('selected photos are re-encoded and invalid files never reach AI',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();
 await expect(page.locator('#analyze-form [name=photo]')).not.toHaveAttribute('capture');await expect(page.locator('#analyze-form [name=camera]')).toHaveAttribute('capture','environment');
 await expect(page.getByText('Choose from library',{exact:true})).toBeVisible();
 await page.locator('#analyze-form [name=photo]').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});await expect(page.locator('#analysis-status')).toContainText('readable image');await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();expect(fake.requests.some(r=>r.path==='/v1/supplements/jobs'&&r.method==='POST')).toBe(false);
 const bytes=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;canvas.getContext('2d').fillRect(0,0,20,20);return canvas.toDataURL('image/png').split(',')[1];});await page.locator('#analyze-form [name=photo]').setInputFiles({name:'label.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});await expect(page.locator('#photo-preview')).toBeVisible();await expect(page.locator('#photo-preview')).toHaveAttribute('src',new RegExp('^data:image/jpeg;base64,'));await page.locator('#remove-photo').click();await expect(page.locator('#photo-preview')).toBeHidden();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();
});

test('login persists after closing the browser and logout clears the saved session',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'tracker-auth-'));let context;
 try{
  context=await chromium.launchPersistentContext(directory,{headless:true});let page=context.pages()[0];await mock(page);await login(page);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('supplement-tracker:auth')));expect(Object.keys(stored).sort()).toEqual(['expiresAt','token']);expect(stored.expiresAt).toBe(null);
  await context.close();context=await chromium.launchPersistentContext(directory,{headless:true});page=context.pages()[0];await mock(page);await page.goto('http://127.0.0.1:4175/');await expect(page.locator('#app-nav')).toBeVisible();await expect(page.locator('#login-form')).toBeHidden();
  await page.locator('.account-link').click();await page.locator('#logout-button').click();expect(await page.evaluate(()=>localStorage.getItem('supplement-tracker:auth'))).toBe(null);
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
 await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await page.locator('#close-add').click();await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail')).toContainText('Provisional grouping');
 fake.releaseResearch();await expect(page.locator('[data-detail-section=dose]')).toContainText('1 tablet daily');await expect(page.locator('#supplement-detail')).not.toContainText('Provisional grouping');
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
 await expect(page.locator('#supplement-detail')).toContainText('Adult reference amount');await expect(page.locator('#supplement-detail')).toContainText('Example ingredient: 25–50 mg');await expect(page.locator('#supplement-detail')).toContainText('not verified manufacturer directions');await expect(page.locator('#supplement-detail a[href="https://guideline.example/reference"]')).toHaveCount(1);
});

test('detail shows only four primary sections and disclosure survives polling redraws with localized controls',async({page})=>{
 const fake=await mock(page,{progressive:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Example');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('.supplement-row')).toHaveCount(1);await page.locator('#close-add').click();await page.locator('.supplement-open').click();
 const primary=page.locator('#detail-primary'),extra=page.locator('#detail-extra-content'),toggle=page.locator('.detail-more>summary');
 await expect(primary.locator('section')).toHaveCount(4);await expect(primary.locator('h3')).toHaveText(['Dose','Potential benefits','Compatibility with your routine','When to use']);await expect(primary.locator('.nutrient-table')).toHaveCount(0);await expect(extra).toBeHidden();await expect(toggle).toHaveText('More information');await expect(page.getByRole('button',{name:'Refresh information'})).toBeHidden();
 await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveText('Less information');await expect(extra).toBeVisible();await expect(extra).toContainText('Check the label.');await expect(extra).toContainText('Confirm suitability.');
 fake.releaseResearch();await expect(page.locator('[data-detail-section=dose]')).toContainText('1 tablet daily');await expect(extra).toBeVisible();await expect(page.locator('.nutrient-table')).toBeVisible();await expect(page.locator('.source-list')).toBeVisible();
 await toggle.click();await expect(toggle).toHaveText('More information');await expect(extra).toBeHidden();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(extra).toBeHidden();
 await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.account-link').click();await page.locator('#settings-form [name=language]').selectOption('lt');await page.locator('#settings-form button').click();await page.locator('#route-dialog [data-sheet-close]').click();await page.locator('.supplement-open').click();await expect(toggle).toHaveText('Daugiau informacijos');await expect(extra).toBeHidden();await toggle.click();await expect(toggle).toHaveText('Mažiau informacijos');await expect(extra).toBeVisible();
});


test('Sage routine and routed sheets preserve scroll, Back, draft and compact unknown dose',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,{unknownDose:true,preloaded:true});await login(page);
 await expect(page.locator('#progress-count')).toHaveText('0 / 1');await page.locator('.check-button').click();await expect(page.locator('#progress-count')).toHaveText('1 / 1');await expect(page.locator('#progress-arc')).toHaveAttribute('stroke-dasharray','100 100');
 await page.screenshot({animations:'disabled',path:'.runtime/sage-home.png'});
 await page.locator('.supplement-open').click();await expect(page.locator('#route-dialog')).toBeVisible();await expect(page.locator('[data-detail-section=dose]')).toHaveText('Dosenot determined');
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
