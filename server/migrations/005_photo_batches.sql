-- Batch summaries contain product names, IDs and errors only; never raw photos/keys.
ALTER TABLE analysis_jobs
 ADD total_count INT UNSIGNED NOT NULL DEFAULT 0,
 ADD processed_count INT UNSIGNED NOT NULL DEFAULT 0,
 ADD result JSON NULL;
