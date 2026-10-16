import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiStructured} from '../src/gemini-structured.mjs';
import {createGeminiPipeline,validGeminiProducts,geminiPrompt} from '../src/providers/gemini.mjs';
import {basicProductsMessages} from '../src/photo-products.mjs';
const groups=[{id:'g1',name:'With food',description:''}];
const result={products:[{name:'Vitamin C',manufacturer:'NOW',ingredients:['Vitamin C'],groupId:'g1',benefit:'Immunity, collagen'}]};
test('Gemini single request carries images, context, language and ingredients without JEV/search',async()=>{
 let calls=0;const provider=createGeminiStructured({fetch:async(url,options)=>{calls++;assert.match(url,/gemini-3.8-flash:generateContent$/);assert.equal(options.headers['x-goog-api-key'],'private-key');const body=JSON.parse(options.body);assert.equal(body.tools,undefined);assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'LOW');assert.match(body.systemInstruction.parts[0].text,/Lithuanian/);assert.doesNotMatch(body.contents[0].parts[0].text,/reviewedDirections/);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}],modelVersion:'gemini-3.8-flash',usageMetadata:{promptTokenCount:100}});}});
 const pipeline=createGeminiPipeline({provider});assert.equal(pipeline.review,null);assert.equal(pipeline.credentialProvider,'google');const metrics=[];const out=await pipeline.discover({key:'private-key',messages:basicProductsMessages({name:'NOW Vitamin C',language:'lt',groups,supplements:[]}),onMetrics:m=>metrics.push(m)});assert.equal(calls,1);assert.equal(out.result.products.length,1);assert.equal(out.result.products[0].groupId,'g1');assert.equal(metrics[0].calls,1);assert.equal(metrics.at(-1).inputTokens,100);assert.equal(Object.values(out.productMetadata)[0].composition.complete,false);
});
test('foreign groups, duplicates, missing composition and oversized text are rejected',()=>{
 assert.equal(validGeminiProducts(result,groups),true);for(const change of [{groupId:'foreign'},{ingredients:null},{name:'x'.repeat(251)}])assert.equal(validGeminiProducts({products:[{...result.products[0],...change}]},groups),false);assert.equal(validGeminiProducts({products:[result.products[0],result.products[0]]},groups),false);assert.match(geminiPrompt(),/English/);assert.match(geminiPrompt(),/exactly one existing group/);
});
test('provider failures are bounded, sanitized and never retried',async()=>{
 for(const [status,code] of [[400,'AI_PROVIDER_FAILED'],[403,'AI_KEY_REJECTED'],[429,'AI_RATE_LIMITED']]){let calls=0;const provider=createGeminiStructured({fetch:async()=>{calls++;return new Response('secret provider body',{status});}});await assert.rejects(provider({key:'secret',messages:[{role:'user',content:'test'}],schema:{},validate:()=>true}),e=>e.code===code);assert.equal(calls,1);}
});
test('known exact manufacturer food constraint is applied after recognition, never prompted',async()=>{
 const gs=[{id:'fast',name:'Morning empty stomach'},{id:'meal',name:'With a meal'}];let prompt;
 const pipeline=createGeminiPipeline({provider:async input=>{prompt=JSON.stringify(input.messages);return {result:{products:[{name:'Alpha Lipoic Acid 600 mg',manufacturer:'NOW',ingredients:['Alpha lipoic acid'],groupId:'fast',benefit:'Antioxidant, energy'}]}};}});
 const out=await pipeline.discover({key:'test',messages:basicProductsMessages({name:'label',language:'en',groups:gs,supplements:[]})});assert.equal(out.result.products[0].groupId,'meal');assert.doesNotMatch(prompt,/NOW|ALA 600|reviewedDirections|Pharma Nord/);
});
test('full research searches only selected identity and extracts with private routine context afterwards',async()=>{
 const {createGeminiResearch}=await import('../src/providers/gemini.mjs');let searched;
 const research=createGeminiResearch({search:async input=>{searched=JSON.stringify(input.messages);assert.doesNotMatch(searched,/Private routine|owner-id|private-group/);return {result:{text:'Public evidence'},citations:['https://manufacturer.example/label'],searches:1};},extract:async input=>{assert.match(JSON.stringify(input.messages),/Private routine/);return {result:{ok:true}};}});
 const out=await research({messages:[{role:'system',content:'policy'},{role:'user',content:[{type:'text',text:JSON.stringify({productName:'Public product',selectedTarget:{name:'Public product',groupId:'private-group'},existingSupplements:[{id:'owner-id',name:'Private routine'}]})}]}]});assert.equal(out.result.ok,true);assert.equal(out.citations[0],'https://manufacturer.example/label');
});
test('full details contract returns sparse severe alerts and owned group choices',async()=>{
 const {detailsSchema,detailsMessages}=await import('../src/product-details.mjs');const supplements=[{id:'owned',name:'Other product',analysis:{manufacturer:'Other',nutrients:[]}}];
 const schema=detailsSchema([],'lt',supplements,true);assert.equal(schema.properties.compatibility.properties.assessments.minItems,0);assert.equal(schema.properties.compatibility.properties.assessments.items.properties.supplementId.enum[0],'owned');assert.ok(schema.properties.cautions.maxItems>0);assert.deepEqual(schema.properties.groupId.enum,[null]);const prompt=detailsMessages({name:'Unknown brand product',language:'lt',supplements,full:true});assert.match(prompt[0].content,/when manufacturer\/brand is missing/);assert.doesNotMatch(prompt[0].content,/No routine compatibility analysis/);
});

test('exact Extra Strength identity without printed strength avoids fasting and recognizes flexible groups',async()=>{
 const gs=[{id:'fast',name:'Morning · empty stomach'},{id:'fat',name:'Meals · with fats'},{id:'any',name:'Any time day or evening'},{id:'bed',name:'Before bed without food'}];
 const pipeline=createGeminiPipeline({provider:async()=>({result:{products:[{name:'Extra Strength Alpha Lipoic Acid',manufacturer:'NOW',ingredients:['Alpha lipoic acid'],groupId:'fast',benefit:'Antioxidant, energy'}]}})});
 const out=await pipeline.discover({key:'test',messages:basicProductsMessages({name:'label',language:'en',groups:gs,supplements:[]})});assert.equal(out.result.products[0].groupId,'any');
 assert.match(geminiPrompt(),/Never select a fasting group for a product recommended with food/);
});
