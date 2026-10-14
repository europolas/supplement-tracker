/**
 * Public test notification scheduling adapter.
 * Use only non-sensitive test messages. Production push needs your authenticated server; scheduled deliveries depend on the provider.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
import { createApi } from './api.js';
export function createNtfy({ id, service = 'https://ntfy.sh', fetch }) {
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(id)) throw new TypeError('Invalid app id');
  const api = createApi({ baseUrl: service, fetch });
  const updateTopics = (subscription, topics) => { const data = subscription.toJSON(); return api.post('/v1/webpush', { endpoint: data.endpoint, auth: data.keys.auth, p256dh: data.keys.p256dh, topics }); };
  return {
    async schedule(subscription, { title, message, delay = '1m', icon, image, url }) {
      const topic = id + '-' + crypto.randomUUID().replace(/-/g, '');
      await updateTopics(subscription, [topic]);
      const result = await api.post('/', { topic, title, message, delay, icon, attach: image, click: url });
      if (!Number.isFinite(result.time)) throw new Error('Siuntimo paslauga nepatvirtino pristatymo laiko.');
      return { topic, due: result.time * 1000 };
    },
    cancel: subscription => updateTopics(subscription, [])
  };
}
