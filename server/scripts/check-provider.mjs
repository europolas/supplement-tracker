/** Explicit paid research smoke test; no DB/account records. All requests use public
 * product/fixture data. Private key is read only from the mounted file. Output is
 * validation metadata; optionally save the validated public-product fixture locally.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createStructuredResearch} from '../src/structured-research.mjs';
import {analysisMessages,analysisSchema,validAnalysis,finalizeAnalysis} from '../src/analysis.mjs';
const key=readFileSync('/run/secrets/provider_test_key','utf8').trim();
const groups=[{id:'11111111-1111-4111-8111-111111111111',name:'With a meal',description:''},{id:'22222222-2222-4222-8222-222222222222',name:'Evening / before bed',description:''}];
const image=process.env.TEST_IMAGE_FILE?'data:image/'+(process.env.TEST_IMAGE_FILE.endsWith('.png')?'png':'jpeg')+';base64,'+readFileSync(process.env.TEST_IMAGE_FILE).toString('base64'):null;
const name=process.env.TEST_PRODUCT||(image?'':'NOW Foods C-1000 1000 mg tablets with rose hips');
const supplements=process.env.TEST_EXISTING_FILE?JSON.parse(readFileSync(process.env.TEST_EXISTING_FILE,'utf8')):[];
const started=Date.now();
try{
 const debugFetch=async(url,options)=>{const response=await fetch(url,options);if(process.env.TEST_DEBUG_FILE){const data=await response.clone().json();writeFileSync(process.env.TEST_DEBUG_FILE,JSON.stringify(data),{mode:0o600});console.log(JSON.stringify({status:data.status,types:data.output?.map(i=>({type:i.type,status:i.status,name:i.name,action:i.action?.type})),citationCount:data.citations?.length,annotations:data.output?.flatMap(i=>i.content||[]).flatMap(c=>c.annotations||[]).length,usage:data.usage?.server_side_tool_usage_details}));}return response;};
 const {result,model,citations,searches}=await createStructuredResearch({fetch:debugFetch})({key,model:'grok-4.7',messages:analysisMessages({name,image,groups,supplements,language:process.env.TEST_LANGUAGE||'en'}),schema:analysisSchema(groups,supplements),validate:value=>validAnalysis(value,groups,supplements),maxTokens:6000,name:'supplement_analysis_v1_2'});
 finalizeAnalysis(result,{citations,image:Boolean(image)});
 if(!result.identified)throw Error('Product identity could not be established');
 if(process.env.TEST_RESULT_FILE)writeFileSync(process.env.TEST_RESULT_FILE,JSON.stringify(result,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({providerCheck:'passed',identified:result.identified,model,schemaVersion:result.schemaVersion,searches,sources:result.sources.length,nutrients:result.nutrients.length,manufacturerDirections:!!result.dosage.directions,dailyServings:result.dosage.dailyServingsMin,seconds:Math.round((Date.now()-started)/1000)}));
}catch(error){console.error('Provider check failed:',error.code||error.message);process.exitCode=1;}
