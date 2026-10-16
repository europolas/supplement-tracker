import {test}from'node:test';import assert from'node:assert/strict';
import{routineGrouping}from'../src/grouping.mjs';
test('timing keeps owned provisional fallback; manual unassign and deleted groups are respected',()=>{
 const ownedIds=['breakfast','evening'];
 assert.deepEqual(routineGrouping({proposed:'breakfast',previous:'evening',ownedIds}),{groupId:'breakfast',basis:'researched'});
 assert.deepEqual(routineGrouping({proposed:null,previous:'evening',ownedIds}),{groupId:'evening',basis:'provisional'});
 assert.deepEqual(routineGrouping({proposed:'breakfast',previous:'evening',manual:true,current:null,ownedIds}),{groupId:null,basis:'manual'});
 assert.deepEqual(routineGrouping({proposed:'foreign',previous:'deleted',ownedIds}),{groupId:null,basis:'unresolved'});
});
import{regroupSchema,validRegroup}from'../src/grouping.mjs';
test('legacy regroup proposals require every owned product exactly once and only owned groups',()=>{
 const groups=[{id:'meal'}],products=[{id:'one'},{id:'two'}],result={assignments:products.map(p=>({supplementId:p.id,groupId:'meal',reason:'Planning only'}))};
 assert.equal(validRegroup(result,groups,products),true);assert.equal(regroupSchema(groups,products).properties.assignments.minItems,2);
 assert.equal(validRegroup({assignments:[result.assignments[0],result.assignments[0]]},groups,products),false);
 assert.equal(validRegroup({assignments:[{...result.assignments[0],groupId:'foreign'},result.assignments[1]]},groups,products),false);
});

import {researchedGrouping} from '../src/grouping.mjs';
test('sourced details move AI groups but preserve manual choices, races and unknown provenance',()=>{
 const input={analysis:{grouping:{basis:'provisional'}},previous:'fast',current:'fast',proposed:'meal',ownedIds:['fast','meal'],groupsUnchanged:true,reason:'Exact label recommends a meal.',sourceUrl:'https://manufacturer.example/label',checkedAt:'2026-10-16'};
 assert.equal(researchedGrouping(input).groupId,'meal');assert.equal(researchedGrouping(input).basis,'researched');
 for(const changes of [{analysis:{grouping:{basis:'manual'}}},{groupsUnchanged:false},{proposed:'foreign'},{proposed:null},{reason:''},{sourceUrl:null},{analysis:{}}])assert.equal(researchedGrouping({...input,...changes}).groupId,'fast');
 assert.equal(researchedGrouping({...input,current:null,analysis:{grouping:{basis:'manual'}}}).groupId,null);
 assert.equal(researchedGrouping({...input,current:null,previous:null}).groupId,null);
 assert.equal(researchedGrouping({...input,current:'meal'}).groupId,'meal');
 assert.equal(researchedGrouping({...input,analysis:{identity:{groupId:'fast'}}}).groupId,'meal');
});
