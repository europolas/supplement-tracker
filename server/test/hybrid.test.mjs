import test from 'node:test';import assert from 'node:assert/strict';
import {BENEFITS,classificationRequest,parseClassification,createJevClassification} from '../src/providers/jev-classification.mjs';
import {validIngredients,createIngredientRecognition} from '../src/providers/grok-ingredients.mjs';
import {createHybridPipeline} from '../src/providers/hybrid.mjs';
import {validBasicProducts} from '../src/photo-products.mjs';
const groups=[{id:'meal',name:'With food'},{id:'bed',name:'Before bed'}],product={name:'Example C',manufacturer:'Example',ingredients:[{name:'Vitamin C',labelAmount:''}],complete:false};
function response(products){const request=classificationRequest(products,groups),answers={};for(const[k,q]of Object.entries(request.questions))answers[k]=q.type==='choice'?{type:'choice',choice:'meal',confidence:1,probabilities:{meal:1,bed:0}}:{type:'score',score:3,confidence:1,probabilities:{0:0,1:0,2:0,3:1}};return {model:'jev-1.14.0',answers,usage:{input_tokens:100}};}
test('100 bilingual categories; one owned group and at most five distinct families',()=>{
 assert.equal(BENEFITS.length,100);assert.equal(new Set(BENEFITS.map(b=>b.id)).size,100);assert.ok(BENEFITS.every(b=>b.en&&b.lt&&b.family));
 const req=classificationRequest([product],groups),data=response([product]);assert.equal(Object.keys(req.questions).length,101);
 const [p]=parseClassification(data,req,[product],groups);assert.equal(p.groupId,'meal');assert.equal(p.benefits.length,5);assert.equal(new Set(p.benefits.map(b=>b.family)).size,5);
 const [unknown]=parseClassification(data,req,[{...product,ingredients:[]}],groups);assert.equal(unknown.benefits.length,0);
 data.answers.g0.choice='foreign';assert.throws(()=>parseClassification(data,req,[product],groups));
});
test('rounded score distributions accepted, malformed/foreign/missing answers rejected',()=>{
 const req=classificationRequest([product],groups),v=response([product]);v.answers.b0_antioxidant={type:'score',score:2.3,confidence:.8,probabilities:{0:0,1:0,2:.67,3:.33}};assert.equal(parseClassification(v,req,[product],groups).length,1);
 v.answers.b0_antioxidant.score=0;assert.throws(()=>parseClassification(v,req,[product],groups));delete v.answers.g0;assert.throws(()=>parseClassification(v,req,[product],groups));
});
test('label extraction retains unknown manufacturer; exact cache fills full composition without another request',async()=>{
 const v={photos:[{photoIndex:1,products:[{...product,manufacturer:''}],skipped:[]}]};assert.equal(validIngredients(v,1),true);assert.equal(validIngredients(v,2),false);let calls=0;
 const read=createIngredientRecognition({provider:async()=>{calls++;return {result:structuredClone(v),model:'grok-4.7'};}});
 const r=await read({images:['fixture'],cache:[{name:product.name,manufacturer:'Unknown',composition:{ingredients:[{name:'Cached ingredient',labelAmount:''}],complete:true,basis:'label',checkedAt:new Date().toISOString()}}]});assert.equal(calls,1);assert.equal(r.products[0].manufacturer,'Unknown');assert.equal(r.products[0].basis,'saved_label');assert.equal(r.products[0].complete,true);
});
test('hybrid makes one extraction then classification; metadata and metrics preserve compact contract',async()=>{
 let n=0,j=0;const metrics=[];const p=createHybridPipeline({recognize:async()=>{n++;return {products:[product],skipped:[],inventory:[],model:'grok-4.7'};},classify:async products=>{j++;return products.map(p=>({...p,groupId:'meal',groupConfidence:.8,benefits:BENEFITS.slice(0,5).map(b=>({...b,score:3,confidence:1})),jevModel:'jev-1.14.0'}));}});
 assert.equal(p.review,null);const r=await p.discover({key:'test',model:'grok-4.7',messages:[{}, {content:[{type:'text',text:JSON.stringify({productName:'Example C',responseLanguage:'lt',groups})}]}],beforeClassification:async()=>{},onMetrics:async m=>metrics.push(m)});
 assert.equal(n,1);assert.equal(j,1);assert.equal(validBasicProducts(r.result,groups,'lt'),true);assert.equal(Object.values(r.productMetadata)[0].benefitTags.length,5);assert.deepEqual(metrics.map(m=>m.stage),['grok','jev','saving']);
});
test('JEV non-OK response fails once without retry or leaking response body',async()=>{
 let calls=0;const classify=createJevClassification({getKey:()=> 'secret',fetch:async()=>{calls++;return new Response('private provider message',{status:429});}});await assert.rejects(classify([product],groups),e=>e.code==='AI_RATE_LIMITED'&&!e.message.includes('private'));assert.equal(calls,1);
});
