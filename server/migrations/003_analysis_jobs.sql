-- No raw photos, prompts or secrets enter this queue. Payloads stay in process
-- memory; a restart terminates unfinished jobs explicitly without auto-rebilling.
CREATE TABLE IF NOT EXISTS analysis_jobs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('running','complete','failed') NOT NULL,
 supplement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 error_code VARCHAR(100) CHARACTER SET ascii NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 finished_at DATETIME(3) NULL,
 UNIQUE KEY(user_id,request_id), INDEX(user_id,status),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
