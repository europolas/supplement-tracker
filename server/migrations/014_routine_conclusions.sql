-- Latest completed report and unresolved decisions survive queue expiry/reloads.
-- No raw prompt, photo, birth date or provider credential is stored here.
CREATE TABLE IF NOT EXISTS routine_conclusions (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 report JSON NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
