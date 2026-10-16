/** Translate existing descriptive text only. Numeric facts, identities, groups,
 * sources and dose provenance remain untouched. Cache fingerprints invalidate
 * after research changes text; applying a translation never changes the source.
 */
import {createHash} from 'node:crypto';
export function analysisTexts(a){
 const fields={};const add=path=>{const value=path.split('.').reduce((v,k)=>v?.[k],a);if(typeof value==='string'&&value.trim())fields[path]=value;};
 for(const key of ['variant','benefitSummary','howToUse','whenToUse','labelDirections','reviewReason','evidenceNote','dosage.directions','dosage.servingSize','doseFallback.ingredient','doseFallback.explanation','grouping.explanation'])add(key);
 for(const key of ['benefits','cautions'])for(const [i] of (a[key]||[]).entries())add(key+'.'+i);
 for(const [i]of(a.nutrients||[]).entries())for(const key of ['name','amountNote','originalUnit'])add('nutrients.'+i+'.'+key);
 for(const [i]of(a.sources||[]).entries())add('sources.'+i+'.title');
 for(const [i]of(a.composition?.ingredients||[]).entries())add('composition.ingredients.'+i+'.name');
 for(const [i]of(a.compatibility?.assessments||[]).entries())for(const key of ['reason','recommendation'])add('compatibility.assessments.'+i+'.'+key);
 return fields;
}
export const textFingerprint=a=>createHash('sha256').update(JSON.stringify(analysisTexts(a))).digest('hex');
export function localizedAnalysis(a,language){
 if(!['en','lt'].includes(a.language)||a.language===language)return a;
 const cached=a.localizations?.[language];if(!cached||cached.fingerprint!==textFingerprint(a))return {...a,localizationNeeded:true};
 const copy=structuredClone(a);for(const [path,text]of Object.entries(cached.fields)){const keys=path.split('.'),last=keys.pop();let node=copy;for(const key of keys)node=node[key];node[last]=text;}
 copy.language=language;copy.localizationNeeded=false;return copy;
}
export function localizationSchema(items){return {type:'object',additionalProperties:false,properties:{products:{type:'array',minItems:items.length,maxItems:items.length,items:{anyOf:items.map(item=>({type:'object',additionalProperties:false,properties:{id:{type:'string',enum:[item.id]},fields:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.keys(item.fields).map(k=>[k,{type:'string',maxLength:3000}])),required:Object.keys(item.fields)}},required:['id','fields']}))}}},required:['products']};}
export function validLocalization(value,items){
 if(!value||Object.keys(value).length!==1||!Array.isArray(value.products)||value.products.length!==items.length||new Set(value.products.map(p=>p?.id)).size!==items.length)return false;
 return value.products.every(p=>{const source=items.find(i=>i.id===p?.id);return source&&Object.keys(p).length===2&&p.fields&&Object.keys(p.fields).length===Object.keys(source.fields).length&&Object.entries(source.fields).every(([k,text])=>typeof p.fields[k]==='string'&&p.fields[k].trim()&&p.fields[k].length<=3000&&JSON.stringify(p.fields[k].match(/\d+(?:[.,]\d+)*/g)||[])===JSON.stringify(text.match(/\d+(?:[.,]\d+)*/g)||[]));});
}
