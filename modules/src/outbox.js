/**
 * Persistent queue with bounded retries and stable operation IDs.
 * Server must enforce Idempotency-Key. Reject credential payloads; process from one window because no cross-tab lock exists.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createOutbox(database, { store = 'outbox', maximumAttempts = 5, randomUUID = () => crypto.randomUUID() } = {}) {
  let running = false;
  function containsSecret(value) { return value && typeof value === 'object' && Object.entries(value).some(([key, item]) => /password|token|authorization|secret|cookie/i.test(key) || containsSecret(item)); }
  return {
    async enqueue(payload) { if (containsSecret(payload)) throw new Error("Passwords and credentials cannot be stored in the queue."); const job = { id: randomUUID(), payload, attempts: 0, createdAt: Date.now() }; await database.set(store, job); return job.id; },
    list: () => database.list(store),
    remove: id => database.remove(store, id),
    async flush(send) {
      if (running) return { busy: true };
      running = true; let delivered = 0; let failed = 0;
      try { for (const job of await database.list(store)) { if (job.attempts >= maximumAttempts) continue; try { await send(job.payload, { idempotencyKey: job.id }); await database.remove(store, job.id); delivered++; } catch { await database.set(store, { ...job, attempts: job.attempts + 1 }); failed++; } } return { delivered, failed }; }
      finally { running = false; }
    }
  };
}
