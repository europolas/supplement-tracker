import test from 'node:test';
import assert from 'node:assert/strict';
import {compactText} from '../src/index.js';
test('preview bounds legacy paragraphs while leaving short Lithuanian/English labels intact',()=>{
 assert.equal(compactText('Energy, cellular support'),'Energy, cellular support');
 assert.equal(compactText('  Energija,\n ląstelių   apsauga '),'Energija, ląstelių apsauga');
 assert.equal(compactText('One two three four five six seven eight'),'One two three four five six…');
 assert.equal(compactText(null),'');
 assert.equal(compactText('<b>literal markup</b>'),'<b>literal markup</b>');
});
test('length limits preserve Unicode and avoid cutting words where possible',()=>{
 assert.equal(compactText('😀😀😀😀😀😀',{maxLength:5}),'😀😀😀😀…');
 assert.equal(compactText('Longword another word',{maxLength:15}),'Longword…');
 assert.equal(compactText('Small label',{maxLength:11}),'Small label');
 assert.throws(()=>compactText('x',{maxWords:0}),RangeError);
 assert.throws(()=>compactText('x',{maxLength:1}),RangeError);
});
