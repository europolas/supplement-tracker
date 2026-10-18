/** Untrusted icon input is reconstructed from a small inert SVG allowlist.
 * No HTML insertion, style, scripts, external URLs, use/image/foreignObject or
 * event attributes. Bootstrap syntax becomes an owned CSS class, never markup.
 * Return null for an empty default. Throws INVALID_GROUP_ICON for unsafe input.
 */
export function parseCustomIcon(value){
 const source=String(value||'').trim();if(!source)return null;
 const fail=()=>{throw new Error('INVALID_GROUP_ICON');};if(source.length>16000||/<!|<\?/.test(source))fail();
 const bi=/^<i\s+class\s*=\s*["']bi\s+(bi-[a-z0-9-]+)["']\s*>\s*<\/i>$/i.exec(source);
 if(bi){const node=document.createElement('i');node.className='bi '+bi[1].toLowerCase();node.setAttribute('aria-hidden','true');return node;}
 const doc=new DOMParser().parseFromString(source,'image/svg+xml'),root=doc.documentElement;
 if(root.localName!=='svg'||doc.querySelector('parsererror')||root.namespaceURI!=='http://www.w3.org/2000/svg'&&root.namespaceURI!==null)fail();
 const tags=new Set(['svg','g','path','circle','ellipse','rect','line','polyline','polygon','title','desc']);
 const attrs=new Set(['viewBox','d','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','vector-effect']);let count=0;
 const copy=(input,depth=0)=>{if(++count>250||depth>20||!tags.has(input.localName)||input.namespaceURI&&input.namespaceURI!=='http://www.w3.org/2000/svg')fail();const output=document.createElementNS('http://www.w3.org/2000/svg',input.localName);
 for(const a of input.attributes){if(['xmlns','class','aria-hidden','role','focusable'].includes(a.name))continue;if(!attrs.has(a.name)||a.value.length>12000||/url\s*\(|[<>]|javascript:|data:|https?:/i.test(a.value))fail();output.setAttribute(a.name,a.value);}
 for(const child of input.childNodes){if(child.nodeType===1)output.append(copy(child,depth+1));else if(child.nodeType===3&&['title','desc'].includes(input.localName))output.append(document.createTextNode(child.textContent));else if(child.nodeType===3&&child.textContent.trim())fail();}return output;};
 const safe=copy(root);safe.setAttribute('aria-hidden','true');safe.setAttribute('focusable','false');safe.classList.add('custom-group-svg');if(!safe.hasAttribute('viewBox'))safe.setAttribute('viewBox','0 0 16 16');return safe;
}
