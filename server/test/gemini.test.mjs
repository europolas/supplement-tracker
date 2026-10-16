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
 assert.equal(validGeminiProducts(result,groups),true);for(const change of [{groupId:'foreign'},{ingredients:null},{name:'x'.repeat(251)}])assert.equal(validGeminiProducts({products:[{...result.products[0],...change}]},groups),false);assert.equal(validGeminiProducts({products:[result.products[0],result.products[0]]},groups),false);assert.match(geminiPrompt(),/English/);assert.match(geminiPrompt(),/exactly ONE supplied group/);
});
test('provider failures are bounded, sanitized and never retried',async()=>{
 for(const [status,code] of [[400,'AI_PROVIDER_FAILED'],[403,'AI_KEY_REJECTED'],[429,'AI_RATE_LIMITED']]){let calls=0;const provider=createGeminiStructured({fetch:async()=>{calls++;return new Response('secret provider body',{status});}});await assert.rejects(provider({key:'secret',messages:[{role:'user',content:'test'}],schema:{},validate:()=>true}),e=>e.code===code);assert.equal(calls,1);}
});
test('recognition preserves the AI group for any product without server product rules',async()=>{
 const gs=[{id:'fast',name:'Morning empty stomach'},{id:'meal',name:'With a meal'}];
 const pipeline=createGeminiPipeline({provider:async()=>({result:{products:[{name:'Alpha Lipoic Acid 600 mg',manufacturer:'NOW',ingredients:['Alpha lipoic acid'],groupId:'fast',benefit:'Antioxidant, energy'}]}})});
 const out=await pipeline.discover({key:'test',messages:basicProductsMessages({name:'label',language:'en',groups:gs,supplements:[]})});assert.equal(out.result.products[0].groupId,'fast');assert.doesNotMatch(geminiPrompt(),/NOW|Pharma Nord|ALERTEN/);
});
test('full research searches only selected identity and extracts with private routine context afterwards',async()=>{
 const {createGeminiResearch}=await import('../src/providers/gemini.mjs');let searched;
 const research=createGeminiResearch({search:async input=>{searched=JSON.stringify(input.messages);assert.doesNotMatch(searched,/Private routine|owner-id|private-group/);return {result:{text:'Public evidence'},citations:['https://manufacturer.example/label'],searches:1};},extract:async input=>{assert.match(JSON.stringify(input.messages),/Private routine/);return {result:{ok:true}};}});
 const out=await research({messages:[{role:'system',content:'policy'},{role:'user',content:[{type:'text',text:JSON.stringify({productName:'Public product',selectedTarget:{name:'Public product',groupId:'private-group'},existingSupplements:[{id:'owner-id',name:'Private routine'}]})}]}]});assert.equal(out.result.ok,true);assert.equal(out.citations[0],'https://manufacturer.example/label');
});
test('details contract excludes restrictions and all other routine products',async()=>{
 const {detailsSchema,detailsMessages}=await import('../src/product-details.mjs');const schema=detailsSchema([],'lt',[{id:'private'}],true);
 assert.equal(schema.properties.compatibility.properties.assessments.maxItems,0);assert.equal(schema.properties.cautions.maxItems,0);
 const prompt=detailsMessages({name:'Product',language:'lt',target:{name:'Product',groupingBasis:'manual',groupId:'private'},groups:[{id:'private',name:'Private group'}],supplements:[{id:'secret',name:'Other supplement'}],full:true});assert.doesNotMatch(JSON.stringify(prompt),/private|secret|Other supplement|group|compatibility|cautions/i);
});

