/** Provider tests use local mocks: no external calls or paid requests. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createCredentialVault} from '../server/credential-vault.mjs';
import {createStructuredChat} from '../server/structured-chat.mjs';
test('credential vault binds owner/provider, randomizes ciphertext and rejects tampering',()=>{
 const vault=createCredentialVault(randomBytes(32)),context={owner:'one',provider:'xai'};
 const a=vault.seal('private-key',context),b=vault.seal('private-key',context);
 assert.notEqual(a,b);assert.equal(a.includes('private-key'),false);assert.equal(vault.open(a,context),'private-key');
 assert.throws(()=>vault.open(a,{owner:'two',provider:'xai'}));assert.throws(()=>vault.open(a,{owner:'one',provider:'other'}));
 const bytes=Buffer.from(a.slice(3),'base64');bytes[28]^=1;assert.throws(()=>vault.open('v1.'+bytes.toString('base64'),context));
});
test('structured provider disables storage, uses schema and refuses redirects/retries',async()=>{
 let calls=0;
 const chat=createStructuredChat({fetch:async(url,options)=>{calls++;assert.equal(url,'https://api.x.ai/v1/chat/completions');assert.equal(options.redirect,'error');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.response_format.json_schema.strict,true);return new Response(JSON.stringify({model:'test-model',choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]}));}});
 assert.deepEqual(await chat({key:'test-only',model:'test-model',messages:[],schema:{type:'object'},validate:v=>v.ok===true}),{result:{ok:true},model:'test-model'});assert.equal(calls,1);
});
test('provider errors, truncation, oversize data and invalid schema produce safe codes',async()=>{
 const cases=[[new Response('private upstream error',{status:401}),'AI_KEY_REJECTED'],[new Response('{}',{status:429}),'AI_RATE_LIMITED'],[new Response('x'.repeat(270000)),'AI_INVALID_RESPONSE'],[new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})),'AI_INVALID_RESPONSE'],[new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]})),'AI_INVALID_RESPONSE']];
 for(const [response,code]of cases){let calls=0;const chat=createStructuredChat({fetch:async()=>{calls++;return response;}});await assert.rejects(chat({key:'test-only',model:'test',messages:[],schema:{},validate:()=>false}),error=>error.code===code);assert.equal(calls,1);}
 assert.throws(()=>createStructuredChat({baseUrl:'http://untrusted.test'}));
});
