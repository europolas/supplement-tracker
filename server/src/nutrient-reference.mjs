/** EU adult food-label NRVs, Regulation (EU) 1169/2011 Annex XIII Part A.
 * These are labeling references, NOT a personal RDA, treatment dose or upper limit.
 * The server owns the constants and math; model output cannot supply its own NRV.
 * Only compatible elemental/vitamin-equivalent mass amounts are compared. Compound
 * masses, IU, unknown units, folate DFE and other non-equivalent forms stay unknown.
 */
export const NRV_SOURCE='https://eur-lex.europa.eu/eli/reg/2011/1169/2025-04-01/eng';
export const NRVS=Object.freeze({
 vitamin_a:[800,'ug'],vitamin_d:[5,'ug'],vitamin_e:[12,'mg'],vitamin_k:[75,'ug'],vitamin_c:[80,'mg'],
 thiamin:[1.1,'mg'],riboflavin:[1.4,'mg'],niacin:[16,'mg'],vitamin_b6:[1.4,'mg'],folic_acid:[200,'ug'],vitamin_b12:[2.5,'ug'],biotin:[50,'ug'],pantothenic_acid:[6,'mg'],
 potassium:[2000,'mg'],chloride:[800,'mg'],calcium:[800,'mg'],phosphorus:[700,'mg'],magnesium:[375,'mg'],iron:[14,'mg'],zinc:[10,'mg'],copper:[1,'mg'],manganese:[2,'mg'],fluoride:[3.5,'mg'],selenium:[55,'ug'],chromium:[40,'ug'],molybdenum:[50,'ug'],iodine:[150,'ug']
});
const scale={g:1000,mg:1,ug:0.001};
const round=value=>Math.round(value*100)/100;
export function enrichNutrients(analysis){
 const min=analysis.dosage.dailyServingsMin,max=analysis.dosage.dailyServingsMax;
 return analysis.nutrients.map(n=>{
  const ref=NRVS[n.nrvCode],comparable=ref&&n.nrvComparable&&Number.isFinite(n.amount)&&scale[n.unit]!==undefined;
  const perServing=comparable?n.amount*scale[n.unit]/scale[ref[1]]/ref[0]*100:null;
  return {...n,reference:ref?{amount:ref[0],unit:ref[1],sourceUrl:NRV_SOURCE,kind:'EU_ADULT_LABEL_NRV'}:null,perServingPercent:perServing===null?null:round(perServing),dailyAmountMin:n.amount!==null&&min!==null?round(n.amount*min):null,dailyAmountMax:n.amount!==null&&max!==null?round(n.amount*max):null,dailyPercentMin:perServing!==null&&min!==null?round(perServing*min):null,dailyPercentMax:perServing!==null&&max!==null?round(perServing*max):null};
 });
}
