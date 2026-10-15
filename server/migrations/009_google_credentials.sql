-- Separate storage and authenticated-encryption context. Existing xAI credentials
-- remain usable only by the explicit legacy pipeline, never sent to Google.
CREATE TABLE IF NOT EXISTS google_provider_credentials (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 encrypted_key TEXT CHARACTER SET ascii NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
