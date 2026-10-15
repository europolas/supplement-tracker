/** One provider call, one independent inventory per photo. The model must not
 * collapse same-brand packages before accounting for each image. We flatten only
 * after validating every photo index and positioned identity. Exact product
 * deduplication remains TrackerApi's responsibility. No photos/keys are stored.
 * Text-only requests retain the compact contract; no automatic paid retries.
 */
import {ProviderError} from './structured-chat.mjs';
import {uniqueProducts} from './photo-products.mjs';
export function createPhotoInventoryDiscovery(provider){
 return async input=>{
  const count=input.messages.flatMap(m=>Array.isArray(m.content)?m.content:[]).filter(p=>p.type==='image_url').length;
  if(!count)return provider(input);
  const compact=input.schema.properties;
  const product=structuredClone(compact.products.items);
  product.properties.position={type:'string',minLength:1,maxLength:120,description:'Unique package position within this photo, e.g. rightmost blister strip.'};product.required.push('position');
  const photo={type:'object',additionalProperties:false,properties:{photoIndex:{type:'integer',enum:Array.from({length:count},(_,i)=>i+1)},products:{...compact.products,items:product},skipped:compact.skipped},required:['photoIndex','products','skipped']};
  const schema={type:'object',additionalProperties:false,properties:{language:compact.language,photos:{type:'array',minItems:count,maxItems:count,items:photo}},required:['language','photos']};
  const flatten=value=>({language:value.language,products:value.photos.flatMap(p=>p.products.map(({position,...product})=>product)),skipped:value.photos.flatMap(p=>p.skipped.map(s=>({...s,location:`${p.photoIndex}: ${s.location}`.slice(0,200)})))});
  const valid=value=>{
   if(!value||Object.keys(value).length!==2||!Object.hasOwn(value,'language')||!Array.isArray(value.photos)||value.photos.length!==count)return false;
   const indices=new Set();
   for(const p of value.photos){
    if(!p||Object.keys(p).length!==3||!Number.isInteger(p.photoIndex)||p.photoIndex<1||p.photoIndex>count||indices.has(p.photoIndex)||!Array.isArray(p.products)||!Array.isArray(p.skipped))return false;
    indices.add(p.photoIndex);
    if(p.products.some(x=>!x||Object.keys(x).length!==5||typeof x.position!=='string'||!x.position.trim()||x.position.length>120))return false;
    if(!input.validate({language:value.language,products:p.products.map(({position,...x})=>x),skipped:p.skipped}))return false;
   }
   // The application's overall capacity is 40; repeated views may exceed that
   // before deduplication, so validate each image independently above.
   return true;
  };
  const messages=input.messages.map(m=>({...m}));
  messages[0]={...messages[0],content:messages[0].content+`\nOUTPUT CONTRACT OVERRIDE: Return {language, photos}, with exactly one entry per numbered input photo, photoIndex 1 through ${count}. Each entry has its own products and skipped arrays. Include every readable package IN THAT PHOTO, even if it appeared in another photo or already exists in the routine. Do not deduplicate across photos; the application does that. Give each product its physical position in this image. Repeated print on one blister is one package, but separate blisters MUST be read independently, including a single-ingredient formula beside a combination. Recheck rightmost and partially cropped packages before finishing each photo. Never silently omit an unreadable package: put its position and unreadable identity in that photo's skipped list. Do not guess identities or a target count. All other language, benefit and grouping rules still apply.`};
  const response=await provider({...input,messages,schema,validate:valid,name:'supplement_photo_inventory_v1',maxTokens:10000});
  if(!valid(response.result))throw new ProviderError('AI_INVALID_RESPONSE');
  const result=flatten(response.result);result.products=uniqueProducts(result.products);result.skipped=result.skipped.slice(0,40);
  if(!input.validate(result))throw new ProviderError('AI_INVALID_RESPONSE');
  return {...response,result,inventory:response.result.photos.map(p=>({photoIndex:p.photoIndex,recognized:p.products.length,skipped:p.skipped.length}))};
 };
}
