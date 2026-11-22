-- Display-only allocation ledger. Never contains visitor identities or measured visits.
CREATE TABLE IF NOT EXISTS illustrative_days(
 day TEXT PRIMARY KEY CHECK(day GLOB '????-??-??'),
 allocation INTEGER NOT NULL CHECK(allocation BETWEEN 5 AND 11),
 origin TEXT NOT NULL DEFAULT 'illustrative' CHECK(origin='illustrative'),
 created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_info VALUES(4,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
