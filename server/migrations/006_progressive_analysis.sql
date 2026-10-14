-- Phases keep fast recognition separate from optional long-running enrichment.
-- Localized result text belongs to the submission language; no secret/photo is stored.
ALTER TABLE analysis_jobs
 ADD phase ENUM('recognizing','enriching','done') NOT NULL DEFAULT 'recognizing',
 ADD language ENUM('en','lt') NOT NULL DEFAULT 'en';
UPDATE analysis_jobs SET phase='done' WHERE status <> 'running';
