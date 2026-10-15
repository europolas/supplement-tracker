import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validGroupReview,reviewSnapshot} from '../src/group-review.mjs';
test('review proposals cover exactly owned targets and reject foreign IDs or malformed results',()=>{
 const groups=[{id:'g'}],targets=[{id:'a'},{id:'b'}],entry=id=>({supplementId:id,groupId:'g',reason:'Source-based timing.',sourceUrl:'https://example.com'}),valid={assignments:targets.map(t=>entry(t.id))};
 assert.equal(validGroupReview(valid,groups,targets),true);
 for(const assignments of [[entry('a')],[entry('a'),entry('a')],[entry('a'),entry('foreign')],[entry('a'),{...entry('b'),groupId:'foreign'}],[entry('a'),null],[entry('a'),{...entry('b'),extra:true}]])assert.equal(validGroupReview({assignments},groups,targets),false);
 const rows=[{id:'a',name:'A',group_id:'g',analysis:{manufacturer:'Brand'}}];assert.notEqual(reviewSnapshot(rows),reviewSnapshot([{...rows[0],analysis:{manufacturer:'Brand',grouping:{basis:'manual'}}}]));
});
