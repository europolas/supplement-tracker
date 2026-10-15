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
const body=buildJevGroupingRequest({products,groups});
const started=performance.now();
const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
if(!response.ok){await response.body?.cancel();throw Error(`TypeSafe HTTP ${response.status}; no retry sent.`);}
const data=await response.json();validateJevAnswers(data,body);
console.log(JSON.stringify({model:data.model,ms:Math.round(performance.now()-started),answers:data.answers,usage:data.usage},null,2));
const expected=['fasting','fats','bed','meal','unknown'];
if(expected.some((group,i)=>data.answers['product_'+i].choice!==group))throw Error('Grouping fixture mismatch; inspect choices before using this provider.');
