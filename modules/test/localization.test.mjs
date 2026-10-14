import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createI18n, dictionaries, createConfig, createValidators, formatNumber, relativeTime } from '../src/index.js';

test('English defaults apply to configuration, translation and Intl; saved Lithuanian remains explicit', () => {
  assert.equal(createConfig({ id: 'english-app', name: 'English app' }).language, 'en');
  assert.equal(createI18n().language, 'en');
  assert.equal(createI18n().t('home'), 'Home');
  assert.equal(createI18n(undefined, 'lt').t('home'), 'Pradžia');
  assert.equal(formatNumber(1234.5), new Intl.NumberFormat('en').format(1234.5));
  assert.equal(relativeTime(0, { now: 60000 }), '1 minute ago');
  assert.throws(() => createI18n(undefined, 'de'), /supported language/);
});
test('missing Lithuanian keys fall back to English and subscriptions stop after cleanup', () => {
  const i18n = createI18n({ en: { title: 'Title', greeting: 'Hello, {name}!' }, lt: { title: 'Antraštė' } });
  let changes = 0;
  const unsubscribe = i18n.subscribe(() => changes++);
  i18n.setLanguage('lt');
  assert.equal(i18n.t('greeting', { name: '<img src=x>' }), 'Hello, <img src=x>!');
  assert.equal(i18n.t('unknown'), 'unknown');
  assert.equal(i18n.t('greeting'), 'Hello, {name}!');
  unsubscribe(); i18n.setLanguage('en'); assert.equal(changes, 1);
});
test('built-in dictionaries cover the same keys, placeholders and all template translation hooks', async () => {
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.lt).sort());
  for (const key of Object.keys(dictionaries.en)) {
    assert.equal(typeof dictionaries.lt[key], 'string');
    assert.deepEqual([...dictionaries.en[key].matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort(), [...dictionaries.lt[key].matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort(), key);
  }
  // A standalone library export has no parent app template; dictionary parity still runs there.
  for (const name of ['index.html', 'account.html']) {
    let html; try { html = await readFile(new URL('../../../starter/' + name, import.meta.url), 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const match of html.matchAll(/data-i18n(?:-aria-label|-placeholder|-title)?="([^"]+)"/g)) assert.ok(Object.hasOwn(dictionaries.en, match[1]), match[1]);
  }
});
test('account/API errors and validator factories follow the active language without changing rule logic', () => {
  const i18n = createI18n(); const validators = createValidators(i18n);
  assert.equal(validators.required(''), 'This field is required.');
  i18n.setLanguage('lt');
  assert.equal(validators.required(''), 'Šis laukas privalomas.');
  assert.equal(validators.min(5)(2), 'Mažiausia reikšmė: 5.');
  assert.equal(validators.maxLength(3)('long'), 'Daugiausia 3 simbolių.');
  assert.equal(validators.email('a@example.com'), true);
  assert.equal(i18n.message('Your name has been saved.'), 'Vardas išsaugotas.');
  assert.equal(i18n.message('unknown OS error'), 'unknown OS error');
});
