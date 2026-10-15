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
