-- Immutable generated prose, owner scoped. Do not archive raw profile, prompt,
-- research evidence or actionable proposals. Existing latest text is recoverable;
-- reports overwritten before this migration cannot be reconstructed.
CREATE TABLE IF NOT EXISTS routine_conclusion_history (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 report JSON NOT NULL,
 INDEX history_owner_date(user_id,created_at,id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
INSERT IGNORE INTO routine_conclusion_history(id,user_id,created_at,report)
SELECT JSON_UNQUOTE(JSON_EXTRACT(report,'$.id')),user_id,
 COALESCE(STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(report,'$.createdAt')),23),'%Y-%m-%dT%H:%i:%s.%f'),UTC_TIMESTAMP(3)),
 JSON_OBJECT('id',JSON_UNQUOTE(JSON_EXTRACT(report,'$.id')),
 'createdAt',JSON_UNQUOTE(JSON_EXTRACT(report,'$.createdAt')),
 'language',JSON_UNQUOTE(JSON_EXTRACT(report,'$.language')),
 'sections',JSON_EXTRACT(report,'$.sections'))
FROM routine_conclusions;
