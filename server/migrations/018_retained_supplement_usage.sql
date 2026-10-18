-- Recorded intake survives removal from the active routine. IDs/request IDs are
-- never recycled; a later recognition creates an independent product record.
ALTER TABLE supplements
 ADD COLUMN first_taken_at DATETIME(3) NULL,
 ADD COLUMN deleted_at DATETIME(3) NULL,
 ADD INDEX active_owner(user_id,deleted_at);
UPDATE supplements s JOIN (
 SELECT supplement_id,MIN(completed_at) AS first_taken FROM supplement_completions GROUP BY supplement_id
) c ON c.supplement_id=s.id SET s.first_taken_at=c.first_taken;
-- Keep the lifetime marker even after explicit Undo removes that occurrence.
CREATE TRIGGER supplement_ever_taken AFTER INSERT ON supplement_completions FOR EACH ROW
 UPDATE supplements SET first_taken_at=COALESCE(first_taken_at,NEW.completed_at)
 WHERE id=NEW.supplement_id AND user_id=NEW.user_id;
