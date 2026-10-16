import {test} from 'node:test';import assert from 'node:assert/strict';
import {protectNumbers,restoreNumbers,createLocalizationProvider} from '../src/localization-provider.mjs';
import {validLocalization,validLocalizationBatch} from '../src/analysis-localization.mjs';
import {ProviderError} from '../src/structured-chat.mjs';
test('numeric placeholders preserve decimal facts and refuse changed, missing, duplicated or reordered quantities',()=>{
 const source='Take 1.5 capsules, 600 mg; vitamin B6, 1,000 IU.',p=protectNumbers(source);assert.doesNotMatch(p.text,/\d/);assert.equal(restoreNumbers('Translated '+p.text,p),'Translated '+source);
 for(const bad of [p.text.replace(p.numbers[0].token,'1,5'),p.text.replace(p.numbers[0].token,''),p.text+p.numbers[0].token,p.text+' 123',p.text.replace(p.numbers[0].token,'TMP').replace(p.numbers[1].token,p.numbers[0].token).replace('TMP',p.numbers[1].token)])assert.equal(restoreNumbers(bad,p),null);
 const many=protectNumbers(Array.from({length:60},(_,i)=>i).join(' '));assert.equal(restoreNumbers(many.text,many),Array.from({length:60},(_,i)=>i).join(' '));
});
test('deduplicated slots repair only invalid fields once and restore original paths/IDs/numbers',async()=>{
 const items=[{id:'one',fields:{usage:'1.5 capsules, 600 mg.',benefit:'Support.'}},{id:'two',fields:{dose:'1.5 capsules, 600 mg.',benefit:'Support.'}}];let calls=0;
 const localize=createLocalizationProvider(async input=>{calls++;const texts=JSON.parse(input.messages[1].content).texts;assert.equal(texts.length,calls===1?2:1);const result={translations:texts.map((s,i)=>({id:s.id,text:calls===1&&i===0?'1,5 capsules, 600 mg.':'Translated '+s.text}))};assert.equal(input.validate(result),true);return {result,model:'test',usage:{inputTokens:10,outputTokens:5}};});
 const response=await localize({key:'isolated',items,language:'lt'});assert.equal(calls,2);assert.equal(response.calls,2);assert.deepEqual(response.failedIds,[]);assert.equal(validLocalization(response.result,items),true);assert.equal(response.result.products[0].fields.usage,'Translated 1.5 capsules, 600 mg.');assert.deepEqual(response.usage,{inputTokens:20,outputTokens:10});
});
test('one failed product cannot discard valid neighbours or expand a bounded retry',async()=>{
 const items=[{id:'one',fields:{usage:'1 capsule'}},{id:'two',fields:{benefit:'Known benefit'}}];let calls=0;
 const response=await createLocalizationProvider(async input=>{calls++;const texts=JSON.parse(input.messages[1].content).texts;return {result:{translations:texts.map(s=>({id:s.id,text:s.text.includes('⟦')?'Wrong 2 capsules':'Translated '+s.text}))}};})({items,language:'en'});
 assert.equal(calls,2);assert.deepEqual(response.failedIds,['one']);assert.equal(response.result.products.length,1);assert.equal(validLocalizationBatch(response,items),true);assert.equal(validLocalizationBatch({...response,failedIds:['foreign']},items),false);assert.equal(validLocalizationBatch({...response,failedIds:['one','one']},items),false);
});
test('invalid structured output repairs once; key/network errors never automatically retry',async()=>{
 let calls=0;const result=await createLocalizationProvider(async()=>{calls++;throw new ProviderError('AI_INVALID_RESPONSE');})({items:[{id:'one',fields:{text:'Fact'}}],language:'en'});assert.equal(calls,2);assert.deepEqual(result.failedIds,['one']);calls=0;await assert.rejects(createLocalizationProvider(async()=>{calls++;throw new ProviderError('AI_KEY_REJECTED');})({items:[{id:'one',fields:{text:'Fact'}}],language:'en'}));assert.equal(calls,1);
});
