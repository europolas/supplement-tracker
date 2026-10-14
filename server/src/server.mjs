/**
 * Node HTTP runtime around AuthApi: strict CORS, JSON/body limits, health, encrypted mail queue and cleanup. Read secrets from files. Recovery stays unavailable until SMTP delivery is explicitly verified.
 * See AGENTS.md and the reusable library docs/ARCHITECTURE.md.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { TrackerApi } from './TrackerApi.mjs';
import { createCredentialVault } from './credential-vault.mjs';
import { createStructuredResearch, createStructuredOutput } from './structured-research.mjs';
import { AuthApi } from './AuthApi.mjs';
import { ApiError, hashPassword, decrypt } from './security.mjs';

const readSecret = variable => readFileSync(process.env[variable], 'utf8').trim();
const config = {
  secret: readSecret('API_SECRET_FILE'),
  persistentSessions: true,
  encryptionKey: Buffer.from(readSecret('MAIL_KEY_FILE'), 'hex'),
  appUrl: process.env.APP_URL || 'http://localhost:4173/',
  mailConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.MAIL_DELIVERY_READY === 'true')
};
if (config.encryptionKey.length !== 32 || config.secret.length < 32) throw Error('Invalid private configuration');
const origins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:4173').split(',').map(value => value.trim()));
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db', user: process.env.DB_USER || 'app_user',
  password: readSecret('DB_PASSWORD_FILE'), database: process.env.DB_NAME || 'app_db',
  connectionLimit: 8, queueLimit: 32, waitForConnections: true,
  timezone: 'Z', charset: 'utf8mb4', multipleStatements: false
});
await pool.query('SELECT 1');
const api = new AuthApi(pool, config, await hashPassword(randomBytes(32).toString('hex')));
const tracker = new TrackerApi(pool, api, {vault:createCredentialVault(Buffer.from(readSecret('VAULT_KEY_FILE'),'hex')),chat:createStructuredResearch(),discover:createStructuredOutput({timeout:90000}),models:(process.env.XAI_MODELS||'grok-4.7').split(',')});
// A single API instance owns in-memory photo payloads. Do not silently retry paid work after restart.
await pool.query("UPDATE analysis_jobs SET status='failed',error_code='AI_JOB_INTERRUPTED',finished_at=UTC_TIMESTAMP(3) WHERE status='running'");
const transport = process.env.SMTP_HOST && process.env.SMTP_FROM ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT === '465', requireTLS: true,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: readSecret('SMTP_PASSWORD_FILE') } : undefined,
  tls: {
    minVersion: 'TLSv1.2', rejectUnauthorized: true,
    ...(process.env.SMTP_CA_FILE ? { ca: readFileSync(process.env.SMTP_CA_FILE) } : {})
  },
  ...(process.env.DKIM_KEY_FILE ? { dkim: { domainName: process.env.DKIM_DOMAIN, keySelector: process.env.DKIM_SELECTOR || 'app', privateKey: readSecret('DKIM_KEY_FILE') } } : {}),
  connectionTimeout: 10000, socketTimeout: 15000
}) : null;
let sending = false;
async function flushMail() {
  if (!config.mailConfigured || !transport || sending) return;
  sending = true;
  try {
    const [rows] = await pool.execute('SELECT id, encrypted_payload FROM email_outbox WHERE sent_at IS NULL AND attempts < 3 AND available_at <= UTC_TIMESTAMP(3) ORDER BY available_at LIMIT 1');
    if (!rows.length) return;
    const job = rows[0];
    const mail = decrypt(job.encrypted_payload, config.encryptionKey);
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM, to: mail.to,
        subject: `${process.env.APP_NAME || 'App'} – password recovery`,
        text: `To change your password, open this link:\n${mail.link}\n\nThe link expires after 30 minutes and can be used once. If you did not request a reset, ignore this email.`,
        disableFileAccess: true, disableUrlAccess: true
      });
      await pool.execute("UPDATE email_outbox SET sent_at = UTC_TIMESTAMP(3), encrypted_payload = '' WHERE id = ?", [job.id]);
    } catch {
      await pool.execute('UPDATE email_outbox SET attempts = attempts + 1, available_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 60 SECOND) WHERE id = ?', [job.id]);
      console.error('Password recovery email delivery failed; retry queued');
    }
  } catch { console.error('Email queue processing failed'); }
  finally { sending = false; }
}
const cleanup = setInterval(async () => {
  try {
    await pool.query("DELETE FROM analysis_jobs WHERE finished_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)");
    await pool.query('DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP(3)');
    await pool.query('DELETE FROM auth_rate_limits WHERE expires_at < UTC_TIMESTAMP(3)');
    await pool.query('DELETE FROM password_resets WHERE expires_at < UTC_TIMESTAMP(3)');
    await pool.query('DELETE FROM email_outbox WHERE available_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)');
  } catch { console.error('Expired authentication data cleanup failed'); }
}, 600000);
const mailTimer = setInterval(flushMail, 5000);

function body(req, maximum=16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maximum) { reject(new ApiError(413, "The request is too large.")); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
        resolve(data);
      } catch { reject(new ApiError(400, "Invalid request data.")); }
    });
    req.on('error', reject);
  });
}
export const server = http.createServer({ requestTimeout: 105000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Origin');
  const respond = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
  try {
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) throw new ApiError(403, "This app origin is not allowed.");
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/health' && req.method === 'GET') { await pool.query('SELECT 1'); respond(200, { ok: true, passwordRecoveryAvailable: config.mailConfigured }); return; }
    if (!path.startsWith('/v1/')) throw new ApiError(404, "Request not found.");
    let payload = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || (req.method === 'DELETE' && (Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding']))) {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, "A JSON request body is required.");
      payload = await body(req, ['/v1/supplements/analyze','/v1/supplements/jobs'].includes(path) ? 4500000 : 16384);
    }
    // Loopback-only container port; trusted local nginx must overwrite this header.
    const ip = process.env.TRUST_PROXY === 'true' ? req.headers['x-real-ip'] || req.socket.remoteAddress : req.socket.remoteAddress;
    const route=path.slice(3);
    const isTracker=/^\/(bootstrap|dashboard|settings\/ai|groups(?:\/|$)|supplements(?:\/|$))/.test(route);
    const [status, data] = isTracker ? await tracker.handle(req.method,route,payload,req.headers.authorization,ip,url.searchParams) : await api.dispatch(req.method,route,payload,req.headers.authorization,ip);
    respond(status, data);
  } catch (error) {
    if (error instanceof ApiError) { if (error.status === 429) res.setHeader('Retry-After', '60'); respond(error.status, { error: error.message }); }
    else { console.error('API request failed', { code: typeof error.code === 'string' ? error.code : 'internal' }); respond(500, { error: "Server error. Try again later." }); }
  }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Application authentication API ready'));
async function shutdown() { clearInterval(cleanup); clearInterval(mailTimer); server.close(); await pool.end(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
