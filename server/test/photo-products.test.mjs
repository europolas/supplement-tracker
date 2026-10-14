/** Pure identity parsing tests: no provider calls, secrets or database. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validPhotoProducts,productRequestId,uniqueProducts,photoProductsMessages} from '../src/photo-products.mjs';
const product={name:'Vitamin C',manufacturer:'Example',variant:'1000 mg',labelText:'Vitamin C 1000 mg',location:'Front left'};
test('discovery requires readable name and brand, bounds output and deduplicates exact identities',()=>{
 const result={version:'1',products:[product],skipped:[{location:'Back',reason:'Blurred brand'}],overflow:false};assert.equal(validPhotoProducts(result),true);
 for(const change of [{manufacturer:''},{name:''},{manufacturer:7},{extra:true},{location:'a'.repeat(201)}])assert.equal(validPhotoProducts({...result,products:[{...product,...change}]}),false);
 assert.equal(validPhotoProducts({...result,products:Array(41).fill(product)}),false);
 assert.equal(uniqueProducts([product,{...product,name:'  VITAMIN   C '},{...product,variant:'500 mg'}]).length,2);
 const prompt=photoProductsMessages({image:'data:image/jpeg;base64,TEST',language:'lt'});assert.match(prompt[0].content,/Lithuanian/);assert.match(prompt[0].content,/manufacturer\/brand must be legible/);
});
test('batch child request IDs are stable, UUID shaped and distinct by parent and index',()=>{
 const first=productRequestId('parent',0);assert.match(first,/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(productRequestId('parent',0),first);assert.notEqual(productRequestId('parent',1),first);assert.notEqual(productRequestId('other',0),first);
});
