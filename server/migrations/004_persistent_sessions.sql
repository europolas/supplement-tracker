-- NULL represents an explicitly revocable session without a time-based expiry.
-- Upgrade only sessions still active at deployment; never revive expired sessions.
ALTER TABLE auth_sessions MODIFY expires_at DATETIME(3) NULL;
UPDATE auth_sessions SET expires_at=NULL WHERE expires_at > UTC_TIMESTAMP(3);
