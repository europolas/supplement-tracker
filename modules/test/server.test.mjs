import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, encrypt, decrypt } from '../server/security.mjs';
import { applyMigrations } from '../server/migrations.mjs';
test('reused password hashing and encrypted recovery payload reject wrong passwords and tampering', async () => {
  const encoded = await hashPassword('A long password phrase'); assert.notEqual(encoded, 'A long password phrase'); assert.equal(await verifyPassword('A long password phrase', encoded), true); assert.equal(await verifyPassword('Wrong password phrase', encoded), false);
  const key = randomBytes(32); const encrypted = encrypt({ token: 'private' }, key); assert.equal(decrypt(encrypted, key).token, 'private'); const buffer = Buffer.from(encrypted, 'base64'); buffer[buffer.length - 1] ^= 1; assert.throws(() => decrypt(buffer.toString('base64'), key));
});
test('migration records are idempotent, detect changed SQL, and always release the DB lock', async () => {
  const applied = new Map(); let executions = 0; let released = 0;
  const connection = { query: async sql => { if (sql === 'CREATE TABLE sample') executions++; }, execute: async (sql, args) => { if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]]; if (sql.includes('RELEASE_LOCK')) { released++; return [[]]; } if (sql.startsWith('SELECT checksum')) return [applied.has(args[0]) ? [{ checksum: applied.get(args[0]) }] : []]; if (sql.startsWith('INSERT')) { applied.set(args[0], args[1]); return [[]]; } } };
  const list = [{ id: '001_sample', sql: 'CREATE TABLE sample' }]; await applyMigrations(connection, list, { database: 'sample_db' }); await applyMigrations(connection, list, { database: 'sample_db' }); assert.equal(executions, 1);
  await assert.rejects(applyMigrations(connection, [{ id: '001_sample', sql: 'Changed' }], { database: 'sample_db' }), /modified/); assert.equal(released, 3);
});
