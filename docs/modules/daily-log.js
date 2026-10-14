/**
 * Reusable, device-local daily completion log for routines, checklists and trackers.
 * Records use stable item/day keys; setting false removes that day's completion.
 * Dates follow the device's local calendar, never UTC midnight. No timers, dosage
 * decisions or notifications are scheduled here. The caller owns database.close().
 */
export function localDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid date');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function checkDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError('Invalid calendar day');
  const date = new Date(day + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new TypeError('Invalid calendar day');
  return day;
}
export function createDailyLog(database, { store = 'records', namespace = 'daily-log' } = {}) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(namespace)) throw new TypeError('Invalid daily-log namespace');
  function key(itemId, day) {
    if (typeof itemId !== 'string' || !itemId || itemId.length > 200) throw new TypeError('Invalid item id');
    return `${namespace}:${encodeURIComponent(itemId)}:${checkDay(day)}`;
  }
  return {
    async set(itemId, completed, { day = localDay(), at = new Date() } = {}) {
      if (typeof completed !== 'boolean') throw new TypeError('Completion must be boolean');
      const id = key(itemId, day);
      if (!completed) { await database.remove(store, id); return null; }
      const completedAt = new Date(at).toISOString();
      const record = { id, kind: 'daily-completion', namespace, itemId, day, completedAt };
      await database.set(store, record);
      return record;
    },
    get: (itemId, day = localDay()) => database.get(store, key(itemId, day)),
    async list(day = localDay()) {
      checkDay(day);
      return (await database.list(store)).filter(row => row.kind === 'daily-completion' && row.namespace === namespace && row.day === day);
    }
  };
}
