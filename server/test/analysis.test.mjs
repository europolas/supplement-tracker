import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichNutrients,NRVS} from '../src/nutrient-reference.mjs';
import {analysisSchema,validAnalysis,finalizeAnalysis} from '../src/analysis.mjs';
const dosage={directions:'1 to 2 capsules daily',servingSize:'1 capsule',dailyServingsMin:1,dailyServingsMax:2,sourceUrl:'https://maker.example/label',evidence:'manufacturer'};
const nutrient={name:'Vitamin C',amount:1000,unit:'mg',nrvCode:'vitamin_c',nrvComparable:true,evidence:'manufacturer',sourceUrl:dosage.sourceUrl};
const fixture=()=>({identified:true,dosage:{...dosage},nutrients:[{...nutrient}],sources:[{url:dosage.sourceUrl,kind:'manufacturer',title:'Label'}]});
test('NRV math distinguishes a serving from daily range and handles mass units',()=>{
 const [c]=enrichNutrients({dosage,nutrients:[nutrient]});assert.equal(c.reference.amount,80);assert.equal(c.perServingPercent,1250);assert.equal(c.dailyAmountMax,2000);assert.equal(c.dailyPercentMax,2500);
 const [d]=enrichNutrients({dosage,nutrients:[{...nutrient,amount:0.025,unit:'mg',nrvCode:'vitamin_d'}]});assert.equal(d.reference.amount,5);assert.equal(d.perServingPercent,500);
 assert.equal(Object.keys(NRVS).length,27);
});
test('unknown frequency, compound quantities, IU and unassigned ingredients never invent percentages',()=>{
 for(const n of [{...nutrient,nrvComparable:false},{...nutrient,unit:'IU'},{...nutrient,nrvCode:null},{...nutrient,amount:null}]){const [result]=enrichNutrients({dosage,nutrients:[n]});assert.equal(result.perServingPercent,null);assert.equal(result.dailyPercentMax,null);}
 const [result]=enrichNutrients({dosage:{...dosage,dailyServingsMin:null,dailyServingsMax:null},nutrients:[nutrient]});assert.equal(result.dailyAmountMin,null);assert.equal(result.perServingPercent,1250);assert.equal(result.dailyPercentMin,null);
});
test('source provenance rejects fabricated, non-manufacturer and absent photo evidence',()=>{
 for(const f of [()=>finalizeAnalysis(fixture(),{citations:[]}),()=>{const a=fixture();a.sources[0].kind='retailer';finalizeAnalysis(a,{citations:[dosage.sourceUrl]});},()=>{const a=fixture();a.dosage.evidence='label_photo';finalizeAnalysis(a,{citations:[dosage.sourceUrl],image:false});}])assert.throws(f,e=>e.code==='AI_SOURCES_UNVERIFIED');
 const a=finalizeAnalysis(fixture(),{citations:[dosage.sourceUrl]});assert.equal(a.nutrients[0].dailyPercentMax,2500);assert.equal(a.research.sourceCount,1);
});
test('strict domain schema enumerates only owned IDs and rejects extra fields/numbers',()=>{
 const schema=analysisSchema([{id:'owned'}],[{id:'existing'}]);assert.deepEqual(schema.properties.groupId.enum,['owned',null]);assert.equal(validAnalysis({...fixture(),untrusted:true},[]),false);
});

