/** One-time private bootstrap. Read a mode-600 JSON file, validate credentials,
 * create the initial account or verify its existing password, then grant admin.
 * Never print passwords or automatically overwrite an existing password.
 */
import mysql from 'mysql2/promise';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {email,name,password,hashPassword,verifyPassword} from '../src/security.mjs';
const input=JSON.parse(readFileSync(process.env.INITIAL_ADMIN_FILE||'/run/secrets/initial_admin','utf8'));
const address=email(input.email),displayName=name(input.name||'Administrator'),secret=password(input.password);
const db=await mysql.createConnection({host:process.env.DB_HOST||'db',database:process.env.DB_NAME,user:'root',password:readFileSync('/run/secrets/db_root','utf8').trim()});
try{
 const [rows]=await db.execute('SELECT id,password_hash FROM users WHERE email=?',[address]);
 if(rows.length){if(!await verifyPassword(secret,rows[0].password_hash))throw new Error('Existing admin password does not match the private bootstrap file');await db.execute("UPDATE users SET role='admin' WHERE id=?",[rows[0].id]);}
 else await db.execute("INSERT INTO users(id,email,name,password_hash,role) VALUES (?,?,?,?,'admin')",[randomUUID(),address,displayName,await hashPassword(secret)]);
 console.log('Initial administrator is ready. No credential values were printed.');
}finally{await db.end();}
