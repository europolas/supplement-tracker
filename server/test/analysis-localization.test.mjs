import {test} from 'node:test';import assert from 'node:assert/strict';
import {analysisTexts,textFingerprint,localizedAnalysis,validLocalization} from '../src/analysis-localization.mjs';
test('localized views change only cached text, retain source facts and invalidate changed research',()=>{
 const a={language:'lt',manufacturer:'Brand',benefitSummary:'Energija, ląstelės',dosage:{directions:'1 kapsulė per dieną.',dailyServingsMin:1,sourceUrl:'https://maker.example/label'},nutrients:[{name:'Vitaminas C',amount:100,unit:'mg',amountNote:'Nauda.'}]},before=structuredClone(a),fields=analysisTexts(a);
 assert.equal(Object.values(fields).includes('Brand'),false);assert.equal(Object.values(fields).includes('https://maker.example/label'),false);assert.equal(localizedAnalysis(a,'en').localizationNeeded,true);
 a.localizations={en:{fingerprint:textFingerprint(a),fields:{...fields,benefitSummary:'Energy, cells','dosage.directions':'1 capsule daily.','nutrients.0.name':'Vitamin C','nutrients.0.amountNote':'Benefit.'}}};
 const view=localizedAnalysis(a,'en');assert.equal(view.language,'en');assert.equal(view.localizationNeeded,false);assert.equal(view.dosage.directions,'1 capsule daily.');assert.equal(view.nutrients[0].amount,100);assert.equal(a.dosage.directions,before.dosage.directions);assert.equal(a.language,'lt');a.benefitSummary='Pasikeitė';assert.equal(localizedAnalysis(a,'en').localizationNeeded,true);
});
test('translation requires every owner-selected text exactly once and preserves all numeric tokens',()=>{
 const items=[{id:'one',fields:{usage:'1 kapsulė, 600 mg.'}},{id:'two',fields:{benefit:'Nauda.'}}],value={products:[{id:'one',fields:{usage:'1 capsule, 600 mg.'}},{id:'two',fields:{benefit:'Benefit.'}}]};assert.equal(validLocalization(value,items),true);
 for(const change of [{products:[value.products[0],value.products[0]]},{products:[{id:'foreign',fields:{usage:'1 capsule, 600 mg.'}},value.products[1]]},{products:[{id:'one',fields:{usage:'2 capsules, 600 mg.'}},value.products[1]]},{products:[{id:'one',fields:{usage:'1 capsule, 600 mg.',extra:'Injected'}},value.products[1]]}])assert.equal(validLocalization(change,items),false);
});
