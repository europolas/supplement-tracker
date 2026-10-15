/** Pure identity parsing tests: no provider calls, secrets or database. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validPhotoProducts,productRequestId,uniqueProducts,photoProductsMessages} from '../src/photo-products.mjs';
const product={name:'Vitamin C',manufacturer:'Example',variant:'1000 mg',labelText:'Vitamin C 1000 mg',groupId:null,reason:'With food',benefit:'Possible support',review:false,existingId:null};
test('discovery requires readable name and brand, bounds output and deduplicates exact identities',()=>{
 const result={version:'2',language:'en',products:[product],skipped:[{location:'Back',reason:'Blurred brand'}],overflow:false};assert.equal(validPhotoProducts(result),true);assert.equal(validPhotoProducts({...result,language:'lt'}),false);assert.equal(validPhotoProducts({...result,products:[{...product,groupId:'foreign'}]}),false);
 for(const change of [{manufacturer:''},{name:''},{manufacturer:7},{extra:true},{reason:'a'.repeat(301)}])assert.equal(validPhotoProducts({...result,products:[{...product,...change}]}),false);
 assert.equal(validPhotoProducts({...result,products:Array(41).fill(product)}),false);
 assert.equal(uniqueProducts([product,{...product,name:'  VITAMIN   C '},{...product,variant:'500 mg'}]).length,2);
 const prompt=photoProductsMessages({image:'data:image/jpeg;base64,TEST',language:'lt'});assert.match(prompt[0].content,/Lithuanian/);assert.match(prompt[0].content,/Both product name AND brand/);
});
test('batch child request IDs are stable, UUID shaped and distinct by parent and index',()=>{
 const first=productRequestId('parent',0);assert.match(first,/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(productRequestId('parent',0),first);assert.notEqual(productRequestId('parent',1),first);assert.notEqual(productRequestId('other',0),first);
});

import {basicProductsSchema,basicProductsMessages,validBasicProducts} from '../src/photo-products.mjs';
test('compact contract accepts four fields and rejects foreign groups, long benefits and extra output',()=>{
 const groups=[{id:'owned',name:'With food'}],p={name:'Vitamin C',manufacturer:'Example',groupId:'owned',benefit:'Immune support'},r={language:'en',products:[p],skipped:[]};
 assert.ok(validBasicProducts(r,groups));assert.equal(Object.keys(basicProductsSchema(groups).properties.products.items.properties).length,4);
 for(const change of [{groupId:null},{groupId:'foreign'},{benefit:'one two three four five six seven'},{benefit:''},{dosage:'1 tablet'}])assert.equal(validBasicProducts({...r,products:[{...p,...change}]},groups),false);
 assert.equal(validBasicProducts({...r,products:[null]},groups),false);assert.equal(validBasicProducts({...r,language:'lt'},groups),false);
 const prompt=basicProductsMessages({groups,language:'lt',name:'Vitamin C'});assert.match(prompt[0].content,/Lithuanian/);assert.match(prompt[0].content,/No doses/);assert.equal(prompt.length,2);
});

test('numbered multi-photo inventory preserves separate same-brand formulas and exact duplicates',()=>{
 const messages=basicProductsMessages({images:['photo-a','photo-b'],groups:[{id:'meal'}],language:'lt'});
 const parts=messages[1].content;
 assert.deepEqual(parts.filter(p=>p.type==='image_url').map(p=>p.image_url),[{url:'photo-a',detail:'high'},{url:'photo-b',detail:'high'}]);
 assert.match(parts[1].text,/Photo 1 of 2/);assert.match(parts[3].text,/Photo 2 of 2/);
 const p=(name,manufacturer)=>({...product,name,manufacturer,variant:''});
 const items=[p('Bio-Zinc','Pharma Nord'),p('Bio-Selenium+Zinc','Pharma Nord'),p('Magnesium Taurate','KAL'),p('Magnesium Bisglycinate','Zenyth')];
 assert.equal(uniqueProducts([...items,items[0]]).length,4);
});

test('compact recognition rejects duplicate identity entries even when assigned to different owned groups',()=>{
 const groups=[{id:'fast'},{id:'bed'}],p={name:'Product',manufacturer:'Brand',groupId:'fast',benefit:'Energy, cells'};
 assert.equal(validBasicProducts({language:'en',products:[p,{...p,groupId:'bed'}],skipped:[]},groups),false);
 assert.equal(validBasicProducts({language:'en',products:[p,{...p,name:'Different product',groupId:'bed'}],skipped:[]},groups),true);
});
