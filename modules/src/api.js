/**
 * HTTPS API client with bearer sessions, JSON/FormData bodies, timeout and cancellation.
 * Requests must stay inside baseUrl; never retry writes implicitly. A 401 clears the session before parsing the response.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export class HttpError extends Error {
  constructor(status, message, data) { super(message); this.name = 'HttpError'; this.status = status; this.data = data; }
}
export function createApi({ baseUrl, getToken = () => null, onUnauthorized = () => {}, timeout = 20000, fetch: send = globalThis.fetch }) {
  const base = new URL(baseUrl);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) throw new TypeError('Invalid HTTPS API URL');
  const prefix = base.pathname.replace(/\/$/, '');
  const api = {
    async request(path, { method = 'GET', body, signal, headers = {} } = {}) {
      if (!path.startsWith('/') || path.startsWith('//')) throw new TypeError('API path must start with one slash');
      const url = new URL(base.origin + prefix + path);
      if (url.origin !== base.origin || !url.pathname.startsWith(prefix + '/')) throw new TypeError('API path escapes its base');
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeout);
      const token = getToken();
      const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
      const requestHeaders = { ...headers };
      if (body !== undefined && !multipart) requestHeaders['Content-Type'] = 'application/json';
      if (token) requestHeaders.Authorization = `Bearer ${token}`;
      try {
        const response = await send(url.href, { method, headers: requestHeaders, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: controller.signal, credentials: 'omit', cache: 'no-store' });
        if (response.status === 401) onUnauthorized();
        const text = await response.text();
        let data = null;
        if (text) { try { data = JSON.parse(text); } catch { throw new HttpError(response.status, 'Server returned an invalid response'); } }
        if (!response.ok) throw new HttpError(response.status, data?.error || `Request failed (${response.status})`, data);
        return data;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    },
    get: (path, options) => api.request(path, options),
    post: (path, body, options) => api.request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => api.request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => api.request(path, { ...options, method: 'DELETE' })
  };
  return api;
}
