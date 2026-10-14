/**
 * Copy plain text through the native clipboard API.
 * Requires a secure context and user activation. Unsupported and denied access are explicit errors; do not silently fake success.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export async function copyText(text, { navigator: nav = globalThis.navigator } = {}) {
  if (!nav.clipboard?.writeText) throw new Error("Copying is not supported on this device.");
  await nav.clipboard.writeText(String(text));
}
