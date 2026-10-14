-- Account removal cascades through both owned groups and supplements. RESTRICT
-- on this edge can block the whole account deletion depending on cascade order.
-- The public group-delete endpoint first unassigns supplements, preserving them.
ALTER TABLE supplements
 DROP FOREIGN KEY supplements_ibfk_2,
 ADD CONSTRAINT supplements_group_owner FOREIGN KEY(group_id,user_id)
 REFERENCES day_groups(id,user_id) ON DELETE CASCADE;
