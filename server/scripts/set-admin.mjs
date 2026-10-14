/**
 * Explicit deployment CLI to grant an existing account admin access. Public registration must never assign roles.
 * See AGENTS.md and the reusable library docs/ARCHITECTURE.md.
 */
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { email } from '../src/security.mjs';
const address = email(process.argv[2]);
const connection = await mysql.createConnection({ host: 'db', user: 'root', password: readFileSync('/run/secrets/db_root', 'utf8').trim(), database: process.env.DB_NAME });
try { const [result] = await connection.execute("UPDATE users SET role = 'admin' WHERE email = ? AND disabled = FALSE", [address]); if (!result.affectedRows) throw new Error('Active user not found'); console.log('Administrator role assigned.'); } finally { await connection.end(); }
