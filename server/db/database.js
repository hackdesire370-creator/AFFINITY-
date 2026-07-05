import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '..', '..', 'affinity.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    title TEXT,
    category TEXT,
    passkey TEXT UNIQUE,
    theme TEXT,
    status TEXT,
    created_by TEXT,
    unlock_date DATETIME,
    collab_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_participants (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    user_name TEXT,
    role TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_wishes (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_memories (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    type TEXT,
    title TEXT,
    file_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_letters (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    title TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_soundtracks (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    title TEXT,
    file_url TEXT,
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_activity (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_voice_notes (
    id TEXT PRIMARY KEY,
    vault_id TEXT,
    user_id TEXT,
    title TEXT,
    file_url TEXT,
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for existing tables
try {
  db.exec(`ALTER TABLE vaults ADD COLUMN unlock_date DATETIME;`);
} catch (err) {
  // Column might already exist
}

try {
  db.exec(`ALTER TABLE vaults ADD COLUMN collab_key TEXT UNIQUE;`);
} catch (err) {
  // Column might already exist
}

export default db;
