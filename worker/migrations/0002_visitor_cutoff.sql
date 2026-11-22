CREATE INDEX IF NOT EXISTS visits_cutoff ON visits(recorded_at,day,country,city);
INSERT OR IGNORE INTO schema_info VALUES(2,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
