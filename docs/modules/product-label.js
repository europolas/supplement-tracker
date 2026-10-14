/** Presentation-only separation of a stored product label. Never derive strength
 * from nutrients/serving sizes: only move explicit trailing label text. Keep source
 * records unchanged; uncertain qualifiers stay in the title rather than being lost.
 */
export function productLabel({name='',manufacturer='',variant=''}={}) {
  const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
  let title=clean(name),brand=clean(manufacturer),details='';
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const aliases=[brand];if(/^NOW Foods$/i.test(brand))aliases.push('NOW');
  for(const alias of aliases.filter(Boolean)){
    const prefix=new RegExp('^'+escape(alias)+'(?:\\s+|\\s*[–—:|]\\s*)','i');
    if(prefix.test(title)){title=title.replace(prefix,'');break;}
  }
  // Parentheses count as a variant only when they start with a strength or form.
  const packaged=title.match(/\s*\(((?:\d|capsul|tablet|softgel|kapsul|tablet|miltel)[^()]*)\)\s*$/i);
  if(packaged){details=packaged[1];title=title.slice(0,packaged.index).trim();}
  const strength=title.match(/\s+(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|ug|g|IU|TV|%)\b.*)$/i);
  if(strength){details=[strength[1],details].filter(Boolean).join(' · ');title=title.slice(0,strength.index).trim();}
  const saved=clean(variant);
  if(!details&&saved){
    const suffix=new RegExp('\\s*'+escape(saved)+'$','i');
    if(suffix.test(title)&&title.replace(suffix,'').trim())title=title.replace(suffix,'').trim();
    details=saved;
  }
  return {name:title||clean(name),manufacturer:brand,variant:details};
}
