-- Icons are owner-supplied data, rendered through a browser SVG allowlist.
ALTER TABLE day_groups ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';
