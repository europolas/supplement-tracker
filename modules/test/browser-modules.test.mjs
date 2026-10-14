import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPwa, setupViewport, setupGestures, subscribePush, unsubscribePush, notificationSupport, openCamera, locate, watchLocation, share, copyText, previewFile, capabilities } from '../src/index.js';
import { installWorker } from '../src/worker.js';
function target(values = {}) { const handlers = new Map(); return { ...values, handlers, addEventListener(name, fn) { handlers.set(name, fn); }, removeEventListener(name) { handlers.delete(name); } }; }
test('ported iPhone viewport and gesture handlers retain fixes and can be cleaned up', () => {
  const properties = {}; const root = { dataset: {}, style: { setProperty: (name, value) => { properties[name] = value; }, removeProperty: name => delete properties[name] } };
  const doc = target({ documentElement: root }); const visual = target({ height: 812, offsetTop: 0 });
  const win = target({ screen: { width: 402, height: 874, orientation: { angle: 0 } }, innerHeight: 812, visualViewport: visual, matchMedia: () => ({ matches: true }), setTimeout: fn => { fn(); return 1; }, clearTimeout() {} });
  const stop = setupViewport({ window: win, document: doc, navigator: { standalone: true, userAgent: 'iPhone' } }); assert.equal(properties['--app-height'], '874px');
  doc.activeElement = { matches: () => true }; visual.height = 420; visual.handlers.get('resize')(); assert.equal(properties['--app-height'], '420px'); assert.equal(root.dataset.keyboard, 'true');
  doc.activeElement = null; win.screen.orientation.angle = 90; win.handlers.get('orientationchange')(); assert.equal(properties['--app-height'], '402px'); stop(); assert.equal(properties['--app-height'], undefined); assert.equal(win.handlers.size, 0);
  const clean = setupGestures({ document: doc }); let prevented = 0; doc.handlers.get('touchmove')({ touches: [{}], preventDefault: () => prevented++ }); doc.handlers.get('touchmove')({ touches: [{}, {}], preventDefault: () => prevented++ }); assert.equal(prevented, 1); clean(); assert.equal(doc.handlers.size, 0);
});
test('PWA updates cannot reload a dirty form, then activate after saving', async () => {
  let dirty = true; let updates = 0; let reloads = 0; let message;
  const registration = target({ waiting: { postMessage: value => { message = value; } }, update: async () => updates++ });
  const serviceWorker = target({ controller: {}, register: async () => registration });
  const win = target({ location: { reload: () => reloads++ }, setInterval: () => 1, clearInterval() {} }); const doc = target({ visibilityState: 'visible' }); let announced;
  const pwa = await setupPwa({ navigator: { serviceWorker, onLine: true }, window: win, document: doc, canReload: () => !dirty, onUpdate: value => { announced = value; } });
  assert.throws(() => announced.apply(), /Save your changes/); assert.equal(message, undefined); assert.equal(updates, 1);
  dirty = false; announced.apply(); assert.deepEqual(message, { type: 'ACTIVATE_UPDATE' }); serviceWorker.handlers.get('controllerchange')(); assert.equal(reloads, 1);
  pwa.destroy(); assert.equal(win.handlers.size, 0); assert.equal(serviceWorker.handlers.size, 0);
});
test('worker waits for explicit activation and removes only its own old scoped cache', async () => {
  const deleted = []; let skipped = 0; let notification;
  const scope = 'https://example.com/apps/one/'; const prefix = 'first-app:' + encodeURIComponent(scope) + ':';
  const worker = target({ registration: { scope, showNotification: async (title, value) => { notification = { title, value }; } }, caches: { open: async () => ({ addAll: async () => {} }), keys: async () => [prefix + 'old', 'second-app:other:old'], delete: async key => deleted.push(key) }, clients: { matchAll: async () => [{ url: scope }], claim: async () => {} }, skipWaiting: async () => skipped++ });
  installWorker({ id: 'first-app', version: 'new', assets: ['./index.html'], name: 'App', scope: worker });
  let promise; const event = { waitUntil: value => { promise = value; } };
  worker.handlers.get('install')(event); await promise; assert.equal(skipped, 0);
  worker.handlers.get('message')({ ...event, data: { type: 'ACTIVATE_UPDATE' } }); await promise; assert.equal(skipped, 1);
  worker.handlers.get('activate')(event); await promise; assert.deepEqual(deleted, [prefix + 'old']);
  worker.handlers.get('push')({ ...event, data: { json: () => ({ title: 'Hello', url: 'https://attacker.example/' }) } }); await promise; assert.equal(notification.value.data.url, scope);
  let intercepted = false; worker.handlers.get('fetch')({ request: { method: 'GET', url: scope + 'api/private', mode: 'cors' }, respondWith: () => { intercepted = true; } }); assert.equal(intercepted, false);
});
test('push permission is requested before subscription; cancellation first removes the server subscription', async () => {
  const order = []; const subscription = { toJSON: () => ({}), unsubscribe: async () => { order.push('unsubscribe'); return true; } };
  const navigator = { standalone: true, userAgent: 'iPhone', serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription } }) } };
  const window = { Notification: { permission: 'default', requestPermission: () => { order.push('permission'); return Promise.resolve('granted'); } }, PushManager: {}, matchMedia: () => ({ matches: true }) };
  assert.equal(notificationSupport({ window, navigator }).supported, true);
  assert.equal(await subscribePush('unused-existing-subscription', { window, navigator }), subscription);
  await unsubscribePush({ navigator, removeOnServer: async () => order.push('server') }); assert.deepEqual(order, ['permission', 'server', 'unsubscribe']);
  assert.equal(notificationSupport({ window, navigator: { ...navigator, standalone: false }, }).supported, true);
});
test('camera cleanup stops tracks even if playback fails; location watches and previews dispose resources', async () => {
  let stopped = 0; const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const video = { play: async () => { throw Error('Playback failed'); } };
  await assert.rejects(openCamera(video, { navigator: { mediaDevices: { getUserMedia: async () => stream } } })); assert.equal(stopped, 1); assert.equal(video.srcObject, null);
  let cleared; const navigator = { geolocation: { getCurrentPosition: fn => fn({ coords: { latitude: 1, longitude: 2, accuracy: 3 }, timestamp: 4 }), watchPosition: () => 5, clearWatch: id => { cleared = id; } } };
  assert.equal((await locate({ navigator })).longitude, 2); watchLocation(() => {}, () => {}, { navigator })(); assert.equal(cleared, 5);
  let revoked; const preview = previewFile({}, { URL: { createObjectURL: () => 'blob:one', revokeObjectURL: value => { revoked = value; } } }); preview.dispose(); assert.equal(revoked, 'blob:one');
});
test('unsupported and cancelled native sharing and clipboard failures are explicit', async () => {
  assert.deepEqual(await share({ text: 'Hello' }, { navigator: {} }), { supported: false });
  assert.deepEqual(await share({ text: 'Hello' }, { navigator: { share: async () => { throw new DOMException('Cancelled', 'AbortError'); } } }), { supported: true, shared: false });
  await assert.rejects(copyText('Hello', { navigator: {} }));
  const result = capabilities({ window: { matchMedia: () => ({ matches: false }) }, navigator: {} }); assert.equal(result.camera, false);
});
