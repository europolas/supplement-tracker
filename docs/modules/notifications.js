/**
 * Native Web Push subscription and permission handling.
 * iOS requires an installed Home Screen PWA. VAPID private keys stay on the server; remove server registration before unsubscribing.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function notificationSupport({ window: win = globalThis.window, navigator: nav = globalThis.navigator } = {}) {
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const installed = nav.standalone === true || win.matchMedia('(display-mode: standalone)').matches;
  return { supported: Boolean(win.Notification && win.PushManager && nav.serviceWorker && (!ios || installed)), needsInstallation: ios && !installed, permission: win.Notification?.permission || 'unsupported' };
}
export function keyBytes(key) { const text = key.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(text + '='.repeat((4 - text.length % 4) % 4)), char => char.charCodeAt(0)); }
export async function subscribePush(publicKey, { window: win = globalThis.window, navigator: nav = globalThis.navigator } = {}) {
  if (!notificationSupport({ window: win, navigator: nav }).supported) throw new Error("Notifications are unsupported or require a Home Screen app.");
  // Call directly from a click handler: permission requires user activation on iOS.
  if (await win.Notification.requestPermission() !== 'granted') throw new Error("Notification permission was not granted.");
  const registration = await nav.serviceWorker.ready;
  return await registration.pushManager.getSubscription() || registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}
export async function unsubscribePush({ navigator: nav = globalThis.navigator, removeOnServer } = {}) {
  const subscription = await (await nav.serviceWorker.ready).pushManager.getSubscription();
  if (!subscription) return false;
  if (removeOnServer) await removeOnServer(subscription.toJSON());
  return subscription.unsubscribe();
}
