/**
 * Client file checks, previews, downloads, JSON import/export and upload adapter.
 * Revoke previews on unmount. MIME/size checks are convenience only; upload authorization and validation belong to your server.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function validateFile(file, { maxBytes = 10 * 1024 * 1024, types = [] } = {}) {
  if (!file || file.size > maxBytes) throw new Error("The file is too large or has not been selected.");
  if (types.length && !types.some(type => type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type)) throw new Error("Invalid file type.");
  return file;
}
export function previewFile(file, { URL: urls = globalThis.URL } = {}) { const url = urls.createObjectURL(file); return { url, dispose: () => urls.revokeObjectURL(url) }; }
export function downloadBlob(blob, filename, { document: doc = globalThis.document, URL: urls = globalThis.URL } = {}) { const url = urls.createObjectURL(blob); const link = doc.createElement('a'); link.href = url; link.download = filename.replace(/[\\/]/g, '_'); doc.body.append(link); link.click(); link.remove(); setTimeout(() => urls.revokeObjectURL(url), 1000); }
export async function uploadFile(api, path, file, options = {}) { validateFile(file, options); const body = new FormData(); body.append(options.field || 'file', file); return api.post(path, body, { signal: options.signal }); }
export function exportJson(data, filename = 'data.json', options) { downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename, options); }
export async function importJson(file, { maxBytes = 1024 * 1024, validate = () => true } = {}) { validateFile(file, { maxBytes }); const data = JSON.parse(await file.text()); if (!validate(data)) throw new Error("The imported data has an invalid structure."); return data; }
