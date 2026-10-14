/**
 * Checksum-verified database migrations with a connection-scoped lock.
 * Use a fresh ID for new SQL. DDL is not transactionally reversible; backup and recovery remain deployment responsibilities.
 * See ../docs/BACKEND.md. This file must never enter the browser build.
 */
import { createHash } from 'node:crypto';
export async function applyMigrations(connection, migrations, { database } = {}) {
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(database)) throw new TypeError('Invalid database name');
  const lock = 'migrate:' + database;
  const [rows] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', [lock]);
  if (!rows[0]?.acquired) throw new Error('Another migration is running');
  try {
    await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(80) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB');
    for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!/^\d{3}_[a-z0-9_]+$/.test(migration.id)) throw new TypeError('Invalid migration id');
      const checksum = createHash('sha256').update(migration.sql).digest('hex');
      const [applied] = await connection.execute('SELECT checksum FROM schema_migrations WHERE id = ?', [migration.id]);
      if (applied.length) { if (applied[0].checksum !== checksum) throw new Error('Applied migration was modified: ' + migration.id); continue; }
      await connection.query(migration.sql);
      await connection.execute('INSERT INTO schema_migrations (id, checksum) VALUES (?, ?)', [migration.id, checksum]);
    }
  } finally { await connection.execute('SELECT RELEASE_LOCK(?)', [lock]); }
}
