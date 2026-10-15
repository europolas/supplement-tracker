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
