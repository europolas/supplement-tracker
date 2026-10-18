-- Optional isolated application-owned workflow store. Apply through the host's
-- migration runner, never automatically on import/startup. Bind owner IDs to the
-- authenticated session; cascade/removeOwner explicitly on account deletion.
CREATE TABLE app_workflows (
 owner_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 document JSON NOT NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY(owner_id,kind,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
