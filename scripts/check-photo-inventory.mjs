/** Opt-in paid regression for the supplied four-photo, sixteen-product fixture.
 * Photos/key remain outside Git; images pass through the real browser compressor.
 * Runs two independent single-call recognitions, never touches accounts or DB. */
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {basicProductsMessages,basicProductsSchema,validBasicProducts,uniqueProducts} from '../server/src/photo-products.mjs';
import {createStructuredOutput} from '../server/src/structured-research.mjs';
import {createPhotoInventoryDiscovery} from '../server/src/photo-inventory.mjs';
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
for(let run=1;run<=Number(process.env.INVENTORY_RUNS||2);run++){
 const started=Date.now(),response=await createPhotoInventoryDiscovery(createStructuredOutput({timeout:90000,reasoningEffort:'none'}))({key:readFileSync(process.env.PROVIDER_TEST_KEY_FILE,'utf8').trim(),model:'grok-4.3',messages:basicProductsMessages({images,groups,language:'lt'}),schema:basicProductsSchema(groups,'lt'),validate:v=>validBasicProducts(v,groups,'lt'),name:'supplement_basics_v1',maxTokens:5000});
 const products=uniqueProducts(response.result.products),missing=expected.filter(re=>!products.some(p=>re.test(p.name))).map(String);
 console.log(JSON.stringify({run,inventory:response.inventory,count:products.length,ms:Date.now()-started,missing,products:products.map(p=>({name:`${p.manufacturer}: ${p.name}`,group:groups.find(g=>g.id===p.groupId)?.name})),skipped:response.result.skipped}));
 assert.equal(missing.length,0);assert.equal(products.length,16);
}
