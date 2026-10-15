/** Explicit paid, DB-free Jev experiment. No Grok import, account access, automatic
 * retries, photos, or secret logging. Tests classification of GIVEN label facts,
 * not autonomous product discovery or verification that those facts are true.
 * Usage: TYPESAFE_TEST_KEY_FILE=/private/key node scripts/check-jev-grouping.mjs
 */
import {readFileSync} from 'node:fs';
import {buildJevGroupingRequest,validateJevAnswers} from '../server/src/providers/jev-evaluation.mjs';
const file=process.env.TYPESAFE_TEST_KEY_FILE;
if(!file)throw Error('Set TYPESAFE_TEST_KEY_FILE to a private key file.');
const key=readFileSync(file,'utf8').trim();
if(!key)throw Error('The private TypeSafe key file is empty.');
const groups=[{id:'fasting',name:'Morning — empty stomach'},{id:'fats',name:'Meal containing fats'},{id:'meal',name:'With a meal'},{id:'bed',name:'Before bed'}];
// Synthetic facts avoid comparing a classifier with an internet-research task.
const products=[
 {id:'a',name:'Fixture A',directions:'Take on an empty stomach with water.'},
 {id:'b',name:'Fixture B',directions:'Take with a meal containing fat.'},
 {id:'c',name:'Fixture C',directions:'Take 30 minutes before bedtime.'},
 {id:'d',name:'Fixture D',directions:'Take with food. No other timing instructions.'},
 {id:'e',name:'Fixture E',directions:'No usage directions available.'}
];
const expected=['fasting','fats','bed','meal','unknown'];
// Opt-in matrix adds an order-invariance check and a 16-item batch. All inputs
// remain synthetic label facts: these timings exclude OCR and evidence retrieval.
const cases=[{name:'basic',groups,products,expected}];
if(process.env.JEV_TEST_MATRIX==='1') {
 cases.push({name:'reversed-options',groups:[...groups].reverse(),products,expected});
 const facts=[
  ['Take on an empty stomach with water.','fasting'],
  ['Take with a fat-containing meal.','fats'],
  ['Take 30 minutes before going to sleep.','bed'],
  ['Take with food; no specific time is stated.','meal'],
  ['Usage instructions are not provided.','unknown'],
  ['Take in the morning before eating, on an empty stomach.','fasting'],
  ['Take with lunch containing some dietary fat.','fats'],
  ['Take just before bedtime.','bed'],
  ['Take during a meal; additional fat is not required.','meal'],
  ['Product name only, with no directions.','unknown'],
  ['Do not take on an empty stomach. Take with food.','meal'],
  ['Take before sleep, not in the morning.','bed'],
  ['Take with breakfast that contains dietary fat.','fats'],
  ['Take on an empty stomach; do not take with food.','fasting'],
  ['Take with a meal, not just before sleeping.','meal'],
  ['Instructions conflict: always take with food AND never take with food.','unknown']
 ];
 cases.push({name:'sixteen-label-facts',groups,products:facts.map(([directions],i)=>({id:'fixture-'+i,name:'Synthetic fixture '+i,directions})),expected:facts.map(([,group])=>group)});
}
let failed=false;
for(const fixture of cases) {
 const body=buildJevGroupingRequest(fixture);
 const started=performance.now();
 const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok){await response.body?.cancel();throw Error(`TypeSafe HTTP ${response.status}; no retry sent.`);}
 const data=await response.json();validateJevAnswers(data,body);
 const mismatches=fixture.expected.flatMap((expected,i)=>data.answers['product_'+i].choice===expected?[]:[{index:i,expected,actual:data.answers['product_'+i].choice}]);
 console.log(JSON.stringify({case:fixture.name,model:data.model,ms:Math.round(performance.now()-started),count:fixture.products.length,correct:fixture.products.length-mismatches.length,mismatches,answers:data.answers,usage:data.usage}));
 failed ||= mismatches.length>0;
}
if(failed)throw Error('Grouping fixture mismatch; inspect choices before using this provider.');
