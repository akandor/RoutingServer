const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Ensure data folder exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'routes.db'));

// Initialize schema
db.exec(`
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dstUri TEXT NOT NULL,
  dstIPGname TEXT NOT NULL,
  days TEXT,
  startTime TEXT,
  endTime TEXT
);
`);

// Backfill columns if upgrading existing DBs without the new fields
const columns = db.prepare("PRAGMA table_info(routes)").all().map(c => c.name);
const addCol = (name, def) => { if (!columns.includes(name)) db.exec(`ALTER TABLE routes ADD COLUMN ${name} ${def}`); };
addCol('days', 'TEXT');
addCol('startTime', 'TEXT');
addCol('endTime', 'TEXT');

// Migration: if original schema had UNIQUE(dstUri), recreate table without it and add composite unique
try {
  const tbl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='routes'").get();
  const hasSingleUnique = tbl && tbl.sql && tbl.sql.toLowerCase().includes('dsturi text not null unique');
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='routes_unique_composite'").get();
  if (hasSingleUnique || !idx) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS routes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dstUri TEXT NOT NULL,
          dstIPGname TEXT NOT NULL,
          days TEXT,
          startTime TEXT,
          endTime TEXT
        );
      `);
      db.exec(`
        INSERT INTO routes_new (id, dstUri, dstIPGname, days, startTime, endTime)
        SELECT id, dstUri, dstIPGname, days, startTime, endTime FROM routes;
      `);
      db.exec('DROP TABLE routes');
      db.exec('ALTER TABLE routes_new RENAME TO routes');
      // Normalize NULLs to empty strings so composite uniqueness works on raw columns
      db.exec("UPDATE routes SET days = COALESCE(days, ''), startTime = COALESCE(startTime, ''), endTime = COALESCE(endTime, '')");
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS routes_unique_composite ON routes (dstUri, days, startTime, endTime)');
    })();
  }
} catch (e) {
  // Log and continue; server will still run, but duplicates by time may be blocked until restart
  console.error('DB migration check failed', e);
}

// Users table for authentication/authorization
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','admin')),
  firstName TEXT,
  lastName TEXT,
  avatar TEXT
);
`);

// Ensure otp_secret and otp_enabled columns exist in users table
(() => {
  const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userColumns.includes('otp_secret')) {
    db.exec("ALTER TABLE users ADD COLUMN otp_secret TEXT");
  }
  if (!userColumns.includes('otp_enabled')) {
    db.exec("ALTER TABLE users ADD COLUMN otp_enabled INTEGER NOT NULL DEFAULT 0");
  }
})();

// Seed default users if table empty
try {
  const count = db.prepare('SELECT COUNT(1) AS c FROM users').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)');
    const adminHash = bcrypt.hashSync('admin123', 10);
    const userHash = bcrypt.hashSync('user123', 10);
    insert.run('admin', adminHash, 'admin');
    insert.run('user', userHash, 'user');
    console.log('Seeded default users: admin/admin123, user/user123');
  }
} catch (e) {
  console.error('User seeding failed', e);
}

db.exec(`
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;


