/** UI contract checks use fake accounts/provider results; never touch production DB. */
import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const group='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const user={id:'33333333-3333-4333-8333-333333333333',email:'test@example.test',name:'Test',role:'user'};
async function mock(page,{waitAnalysis=false,failAnalysis=false}={}){
 let completed=false,added=false,started=false,configured=true,release;
 const gate=new Promise(resolve=>release=resolve),requests=[];
 await page.route('https://perimove.com/supplement-api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname.replace('/supplement-api','');requests.push({path,method:request.method()});
  let result={ok:true};
  const ai={configured,model:'grok-4.7',models:['grok-4.7']};
  if(path==='/health')result={ok:true,passwordRecoveryAvailable:false};
  else if(path==='/v1/login')result={token:'a'.repeat(64),expiresAt:null,user};
  else if(path==='/v1/me')result={user,expiresAt:null};
  else if(path==='/v1/settings/ai'){configured=request.method()!=='DELETE';result={...ai,configured};}
  else if(path==='/v1/supplements/jobs'&&request.method()==='POST'){started=true;result={id:'test-job',status:'running'};}
  else if(path==='/v1/supplements/jobs/test-job'){if(waitAnalysis)await gate;if(failAnalysis)result={id:'test-job',status:'failed',error_code:'AI_SOURCES_UNVERIFIED'};else{added=true;result={id:'test-job',status:'complete',supplement_id:id};}}
  else if(path==='/v1/supplements/jobs')result={job:started&&!added?{id:'test-job',status:'running'}:null};
  else if(path.endsWith('/completion'))completed=request.postDataJSON().completed;
  else if(path==='/v1/dashboard')result={day:new Date().toLocaleDateString('sv-SE'),groups:[{id:group,name:'With a meal',description:'Energy and everyday support'}],supplements:added?[{id,group_id:group,name:'Example <b>supplement</b>',completed,analysis:{manufacturer:'Example',dosage:{directions:'1 tablet daily',servingSize:'1 tablet'},nutrients:[{name:'Vitamin C',amount:1000,unit:'mg',amountNote:'Per tablet',reference:{amount:80,unit:'mg'},dailyAmountMin:1000,dailyAmountMax:1000,dailyPercentMin:1250,dailyPercentMax:1250}],sources:[{url:'https://manufacturer.example/label',title:'Official product label',kind:'manufacturer'}],research:{checkedAt:'2026-10-14T10:00:00Z'},benefits:['Everyday support'],howToUse:'Check the label.',whenToUse:'With food.',labelDirections:null,cautions:['Confirm suitability.'],needsReview:true,evidenceNote:'Example only.',compatibility:{summary:'Review your routine.',assessments:[]}}}]:[],ai};
  await route.fulfill({json:result});
 });
 return {release,requests};
}
async function login(page){await page.goto('/');await page.locator('#login-form [name=email]').fill(user.email);await page.locator('#login-form [name=password]').fill('A long example password');await page.locator('#login-form button[type=submit]').click();await expect(page.locator('#app-nav')).toBeVisible();await expect(page.locator('[data-screen="/"]')).toBeVisible();}
test('shared login opens English routine and preserves iPhone layout',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await mock(page);await login(page);
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#routine-groups h2')).toHaveText('With a meal');await expect(page.locator('.group-benefit')).toHaveText('Energy and everyday support');
 const layout=await page.evaluate(()=>({bottom:document.querySelector('main').getBoundingClientRect().bottom,height:innerHeight,scroll:getComputedStyle(document.querySelector('main')).scrollbarWidth}));expect(layout.bottom).toBe(layout.height);expect(layout.scroll).toBe('none');expect(errors).toEqual([]);
});
test('analysis disables send, reports completion and renders safe table/details',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Example manufacturer supplement');await page.locator('#analyze-form button[type=submit]').click();
 await expect(page.locator('#analyze-form button[type=submit]')).toBeDisabled();await expect(page.locator('#analysis-status')).toContainText('Searching');fake.release();await expect(page.locator('#analysis-status')).toContainText('complete');await page.locator('#close-add').click();
 await expect(page.locator('.supplement-row td:first-child button')).toHaveAttribute('aria-pressed','false');await page.locator('.check-button').click();await expect(page.locator('.supplement-row')).toHaveClass(/is-done/);await expect(page.locator('#today-progress')).toContainText('1 of 1');await expect(page.locator('.supplement-row b')).toHaveCount(0);
 await page.locator('.supplement-open').click();await expect(page.locator('#supplement-detail h1')).toHaveText('Example <b>supplement</b>');await expect(page.locator('#supplement-detail')).toContainText('Compatibility with your routine');await expect(page.locator('.nutrient-table')).toContainText('1,250 %');await expect(page.locator('.source-list a')).toHaveAttribute('href','https://manufacturer.example/label');
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
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('A public test product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Searching');await page.locator('#close-add').click();await page.reload();await expect(page.locator('#home-status')).toContainText('Searching');fake.release();await expect(page.locator('.supplement-row')).toHaveCount(1);await expect(page.locator('#home-status')).toHaveText('');await page.locator('#add-supplement').click();await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('#analyze-form [name=name]')).toHaveValue('');
});
test('a failed source check shows an error and never adds an item',async({page})=>{
 await mock(page,{failAnalysis:true});await login(page);await page.locator('#add-supplement').click();await page.locator('#analyze-form [name=name]').fill('Unconfirmed product');await page.locator('#analyze-form button[type=submit]').click();await expect(page.locator('#analysis-status')).toContainText('Nothing was added');await expect(page.locator('#analyze-form button[type=submit]')).toBeEnabled();await expect(page.locator('.supplement-row')).toHaveCount(0);
});
test('selected photos are re-encoded and invalid files never reach AI',async({page})=>{
 const fake=await mock(page,{waitAnalysis:true});await login(page);await page.locator('#add-supplement').click();
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
