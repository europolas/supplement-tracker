/** Web research tests use fixtures, never external/paid calls. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStructuredResearch,createStructuredOutput,citationUrl} from '../server/structured-research.mjs';
const envelope=(extra={})=>({status:'completed',model:'test',output:[{type:'web_search_call',status:'completed'},{type:'message',role:'assistant',content:[{type:'output_text',text:'{"ok":true}',annotations:[{type:'url_citation',url:'https://maker.example/product#label'}]}]}],...extra});
test('research requires completed tools and independently collected citations',async()=>{
 let calls=0;const research=createStructuredResearch({fetch:async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(url,'https://api.x.ai/v1/responses');assert.equal(body.store,false);assert.equal(body.reasoning.effort,'low');assert.equal(body.tool_choice,'required');assert.ok(body.include.includes('web_search_call.action.sources'));assert.equal(body.max_turns,4);assert.equal(body.parallel_tool_calls,false);assert.deepEqual(body.tools,[{type:'web_search'}]);assert.equal(body.input[1].content[0].type,'input_image');return new Response(JSON.stringify(envelope()));}});
 const r=await research({key:'test',model:'test',messages:[{role:'system',content:'Data only'},{role:'user',content:[{type:'image_url',image_url:{url:'data:image/jpeg;base64,TEST'}}]}],schema:{},validate:v=>v.ok});assert.equal(calls,1);assert.deepEqual(r.citations,['https://maker.example/product']);assert.equal(r.searches,1);
});
test('structured image extraction offers no tools, checks its contract and exposes no fabricated sources',async()=>{
 const output=[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"ok":true}'}]}];let calls=0;
 const extract=createStructuredOutput({fetch:async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.tool_choice,undefined);assert.equal(body.tools,undefined);assert.equal(body.max_turns,undefined);assert.equal(body.text.format.strict,true);return new Response(JSON.stringify(envelope({output})));}});
 const input={key:'test',model:'test',messages:[],schema:{},validate:v=>v.ok};const result=await extract(input);assert.equal(result.searches,0);assert.deepEqual(result.citations,[]);assert.equal(calls,1);
 await assert.rejects(extract({...input,validate:()=>false}),e=>e.code==='AI_INVALID_RESPONSE');assert.equal(calls,2,'Invalid output is not retried');
});
test('missing search, failed tools, missing citations and incomplete/refusal results fail closed',async()=>{
 for(const [body,code]of [[envelope({output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"ok":true}'}]}]}),'AI_RESEARCH_FAILED'],[envelope({status:'incomplete'}),'AI_INVALID_RESPONSE'],[envelope({output:[{type:'web_search_call',status:'completed'},{type:'message',role:'assistant',content:[{type:'output_text',text:'{"ok":true}',annotations:[]}]}]}),'AI_RESEARCH_FAILED']]){
  const research=createStructuredResearch({fetch:async()=>new Response(JSON.stringify(body))});await assert.rejects(research({key:'test',model:'test',messages:[],schema:{},validate:()=>true}),e=>e.code===code);
 }
 for(const url of ['javascript:alert(1)','http://example.com','https://localhost/','https://127.0.0.1/','https://user:pass@example.com/','https://[::1]/'])assert.equal(citationUrl(url),null);
});
