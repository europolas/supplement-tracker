-- Explicit personal plans, not AI/manufacturer dosage. Null is legacy daily use.
ALTER TABLE supplements
 ADD COLUMN intake_plan JSON NULL,
 ADD COLUMN intake_revision INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN stock_remaining INT UNSIGNED NULL,
 ADD COLUMN stock_threshold INT UNSIGNED NOT NULL DEFAULT 7,
 ADD COLUMN stock_epoch INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE supplement_completions
 ADD COLUMN slot VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'daily',
 ADD COLUMN quantity INT UNSIGNED NOT NULL DEFAULT 1,
 ADD COLUMN unit VARCHAR(12) NOT NULL DEFAULT 'unit',
 ADD COLUMN stock_debited INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN stock_epoch INT UNSIGNED NOT NULL DEFAULT 0,
 DROP PRIMARY KEY,
 ADD PRIMARY KEY(supplement_id,local_day,slot);
CREATE TABLE supplement_intake_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 supplement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 effective_day DATE NOT NULL,
 plan JSON NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX intake_day(supplement_id,effective_day,id),
 INDEX owner_intake(user_id),
 FOREIGN KEY(supplement_id,user_id) REFERENCES supplements(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
