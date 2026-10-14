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
