/** Server-only AES-GCM credential envelope bound to owner/provider through AAD.
 * Keep the 32-byte key in a private deployment secret, never in DB or browser code.
 * Storage/versioning/deletion is the caller's responsibility; never return plaintext to clients.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
const context = (owner, provider) => {
  if (typeof owner !== 'string' || !owner || typeof provider !== 'string' || !provider) throw new TypeError('Invalid credential context');
  return Buffer.from(JSON.stringify([owner, provider]));
};
export function createCredentialVault(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new TypeError('Vault key must be 32 bytes');
  return {
    seal(secret, { owner, provider }) {
      if (typeof secret !== 'string' || !secret || secret.length > 4096) throw new TypeError('Invalid credential');
      const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(context(owner,provider));
      const body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
      return 'v1.'+Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
    },
    open(envelope, { owner, provider }) {
      if (typeof envelope !== 'string' || !envelope.startsWith('v1.')) throw new TypeError('Unknown credential version');
      const data=Buffer.from(envelope.slice(3),'base64');if(data.length<29)throw new TypeError('Invalid credential envelope');
      const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAAD(context(owner,provider));cipher.setAuthTag(data.subarray(12,28));
      return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');
    }
  };
}
