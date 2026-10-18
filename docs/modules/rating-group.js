/** Accessible nullable rating, independent of any health/domain policy.
 * Host supplies translated labels and optional safe DOM artwork. Values are
 * 1..labels.length or null; clicking the selected choice clears it when allowed.
 * Arrow/Home/End keys move/select; callbacks are explicit UI changes only.
 * No persistence. Destroy when the owner/date view is replaced or reset.
 */
import {element} from './ui.js';
export function createRatingGroup({root,label,labels,value=null,allowClear=true,renderOption,onChange=()=>{}}){
 if(!root||typeof label!=='string'||!Array.isArray(labels)||labels.length<2||labels.length>10||labels.some(s=>typeof s!=='string'||!s))throw new TypeError('Invalid rating group');
 const valid=v=>v===null||Number.isInteger(v)&&v>=1&&v<=labels.length;
 if(!valid(value))throw new TypeError('Invalid rating');
 let current=value,destroyed=false;const bindings=[];
 root.setAttribute('role','radiogroup');root.setAttribute('aria-label',label);
 const buttons=labels.map((text,index)=>{const button=element('button',{attributes:{type:'button',role:'radio','aria-label':text,'data-rating':String(index+1)}},root.ownerDocument);const artwork=renderOption?.(index+1);if(artwork)button.append(artwork);else button.textContent=text;
  const click=()=>select(allowClear&&current===index+1?null:index+1),keydown=event=>{const keys=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?labels.length-1:(index+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+labels.length)%labels.length;select(next+1);buttons[next].focus();};
  button.addEventListener('click',click);button.addEventListener('keydown',keydown);bindings.push(()=>{button.removeEventListener('click',click);button.removeEventListener('keydown',keydown);});return button;
 });
 function paint(){buttons.forEach((button,index)=>{button.setAttribute('aria-checked',String(current===index+1));button.tabIndex=index===(current===null?0:current-1)?0:-1;});}
 function select(next){if(destroyed||next===current)return;current=next;paint();onChange(next);}
 root.replaceChildren(...buttons);paint();
 return {get value(){return current;},setValue(next){if(!valid(next))throw new TypeError('Invalid rating');if(destroyed)return;current=next;paint();},setDisabled(disabled){for(const button of buttons)button.disabled=Boolean(disabled);},destroy(){destroyed=true;bindings.forEach(remove=>remove());root.replaceChildren();root.removeAttribute('role');root.removeAttribute('aria-label');}};
}