test('compact research transports only product facts and optional AI timing, then expands local fields',async()=>{
 const {detailsMessages,detailsSchema,validDetails}=await import('../src/product-details.mjs'),{createGeminiResearch}=await import('../src/providers/gemini.mjs');
 for(const manual of [true,false]){
  const groups=[{id:'meal',name:'Private meal group'}],target={name:'Example',manufacturer:'Brand',groupId:'meal',groupingBasis:manual?'manual':'provisional'};
  const research=createGeminiResearch({search:async input=>{assert.doesNotMatch(JSON.stringify(input.messages),/group|interaction|contraindication/i);return {result:{text:'Official facts'},citations:['https://manufacturer.example/label']};},extract:async input=>{
   const all=JSON.stringify({messages:input.messages,schema:input.schema});assert.doesNotMatch(all,/compatibility|cautions|doseFallback|existingSupplements|evidenceNote/);
   if(manual)assert.doesNotMatch(all,/group|reviewReason/i);else assert.match(all,/Private meal group/);
   const raw={identified:true,productName:'Example',manufacturer:'Brand',variant:null,nutrients:[],dosage:{directions:'One tablet with a meal daily.',servingSize:'One tablet',dailyServingsMin:1,dailyServingsMax:1,sourceUrl:'S1'},benefits:['Short benefit.'],benefitSummary:'Energy, cells',sources:[{url:'S1',title:'Official product',kind:'manufacturer'}],...(!manual?{groupId:'meal',reviewReason:'Manufacturer recommends a meal.'}:{})};assert.equal(input.validate(raw),true);return {result:raw};
  }});
  const out=await research({name:'supplement_product_details',messages:detailsMessages({name:'Example',language:'en',target,groups,full:true}),schema:detailsSchema(manual?[]:groups,'en',[],!manual),validate:v=>validDetails(v,manual?[]:groups,'en',[],!manual)});
  assert.equal(out.result.compatibility.assessments.length,0);assert.equal(out.result.cautions.length,0);assert.equal(out.result.groupId,manual?null:'meal');assert.equal(out.result.dosage.sourceUrl,'https://manufacturer.example/label');
 }
});

test('invalid focused extraction is repaired once from the same evidence; key failures are not retried',async()=>{
 const {createGeminiResearch}=await import('../src/providers/gemini.mjs'),{detailsMessages,detailsSchema,validDetails}=await import('../src/product-details.mjs');
 const raw={identified:true,productName:'Generic product',manufacturer:'Brand',variant:null,nutrients:[{name:'Ingredient',amount:400,unit:'mg',originalUnit:null,amountNote:'Per serving',sourceUrl:'S1'}],dosage:{directions:'Two tablets daily with food.',servingSize:'Two tablets',dailyServingsMin:1,dailyServingsMax:1,sourceUrl:'S1'},benefits:['Brief benefit.'],benefitSummary:'Energy',sources:[{url:'S1',title:'Official label',kind:'manufacturer'}]};
 for(const mode of ['repair','invalid','key']){
  let searches=0,extracts=0;const research=createGeminiResearch({search:async()=>{searches++;return {result:{text:'Exact-product label'},citations:['https://manufacturer.example/label'],searches:1};},extract:createGeminiStructured({fetch:async()=>{extracts++;if(mode==='key')return new Response('private key response',{status:403});return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:mode==='invalid'||extracts===1?'broken JSON secret body':JSON.stringify(raw)}]}}]});}})});
  const request={name:'supplement_product_details',key:'private',messages:detailsMessages({name:'Generic product',language:'en',target:{name:'Generic product',manufacturer:'Brand',groupingBasis:'manual'},full:true}),schema:detailsSchema([],'en'),validate:v=>validDetails(v,[],'en')};
  if(mode==='repair'){const out=await research(request);assert.equal(out.extractionAttempts,2);assert.equal(out.result.nutrients[0].amount,400);assert.equal(out.result.dosage.directions,raw.dosage.directions);assert.equal(out.result.groupId,null);}else await assert.rejects(research(request),e=>{assert.equal(e.code,mode==='key'?'AI_KEY_REJECTED':'AI_INVALID_RESPONSE');assert.equal(e.diagnostic.stage,'extraction');assert.equal(e.diagnostic.reason,mode==='key'?'provider_error':'invalid_json');assert.doesNotMatch(JSON.stringify(e),/secret body|private key/);return true;});
  assert.equal(searches,1);assert.equal(extracts,mode==='key'?1:2);
 }
});
