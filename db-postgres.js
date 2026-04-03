const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// PostgreSQL connection configuration
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper function to convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Database initialization
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Create routes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        "dstUri" TEXT NOT NULL,
        "dstIPGname" TEXT NOT NULL,
        days TEXT DEFAULT '',
        "startTime" TEXT DEFAULT '',
        "endTime" TEXT DEFAULT ''
      )
    `);

    // Create unique index for routes (PostgreSQL equivalent of SQLite composite unique)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS routes_unique_composite 
      ON routes ("dstUri", days, "startTime", "endTime")
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        passwordhash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','admin')),
        firstname TEXT,
        lastname TEXT,
        avatar TEXT,
        otp_secret TEXT,
        otp_enabled INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        token TEXT NOT NULL,
        createdat TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        permissions JSONB NOT NULL DEFAULT '{}',
        createdat TIMESTAMP NOT NULL DEFAULT NOW(),
        updatedat TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create web_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS web_settings (
        id SERIAL PRIMARY KEY,
        access_mode TEXT NOT NULL DEFAULT 'http_https' CHECK(access_mode IN ('http_https','https_only','https_redirect')),
        private_key_path TEXT,
        certificate_path TEXT,
        private_key_passphrase TEXT,
        certificate_info JSONB,
        updatedat TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default users if table is empty
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const userHash = bcrypt.hashSync('user123', 10);
      
      await client.query(
        'INSERT INTO users (username, passwordhash, role) VALUES ($1, $2, $3)',
        ['admin', adminHash, 'admin']
      );
      await client.query(
        'INSERT INTO users (username, passwordhash, role) VALUES ($1, $2, $3)',
        ['user', userHash, 'user']
      );
      console.log('Seeded default users: admin/admin123, user/user123');
    }

    // Seed default roles if table is empty
    const roleCount = await client.query('SELECT COUNT(*) as count FROM roles');
    if (parseInt(roleCount.rows[0].count) === 0) {
      await client.query(
        'INSERT INTO roles (name, permissions) VALUES ($1, $2)',
        ['Administrator', JSON.stringify({
          administrator: true,
          routes: { view: true, add: true, edit: true, delete: true }
        })]
      );
      await client.query(
        'INSERT INTO roles (name, permissions) VALUES ($1, $2)',
        ['User', JSON.stringify({
          administrator: false,
          routes: { view: true, add: false, edit: false, delete: false }
        })]
      );
      await client.query(
        'INSERT INTO roles (name, permissions) VALUES ($1, $2)',
        ['Editor', JSON.stringify({
          administrator: false,
          routes: { view: true, add: true, edit: true, delete: false }
        })]
      );
      console.log('Seeded default roles: Administrator, User, Editor');
    }

    // Seed default web settings if table is empty
    const webSettingsCount = await client.query('SELECT COUNT(*) as count FROM web_settings');
    if (parseInt(webSettingsCount.rows[0].count) === 0) {
      await client.query(
        'INSERT INTO web_settings (access_mode) VALUES ($1)',
        ['http_https']
      );
      console.log('Seeded default web settings');
    }

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// SQLite-compatible API for PostgreSQL
const db = {
  prepare(sql) {
    const pgSql = convertPlaceholders(sql);
    
    return {
      async get(...params) {
        const client = await pool.connect();
        try {
          const result = await client.query(pgSql, params);
          return result.rows[0] || null;
        } finally {
          client.release();
        }
      },
      
      async all(...params) {
        const client = await pool.connect();
        try {
          const result = await client.query(pgSql, params);
          return result.rows;
        } finally {
          client.release();
        }
      },
      
      async run(...params) {
        const client = await pool.connect();
        try {
          // For INSERT queries, we need to return the inserted ID
          let finalSql = pgSql;
          if (pgSql.toLowerCase().includes('insert into')) {
            finalSql += ' RETURNING id';
          }
          
          const result = await client.query(finalSql, params);
          return {
            changes: result.rowCount,
            lastInsertRowid: result.rows[0]?.id || null
          };
        } finally {
          client.release();
        }
      }
    };
  },

  transaction(fn) {
    return async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await fn();
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    };
  },

  async exec(sql) {
    const client = await pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }
};

// Initialize the database
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = db;
