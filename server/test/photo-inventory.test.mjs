import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoInventoryDiscovery} from '../src/photo-inventory.mjs';
import {basicProductsSchema,basicProductsMessages,validBasicProducts} from '../src/photo-products.mjs';
const groups=[{id:'meal',name:'With food'}];
const p=name=>({name,manufacturer:'Pharma Nord',groupId:'meal',benefit:'Immune, skin',position:'right blister'});
const input=images=>({messages:basicProductsMessages({images,groups}),schema:basicProductsSchema(groups),validate:v=>validBasicProducts(v,groups),model:'test'});
test('one call inventories every image and preserves zinc separately from selenium/zinc',async()=>{
 let calls=0;
 const discover=createPhotoInventoryDiscovery(async request=>{calls++;
  const result={language:'en',photos:[{photoIndex:1,products:[p('Bio-Zink'),{...p('Bio-Selenium+Zinc'),position:'middle blister'}],skipped:[]},{photoIndex:2,products:[p('Bio-Zink')],skipped:[{location:'rear',reason:'Unreadable name'}]}]};
  assert.ok(request.validate(result));
  for(const bad of [ {...result,photos:result.photos.slice(1)}, {...result,photos:[result.photos[0],result.photos[0]]}, {...result,photos:[{...result.photos[0],photoIndex:3},result.photos[1]]}, {...result,photos:[{...result.photos[0],products:[{...p('Bio-Zink'),groupId:'foreign'}]},result.photos[1]]} ])assert.equal(request.validate(bad),false);
  return {result,model:'test'};
 });
 const result=await discover(input(['image1','image2']));assert.equal(calls,1);assert.deepEqual(result.result.products.map(p=>p.name),['Bio-Zink','Bio-Selenium+Zinc']);assert.equal(result.result.skipped[0].location,'2: rear');assert.deepEqual(result.inventory.map(p=>p.recognized),[2,1]);assert.ok(validBasicProducts(result.result,groups));
});
test('text-only recognition keeps original contract and malformed photo coverage fails closed',async()=>{
 const request=input([]);let calls=0;await createPhotoInventoryDiscovery(async actual=>{calls++;assert.equal(actual,request);return {result:{language:'en',products:[],skipped:[]}};})(request);assert.equal(calls,1);
 await assert.rejects(createPhotoInventoryDiscovery(async()=>({result:{language:'en',photos:[]}}))(input(['one'])),e=>e.code==='AI_INVALID_RESPONSE');
});
