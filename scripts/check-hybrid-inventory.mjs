/** Explicit paid hybrid benchmark. Original photos and both keys stay outside Git. */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createIngredientRecognition} from '../server/src/providers/grok-ingredients.mjs';
import {createJevClassification} from '../server/src/providers/jev-classification.mjs';
const dir=process.env.INVENTORY_PHOTO_DIR;
if(!dir||!process.env.PROVIDER_TEST_KEY_FILE)throw Error('Set INVENTORY_PHOTO_DIR and PROVIDER_TEST_KEY_FILE');
const browser=await chromium.launch();let images;
try{const page=await browser.newPage();images=await page.evaluate(async({source,files})=>{
 const {prepareImage}=await import('data:text/javascript;base64,'+source);const out=[];
 for(const data of files){const blob=await(await fetch('data:image/jpeg;base64,'+data)).blob();let prepared;for(const maxSide of [1800,1400,1000,700]){try{prepared=await prepareImage(blob,{maxSide,maxBytes:600000});break;}catch{}}if(!prepared)throw Error('Image preparation failed');out.push(prepared);}return out;
},{source:readFileSync('modules/src/image-input.js').toString('base64'),files:[1,2,3,4].map(i=>readFileSync(`${dir}/${i}-Photo-${i}.jpg`).toString('base64'))});}finally{await browser.close();}
const defaultGroups=[{id:'morning',name:'Morning · empty stomach'},{id:'fats',name:'With breakfast / lunch (with fats)'},{id:'meal',name:'With a meal day or evening'},{id:'evening',name:'Evening · before bed'}];
const groups=process.env.INVENTORY_CONTEXT_FILE?JSON.parse(readFileSync(process.env.INVENTORY_CONTEXT_FILE,'utf8')).groups:defaultGroups;
const expected=[/nad/i,/\bnac\b/i,/astaxanthin/i,/lysine/i,/quinone.*q10|q10/i,/selenium.*zinc/i,/^bio.zin[ck]/i,/alpha.*lipoic/i,/liposomal.*vitamin.*c/i,/magnesium.*taurate/i,/urolithin/i,/resveratrol/i,/magnesium.*bisglycinate/i,/tryptophan/i,/tomato/i,/alerten/i];

const recognize=createIngredientRecognition();
for(let run=1;run<=Number(process.env.INVENTORY_RUNS||1);run++){
 const started=Date.now();
 const recognized=await recognize({key:readFileSync(process.env.PROVIDER_TEST_KEY_FILE,'utf8').trim(),images,language:'lt',scope:process.env.CACHE_BENCHMARK?'isolated-benchmark':''});
 const grokMs=Date.now()-started;
 const classified=await createJevClassification({getKey:()=>readFileSync(process.env.TYPESAFE_TEST_KEY_FILE,'utf8')})(recognized.products,groups);
 const totalMs=Date.now()-started;
 const missing=expected.filter(re=>!classified.some(p=>re.test(p.name))).map(String);
 const report={run,cacheHit:recognized.cacheHit,grokMs,jevMs:totalMs-grokMs,totalMs,count:classified.length,missing,products:classified.map(p=>({name:p.name,manufacturer:p.manufacturer,ingredients:p.ingredients,complete:p.complete,group:groups.find(g=>g.id===p.groupId)?.name,confidence:p.groupConfidence,timing:p.timing,benefits:p.benefits.map(b=>({word:b.lt,score:b.score,confidence:b.confidence}))})),skipped:recognized.skipped};
 console.log(JSON.stringify(report));
 if(process.env.HYBRID_RESULT_FILE)writeFileSync(process.env.HYBRID_RESULT_FILE,JSON.stringify({recognized,classified,report},null,2),{mode:0o600});
 // Schedule assertions are explicit, beyond identity count; source-backed ALA
 // must not be forced into fasting merely to imitate the user's reference image.
 const kind=re=>classified.find(p=>re.test(p.name))?.timing?.groupKind;
 for(const re of [/astaxanthin/i,/quinone/i,/resveratrol/i,/tomato/i])assert.equal(kind(re),'fats');
 for(const re of [/magnesium.*taurate/i,/magnesium.*bisglycinate/i,/tryptophan/i])assert.equal(kind(re),'bed');
 assert.equal(kind(/nad/i),'fasting');assert.notEqual(kind(/alpha.*lipoic/i),'fasting');
 assert.equal(missing.length,0);assert.equal(classified.length,16);assert.ok(classified.every(p=>p.benefits.length<=5&&groups.some(g=>g.id===p.groupId)));
}
