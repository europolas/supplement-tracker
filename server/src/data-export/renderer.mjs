/** Renders only the escaped app-owned B template, never arbitrary client HTML.
 * Fresh offline/JS-disabled context per export; PDF bytes stay in RAM. Single
 * render slot bounds browser memory. Always closes the process, including timeout.
 * See https://playwright.dev/docs/api/class-page#page-pdf. */
import {chromium} from 'playwright';
import {ApiError} from '../security.mjs';
import {reportHtml} from './template.mjs';
let busy=false;
export async function renderExportPdf(snapshot,{inspect}={}){
 if(busy)throw new ApiError(409,'EXPORT_BUSY');busy=true;let browser,timer;
 try{
  browser=await chromium.launch({timeout:5000,args:['--disable-dev-shm-usage']});
  return await Promise.race([(async()=>{
   const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',viewport:{width:794,height:1123}});
   await context.route('**/*',route=>route.abort());const page=await context.newPage();await page.setContent(reportHtml(snapshot),{timeout:5000});await page.emulateMedia({media:'print'});
   // Long real AI paragraphs flow onto additional B-style pages. Only the
   // inventory is compressed to one A4 page; no names/rows are silently omitted.
   await page.evaluate(()=>{
    const pageNodes=[...document.querySelectorAll('.page')],template=pageNodes[3],body=template.querySelector('.conclusion-body'),chunks=[...body.children];body.replaceChildren();let sheet=template,container=body;
    for(const chunk of chunks){container.append(chunk);const foot=sheet.querySelector('.foot');if(chunk.getBoundingClientRect().bottom>foot.getBoundingClientRect().top-12){chunk.remove();if(!container.children.length)throw Error('PDF paragraph too large');const next=template.cloneNode(true);next.querySelector('.conclusion-body').replaceChildren(chunk);sheet.after(next);sheet=next;container=next.querySelector('.conclusion-body');}}
    const inventory=document.querySelector('.inventory-fit'),sheetInventory=inventory.closest('.page'),available=sheetInventory.querySelector('.foot').offsetTop-inventory.offsetTop-18;for(let i=0;i<5;i++){const height=inventory.getBoundingClientRect().height;if(height<=available)break;const old=Number(inventory.dataset.scale||1),scale=old*available/height;inventory.dataset.scale=String(scale);inventory.style.zoom=String(scale);inventory.style.width='auto';}
    const pages=[...document.querySelectorAll('.page')];if(pages.length>50)throw Error('PDF too large');pages.forEach((n,i)=>n.querySelector('.page-number').textContent=(i+1)+' / '+pages.length);
    for(const n of pages){const footer=n.querySelector('.foot').getBoundingClientRect().top;for(const child of n.children)if(!child.classList.contains('foot')&&child.getBoundingClientRect().bottom>footer-8)throw Error('PDF content overflow');}
   });
   if(inspect)await inspect(page);
   const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});if(pdf.length>8*1024*1024)throw new ApiError(400,'EXPORT_TOO_LARGE');return pdf;
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new ApiError(503,'EXPORT_TIMEOUT')),11000);})]);
 }finally{clearTimeout(timer);await browser?.close().catch(()=>{});busy=false;}
}
