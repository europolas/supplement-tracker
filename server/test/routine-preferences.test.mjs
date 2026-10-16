import {test} from 'node:test';import assert from 'node:assert/strict';
import {validRoutine,validTiming,routineFromRow,routineInstructions} from '../src/routine-preferences.mjs';
import {detailsMessages} from '../src/product-details.mjs';import {routineRecheckMessages} from '../src/routine-recheck.mjs';import {basicProductsMessages} from '../src/photo-products.mjs';import {createGeminiPipeline,createGeminiResearch} from '../src/providers/gemini.mjs';import {isTrackerRoute} from '../src/tracker-routing.mjs';
const timing={mode:'exact',start:'08:00',end:null},routine={version:1,meals:Object.fromEntries(['breakfast','lunch','dinner'].map(k=>[k,{status:'yes',timing}])),exercise:{status:'no',frequency:'varies',timing:{mode:'varies',start:null,end:null}},sleep:{timing:{mode:'approximate',start:'23:00',end:'01:00'}},days:'varies',strategy:'rhythm',restEvening:true};
test('routine choices accept overnight ranges, skipped meals and irregular days without free-text payloads',()=>{
 assert.equal(validRoutine(routine),true);assert.equal(validRoutine(null),true);assert.deepEqual(routineFromRow({routine:JSON.stringify(routine),routine_revision:3}),{routine,routineRevision:3});assert.equal(isTrackerRoute('/settings/routine'),true);
 for(const bad of [{...routine,unknown:'injection'},{...routine,strategy:'override-label'},{...routine,restEvening:'yes'},{...routine,version:2},{...routine,sleep:{timing:{mode:'exact',start:'08:05',end:null}}},{...routine,meals:{...routine.meals,breakfast:{status:'no',timing}}}])assert.equal(validRoutine(bad),false);
 for(const bad of [{mode:'exact',start:'24:00',end:null},{mode:'varies',start:'08:00',end:null},{mode:'approximate',start:'08:00',end:'08:00'}])assert.equal(validTiming(bad),false);
 const skipped=structuredClone(routine);skipped.meals.breakfast={status:'no',timing:{mode:'varies',start:null,end:null}};assert.equal(validRoutine(skipped),true);
});
test('saved routine enters recognition, researched timing and Recheck, never Search or manual research',async()=>{
 const groups=[{id:'flex',name:'Any time'}],target={name:'Product',manufacturer:'Brand',groupId:'flex',groupingBasis:'researched'};
 const messages=basicProductsMessages({name:'Product',groups,routine});let seen=false;
 const pipeline=createGeminiPipeline({provider:async input=>{seen=true;const payload=JSON.parse(input.messages[1].content[0].text);assert.deepEqual(payload.routinePreferences,routine);assert.ok(input.messages[0].content.includes(routineInstructions(routine)));return {result:{products:[{name:'Product',manufacturer:'Brand',ingredients:[],groupId:'flex',benefit:'Energy'}]}};}});await pipeline.discover({messages});assert.equal(seen,true);
 const details=detailsMessages({name:'Product',target,groups,full:true,routine});assert.deepEqual(JSON.parse(details[1].content[0].text).routinePreferences,routine);assert.ok(details[0].content.includes(routineInstructions(routine)));
 const manual=detailsMessages({name:'Product',target:{...target,groupingBasis:'manual'},groups,full:true,routine});assert.doesNotMatch(JSON.stringify(manual),/routinePreferences|restEvening|groupId/);
 const review=routineRecheckMessages(groups,[],'en',routine);assert.deepEqual(JSON.parse(review[1].content).routinePreferences,routine);
 await createGeminiResearch({search:async input=>{assert.doesNotMatch(JSON.stringify(input.messages),/routinePreferences|restEvening|08:00|23:00|Any time/);return {result:{text:'Official selected product facts'},citations:[]};},extract:async input=>{assert.match(JSON.stringify(input.messages),/routinePreferences/);return {result:{ok:true}};}})({messages:details,schema:{}});
});
