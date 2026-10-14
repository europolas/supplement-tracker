/**
 * Native text, URL and file sharing adapter.
 * Call after a user action. Unsupported and user-cancelled sharing are separate outcomes; handle fallback in your app.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export async function share(data, { navigator: nav = globalThis.navigator } = {}) {
  if (!nav.share || (data.files && (!nav.canShare || !nav.canShare({ files: data.files })))) return { supported: false };
  try { await nav.share(data); return { supported: true, shared: true }; }
  catch (error) { if (error.name === 'AbortError') return { supported: true, shared: false }; throw error; }
}
