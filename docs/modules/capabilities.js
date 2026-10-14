/**
 * Feature and permission availability checks.
 * A reported capability does not grant permission. Query failures are normal; request permissions only after a user action.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function capabilities({ window: win = globalThis.window, navigator: nav = globalThis.navigator } = {}) {
  return { installed: nav.standalone === true || Boolean(win.matchMedia?.('(display-mode: standalone)').matches), serviceWorker: Boolean(nav.serviceWorker), notifications: Boolean(win.Notification && win.PushManager), camera: Boolean(nav.mediaDevices?.getUserMedia), geolocation: Boolean(nav.geolocation), share: Boolean(nav.share), clipboard: Boolean(nav.clipboard?.writeText), database: Boolean(win.indexedDB) };
}
export async function permissionState(name, { navigator: nav = globalThis.navigator } = {}) { try { return (await nav.permissions.query({ name })).state; } catch { return 'unknown'; } }
