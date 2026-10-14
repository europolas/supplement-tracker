/**
 * Versioned JSON storage with an app namespace and memory fallback.
 * The fallback lasts only in this tab. Same-origin apps share a security boundary; this is not a credential vault.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createStorage(namespace, { backend, version = 1, onError = () => {} } = {}) {
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(namespace)) throw new TypeError('Invalid storage namespace');
  if (!Number.isInteger(version) || version < 1) throw new TypeError('Invalid storage version');
  if (!backend) { try { backend = globalThis.localStorage; } catch (error) { onError(error); } }
  const memory = new Map();
  const prefix = namespace + ':';
  function read(key) { try { return backend ? backend.getItem(prefix + key) : memory.get(prefix + key); } catch (error) { onError(error); return memory.get(prefix + key); } }
  return {
    get(key, fallback = null) { try { const item = JSON.parse(read(key) || 'null'); return item?.version === version ? item.value : fallback; } catch (error) { onError(error); return fallback; } },
    set(key, value) { const text = JSON.stringify({ version, value }); memory.set(prefix + key, text); try { backend?.setItem(prefix + key, text); } catch (error) { onError(error); } return value; },
    remove(key) { memory.delete(prefix + key); try { backend?.removeItem(prefix + key); } catch (error) { onError(error); } },
    clear() { for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key); try { if (backend) for (let i = backend.length - 1; i >= 0; i--) { const key = backend.key(i); if (key?.startsWith(prefix)) backend.removeItem(key); } } catch (error) { onError(error); } }
  };
}
