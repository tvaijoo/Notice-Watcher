CREATE TABLE notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT,
    published_at TEXT,
    detected_at TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    content_hash TEXT NOT NULL
);

CREATE INDEX idx_notices_published_at
ON notices(published_at);

CREATE TABLE site_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checked_at TEXT NOT NULL,
    status TEXT NOT NULL,
    response_status INTEGER,
    error TEXT
);

CREATE INDEX idx_site_checks_checked_at
ON site_checks(checked_at);