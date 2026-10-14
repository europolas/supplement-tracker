/**
 * IndexedDB record operations and schema upgrade hook.
 * Resolve writes only after transaction completion. close on unmount; version changes close stale database connections.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export async function openDatabase(id, { version = 1, stores = ['records', 'outbox'], indexedDB: factory = globalThis.indexedDB, upgrade } = {}) {
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(id)) throw new TypeError('Invalid database namespace');
  if (!factory) throw new Error("Local database storage is not supported.");
  const db = await new Promise((resolve, reject) => {
    const request = factory.open(id + ':data', version);
    request.onupgradeneeded = event => { for (const store of stores) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' }); if (upgrade) upgrade(request.result, event.oldVersion, event.newVersion, request.transaction); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other app windows and try again."));
  });
  db.onversionchange = () => db.close();
  function run(store, mode, task) { return new Promise((resolve, reject) => { const transaction = db.transaction(store, mode); const request = task(transaction.objectStore(store)); let result; request.onsuccess = () => { result = request.result; }; transaction.oncomplete = () => resolve(result); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error("The data operation was aborted.")); }); }
  return { get: (store, id) => run(store, 'readonly', object => object.get(id)), list: store => run(store, 'readonly', object => object.getAll()), set: (store, value) => run(store, 'readwrite', object => object.put(value)), remove: (store, id) => run(store, 'readwrite', object => object.delete(id)), clear: store => run(store, 'readwrite', object => object.clear()), close: () => db.close() };
}
