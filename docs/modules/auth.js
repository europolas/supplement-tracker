/**
 * Account API adapter and observable session state.
 * Only opaque token and expiry enter sessionStorage. Generation checks prevent old requests restoring a signed-out session.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
import { createApi } from './api.js';
import { createStore } from './store.js';
export function createAuth({ id, baseUrl, storage, fetch, timeout = 20000 }) {
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(id)) throw new TypeError('Invalid app id');
  if (!storage) { try { storage = globalThis.sessionStorage; } catch {} }
  const key = id + ':auth';
  let session = null;
  let generation = 0;
  const state = createStore({ user: null, authenticated: false });
  const valid = value => value && /^[a-f0-9]{64}$/.test(value.token) && Date.parse(value.expiresAt) > Date.now();
  try { const saved = JSON.parse(storage?.getItem(key) || 'null'); if (valid(saved)) session = saved; else storage?.removeItem(key); } catch {}
  function remember(value, user = null) { generation++; session = value; try { if (value) storage?.setItem(key, JSON.stringify(value)); else storage?.removeItem(key); } catch {} state.set({ user, authenticated: Boolean(value && user) }); }
  function getToken() { if (session && !valid(session)) remember(null); return session?.token || null; }
  const api = createApi({ baseUrl, getToken, fetch, timeout, onUnauthorized: () => remember(null) });
  return {
    state, api, getToken,
    async restore() { if (!getToken()) return null; const current = generation; const result = await api.get('/v1/me'); if (current === generation) state.set({ user: result.user, authenticated: true }); return result.user; },
    register: data => api.post('/v1/register', data),
    async login(data) { const result = await api.post('/v1/login', data); if (!valid(result)) throw new Error('Invalid server session'); remember({ token: result.token, expiresAt: result.expiresAt }, result.user); return result.user; },
    async logout() { try { if (getToken()) await api.post('/v1/logout', {}); } finally { remember(null); } },
    forgotPassword: email => api.post('/v1/forgot-password', { email }),
    async resetPassword(token, password) { const result = await api.post('/v1/reset-password', { token, password }); remember(null); return result; },
    async changePassword(currentPassword, password) { const result = await api.post('/v1/change-password', { currentPassword, password }); remember(null); return result; },
    async updateProfile(name) { const result = await api.patch('/v1/me', { name }); state.set({ user: result.user, authenticated: true }); return result.user; },
    async deleteAccount(password) { const result = await api.delete('/v1/me', { body: { password, confirmation: 'DELETE' } }); remember(null); return result; },
    listUsers: () => api.get('/v1/users'),
    setBlocked: (id, disabled) => api.patch('/v1/users/' + encodeURIComponent(id), { disabled })
  };
}
