/**
 * Validate and freeze per-application configuration.
 * New apps default to English; unique IDs namespace storage. Feature flags do not grant server permissions.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createConfig(input) {
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(input?.id)) throw new TypeError('App id must be 3–24 lowercase letters, digits or hyphens');
  const name = String(input.name || '').trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new TypeError('App name must be 1–80 characters without control characters');
  if (input.apiUrl) {
    const url = new URL(input.apiUrl);
    if (url.username || url.password || url.hash || url.search || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new TypeError('API requires HTTPS (localhost is allowed for development)');
  }
  if (input.theme && !['dark', 'light', 'system'].includes(input.theme)) throw new TypeError('Invalid theme');
  if (input.language && !['lt', 'en'].includes(input.language)) throw new TypeError('Unsupported starter language');
  for (const key of ['auth', 'notifications']) if (input.features?.[key] !== undefined && typeof input.features[key] !== 'boolean') throw new TypeError('Feature flags must be boolean');
  for (const key of ['lockZoom', 'lockSelection']) if (input.interaction?.[key] !== undefined && typeof input.interaction[key] !== 'boolean') throw new TypeError('Interaction flags must be boolean');
  return Object.freeze({ id: input.id, name, version: input.version || '1.0.0', apiUrl: input.apiUrl || '', language: input.language || 'en', theme: input.theme || 'dark', features: Object.freeze({ auth: false, notifications: false, ...input.features }), interaction: Object.freeze({ lockZoom: true, lockSelection: true, ...input.interaction }) });
}
