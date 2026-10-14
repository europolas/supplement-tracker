/**
 * Supplement Tracker foundation. The toolkit owns generic modules; this file
 * owns app records and screens. No account API or remote service receives data.
 * A preferred time is descriptive, not a scheduled notification or dosage rule.
 */
import { createConfig, createStorage, createSettings, createTheme, createI18n, createRouter,
  createToast, bindForm, trackDirty, setupViewport, setupGestures, setupPwa, watchNetwork,
  openDatabase, createDailyLog, localDay, element, confirmDialog } from './modules/index.js';

const config = createConfig(await (await fetch('./app.config.json')).json());
const get = id => document.getElementById(id);
const storage = createStorage(config.id);
const settings = createSettings(storage, { theme: config.theme, language: config.language }, {
  theme: value => ['dark', 'light', 'system'].includes(value), language: value => ['en', 'lt'].includes(value)
});
const theme = createTheme({ storage });
const i18n = createI18n(undefined, settings.state.get().language);
const toast = createToast(get('toast'));
const network = watchNetwork();
setupViewport(); setupGestures(config.interaction);
const settingsDirty = trackDirty(get('settings-form'));
const supplementDirty = trackDirty(get('supplement-form'));
let database, log, items = [], completed = new Set(), loadedDay, generation = 0, writes = 0;
let databaseFailed = false;

function fail() { toast.show(i18n.t('trackerSaveError'), true); }
function renderLists() {
  const day = localDay();
  get('today-date').textContent = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  get('today-progress').textContent = databaseFailed ? '' : database ? i18n.t('trackerProgress', { done: items.filter(item => completed.has(item.id)).length, total: items.length }) : i18n.t('trackerLoading');
  get('today-empty').hidden = !database || items.length > 0;
  get('supplement-empty').hidden = !database || items.length > 0;
  for (const [listId, today] of [['today-list', true], ['supplement-list', false]]) {
    const list = get(listId); list.replaceChildren();
    for (const item of items) {
      const row = element('li');
      row.append(element('strong', { text: item.name }));
      const details = [item.amount, item.time].filter(Boolean).join(' · ');
      if (details) row.append(element('p', { text: details, className: 'item-info' }));
      const taken = completed.has(item.id);
      const button = element('button', { text: i18n.t(today ? taken ? 'trackerUndo' : 'trackerTaken' : 'trackerArchive'), attributes: { type: 'button' } });
      if (today) { button.dataset.completed = String(taken); button.setAttribute('aria-pressed', String(taken)); }
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        if (today && day !== localDay()) { await refresh(); return; }
        button.disabled = true;
        if (!today && !await confirmDialog(i18n.t('trackerArchiveConfirm'), { i18n })) { button.disabled = false; return; }
        writes++;
        try {
          if (today) await log.set(item.id, !taken, { day });
          else { await database.set('records', { ...item, archived: true }); toast.show(i18n.t('trackerArchived')); }
          await refresh();
        } catch { fail(); button.disabled = false; }
        finally { writes--; }
      });
      row.append(button); list.append(row);
    }
  }
}
function translate() {
  i18n.render(document);
  get('app-version').textContent = i18n.t('version', { version: config.version });
  get('network-status').textContent = network.state.get().online ? '' : i18n.t('trackerOffline');
  get('database-error').textContent = databaseFailed ? i18n.t('trackerDatabaseError') : '';
  renderLists();
}
// Generation guard prevents an older refresh from overwriting a later mutation.
async function refresh() {
  const current = ++generation; const day = localDay();
  const [records, marks] = await Promise.all([database.list('records'), log.list(day)]);
  if (current !== generation) return;
  if (day !== localDay()) return refresh();
  items = records.filter(row => row.kind === 'supplement' && !row.archived).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.name.localeCompare(b.name, i18n.language));
  completed = new Set(marks.map(row => row.itemId)); loadedDay = day; renderLists();
}
settings.state.subscribe(value => {
  theme.set(value.theme); i18n.setLanguage(value.language);
  get('settings-form').elements.theme.value = value.theme;
  get('settings-form').elements.language.value = value.language;
  translate();
}, true);
network.state.subscribe(translate);
bindForm(get('settings-form'), data => { settings.update(data); settingsDirty.reset(); toast.show(i18n.t('saved')); }, { onError: fail });
bindForm(get('supplement-form'), async (data, form) => {
  if (!database) throw new Error('Database unavailable');
  const name = data.name.trim();
  if (!name || [...name].length > 80) { toast.show(i18n.t('trackerInvalidName'), true); return; }
  const record = { id: 'supplement:' + crypto.randomUUID(), kind: 'supplement', name, amount: data.amount.trim(), time: data.time, archived: false, createdAt: new Date().toISOString() };
  await database.set('records', record);
  form.reset(); supplementDirty.reset(); toast.show(i18n.t('trackerAdded')); await refresh();
}, { onError: fail });
createRouter({ routes: Object.fromEntries(['/', '/supplements', '/settings'].map(path => [path, () => {
  for (const node of document.querySelectorAll('[data-screen]')) node.hidden = node.dataset.screen !== path;
  for (const link of document.querySelectorAll('[data-route]')) { if (link.dataset.route === path) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
  document.querySelector('main').scrollTop = 0;
}])), onNotFound: () => { location.hash = '/'; } });
try {
  database = await openDatabase(config.id); log = createDailyLog(database, { namespace: 'supplement-log' }); await refresh();
} catch {
  databaseFailed = true; get('database-error').hidden = false;
  for (const input of get('supplement-form').elements) input.disabled = true;
  translate();
}
// Keep an app left open overnight on the local calendar's current day.
const checkDay = () => { if (database && document.visibilityState === 'visible' && loadedDay !== localDay()) refresh().catch(fail); };
document.addEventListener('visibilitychange', checkDay);
window.addEventListener('focus', checkDay);
window.setInterval(checkDay, 60000);
let applyUpdate;
await setupPwa({ canReload: () => !settingsDirty.dirty && !supplementDirty.dirty && writes === 0 && !document.querySelector('form[aria-busy="true"], dialog[open]'),
  onUpdate: ({ apply }) => { applyUpdate = apply; get('update-card').hidden = false; },
  onError: () => { if (navigator.onLine) toast.show(i18n.t('updateFailed'), true); }
});
get('update-button').addEventListener('click', () => { try { applyUpdate?.(); } catch (error) { toast.show(i18n.message(error.message), true); } });