test('dose provenance normalizes unknown directions and computed values stay server owned',()=>{
 const a=fixture();a.dosage.evidence='unknown';const result=finalizeAnalysis(a,{citations:[dosage.sourceUrl]});assert.equal(result.dosage.directions,null);assert.equal(result.nutrients[0].dailyAmountMax,null);assert.equal(result.nutrients[0].reference.amount,80);assert.equal(result.needsReview,true);
});
test('unused unverified bibliography is omitted with review while quantity provenance remains strict',()=>{
 const a=fixture();a.sources.push({url:'https://invented.example/unused',title:'Unverified extra link',kind:'clinical'});
 const safe=finalizeAnalysis(a,{citations:[dosage.sourceUrl]});assert.equal(safe.sources.length,1);assert.equal(safe.research.omittedSourceCount,1);assert.equal(safe.needsReview,true);assert.equal(safe.dosage.directions,dosage.directions);
 const b=fixture();b.dosage.evidence='unknown';b.nutrients[0].evidence='unknown';assert.throws(()=>finalizeAnalysis(b,{citations:[],image:true}),e=>e.code==='AI_SOURCES_UNVERIFIED');
 const c=fixture();c.dosage.evidence='label_photo';c.dosage.sourceUrl='https://invented.example/label';const photo=finalizeAnalysis(c,{citations:[dosage.sourceUrl],image:true});assert.equal(photo.dosage.sourceUrl,null);
});
test('sourced adult fallback stays separate from unverified manufacturer directions and daily totals',()=>{
 const a=fixture();a.dosage.evidence='unknown';a.dosage.servingSize=null;a.nutrients[0].evidence='unknown';a.sources=[{url:'https://guideline.example/adults',kind:'regulatory',title:'Adult reference'}];
 a.doseFallback={basis:'established_adult_intake',ingredient:'Example ingredient',dailyAmountMin:25,dailyAmountMax:50,unit:'mg',sourceUrl:a.sources[0].url,explanation:'An adult intake reference, not a capsule count.'};
 const result=finalizeAnalysis(a,{citations:[a.sources[0].url]});assert.equal(result.doseFallback.dailyAmountMin,25);assert.equal(result.dosage.directions,null);assert.equal(result.dosage.dailyServingsMin,null);assert.equal(result.nutrients[0].dailyAmountMin,null);assert.equal(result.labelDirections,null);assert.equal(result.needsReview,true);
 for(const kind of ['retailer','manufacturer']){const bad=structuredClone(a);bad.sources[0].kind=kind;assert.throws(()=>finalizeAnalysis(bad,{citations:[bad.sources[0].url]}),e=>e.code==='AI_SOURCES_UNVERIFIED');}
 const fabricated=structuredClone(a);assert.throws(()=>finalizeAnalysis(fabricated,{citations:[]}),e=>e.code==='AI_SOURCES_UNVERIFIED');
});
test('AI contract limits Home summary and rejects incomplete or invented fallback quantities',()=>{
 const base={...fixture(),schemaVersion:'1.4',language:'lt',manufacturer:null,variant:null,productName:'Example',groupId:'owned',benefitSummary:'Energija, ląstelių apsauga',benefits:['Long explanation remains here.'],howToUse:'Read label',whenToUse:'With food',labelDirections:null,cautions:[],confidence:'low',needsReview:true,reviewReason:'Dose uncertain',evidenceNote:'Review',doseFallback:{basis:'not_needed',ingredient:null,dailyAmountMin:null,dailyAmountMax:null,unit:null,sourceUrl:null,explanation:''},compatibility:{summary:'No routine yet',requiresReview:true,assessments:[]}};
 Object.assign(base.nutrients[0],{originalUnit:null,amountNote:'Per serving'});
 assert.equal(validAnalysis(base,[{id:'owned'}],[],'lt'),true);
 const long=structuredClone(base);long.benefitSummary='This is much too long for the home screen';assert.equal(validAnalysis(long,[{id:'owned'}],[],'lt'),false);
 const unknown=structuredClone(base);unknown.dosage.evidence='unknown';assert.equal(validAnalysis(unknown,[{id:'owned'}],[],'lt'),false);
 unknown.doseFallback={basis:'established_adult_intake',ingredient:'Example',dailyAmountMin:25,dailyAmountMax:50,unit:'mg',sourceUrl:'https://guideline.example/adults',explanation:'General adult intake, including food.'};assert.equal(validAnalysis(unknown,[{id:'owned'}],[],'lt'),true);
 unknown.doseFallback.dailyAmountMax=10;assert.equal(validAnalysis(unknown,[{id:'owned'}],[],'lt'),false);
 unknown.doseFallback.dailyAmountMax=50;unknown.doseFallback.sourceUrl=null;assert.equal(validAnalysis(unknown,[{id:'owned'}],[],'lt'),false);
});
