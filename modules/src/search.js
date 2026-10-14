/**
 * Accent-insensitive filtering and locale-aware sorting.
 * Returns new arrays rather than mutating records. This is client filtering, not a database query or authorization filter.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function filterItems(items, query, fields) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return items.filter(item => { const text = fields.map(field => normalize(typeof field === 'function' ? field(item) : item[field])).join(' '); return words.every(word => text.includes(word)); });
}
export function sortItems(items, field, direction = 'asc', locale = 'lt') {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const read = typeof field === 'function' ? field : item => item[field];
  return [...items].sort((a, b) => (direction === 'desc' ? -1 : 1) * collator.compare(String(read(a) ?? ''), String(read(b) ?? '')));
}
