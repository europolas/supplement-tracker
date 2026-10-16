/**
 * Build only public assets. Refuse unmanaged output, inject the allowed API origin, and hash every asset for worker cache versioning. Backend source and .runtime never enter docs/.
 * See AGENTS.md and the reusable library docs/ARCHITECTURE.md.
 */
import { readFile, writeFile, mkdir, cp, rm, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfig } from '../modules/src/config.js';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildStarter({ source = path.join(root, 'src'), output = path.join(root, 'docs'), modules = path.join(root, 'modules'), config: input } = {}) {
  source = path.resolve(source); output = path.resolve(output); modules = path.resolve(modules);
  if ([source, modules, root].includes(output) || source.startsWith(output + path.sep) || modules.startsWith(output + path.sep)) throw new Error('Output would overwrite source files');
  try { const files = await readdir(output); if (files.length) { await access(path.join(output, '.starter-build')); await rm(output, { recursive: true }); } } catch (error) { if (error.code !== 'ENOENT') throw error; /* Missing output is safe; existing unmanaged output is checked below. */ }
  // Never overwrite an existing directory that has user files but no build marker.
  try { const files = await readdir(output); if (files.length && !files.includes('.starter-build')) throw new Error('Refusing to overwrite unmanaged output'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = createConfig(input || JSON.parse(await readFile(path.join(source, 'app.config.json'), 'utf8')));
  await mkdir(output, { recursive: true });
  for (const name of ['index.html', 'app.js', 'custom-icon.js', 'vendor', 'account.html', 'icon-192.png', 'icon-512.png', 'app.css']) await cp(path.join(source, name), path.join(output, name),{recursive:true});
  await cp(path.join(modules, 'src'), path.join(output, 'modules'), { recursive: true });
  await cp(path.join(modules, 'styles/base.css'), path.join(output, 'style.css'));
  await writeFile(path.join(output, 'app.config.json'), JSON.stringify(config, null, 2) + '\n');
  const html = (await readFile(path.join(output, 'index.html'), 'utf8')).replace('__API_ORIGIN__', config.apiUrl ? new URL(config.apiUrl).origin : '');
  await writeFile(path.join(output, 'index.html'), html);
  await writeFile(path.join(output, 'manifest.webmanifest'), JSON.stringify({ id: './', name: config.name, short_name: config.name.slice(0, 24), lang: config.language, start_url: './', scope: './', display: 'standalone', background_color: '#f8f7f3', theme_color: '#f8f7f3', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2));
  const files = [];
  async function walk(dir, prefix = '') { for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const name = prefix + entry.name; if (entry.isDirectory()) await walk(path.join(dir, entry.name), name + '/'); else if (!name.startsWith('.')) files.push(name); } }
  await walk(output);
  const hash = createHash('sha256'); for (const name of files) { hash.update(name); hash.update(await readFile(path.join(output, name))); }
  const version = hash.digest('hex');
  await writeFile(path.join(output, 'sw.js'), `import { installWorker } from './modules/worker.js';\ninstallWorker(${JSON.stringify({ id: config.id, name: config.name, version, assets: ['./', ...files.map(name => './' + name)] })});\n`);
  await writeFile(path.join(output, '.starter-build'), version + '\n');
  return { output, version, assets: files, config };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : undefined;
  const result = await buildStarter({ output }); console.log(`Prepared starter ${result.config.id}, cache ${result.version.slice(0, 12)}`);
}
