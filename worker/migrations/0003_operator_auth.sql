CREATE TABLE auth_grants(token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),subject TEXT NOT NULL,origin TEXT NOT NULL,epoch TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER,CHECK(expires_at>created_at AND expires_at-created_at<=120000));
CREATE INDEX auth_grants_expiry ON auth_grants(expires_at);
DELETE FROM sessions;
DELETE FROM cache WHERE key LIKE 'access:%';
INSERT OR IGNORE INTO schema_info VALUES(3,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
