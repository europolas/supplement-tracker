/** Independent durable decisions. Host validates stale input/ownership atomically
 * on the server. No optimistic domain changes; update only after acknowledged save.
 */
import {element} from './ui.js';
import {createI18n} from './i18n.js';
export function createProposalReview({root,i18n=createI18n(),onDecision,onChanged=()=>{}}){
 let items=[],busy=false,epoch=0,error='';
 function render(){root.replaceChildren();for(const item of items.filter(i=>!i.status||i.status==='pending')){const card=element('article',{className:'kit-card'},root.ownerDocument);card.append(element('h3',{text:item.name||item.title},root.ownerDocument));if(item.subtitle)card.append(element('p',{text:item.subtitle,className:'kit-muted'},root.ownerDocument));card.append(element('p',{text:String(item.from?.name??item.from??'')+' → '+String(item.to?.name??item.to??'')},root.ownerDocument));if(item.reason)card.append(element('p',{text:item.reason},root.ownerDocument));const row=element('div',{className:'kit-actions kit-actions-pair'},root.ownerDocument);for(const action of ['accept','remove']){const button=element('button',{text:i18n.t(action==='accept'?'kitAccept':'kitRemove'),className:action==='accept'?'primary':'secondary',attributes:{type:'button'}},root.ownerDocument);button.disabled=busy;button.addEventListener('click',()=>void decide(item,action));row.append(button);}card.append(row);root.append(card);}if(error)root.append(element('p',{text:error,attributes:{role:'alert'}},root.ownerDocument));}
 async function decide(item,action){if(busy)return;const version=epoch;busy=true;error='';render();try{const result=await onDecision(item,action);if(version!==epoch)return;items=result?.items||items.filter(i=>i.id!==item.id);onChanged(result);}catch(e){if(version===epoch)error=i18n.message(e.message);}finally{if(version===epoch){busy=false;render();}}}
 return {set(value){epoch++;busy=false;error='';items=structuredClone(value);render();},get busy(){return busy;},reset(){epoch++;items=[];busy=false;error='';root.replaceChildren();},destroy(){this.reset();}};
}
