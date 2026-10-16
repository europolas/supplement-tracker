import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detailsSchema,detailsMessages,validDetails} from '../src/product-details.mjs';
import {finalizeAnalysis} from '../src/analysis.mjs';
import {createStructuredResearch} from '../src/structured-research.mjs';
test('focused details isolate selected identity and forbid routine analysis or group changes',()=>{
 const schema=detailsSchema([{id:'owned'}],'lt');
 assert.deepEqual(schema.properties.groupId.enum,[null]);assert.equal(schema.properties.compatibility.properties.assessments.maxItems,0);
 const messages=detailsMessages({name:'Brand Vitamin',language:'lt',target:{name:'Vitamin',manufacturer:'Brand'},supplements:[{name:'Private routine'}]});
 assert.equal(JSON.stringify(messages).includes('Private routine'),false);assert.equal(JSON.parse(messages[1].content[0].text).selectedTarget.manufacturer,'Brand');
 assert.equal(validDetails({},[],'lt'),false);
});
test('live focused detail request validates sources and compact localized result',{skip:process.env.LIVE_DETAILS!=='1',timeout:330000},async()=>{
 const language='lt',groups=[],request={name:'NOW Foods C-1000 tablets with rose hips and bioflavonoids, SKU 0685',target:{name:'C-1000',manufacturer:'NOW Foods'},language};
 const data=await createStructuredResearch()({key:readFileSync('/run/secrets/provider_test_key','utf8').trim(),model:'grok-4.7',messages:detailsMessages(request),schema:detailsSchema(groups,language),validate:v=>validDetails(v,groups,language),name:'supplement_product_details',maxTokens:5000});
 const result=finalizeAnalysis(data.result,{citations:data.citations});assert.equal(result.language,'lt');assert.equal(result.identified,true);assert.ok(result.nutrients.length>0);assert.ok(result.sources.length>0);assert.equal(result.compatibility.assessments.length,0);assert.equal(result.groupId,null);assert.equal(result.cautions.length,0);
 for(const value of [...result.benefits,result.howToUse,result.whenToUse,...result.nutrients.map(n=>n.amountNote)])assert.doesNotMatch(value,/reikia patvirtinimo|laikinas pasirinkimas|reikia daugiau informacijos/iu);
 console.log(JSON.stringify({scope:'product-details',language,ingredients:result.nutrients.length,sources:result.sources.length,doseKnown:Boolean(result.dosage.directions)}));
});
function fullFixture(){return {schemaVersion:'1.4',language:'en',identified:true,productName:'Product',manufacturer:'Brand',variant:'',groupId:null,benefitSummary:'Energy, cells',benefits:['Useful benefit.'],howToUse:'With water.',whenToUse:'With food.',labelDirections:null,cautions:[],confidence:'medium',needsReview:false,reviewReason:null,evidenceNote:'',doseFallback:{basis:'unavailable',ingredient:null,dailyAmountMin:null,dailyAmountMax:null,unit:null,sourceUrl:null,explanation:'Not determined'},dosage:{directions:null,servingSize:null,dailyServingsMin:null,dailyServingsMax:null,sourceUrl:null,evidence:'unknown'},nutrients:[],sources:[],compatibility:{summary:'',requiresReview:false,assessments:[]}};}
const alert=()=>({supplementId:'other',status:'potential_conflict',severity:'severe',canSeparate:true,recommendedGroupId:'evening',recommendation:'Separate intake in the evening group.',sourceUrl:'https://manufacturer.example/interaction',reason:'Established significant interaction.'});
test('full details accepts no alerts, or only severe sparse source-backed recommendations',()=>{
 const groups=[{id:'evening'}],others=[{id:'other'},{id:'safe'}];let f=fullFixture();assert.equal(validDetails(f,groups,'en',others,true),true);f.compatibility={summary:'',requiresReview:true,assessments:[alert()]};assert.equal(validDetails(f,groups,'en',others,true),true);
 for(const change of [{severity:'minor'},{supplementId:'foreign'},{recommendedGroupId:'foreign'},{canSeparate:false},{sourceUrl:'http://unsafe.example'},{recommendation:''},{status:'insufficient_information'}]){const copy=structuredClone(f);Object.assign(copy.compatibility.assessments[0],change);assert.equal(validDetails(copy,groups,'en',others,true),false);}
 const noSeparation=structuredClone(f);Object.assign(noSeparation.compatibility.assessments[0],{canSeparate:false,recommendedGroupId:null,recommendation:'Moving groups does not resolve this interaction.'});assert.equal(validDetails(noSeparation,groups,'en',others,true),true);
});
test('full details sends group context and prioritizes severe same-group conflicts without safe-pair essays',()=>{
 const m=detailsMessages({name:'Product',language:'en',target:{groupId:'morning'},groups:[{id:'evening',name:'Evening'}],supplements:[{id:'other',name:'Other',group_id:'morning',analysis:{}}],full:true});assert.match(m[0].content,/ONLY source-backed SEVERE/);assert.match(m[0].content,/DIFFERENT existing groupId/);const c=JSON.parse(m[1].content[0].text);assert.equal(c.groups[0].id,'evening');assert.equal(c.existingSupplements[0].groupId,'morning');
});
test('research rejects unencountered severe-alert sources and current-group moves before persistence',async()=>{
 const {TrackerApi}=await import('../src/TrackerApi.mjs'),{createCredentialVault}=await import('../src/credential-vault.mjs');const vault=createCredentialVault(Buffer.alloc(32,7)),owner='owner',sealed=vault.seal('private-testing-key',{owner,provider:'xai'}),groups=[{id:'morning',name:'Morning'},{id:'evening',name:'Evening'}],supplements=[{id:'other',name:'Other',analysis:{enrichment:{status:'complete'}}}];
 let source='https://manufacturer.example/interaction',recommended='evening';
 const chat=async input=>{const r=fullFixture();r.compatibility={summary:'',requiresReview:true,assessments:[{...alert(),sourceUrl:source,recommendedGroupId:recommended}]};r.sources=[{url:'https://manufacturer.example/interaction',title:'Official interaction directions',kind:'manufacturer'}];assert.equal(input.validate(r),true);return {result:r,citations:['https://manufacturer.example/interaction'],model:'test'};};
 const api=new TrackerApi(null,{authenticate:async()=>({})},{vault,chat,fullResearch:true});api.checkKey=async()=>sealed;
 const run=()=>api.requestResearch(owner,{name:'Product',language:'en',target:{name:'Product',groupId:'morning'},groups,supplements,settings:{model:'test'},sealed},'Bearer private');
 const result=await run();assert.equal(result.result.compatibility.assessments[0].supplementName,'Other');source='https://invented.example/interaction';await assert.rejects(run(),e=>e.code==='AI_SOURCES_UNVERIFIED');source='https://manufacturer.example/interaction';recommended='morning';await assert.rejects(run(),e=>e.code==='AI_INVALID_RESPONSE');
});
