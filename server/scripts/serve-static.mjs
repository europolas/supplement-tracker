/** Production public-asset server behind HTTPS nginx. Only the generated /public
 * tree is mounted, read-only; no API source, secrets or account responses are here.
 * The proxy strips /supplement-tracker/ but the browser retains that worker scope.
 * Missing assets fail with 404 rather than returning HTML to module/worker requests.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root='/public';
const types={'.pdf':'application/pdf','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
  if(!file.startsWith(root+'/')||path.relative(root,file).split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(3000,'0.0.0.0');
process.on('SIGTERM',()=>server.close());
