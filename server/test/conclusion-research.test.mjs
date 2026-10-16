import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conclusionResearchMessages,conclusionResearchEvidence} from '../src/conclusion-research.mjs';
test('clinical search sends public identities only and checks grounded sources',()=>{
 const rows=[{id:'private-id',name:'Magnesium',group_id:'private-group',owner:'private-owner',analysis:{manufacturer:'Brand',nutrients:[{name:'Magnesium',amount:200}],labelDirections:'private note'},personal:{weightKg:80}}];
 const messages=conclusionResearchMessages(rows,new Date('2026-10-16'));
 assert.deepEqual(JSON.parse(messages[1].content),{products:[{name:'Magnesium',manufacturer:'Brand',ingredients:['Magnesium']}]});
 assert.doesNotMatch(JSON.stringify(messages),/private-|weightKg|personal|labelDirections/);
 assert.match(messages[0].content,/2026-10-16/);assert.match(messages[0].content,/randomized controlled/);
 for(const response of [{result:{text:'Unverified'},searches:0,citations:['https://pubmed.ncbi.nlm.nih.gov/1']},{result:{text:'Unverified'},searches:1,citations:['javascript:bad']}])assert.throws(()=>conclusionResearchEvidence(response),/AI_RESEARCH_FAILED/);
 const evidence=conclusionResearchEvidence({result:{text:'RCT finding'},searches:1,citations:['https://pubmed.ncbi.nlm.nih.gov/1','https://pubmed.ncbi.nlm.nih.gov/1'],citationTitles:{'https://pubmed.ncbi.nlm.nih.gov/1':'A human trial'}});
 assert.deepEqual(evidence.sources,[{id:'S1',url:'https://pubmed.ncbi.nlm.nih.gov/1',title:'A human trial'}]);
});
