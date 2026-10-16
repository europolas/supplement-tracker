/** Bind short model source IDs to encountered URLs. Exact NIH label identity may
 * be checked via its fixed public endpoint; no arbitrary source URL is fetched.
 * Unsupported quantity claims become unknown, not fabricated substitutes.
 */
import {citationUrl} from './structured-research.mjs';import {ProviderError} from './structured-chat.mjs';
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export const knownBrand=v=>!!v&&!/^(unknown|not visible|not readable|n\/?a|nenustatyta|nežinoma)$/i.test(v.trim());
const brandKey=v=>norm(v).replace(/(?:foods|vitamins|healthproducts|llc|inc)$/,'');
export const sameBrand=(a,b)=>knownBrand(a)&&knownBrand(b)&&(norm(a)===norm(b)||brandKey(a).length>=3&&brandKey(a)===brandKey(b)||Math.min(norm(a).length,norm(b).length)>=5&&(norm(a).startsWith(norm(b))||norm(b).startsWith(norm(a))));
export async function verifiedLabels(citations,target,{fetch:send=globalThis.fetch}={}){
 const out=new Map();if(!knownBrand(target?.manufacturer))return out;
 for(const url of [...new Set(citations)].filter(u=>/^https:\/\/dsld\.od\.nih\.gov\/label\/\d+$/.test(u)).slice(0,3))try{
 const id=Number(url.split('/').pop()),r=await send('https://api.ods.od.nih.gov/dsld/v9/label/'+id,{redirect:'error',signal:AbortSignal.timeout(7000)});if(!r.ok){await r.body?.cancel();continue;}
 const reader=r.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256000){await reader.cancel();throw Error();}chunks.push(value);}const d=JSON.parse(Buffer.concat(chunks).toString());
 if(d.id!==id||!sameBrand(target.manufacturer,d.brandName)||norm(target.name)!==norm(d.fullName))continue;
 out.set(citationUrl(url),{brand:d.brandName,name:d.fullName,servings:d.servingSizes,ingredients:d.ingredientRows?.map(n=>({name:n.name,quantity:n.quantity})),directions:d.statements?.filter(s=>/Suggested|Recommended|Usage|Directions/i.test(s.type)).map(s=>s.notes)});
 }catch{/* Missing/unmatched label never becomes manufacturer evidence. */}return out;
}
export function referencedSchema(schema,ids){
 if(!schema)return schema;const copy=structuredClone(schema);const visit=s=>{if(!s||typeof s!=='object')return;for(const [k,p]of Object.entries(s.properties||{})){if(k==='sourceUrl'||k==='url')p.enum=[...(Array.isArray(p.type)&&p.type.includes('null')?[null]:[]),...ids];visit(p);}if(s.items)visit(s.items);};visit(copy);return copy;
}
export function bindEvidence(raw,book,target,language='en'){
 const result=structuredClone(raw),resolve=value=>{if(value===null)return null;const s=book.find(s=>s.id===value);if(!s)throw new ProviderError('AI_SOURCES_UNVERIFIED');return s.url;};
 const walk=v=>{if(!v||typeof v!=='object')return;for(const [k,value]of Object.entries(v)){if(k==='sourceUrl'||k==='url')v[k]=resolve(value);else if(value&&typeof value==='object')walk(value);}};walk(result);
 if(!result.dosage||!Array.isArray(result.sources)||!Array.isArray(result.nutrients)||!result.compatibility)return result;
 const returnedBrand=result.manufacturer;const mismatch=knownBrand(target?.manufacturer)&&knownBrand(result.manufacturer)&&!sameBrand(target.manufacturer,result.manufacturer);
 if(knownBrand(target?.manufacturer))result.manufacturer=target.manufacturer;
 for(const s of result.sources){if(book.find(b=>b.url===s.url)?.label)s.kind='label_registry';else if(/^https:\/\/dsld\.od\.nih\.gov\/label\/\d+$/.test(book.find(b=>b.url===s.url)?.publisherUrl||s.url))s.kind='regulatory';else if(s.kind==='label_registry')s.kind=/^https:\/\/dsld\.od\.nih\.gov\/label\/\d+$/.test(s.url)?'regulatory':'other';}
 const validMaker=url=>result.sources.some(s=>s.url===url&&(s.kind==='manufacturer'||s.kind==='label_registry'&&book.some(b=>b.url===url&&b.label)));
 if(mismatch){result.sources=result.sources.filter(s=>!norm(s.title).includes(norm(returnedBrand)));result.productName=target.name;result.benefitSummary=target.originalBenefit||(language==='lt'?'Nauda, neaiški':'Benefits, uncertain');result.benefits=target.originalBenefit?[target.originalBenefit]:[];result.cautions=[];result.nutrients=(target.originalComposition||[]).filter(n=>typeof n.name==='string'&&n.name.trim()).slice(0,40).map(n=>({name:n.name,amount:null,unit:'other',originalUnit:null,nrvCode:null,nrvComparable:false,amountNote:'',sourceUrl:null,evidence:'unknown'}));result.compatibility={summary:'',requiresReview:false,assessments:[]};}
 // No image accompanies background research: a sourced label is external
 // evidence, never an assertion that a photo was read in this request.
 for(const entry of [result.dosage,...result.nutrients])if(entry.evidence==='label_photo')entry.evidence='manufacturer';
 const d=result.dosage,label=book.find(s=>s.url===d.sourceUrl)?.label,verifiedServings=!label||label.servings?.some(s=>s.minDailyServings===d.dailyServingsMin&&s.maxDailyServings===d.dailyServingsMax),unsupported=mismatch||d.evidence==='manufacturer'&&(!validMaker(d.sourceUrl)||!verifiedServings);
 if(unsupported){Object.assign(d,{directions:null,servingSize:null,dailyServingsMin:null,dailyServingsMax:null,sourceUrl:null,evidence:'unknown'});result.labelDirections=null;result.whenToUse='';result.howToUse='';result.needsReview=true;}
 for(const n of result.nutrients)if(n.evidence==='manufacturer'&&(!validMaker(n.sourceUrl)||book.find(s=>s.url===n.sourceUrl)?.label&&!book.find(s=>s.url===n.sourceUrl).label.ingredients?.some(i=>i.quantity?.some(q=>q.quantity===n.amount&&String(q.unit).toLowerCase()===String(n.unit).toLowerCase())))){Object.assign(n,{amount:null,nrvComparable:false,sourceUrl:null,evidence:'unknown',amountNote:''});result.needsReview=true;}
 if(unsupported||result.doseFallback?.basis==='not_needed'&&d.evidence==='unknown')result.doseFallback={basis:'unavailable',ingredient:null,dailyAmountMin:null,dailyAmountMax:null,unit:null,sourceUrl:null,explanation:language==='lt'?'Nenustatyta':'Not determined'};
 // These are reserved/derived display fields, not clinical assertions.
 result.compatibility.summary='';result.compatibility.requiresReview=result.compatibility.assessments?.length>0;if(mismatch){result.groupId=null;result.reviewReason=null;}result.evidenceNote='';
 return result;
}
