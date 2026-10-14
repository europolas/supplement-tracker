/**
 * Local development static server bound to loopback. Serve built assets only; reject dotfiles and directory traversal. This is not a production API or HTTPS server.
 * See AGENTS.md and the reusable library docs/ARCHITECTURE.md.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const argument = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const root = path.resolve(argument('--dir') || 'docs');
const port = Number(argument('--port') || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (name.endsWith('/') ? name + 'index.html' : name));
    if (!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some(part => part.startsWith('.'))) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Starter: http://localhost:${port}`));
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
