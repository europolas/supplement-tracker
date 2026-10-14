/**
 * Opt-in structured logging with secret field and recovery URL redaction.
 * Disabled by default. Redaction is defensive, not a guarantee for arbitrary free text; do not log credentials or personal payloads.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
const sensitive = /password|token|secret|authorization|cookie|email|reset|session|key/i;
export function redact(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.map(item => redact(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[redacted]' : redact(item, depth + 1)]));
  return typeof value === 'string' ? value.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/([?&#](?:token|reset|secret|key)=)[^&#\s]+/gi, '$1[redacted]') : value;
}
export function createLogger({ enabled = false, sink = console } = {}) {
  return Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, (event, data = {}) => { if (enabled) sink[level](String(event), redact(data)); }]));
}
