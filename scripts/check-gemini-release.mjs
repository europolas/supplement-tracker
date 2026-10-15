/** Explicit paid release regression: real production adapter, no account/DB writes.
 * Original images stay in memory; only redacted timing and product output is saved.
 */
import {readFileSync,writeFileSync,mkdirSync,appendFileSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {createGeminiPipeline} from '../server/src/providers/gemini.mjs';
import {createGeminiStructured} from '../server/src/gemini-structured.mjs';
import {basicProductsMessages} from '../server/src/photo-products.mjs';
const out=process.env.GEMINI_CHECK_OUTPUT||'.runtime/gemini-release';mkdirSync(out,{recursive:true,mode:0o700});if(existsSync(out+'/runs.jsonl'))throw Error('Choose a new output directory to avoid accidental repeated billing');
const key=readFileSync('/home/deploy/.secrets/supplement-tracker/google_test_key','utf8').trim(),groups=JSON.parse(readFileSync('.runtime/inventory-context.json')).groups;
const browser=await chromium.launch();let images;
try{const page=await browser.newPage();images=await page.evaluate(async({source,files})=>{const{prepareImage}=await import('data:text/javascript;base64,'+source);const out=[];for(const data of files){const blob=await(await fetch('data:image/jpeg;base64,'+data)).blob();let image;for(const maxSide of [1800,1400,1000,700])try{image=await prepareImage(blob,{maxSide,maxBytes:600000});break;}catch{}if(!image)throw Error('Preparation failed');out.push(image);}return out;},{source:readFileSync('modules/src/image-input.js').toString('base64'),files:[1,2,3,4].map(i=>readFileSync(`${process.env.INVENTORY_PHOTO_DIR}/${i}-Photo-${i}.jpg`).toString('base64'))});}finally{await browser.close();}
for(let round=1;round<=Number(process.env.CHECK_ROUNDS||5);round++){
 let calls=0;const messages=basicProductsMessages({images,language:'lt',groups,supplements:[]});const provider=createGeminiStructured({fetch:async(...args)=>{calls++;const r=await fetch(...args);if(!r.ok){const d=await r.clone().json();console.error(JSON.stringify({status:r.status,message:String(d.error?.message||"").replaceAll(key,"[redacted]")}));}return r;}});const pipeline=createGeminiPipeline({provider});const start=Date.now();let r;
 try{const result=await pipeline.discover({key,messages});r={round,ms:Date.now()-start,calls,valid:true,...result};}catch(e){r={round,ms:Date.now()-start,calls,valid:false,error:e.code||e.message};}
 appendFileSync(out+'/runs.jsonl',JSON.stringify(r)+'\n',{mode:0o600});console.log(JSON.stringify({round,ms:r.ms,calls,valid:r.valid,count:r.result?.products.length,error:r.error}));
}
