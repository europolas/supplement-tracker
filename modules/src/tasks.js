/**
 * Single-flight actions, debounce and policy-driven retries.
 * Retries must be explicitly safe for each operation. Respect AbortSignal; cleanup pending debounced work when leaving a screen.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function singleFlight(task) {
  let pending;
  return function (...args) { if (!pending) pending = Promise.resolve().then(() => task.apply(this, args)).finally(() => { pending = null; }); return pending; };
}
export function debounce(fn, delay = 250) {
  let timer;
  const wrapped = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}
export async function retry(task, { attempts = 3, delay = 200, shouldRetry = error => error instanceof TypeError, signal } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) throw new TypeError('Invalid attempts');
  for (let i = 0; i < attempts; i++) {
    signal?.throwIfAborted();
    try { return await task(i); } catch (error) {
      if (i === attempts - 1 || !shouldRetry(error)) throw error;
      await new Promise((resolve, reject) => { const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason); }; const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay * 2 ** i); if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true }); });
    }
  }
}
