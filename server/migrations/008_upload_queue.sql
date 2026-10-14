-- Uploads may wait for their account's single fast recognition slot. Raw photos
-- remain bounded in memory; only submission labels and progress live in job JSON.
ALTER TABLE analysis_jobs
 MODIFY phase ENUM('queued','recognizing','enriching','done') NOT NULL DEFAULT 'queued';
