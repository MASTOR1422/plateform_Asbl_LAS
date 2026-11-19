CREATE TABLE IF NOT EXISTS members (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, poste TEXT, profession TEXT, phone TEXT, email TEXT,
 birthdate TEXT, birthplace TEXT, address TEXT, joined TEXT, asbl TEXT NOT NULL DEFAULT 'OUI' CHECK(asbl IN ('OUI','NON')),
 forum TEXT NOT NULL DEFAULT 'Actif' CHECK(forum IN ('Actif','Inactif')), created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS member_payments (
 member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, payment_year INTEGER NOT NULL,
 payment_month INTEGER NOT NULL CHECK(payment_month BETWEEN 1 AND 12), paid INTEGER NOT NULL DEFAULT 1 CHECK(paid IN (0,1)),
 updated_by TEXT, updated_at TEXT, PRIMARY KEY(member_id,payment_year,payment_month)
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','tresorier','secretaire','membre')), member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
 salt TEXT NOT NULL, password_hash TEXT NOT NULL, iterations INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS auth_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,ip_hash TEXT NOT NULL,username TEXT NOT NULL,success INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_window ON auth_attempts(ip_hash,created_at,success);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,target_type TEXT,target_id TEXT,ip_hash TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
