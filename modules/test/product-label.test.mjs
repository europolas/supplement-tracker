import test from 'node:test';import assert from 'node:assert/strict';
import {productLabel} from '../src/product-label.js';
test('stored labels separate brand and explicit strength/form without inventing dose',()=>{
 assert.deepEqual(productLabel({name:'Trans Resveratrolis (300 mg kapsulės, 60 vnt.)',manufacturer:'L Cell'}),{name:'Trans Resveratrolis',manufacturer:'L Cell',variant:'300 mg kapsulės, 60 vnt.'});
 assert.deepEqual(productLabel({name:'NOW Alpha Lipoic Acid Extra Strength 600 mg',manufacturer:'NOW Foods'}),{name:'Alpha Lipoic Acid Extra Strength',manufacturer:'NOW Foods',variant:'600 mg'});
 assert.equal(productLabel({name:'Vitamin B12',manufacturer:'NOW Foods'}).name,'Vitamin B12');
 assert.equal(productLabel({name:'CoQ10 (with antioxidants)'}).name,'CoQ10 (with antioxidants)');
 assert.equal(productLabel({name:'Example',variant:null}).variant,'');
 assert.equal(productLabel({name:'D3 1000 IU',manufacturer:'D'}).name,'D3');
 assert.equal(productLabel({name:'A+B Product 300 mg',manufacturer:'A+B'}).name,'Product');
});
