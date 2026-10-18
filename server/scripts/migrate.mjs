/**
 * Privileged provisioning CLI only. Validate identifiers, apply schema migrations and grant the application user DML only. Never expose this root-credential command as an HTTP route.
 * See AGENTS.md and the reusable library docs/ARCHITECTURE.md.
 */
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { applyMigrations } from '../src/migrations.mjs';
const database = process.env.DB_NAME;
const user = process.env.DB_USER;
if (!/^[a-z][a-z0-9_]{2,31}$/.test(database) || !/^[a-z][a-z0-9_]{2,31}$/.test(user)) throw new Error('Invalid database identifiers');
const connection = await mysql.createConnection({ host: 'db', user: 'root', password: readFileSync('/run/secrets/db_root', 'utf8').trim(), database, multipleStatements: true });
try {
  await applyMigrations(connection, [{ id: '001_accounts', sql: readFileSync('/app/schema.sql', 'utf8') }, { id: '002_tracker', sql: readFileSync('/app/migrations/002_tracker.sql', 'utf8') }, { id: '003_analysis_jobs', sql: readFileSync('/app/migrations/003_analysis_jobs.sql', 'utf8') }, { id: '004_persistent_sessions', sql: readFileSync('/app/migrations/004_persistent_sessions.sql', 'utf8') }, { id: '005_photo_batches', sql: readFileSync('/app/migrations/005_photo_batches.sql', 'utf8') }, { id: '006_progressive_analysis', sql: readFileSync('/app/migrations/006_progressive_analysis.sql', 'utf8') }, { id: '007_account_group_cascade', sql: readFileSync('/app/migrations/007_account_group_cascade.sql', 'utf8') }, { id: '008_upload_queue', sql: readFileSync('/app/migrations/008_upload_queue.sql', 'utf8') }, { id: '009_google_credentials', sql: readFileSync('/app/migrations/009_google_credentials.sql', 'utf8') }, { id: '010_group_icons', sql: readFileSync('/app/migrations/010_group_icons.sql', 'utf8') }, { id: '011_routine_preferences', sql: readFileSync('/app/migrations/011_routine_preferences.sql', 'utf8') }, { id: '012_supplement_pauses', sql: readFileSync('/app/migrations/012_supplement_pauses.sql', 'utf8') }, { id: '013_usage_group_history', sql: readFileSync('/app/migrations/013_usage_group_history.sql', 'utf8') }, { id: '014_routine_conclusions', sql: readFileSync('/app/migrations/014_routine_conclusions.sql', 'utf8') }, { id: '015_intake_stock', sql: readFileSync('/app/migrations/015_intake_stock.sql', 'utf8') }, { id: '016_wellbeing_journal', sql: readFileSync('/app/migrations/016_wellbeing_journal.sql', 'utf8') }, { id: '017_conclusion_history', sql: readFileSync('/app/migrations/017_conclusion_history.sql', 'utf8') }, { id: '018_retained_supplement_usage', sql: readFileSync('/app/migrations/018_retained_supplement_usage.sql', 'utf8') }], { database });
  const password = readFileSync('/run/secrets/db_app', 'utf8').trim();
  await connection.query("CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?", [user, password]);
  await connection.query("ALTER USER ?@'%' IDENTIFIED BY ?", [user, password]);
  await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO ?@'%'`, [user]);
  console.log('Created tables and restricted application account.');
} finally { await connection.end(); }
