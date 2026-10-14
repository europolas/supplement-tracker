# Accounts and deployment boundary

AuthApi and security are server-only. The browser uses createApi/createAuth and
setupAccount. Runtime HTTP/CORS/mail handling lives in the optional server template.
Credentials are loaded from ignored .runtime files; generated apps receive fresh
keys, a unique DB/user and a separate Docker project. No production DB is copied.

| Route family | Responsibility |
| --- | --- |
| POST /v1/register, /v1/login | validated registration, generic anti-enumeration response, authentication |
| GET/PATCH /v1/me | own profile read/update with bearer session |
| DELETE /v1/me | current password and explicit DELETE confirmation, transactional removal |
| POST /v1/logout, /v1/change-password | session revocation and password change |
| POST /v1/forgot-password, /v1/reset-password | generic recovery response, one-time expiring token |
| GET /v1/users, PATCH /v1/users/:id | admin-only listing/blocking, never public role assignment |

Read dispatch in server/AuthApi.mjs for exact paths and body fields before building
another client. Do not infer endpoint shapes from this overview. Security helpers
validate limits, use scrypt, hash opaque tokens and encrypt queued recovery mail.
Password changes/deletions recheck account state inside a DB transaction so parallel
requests cannot leave stale sessions. Successful changes invalidate existing sessions.

Migrations hold a connection-level database lock and record SQL checksums. Never edit
applied SQL; use a new migration ID and test recovery on a disposable database. DDL
is not atomic in MariaDB. App credentials receive DML only; provisioning uses separate
root credentials. DB volume persistence is not a backup.

Recovery remains unavailable (503) until SMTP is configured and actual delivery
verified. Runtime messages and email default to English. No recipient-language DB
column, email verification, MFA, social login or complete production push sender is
implemented. Upload/CRUD client helpers require project-specific API endpoints.

Keep the initial schema.sql byte-for-byte unchanged, including comments: its full
contents participate in the stored migration checksum. Put additional explanations
in this guide, not inside already versioned migration SQL.
