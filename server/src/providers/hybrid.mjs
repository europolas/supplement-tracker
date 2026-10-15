/** Explicit Grok extraction -> Jev classification; legacy Grok factory is retained.
 * Both credentials stay server-only. No second Grok review or automatic research.
 * Metadata travels separately from the legacy compact result and is saved atomically.
 */
import {createIngredientRecognition} from './grok-ingredients.mjs';
import {createJevClassification} from './jev-classification.mjs';
import {createStructuredResearch} from '../structured-research.mjs';
import {productIdentity} from '../photo-products.mjs';
export function createHybridPipeline({getJevKey,recognize=createIngredientRecognition(),classify=createJevClassification({getKey:getJevKey}),models=['grok-4.7']}={}){
 return {chat:createStructuredResearch(),review:null,discoveryModel:'grok-4.7',models,discover:async input=>{
 const text=input.messages[1].content.find(p=>p.type==='text').text,context=JSON.parse(text);
 const images=input.messages[1].content.filter(p=>p.type==='image_url').map(p=>p.image_url.url),language=context.responseLanguage==='lt'?'lt':'en';
 const start=Date.now();await input.onMetrics?.({pipeline:'grok-jev',stage:'grok',startedAt:new Date(start).toISOString(),grokModel:input.model,jevModel:'jev-1.14.0',photoCount:images.length,grokCalls:1,jevCalls:0});
 const recognized=await recognize({key:input.key,model:input.model,name:context.productName,images,language,cache:input.compositionCache||[],scope:input.cacheScope||''});const grokMs=Date.now()-start;
 // Recheck ownership/job existence before the next provider is billed.
 await input.beforeClassification?.();
 await input.onMetrics?.({stage:'jev',grokMs,grokCacheHit:Boolean(recognized.cacheHit),grokCalls:recognized.cacheHit?0:1,recognized:recognized.products.length,completeComposition:recognized.products.filter(p=>p.complete).length,partialComposition:recognized.products.filter(p=>!p.complete&&p.ingredients.length).length,unknownComposition:recognized.products.filter(p=>!p.ingredients.length).length});
 const classified=await classify(recognized.products,context.groups,async update=>input.onMetrics?.(update));
 await input.onMetrics?.({stage:'saving',jevMs:Date.now()-start-grokMs,totalMs:Date.now()-start});
 const metadata=Object.fromEntries(classified.map(p=>[productIdentity(p),{composition:{ingredients:p.ingredients,complete:p.complete,basis:p.basis,checkedAt:new Date().toISOString()},benefitTags:p.benefits.map(({id,en,lt,score,confidence})=>({id,en,lt,score,confidence})),classification:{provider:'typesafe',model:p.jevModel,groupConfidence:p.groupConfidence,vocabularyVersion:1,timing:p.timing}}]));
 return {result:{language,products:classified.map(p=>({name:p.name,manufacturer:p.manufacturer,groupId:p.groupId,benefit:(p.benefits.slice(0,2).map(b=>b[language]).join(', ')||(language==='lt'?'Nauda nenustatyta':'Benefits unknown')).split(/\s+/).slice(0,6).join(' ').slice(0,80)})),skipped:recognized.skipped},model:recognized.model,inventory:recognized.inventory,productMetadata:metadata,timings:{grokMs,jevMs:Date.now()-start-grokMs,totalMs:Date.now()-start},pipeline:'grok-jev'};
 }};
}
