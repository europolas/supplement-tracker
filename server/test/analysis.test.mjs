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
