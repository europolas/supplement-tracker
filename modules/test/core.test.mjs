import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { createConfig, createStorage, createStore, createEvents, createSettings, createI18n, filterItems, sortItems, paginate, validate, validators, createApi, createAuth, singleFlight, retry, openDatabase, createOutbox, createDrafts, redact, importJson, validateFile, createResource, createNtfy } from '../src/index.js';
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function memory() { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), get length() { return values.size; }, key: index => [...values.keys()][index] }; }

test('config rejects unsafe URLs, control characters and invalid feature flags', () => {
  for (const apiUrl of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/?secret=yes']) assert.throws(() => createConfig({ id: 'sample-app', name: 'App', apiUrl }));
  assert.throws(() => createConfig({ id: 'sample-app', name: 'App\nSMTP_HOST=other' }));
  assert.throws(() => createConfig({ id: 'sample-app', name: 'App', features: { auth: 'false' } }));
  assert.equal(createConfig({ id: 'sample-app', name: 'App', apiUrl: 'http://localhost:8092' }).features.auth, false);
});
test('storage isolates apps, versions and corrupted data; unavailable storage falls back to memory', () => {
  const backend = memory(); const first = createStorage('first-app', { backend }); const second = createStorage('second-app', { backend });
  first.set('settings', { name: 'First' }); second.set('settings', { name: 'Second' });
  first.clear(); assert.equal(first.get('settings'), null); assert.equal(second.get('settings').name, 'Second');
  assert.equal(createStorage('second-app', { backend, version: 2 }).get('settings', 'fallback'), 'fallback');
  backend.setItem('second-app:broken', '{'); assert.equal(second.get('broken'), null);
  const broken = createStorage('broken-app', { backend: { getItem() { throw Error(); }, setItem() { throw Error(); } } }); broken.set('one', 1); assert.equal(broken.get('one'), 1);
});
test('events and stores unsubscribe safely; settings validate persisted values', () => {
  const bus = createEvents(); const values = []; const off = bus.on('saved', value => values.push(value)); bus.emit('saved', 1); off(); bus.emit('saved', 2); assert.deepEqual(values, [1]);
  const store = createStore(1); const stop = store.subscribe(value => values.push(value)); store.set(value => value + 1); stop(); store.set(3); assert.deepEqual(values, [1, 2]);
  const storage = createStorage('settings-app', { backend: memory() }); storage.set('settings', { language: 'bad', unknown: true });
  const settings = createSettings(storage, { language: 'lt' }, { language: value => ['lt', 'en'].includes(value) }); assert.equal(settings.state.get().language, 'lt'); assert.throws(() => settings.update({ unknown: 1 })); settings.update({ language: 'en' }); settings.reset(); assert.equal(settings.state.get().language, 'lt');
});
test('search supports Lithuanian accents, sorting is numeric and pagination clamps pages', () => {
  const items = [{ name: 'Ąžuolas 10' }, { name: 'Ąžuolas 2' }, { name: 'Beržas' }];
  assert.equal(filterItems(items, 'azuolas', ['name']).length, 2); assert.equal(sortItems(items, 'name')[0].name, 'Ąžuolas 2'); assert.equal(items[0].name, 'Ąžuolas 10');
  const page = paginate(items, { page: 10, pageSize: 2 }); assert.equal(page.page, 2); assert.equal(page.items.length, 1); assert.throws(() => paginate(items, { pageSize: 0 }));
  const i18n = createI18n({ lt: { greeting: 'Labas, {name}!' }, en: { greeting: 'Hello, {name}!' } }); assert.equal(i18n.t('greeting', { name: 'A' }), 'Hello, A!'); i18n.setLanguage('en'); assert.equal(i18n.t('missing'), 'missing');
  assert.equal(validate({ email: 'bad', password: 'short' }, { email: [validators.email], password: [validators.password] }).valid, false);
});
test('API confines tokens to its HTTPS base, handles 401 and sends FormData without a JSON header', async () => {
  const calls = []; let unauthorized = 0;
  const api = createApi({ baseUrl: 'https://api.example.com/app', getToken: () => 'private-session', onUnauthorized: () => unauthorized++, fetch: async (url, options) => { calls.push({ url, options }); return response({ error: 'Expired' }, 401); } });
  for (const path of ['//other.example/path', '/../private', '/%2e%2e/private']) await assert.rejects(api.get(path), TypeError);
  assert.equal(calls.length, 0);
  const body = new FormData(); body.append('file', new Blob(['data']), 'test.txt'); await assert.rejects(api.post('/upload', body), error => error.status === 401);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-session'); assert.equal(calls[0].options.headers['Content-Type'], undefined); assert.equal(calls[0].options.credentials, 'omit'); assert.equal(unauthorized, 1);
  const invalid = createApi({ baseUrl: 'https://api.example.com', onUnauthorized: () => unauthorized++, fetch: async () => new Response('bad', { status: 401 }) }); await assert.rejects(invalid.get('/me')); assert.equal(unauthorized, 2);
});
test('API timeout cancels its request and does not retry mutations', async () => {
  let attempts = 0;
  const api = createApi({ baseUrl: 'https://api.example.com', timeout: 5, fetch: (_, options) => new Promise((_, reject) => { attempts++; options.signal.addEventListener('abort', () => reject(options.signal.reason)); }) });
  await assert.rejects(api.post('/orders', {})); assert.equal(attempts, 1);
});
test('auth saves only the opaque session, clears on 401, and does not resurrect an old restore', async () => {
  const storage = memory(); const token = 'a'.repeat(64); let release; let expire = false;
  const auth = createAuth({ id: 'auth-app', baseUrl: 'https://api.example.com', storage, fetch: async url => {
    if (url.endsWith('/login')) return response({ token, expiresAt: '2099-01-01', user: { id: '1', name: 'User' } });
    if (url.endsWith('/logout')) return response({ message: 'Bye' });
    if (expire) return response({ error: 'Expired' }, 401);
    return new Promise(resolve => { release = () => resolve(response({ user: { id: '1' } })); });
  } });
  await auth.login({ email: 'user@example.com', password: 'A private long password' });
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem('auth-app:auth'))).sort(), ['expiresAt', 'token']);
  const restoring = auth.restore(); await auth.logout(); release(); await restoring; assert.equal(auth.state.get().authenticated, false);
  await auth.login({ password: 'Long password' }); expire = true; await assert.rejects(auth.restore()); assert.equal(storage.getItem('auth-app:auth'), null);
});
test('IndexedDB persists records; the outbox retries with a stable idempotency key', async () => {
  const database = await openDatabase('test-database', { indexedDB });
  try {
    await database.set('records', { id: 'one', name: 'Saved' }); assert.equal((await database.get('records', 'one')).name, 'Saved');
    const queue = createOutbox(database, { randomUUID: () => 'stable-key' }); await assert.rejects(queue.enqueue({ password: 'secret' })); await queue.enqueue({ operation: 'create', text: 'Note' });
    const keys = []; await queue.flush(async (_, meta) => { keys.push(meta.idempotencyKey); throw Error('Offline'); }); assert.equal((await queue.list())[0].attempts, 1);
    assert.equal((await queue.flush(async (_, meta) => keys.push(meta.idempotencyKey))).delivered, 1); assert.deepEqual(keys, ['stable-key', 'stable-key']); assert.equal((await queue.list()).length, 0);
    await database.remove('records', 'one'); assert.equal((await database.list('records')).length, 0);
  } finally { database.close(); }
});
test('draft binding excludes passwords, hidden tokens and files, and keeps the selected radio', () => {
  const storage = createStorage('draft-app', { backend: memory() });
  const elements = [{ name: 'title', type: 'text', value: 'Note' }, { name: 'password', type: 'password', value: 'secret' }, { name: 'token', type: 'hidden', value: 'private' }, { name: 'choice', type: 'radio', value: 'a', checked: true }, { name: 'choice', type: 'radio', value: 'b', checked: false }];
  let handler; const form = { elements, addEventListener: (_, fn) => { handler = fn; }, removeEventListener() {} };
  const drafts = createDrafts(storage); drafts.bind(form, 'editor'); handler();
  assert.deepEqual(drafts.load('editor').value, { title: 'Note', choice: 'a' });
});
test('single-flight collapses repeated submits; retry obeys cancellation and error policy', async () => {
  let count = 0; let finish;
  const submit = singleFlight(() => { count++; return new Promise(resolve => { finish = resolve; }); }); const a = submit(); const b = submit(); await Promise.resolve(); assert.equal(count, 1); finish(10); assert.equal(await a, 10); assert.equal(await b, 10);
  let attempts = 0; await assert.rejects(retry(async () => { attempts++; throw Error('Forbidden'); }, { delay: 1 })); assert.equal(attempts, 1);
  const controller = new AbortController(); controller.abort(); await assert.rejects(retry(async () => {}, { signal: controller.signal }));
});
test('file imports check size and structure; logs redact structured credentials and reset URLs', async () => {
  assert.throws(() => validateFile({ size: 100, type: 'text/plain' }, { maxBytes: 10 }));
  await assert.rejects(importJson({ size: 2, text: async () => '{}' }, { validate: value => Boolean(value.items) }));
  assert.deepEqual(await importJson({ size: 20, text: async () => '{"items":[]}' }, { validate: value => Array.isArray(value.items) }), { items: [] });
  assert.deepEqual(redact({ password: 'abc', nested: { token: '123', url: 'https://example.com/#reset=secret' } }), { password: '[redacted]', nested: { token: '[redacted]', url: 'https://example.com/#reset=[redacted]' } });
});
test('resource ids are encoded; ntfy confirms scheduling and cancellation server-side', async () => {
  const calls = []; const api = { get: path => calls.push(path) }; createResource(api, '/notes').get('a/b'); assert.equal(calls[0], '/notes/a%2Fb');
  const sent = []; const ntfy = createNtfy({ id: 'push-app', fetch: async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return response({ time: 1000 }); } });
  const subscription = { toJSON: () => ({ endpoint: 'https://push.example.com', keys: { auth: 'public', p256dh: 'public' } }) };
  const result = await ntfy.schedule(subscription, { title: 'Hi', message: 'Test', image: 'https://example.com/icon.png' }); assert.equal(result.due, 1000000); assert.equal(sent[0].body.topics[0], sent[1].body.topic); await ntfy.cancel(subscription); assert.deepEqual(sent[2].body.topics, []);
});
