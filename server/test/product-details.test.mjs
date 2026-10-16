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
test('full details reviews timing against all groups and requires an owned decision and explanation',()=>{
 const groups=[{id:'fast',name:'Morning · empty stomach'},{id:'meal',name:'Any time day or evening'}],f=fullFixture();f.groupId='meal';f.reviewReason='Exact manufacturer directions recommend a meal.';
 assert.deepEqual(detailsSchema(groups,'en',[],true).properties.groupId.enum,['fast','meal',null]);assert.equal(validDetails(f,groups,'en',[],true),true);
 for(const changes of [{groupId:'foreign'},{groupId:['fast','meal']},{reviewReason:null},{reviewReason:''}])assert.equal(validDetails({...f,...changes},groups,'en',[],true),false);
 const m=detailsMessages({name:'Product',language:'en',target:{groupId:'fast',groupingBasis:'provisional'},groups,full:true}),c=JSON.parse(m[1].content[0].text);
 assert.equal(c.groups.length,2);assert.equal(c.selectedTarget.groupId,'fast');assert.match(m[0].content,/preferably with a meal/);assert.doesNotMatch(JSON.stringify(m),/existingSupplements|compatibility|contraindications/);
});

import {compactDetailsSchema,expandCompactDetails} from '../src/product-details.mjs';
test('manual detail requests omit group context, instructions and wire fields entirely',()=>{
 const messages=detailsMessages({name:'Product',language:'en',target:{name:'Product',manufacturer:'Brand',groupId:'private',groupingBasis:'manual',originalBenefit:'private benefit'},groups:[{id:'private',name:'Private group'}],full:true});
 assert.doesNotMatch(JSON.stringify(messages),/group|private|originalBenefit|compatibility|interaction|restriction/i);
 const schema=compactDetailsSchema([],'en');assert.doesNotMatch(JSON.stringify(schema),/group|reviewReason|cautions|compatibility|doseFallback|evidenceNote/);
 const full=fullFixture(),raw={identified:true,productName:full.productName,manufacturer:full.manufacturer,variant:full.variant,nutrients:[],dosage:{...full.dosage},benefits:['Brief benefit.'],benefitSummary:'Energy, cells',sources:[]};delete raw.dosage.evidence;
 assert.equal(validDetails(expandCompactDetails(raw,'en',false),[],'en'),true);
 assert.throws(()=>expandCompactDetails({...raw,groupId:'private'},'en',false));
 const cautions=fullFixture();cautions.cautions=['Extra topic'];assert.equal(validDetails(cautions,[],'en',[],true),false);
});

test('verbose research preview is bounded without discarding full benefits or product facts',()=>{
 const f=fullFixture(),raw={identified:true,productName:f.productName,manufacturer:f.manufacturer,variant:f.variant,nutrients:[],dosage:{...f.dosage},benefits:['Full detailed benefit stays intact.'],benefitSummary:'Sleep quality, nervous system support, muscle relaxation and recovery',sources:[]};delete raw.dosage.evidence;
 const expanded=expandCompactDetails(raw,'en',false);assert.equal(validDetails(expanded,[],'en'),true);assert.deepEqual(expanded.benefits,raw.benefits);assert.equal(expanded.benefitSummary.split(/\s+/).length,6);assert.equal(raw.benefitSummary,'Sleep quality, nervous system support, muscle relaxation and recovery');
 raw.benefitSummary=Array(20).fill('Atsipalaidavimas').join(' ');assert.equal(validDetails(expandCompactDetails(raw,'lt',false),[],'lt'),true);
 raw.benefitSummary=42;assert.equal(validDetails(expandCompactDetails(raw,'en',false),[],'en'),false);
});

test('optional timing metadata cannot discard valid product facts or move without a reason',()=>{
 const raw={identified:true,productName:'Generic product',manufacturer:'Brand',variant:null,nutrients:[],dosage:{directions:'Two tablets daily with food.',servingSize:'Two tablets',dailyServingsMin:1,dailyServingsMax:1,sourceUrl:'S1'},benefits:['Brief benefit.'],benefitSummary:'Energy',sources:[],groupId:null,reviewReason:'Timing is not established.'};
 for(const decision of [{groupId:null,reviewReason:raw.reviewReason},{groupId:'meal',reviewReason:null},{groupId:'meal',reviewReason:''}]){const result=expandCompactDetails({...raw,...decision},'en',true);assert.equal(result.groupId,null);assert.equal(result.reviewReason,null);assert.equal(result.dosage.directions,raw.dosage.directions);assert.equal(validDetails(result,[{id:'meal'}],'en',[],true),true);}
});
