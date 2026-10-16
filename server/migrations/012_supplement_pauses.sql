-- Pause snapshots make routine reads cheap; immutable periods preserve future history.
ALTER TABLE supplements
 ADD COLUMN paused_at DATETIME(3) NULL,
 ADD COLUMN resume_on DATE NULL,
 ADD COLUMN pause_timezone VARCHAR(80) NULL,
 ADD COLUMN pause_revision INT UNSIGNED NOT NULL DEFAULT 0;
CREATE TABLE supplement_pauses (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 supplement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 started_at DATETIME(3) NOT NULL,
 resumed_at DATETIME(3) NULL,
 resume_on DATE NULL,
 timezone VARCHAR(80) NOT NULL,
 INDEX supplement_periods (supplement_id,started_at),
 FOREIGN KEY (supplement_id,user_id) REFERENCES supplements(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
