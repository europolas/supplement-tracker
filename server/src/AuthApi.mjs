/**
 * Account API routes with password hashing, revocable sessions, recovery and admin access.
 * Use parameterized SQL and transactional account locks. Never reveal whether registration/recovery emails exist. Runtime owns CORS, body limits and SMTP.
 * See ../docs/BACKEND.md. This file must never enter the browser build.
 */
import { randomUUID } from 'node:crypto';
import { ApiError, digest, bucket, token, hashPassword, verifyPassword, email, password, name, encrypt } from './security.mjs';

const publicUser = row => ({ id: row.id, email: row.email, name: row.name, role: row.role });
const recoveryMessage = "If this account exists, a password recovery link will be sent by email.";

export class AuthApi {
  constructor(pool, config, dummyHash) { this.pool = pool; this.config = config; this.dummyHash = dummyHash; }
  async transaction(task) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await task(connection);
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async limit(scope, identifier, maximum, seconds) {
    const period = Math.floor(Date.now() / (seconds * 1000));
    const key = bucket(this.config.secret, `${scope}:${identifier}:${period}`);
    await this.pool.execute('INSERT INTO auth_rate_limits (bucket_hash, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE hits = hits + 1', [key, new Date((period + 1) * seconds * 1000)]);
    const [rows] = await this.pool.execute('SELECT hits FROM auth_rate_limits WHERE bucket_hash = ?', [key]);
    if (rows[0].hits > maximum) throw new ApiError(429, "Too many attempts. Wait and try again.");
  }
  async authenticate(authorization) {
    if (typeof authorization !== 'string' || !/^Bearer [a-f0-9]{64}$/.test(authorization)) throw new ApiError(401, "Sign in to your account.");
    const sessionHash = digest(authorization.slice(7));
    const [rows] = await this.pool.execute('SELECT u.*, s.expires_at AS session_expires_at FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND (s.expires_at IS NULL OR s.expires_at > UTC_TIMESTAMP(3)) AND u.disabled = FALSE', [sessionHash]);
    if (!rows.length) throw new ApiError(401, "Your session has expired. Sign in again.");
    return { user: publicUser(rows[0]), sessionHash, expiresAt: rows[0].session_expires_at === null ? null : new Date(rows[0].session_expires_at).toISOString() };
  }
  async register(body, ip) {
    await this.limit('register-ip', ip, 5, 3600);
    const address = email(body.email);
    const displayName = name(body.name);
    const secret = password(body.password);
    const encoded = await hashPassword(secret);
    try {
      await this.pool.execute('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)', [randomUUID(), address, displayName, encoded]);
    } catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; }
    return { message: "Your registration request has been processed. Sign in with your credentials. If you already had an account, use your previous password or password recovery." };
  }
  async login(body, ip) {
    await this.limit('login-ip', ip, 20, 900);
    const address = email(body.email);
    await this.limit('login-email', address, 10, 900);
    if (typeof body.password !== 'string' || Buffer.byteLength(body.password) > 512) throw new ApiError(401, "Incorrect sign-in credentials.");
    const [rows] = await this.pool.execute('SELECT * FROM users WHERE email = ?', [address]);
    const current = rows[0];
    const valid = await verifyPassword(body.password, current?.password_hash || this.dummyHash);
    if (!valid || !current || current.disabled) throw new ApiError(401, "Incorrect sign-in credentials.");
    // Recheck with a lock so a concurrent password change cannot leave an old login active.
    return this.transaction(async connection => {
      const [locked] = await connection.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [current.id]);
      if (!locked[0] || locked[0].disabled || locked[0].password_hash !== current.password_hash) throw new ApiError(401, "Incorrect sign-in credentials.");
      const session = token();
      // Non-expiring sessions are an explicit app policy and require nullable expiry.
      const expires = this.config.persistentSessions === true ? null : new Date(Date.now() + 12 * 3600 * 1000);
      await connection.execute('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [digest(session), current.id, expires]);
      return { token: session, expiresAt: expires?.toISOString() ?? null, user: publicUser(locked[0]) };
    });
  }
  async forgot(body, ip) {
    await this.limit('forgot-ip', ip, 10, 3600);
    const address = email(body.email);
    await this.limit('forgot-email', address, 3, 3600);
    if (!this.config.mailConfigured) throw new ApiError(503, "Password recovery email is not configured yet.");
    const resetToken = token();
    const [rows] = await this.pool.execute('SELECT id FROM users WHERE email = ? AND disabled = FALSE', [address]);
    if (rows.length) {
      await this.transaction(async connection => {
        const [locked] = await connection.execute('SELECT id FROM users WHERE id = ? AND disabled = FALSE FOR UPDATE', [rows[0].id]);
        if (!locked.length) return;
        await connection.execute('DELETE FROM password_resets WHERE user_id = ?', [rows[0].id]);
        await connection.execute('DELETE FROM email_outbox WHERE user_id = ? AND sent_at IS NULL', [rows[0].id]);
        await connection.execute('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [digest(resetToken), rows[0].id, new Date(Date.now() + 30 * 60 * 1000)]);
        const link = `${this.config.appUrl}#reset=${resetToken}`;
        await connection.execute('INSERT INTO email_outbox (id, user_id, encrypted_payload) VALUES (?, ?, ?)', [randomUUID(), rows[0].id, encrypt({ to: address, link }, this.config.encryptionKey)]);
      });
    }
    return { message: recoveryMessage };
  }
  async reset(body, ip) {
    await this.limit('reset-ip', ip, 10, 900);
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new ApiError(400, "The recovery link is invalid or has expired.");
    const newPassword = password(body.password);
    const resetHash = digest(body.token);
    const [rows] = await this.pool.execute('SELECT user_id FROM password_resets WHERE token_hash = ?', [resetHash]);
    if (!rows.length) throw new ApiError(400, "The recovery link is invalid or has expired.");
    const encoded = await hashPassword(newPassword);
    await this.transaction(async connection => {
      const [users] = await connection.execute('SELECT id FROM users WHERE id = ? AND disabled = FALSE FOR UPDATE', [rows[0].user_id]);
      const [resets] = await connection.execute('SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE', [resetHash]);
      if (!users.length || !resets.length) throw new ApiError(400, "The recovery link is invalid or has expired.");
      await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [encoded, rows[0].user_id]);
      await connection.execute('UPDATE password_resets SET used_at = UTC_TIMESTAMP(3) WHERE user_id = ?', [rows[0].user_id]);
      await connection.execute('DELETE FROM auth_sessions WHERE user_id = ?', [rows[0].user_id]);
    });
    return { message: "Your password has been changed. Sign in again." };
  }
  async changePassword(auth, body, ip) {
    await this.limit('password-user', auth.user.id, 5, 900);
    if (typeof body.currentPassword !== 'string' || Buffer.byteLength(body.currentPassword) > 512) throw new ApiError(400, "The current password is incorrect.");
    const next = password(body.password);
    const [rows] = await this.pool.execute('SELECT password_hash FROM users WHERE id = ?', [auth.user.id]);
    const previous = rows[0]?.password_hash;
    if (!previous || !await verifyPassword(body.currentPassword, previous)) throw new ApiError(400, "The current password is incorrect.");
    const encoded = await hashPassword(next);
    await this.transaction(async connection => {
      const [locked] = await connection.execute('SELECT password_hash FROM users WHERE id = ? FOR UPDATE', [auth.user.id]);
      if (locked[0]?.password_hash !== previous) throw new ApiError(409, "The account has changed. Sign in again.");
      await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [encoded, auth.user.id]);
      await connection.execute('DELETE FROM auth_sessions WHERE user_id = ?', [auth.user.id]);
      await connection.execute('DELETE FROM password_resets WHERE user_id = ?', [auth.user.id]);
      await connection.execute('DELETE FROM email_outbox WHERE user_id = ? AND sent_at IS NULL', [auth.user.id]);
    });
    return { message: "Your password has been changed. All sessions have ended; sign in again." };
  }
  async dispatch(method, path, body, authorization, ip) {
    await this.limit('api-ip', ip, 120, 60);
    if (method === 'POST' && path === '/register') return [202, await this.register(body, ip)];
    if (method === 'POST' && path === '/login') return [200, await this.login(body, ip)];
    if (method === 'POST' && path === '/forgot-password') return [202, await this.forgot(body, ip)];
    if (method === 'POST' && path === '/reset-password') return [200, await this.reset(body, ip)];
    const auth = await this.authenticate(authorization);
    if (method === 'DELETE' && path === '/me') {
      await this.limit('delete-user', auth.user.id, 5, 900);
      if (body.confirmation !== 'DELETE' || typeof body.password !== 'string' || Buffer.byteLength(body.password) > 512) throw new ApiError(400, "Confirm deletion and enter your current password.");
      const [rows] = await this.pool.execute('SELECT password_hash FROM users WHERE id = ?', [auth.user.id]);
      if (!rows[0] || !await verifyPassword(body.password, rows[0].password_hash)) throw new ApiError(400, "The current password is incorrect.");
      await this.transaction(async connection => {
        const [locked] = await connection.execute('SELECT password_hash, disabled FROM users WHERE id = ? FOR UPDATE', [auth.user.id]);
        if (!locked[0] || locked[0].disabled || locked[0].password_hash !== rows[0].password_hash) throw new ApiError(409, "The account has changed. Sign in again.");
        await connection.execute('DELETE FROM users WHERE id = ?', [auth.user.id]);
      });
      return [200, { message: "The account and its sessions have been deleted." }];
    }
    if (method === 'GET' && path === '/me') return [200, { user: auth.user, expiresAt: auth.expiresAt }];
    if (method === 'POST' && path === '/logout') {
      await this.pool.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [auth.sessionHash]);
      return [200, { message: "You have signed out." }];
    }
    if (method === 'PATCH' && path === '/me') {
      const displayName = name(body.name);
      await this.pool.execute('UPDATE users SET name = ? WHERE id = ?', [displayName, auth.user.id]);
      return [200, { user: { ...auth.user, name: displayName } }];
    }
    if (method === 'POST' && path === '/change-password') return [200, await this.changePassword(auth, body, ip)];
    if (path === '/users' && method === 'GET') {
      if (auth.user.role !== 'admin') throw new ApiError(403, "Permission denied.");
      const [users] = await this.pool.execute('SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at DESC LIMIT 100');
      return [200, { users }];
    }
    const match = /^\/users\/([a-f0-9-]{36})$/.exec(path);
    if (match && method === 'PATCH') {
      if (auth.user.role !== 'admin') throw new ApiError(403, "Permission denied.");
      if (match[1] === auth.user.id) throw new ApiError(400, "You cannot block your own administrator account.");
      if (typeof body.disabled !== 'boolean') throw new ApiError(400, "Specify a boolean disabled value.");
      await this.transaction(async connection => {
        const [users] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [match[1]]);
        if (!users.length) throw new ApiError(404, "User not found.");
        await connection.execute('UPDATE users SET disabled = ? WHERE id = ?', [body.disabled, match[1]]);
        if (body.disabled) {
          await connection.execute('DELETE FROM auth_sessions WHERE user_id = ?', [match[1]]);
          await connection.execute('DELETE FROM password_resets WHERE user_id = ?', [match[1]]);
          await connection.execute('DELETE FROM email_outbox WHERE user_id = ? AND sent_at IS NULL', [match[1]]);
        }
      });
      return [200, { message: body.disabled ? "The user has been blocked." : "The user has been unblocked." }];
    }
    throw new ApiError(404, "Request not found.");
  }
}
