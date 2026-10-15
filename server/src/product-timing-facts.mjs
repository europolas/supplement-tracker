/** Small reviewed manufacturer-facts cache, NOT a product-to-group lookup table.
 * Brand + exact named formulation required; unknown brands/variants do not match.
 * Only timing is reused, never dose or complete composition. Refresh within 90 days.
 * Sources reviewed 2026-10-15. JEV sees facts; deterministic rules preserve food constraints.
 */
const records=[
 {brand:/^l cell$/i,name:/^nad\+? formula(?:®)?$/i,text:'Manufacturer recommends use 15–30 minutes before breakfast with water. Prefer the morning empty-stomach slot.',source:'https://lcell.lt/en/products/nad-formula-500mg-30-days-90-capsules'},
 {brand:/^now(?: foods)?$/i,name:/^(?:extra strength )?alpha lipoic acid(?: extra strength)? 600\s*mg$/i,text:'Manufacturer recommends taking this exact 600 mg product preferably with a meal. Do not schedule fasting.',avoidFasting:true,source:'https://www.nowfoods.com/products/supplements/alpha-lipoic-acid-extra-strength-600-mg-veg-capsules'},
 {brand:/^kal$/i,name:/^magnesium taurate\+?(?: 400\s*mg)?$/i,text:'Manufacturer permits a meal or a glass of water. Evening is a common practical preference for relaxation, but daytime is also permitted.',source:'https://www.kalvitamins.com/products/magnesium-taurate'},
 {brand:/^zenyth$/i,name:/^magnesium bisglycinate 1000\s*mg$/i,text:'Manufacturer prefers use with meals and explicitly permits morning or evening at bedtime. An evening slot is compatible when taken with food.',avoidFasting:true,source:'https://zenyth.ro/produse/magnesium-bisglycinate-90-capsule/'},
 {brand:/^swanson(?: vitamins)?$/i,name:/^(?:nac(?: acetyl cysteine| n-acetyl cysteine)?|n-acetyl cysteine)(?: 600\s*mg)?$/i,text:'Manufacturer says take with water; no required meal or time. Any time of day is allowed. Fasting or bedtime is not a manufacturer requirement.',source:'https://www.swansonvitamins.com/p/swanson-premium-nac-n-acetyl-cysteine-600-mg-100-caps'}
];
export function timingFacts(product,now=Date.now()){
 if(now-Date.parse('2026-10-15T00:00:00Z')>90*86400000)return null;
 const r=records.find(r=>r.brand.test(product.manufacturer?.trim()||'')&&r.name.test(product.name?.trim()||''));
 return r?{text:r.text,avoidFasting:Boolean(r.avoidFasting),source:r.source,checkedAt:'2026-10-15'}:null;
}
