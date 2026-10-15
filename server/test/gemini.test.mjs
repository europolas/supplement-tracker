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
