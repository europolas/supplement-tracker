-- Snapshot names/icons without a group FK: deleting/renaming a group must not
-- rewrite past records. Product/account deletion retains their explicit cascade.
CREATE TABLE supplement_group_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 supplement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 group_name VARCHAR(120) NULL,
 group_icon TEXT NULL,
 group_position INT NULL,
 effective_at DATETIME(3) NOT NULL,
 INDEX product_group_time(supplement_id,effective_at,id),
 INDEX owner_group_time(user_id,effective_at),
 FOREIGN KEY(supplement_id,user_id) REFERENCES supplements(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE supplement_completions ADD COLUMN group_snapshot JSON NULL;
-- The baseline starts NOW. Earlier unrecorded assignments cannot be inferred from
-- today's group. Never backdate a fabricated current assignment into old history.
INSERT INTO supplement_group_history(user_id,supplement_id,group_id,group_name,group_icon,group_position,effective_at)
 SELECT s.user_id,s.id,s.group_id,g.name,g.icon,g.position,UTC_TIMESTAMP(3)
 FROM supplements s LEFT JOIN day_groups g ON g.id=s.group_id AND g.user_id=s.user_id;
-- DB triggers cover manual edits, recognition, research and accepted AI moves in
-- the same transaction, including legacy API paths. No additional paid requests.
CREATE TRIGGER supplement_group_created AFTER INSERT ON supplements FOR EACH ROW
 INSERT INTO supplement_group_history(user_id,supplement_id,group_id,group_name,group_icon,group_position,effective_at)
 VALUES(NEW.user_id,NEW.id,NEW.group_id,(SELECT name FROM day_groups WHERE id=NEW.group_id AND user_id=NEW.user_id),(SELECT icon FROM day_groups WHERE id=NEW.group_id AND user_id=NEW.user_id),(SELECT position FROM day_groups WHERE id=NEW.group_id AND user_id=NEW.user_id),NEW.created_at);
CREATE TRIGGER supplement_group_changed AFTER UPDATE ON supplements FOR EACH ROW
 INSERT INTO supplement_group_history(user_id,supplement_id,group_id,group_name,group_icon,group_position,effective_at)
 SELECT NEW.user_id,NEW.id,NEW.group_id,g.name,g.icon,g.position,UTC_TIMESTAMP(3)
 FROM (SELECT 1 AS singleton) x LEFT JOIN day_groups g ON g.id=NEW.group_id AND g.user_id=NEW.user_id
 WHERE NOT(NEW.group_id <=> OLD.group_id);
CREATE TRIGGER group_history_changed AFTER UPDATE ON day_groups FOR EACH ROW
 INSERT INTO supplement_group_history(user_id,supplement_id,group_id,group_name,group_icon,group_position,effective_at)
 SELECT s.user_id,s.id,NEW.id,NEW.name,NEW.icon,NEW.position,UTC_TIMESTAMP(3)
 FROM supplements s WHERE s.group_id=NEW.id AND s.user_id=NEW.user_id
 AND (NOT(NEW.name <=> OLD.name) OR NOT(NEW.icon <=> OLD.icon) OR NOT(NEW.position <=> OLD.position));
-- Capturing at INSERT protects taken records from even a later same-millisecond
-- move/rename. Idempotent re-marking preserves the original completion snapshot.
CREATE TRIGGER completion_group_captured BEFORE INSERT ON supplement_completions FOR EACH ROW
 SET NEW.group_snapshot=JSON_OBJECT(
 'groupId',(SELECT group_id FROM supplements WHERE id=NEW.supplement_id AND user_id=NEW.user_id),
 'name',(SELECT g.name FROM supplements s JOIN day_groups g ON g.id=s.group_id AND g.user_id=s.user_id WHERE s.id=NEW.supplement_id AND s.user_id=NEW.user_id),
 'icon',(SELECT g.icon FROM supplements s JOIN day_groups g ON g.id=s.group_id AND g.user_id=s.user_id WHERE s.id=NEW.supplement_id AND s.user_id=NEW.user_id),
 'position',(SELECT g.position FROM supplements s JOIN day_groups g ON g.id=s.group_id AND g.user_id=s.user_id WHERE s.id=NEW.supplement_id AND s.user_id=NEW.user_id));
