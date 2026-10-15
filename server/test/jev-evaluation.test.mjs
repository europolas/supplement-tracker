import test from 'node:test';import assert from 'node:assert/strict';
import {buildJevGroupingRequest,validateJevAnswers} from '../src/providers/jev-evaluation.mjs';
import {createGrokPipeline} from '../src/providers/grok.mjs';
test('Jev accepts only supplied group choices and explicit unknown without source claims',()=>{
 const r=buildJevGroupingRequest({products:[{name:'A',directions:'With a meal'}],groups:[{id:'meal',name:'With a meal'}]});
 assert.equal(Object.keys(r.questions).length,1);assert.equal(r.model,'jev-1.14.0');
 const valid={model:r.model,answers:{product_0:{type:'choice',choice:'meal',confidence:.8,probabilities:{meal:.9,unknown:.1}}}};
 assert.equal(validateJevAnswers(valid,r),true);
 for(const patch of [{choice:'foreign'},{choice:['meal','unknown']},{confidence:2},{probabilities:{meal:1}},{probabilities:{meal:1,unknown:1}}])assert.throws(()=>validateJevAnswers({...valid,answers:{product_0:{...valid.answers.product_0,...patch}}},r));
 assert.throws(()=>validateJevAnswers({model:r.model,answers:{}},r));
 assert.throws(()=>buildJevGroupingRequest({products:[{}],groups:[{id:'unknown',name:'X'}]}));
});
test('preserved Grok factory exposes the existing three capabilities without requests',()=>{
 const p=createGrokPipeline();assert.equal(p.discoveryModel,'grok-4.7');assert.deepEqual(p.models,['grok-4.7']);for(const key of ['chat','review','discover'])assert.equal(typeof p[key],'function');
});
