import test from 'node:test';
import assert from 'node:assert/strict';
import {createStructuredResearch,createStructuredOutput} from '../src/structured-research.mjs';
// Transport regression: only the review opt-in permits concurrent source lookups;
// extraction must still omit tools entirely and research must retain provenance.
test('parallel research retains source validation; extraction remains tool-free',async()=>{
 const requests=[];
 const fetch=async(url,init)=>{requests.push(JSON.parse(init.body));return new Response(JSON.stringify({status:'completed',model:'grok-4.7',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"ok":true}'}]},{type:'web_search_call',status:'completed',action:{sources:[{url:'https://example.com/label'}]}}]}));};
 const input={key:'test',model:'grok-4.7',messages:[{role:'user',content:'test'}],schema:{type:'object'},validate:v=>v.ok===true};
 const reviewed=await createStructuredResearch({fetch,parallelToolCalls:true})(input);
 assert.equal(requests[0].parallel_tool_calls,true);assert.equal(requests[0].max_turns,4);assert.equal(requests[0].tool_choice,'required');assert.equal(reviewed.searches,1);assert.deepEqual(reviewed.citations,['https://example.com/label']);
 await createStructuredResearch({fetch})(input);assert.equal(requests[1].parallel_tool_calls,false);
 await createStructuredOutput({fetch,reasoningEffort:'none'})(input);assert.equal(requests[2].model,'grok-4.7');assert.equal(requests[2].reasoning.effort,'none');assert.equal('tools' in requests[2],false);assert.equal('parallel_tool_calls' in requests[2],false);
 const noSources=async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"ok":true}'}]}]}));
 await assert.rejects(createStructuredResearch({fetch:noSources,parallelToolCalls:true})(input),e=>e.code==='AI_RESEARCH_FAILED');
});
