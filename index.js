const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db-postgres');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

const dbHost = process.env.POSTGRES_HOST;
const dbPort = process.env.POSTGRES_PORT;
const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;
const dbName = process.env.POSTGRES_DB;

// Global variable to store current web settings
let currentWebSettings = null;

// Function to load web settings from database
async function loadWebSettings() {
  try {
    const settings = await db.prepare('SELECT * FROM web_settings ORDER BY id DESC LIMIT 1').get();
    currentWebSettings = settings || { access_mode: 'http_https' };
    return currentWebSettings;
  } catch (error) {
    console.error('Error loading web settings:', error);
    currentWebSettings = { access_mode: 'http_https' };
    return currentWebSettings;
  }
}

// HTTPS redirect middleware
function httpsRedirectMiddleware(req, res, next) {
  if (!currentWebSettings) {
    return next();
  }

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  
  if (currentWebSettings.access_mode === 'https_only' && !isSecure) {
    return res.status(403).json({ error: 'HTTPS required' });
  }
  
  if (currentWebSettings.access_mode === 'https_redirect' && !isSecure) {
    const httpsUrl = `https://${req.headers.host.replace(/:\d+$/, '')}:${HTTPS_PORT}${req.url}`;
    return res.redirect(301, httpsUrl);
  }
  
  next();
}

// Middleware
app.use(cors());
app.use(httpsRedirectMiddleware); // Apply HTTPS redirect middleware early
app.use(express.json());
app.use(express.text({ type: 'text/csv', limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fa', express.static(path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

// Route: redirect root to /admin
app.get('/', (req, res) => {
  return res.redirect('/admin');
});

// Route: serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Basic POST endpoint placeholder
app.post('/echo', (req, res) => {
  const payload = req.body || {};
  res.json({ received: payload, message: 'Echo successful' });
});

// POST /getRoute
// Body: { sessionId: string, dstUri: string }
app.post('/getRoute', async (req, res) => {
  // Require HTTP Basic Auth
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const base64 = auth.split(' ')[1];
  const [username, token] = Buffer.from(base64, 'base64').toString().split(':');
  if (!username || !token) {
    return res.status(400).json({ error: 'Invalid Basic Auth' });
  }
  // Validate against tokens table
  const tokenRow = await db.prepare('SELECT username FROM tokens WHERE username = ? AND token = ?').get(username, token);
  if (!tokenRow) {
    return res.status(401).json({ error: 'Invalid token credentials' });
  }

  // Accept sessionId from body
  const { dstUri, sessionId } = req.body || {};
  if (!dstUri) {
    return res.status(400).json({ error: 'dstUri required' });
  }
  try {
    const now = new Date();
    const dayIdx = now.getDay(); // 0..6 Sun..Sat
    const dayMap = ['sun','mon','tue','wed','thu','fri','sat'];
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const current = `${hh}:${mm}`;

    // First try exact match
    let rows = await db.prepare('SELECT "dstIPGname", days, "startTime", "endTime", "dstUri" FROM routes WHERE "dstUri" = ? ORDER BY id ASC').all(dstUri);
    
    // If no exact match found, try wildcard matching
    if (!rows || rows.length === 0) {
      // Get all routes that might contain wildcards
      const allRoutes = await db.prepare('SELECT "dstIPGname", days, "startTime", "endTime", "dstUri" FROM routes WHERE "dstUri" LIKE \'%x%\' OR "dstUri" LIKE \'%z%\' OR "dstUri" LIKE \'%n%\' OR "dstUri" LIKE \'%*%\' ORDER BY id ASC').all();
      
      // Filter and sort routes by wildcard pattern specificity
      const matchingRoutes = allRoutes.filter(route => {
        const pattern = route.dstUri;
        // Handle * wildcard (prefix matching)
        if (pattern.includes('*')) {
          const prefixPattern = pattern.replace('*', '');
          const escapedPrefix = prefixPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`^${escapedPrefix}`);
          return regex.test(dstUri);
        }
        
        // Escape special regex characters, then replace wildcards with digit matchers
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = escapedPattern
          .replace(/x/g, '[0-9]')  // x = any digit 0-9
          .replace(/z/g, '[1-9]')  // z = digits 1-9 (excluding 0)
          .replace(/n/g, '[2-9]'); // n = digits 2-9 (excluding 0,1)
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(dstUri);
      });

      // Sort by specificity: exact length patterns (x,z,n) before prefix patterns (*)
      rows = matchingRoutes.sort((a, b) => {
        const aHasStar = a.dstUri.includes('*');
        const bHasStar = b.dstUri.includes('*');
        
        // Patterns without * (exact length) have higher priority
        if (!aHasStar && bHasStar) return -1;
        if (aHasStar && !bHasStar) return 1;
        
        // If both have * or both don't have *, sort by pattern length (longer = more specific)
        return b.dstUri.length - a.dstUri.length;
      });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    function isActive(r) {
      const days = (r.days || '').toLowerCase();
      const activeDays = days ? days.split(',').map(s => s.trim()) : [];
      const dayOk = activeDays.length === 0 || activeDays.includes(dayMap[dayIdx]);
      const start = r.startTime || '00:00';
      const end = r.endTime || '23:59';
      return dayOk && start <= current && current <= end;
    }

    function isSpecific(r) {
      return (r.days && r.days.trim() !== '') || (r.startTime && r.startTime.trim() !== '') || (r.endTime && r.endTime.trim() !== '');
    }

    const activeSpecific = rows.filter(r => isActive(r) && isSpecific(r));
    const activeAny = rows.filter(isActive);
    const active = activeSpecific[0] || activeAny[0];
    if (!active) {
      return res.status(404).json({ error: 'Route not found', sessionId });
    }
    // Include sessionId in the response
    return res.json({
      sessionId,
      dstGroup: { type: 'IPGroup', name: active.dstIPGname }
      
    });
  } catch (err) {
    console.error('Error querying route', err);
    return res.status(500).json({ error: 'Internal server error', sessionId });
  }
});

// CRUD APIs for admin
// List
// Auth helpers
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password, otp } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  // Also select otp_enabled and otp_secret
  const user = await db.prepare('SELECT id, username, passwordhash, role, otp_enabled, otp_secret FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordhash)) return res.status(401).json({ error: 'Invalid credentials' });
  
  if (user.otp_enabled === 1 && !user.otp_secret) {
    console.log('Forcing 2FA setup for user:', user.username);
    return res.status(401).json({ error: '2FA setup required', otp_setup_required: true });
  }
  
  // If OTP is enabled, require OTP
  if (user.otp_enabled === 1) {
    if (!otp) {
      return res.status(401).json({ error: 'OTP required', otp: true });
    }
    // Verify OTP
    const verified = speakeasy.totp.verify({
      secret: user.otp_secret,
      encoding: 'base32',
      token: otp
    });
    if (!verified) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// OTP Setup for login flow (without authentication) - don't save to DB yet
app.post('/api/auth/otp/setup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  
  const user = await db.prepare('SELECT id, username, passwordhash, otp_enabled, otp_secret FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordhash)) return res.status(401).json({ error: 'Invalid credentials' });
  
  // Only allow setup if 2FA is enabled but no secret exists (forced activation)
  if (user.otp_enabled !== 1 || user.otp_secret) {
    return res.status(400).json({ error: 'OTP setup not required' });
  }
  
  const secret = speakeasy.generateSecret({ name: `RoutingServer (${user.username})` });
  // Store temporarily using negative user ID to distinguish from authenticated users
  tempSecrets.set(`login_${user.id}`, secret.base32);
  
  try {
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qr: qrDataUrl });
  } catch (err) {
    console.error('Error generating QR code', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// OTP Verify for login flow (without authentication) - now saves secret to DB
app.post('/api/auth/otp/verify', async (req, res) => {
  const { username, password, code } = req.body || {};
  if (!username || !password || !code) return res.status(400).json({ error: 'username, password, and code required' });
  
  const user = await db.prepare('SELECT id, username, passwordhash, role, otp_enabled, otp_secret FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordhash)) return res.status(401).json({ error: 'Invalid credentials' });
  
  // Get temporary secret for login flow
  const tempSecret = tempSecrets.get(`login_${user.id}`);
  if (!tempSecret) return res.status(400).json({ error: 'No setup in progress' });
  
  const verified = speakeasy.totp.verify({ 
    secret: tempSecret, 
    encoding: 'base32', 
    token: code 
  });
  
  if (!verified) return res.status(400).json({ error: 'Invalid code' });
  
  // Code verified - now save to database
  await db.prepare('UPDATE users SET otp_secret = ? WHERE id = ?').run(tempSecret, user.id);
  tempSecrets.delete(`login_${user.id}`); // Clean up temporary secret
  
  // Set session and return success
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ user: req.session.user });
});

// Users management (admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
  const users = await db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  res.json(users);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ error: 'username, password, role required' });
  if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = await db.prepare('INSERT INTO users (username, passwordhash, role) VALUES (?, ?, ?)').run(username, hash, role);
    const user = await db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(user);
  } catch (e) {
    if ((e.message || '').toLowerCase().includes('unique')) return res.status(409).json({ error: 'username exists' });
    console.error('Create user failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password, role, otp_enabled } = req.body || {};
  
  // Input validation
  if (!password && !role && otp_enabled === undefined) {
    return res.status(400).json({ error: 'nothing to update' });
  }
  
  // Validate role if provided
  if (role && !['user','admin'].includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }
  
  // Validate otp_enabled if provided
  if (otp_enabled !== undefined && ![0, 1].includes(otp_enabled)) {
    return res.status(400).json({ error: 'otp_enabled must be 0 or 1' });
  }
  
  // Get existing user
  const existing = await db.prepare('SELECT id, username, role, otp_enabled, otp_secret FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  
  // Security check: Prevent users from modifying their own role
  if (role && role !== existing.role && req.session.user.id == id) {
    return res.status(403).json({ error: 'Cannot modify your own role' });
  }
  
  // Security check: Only allow admin role changes by other admins
  if (role === 'admin' && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can grant admin privileges' });
  }
  
  // Security check: Prevent last admin from being demoted
  if (role === 'user' && existing.role === 'admin') {
    const adminCount = await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
    if (adminCount.count <= 1) {
      return res.status(403).json({ error: 'Cannot demote the last administrator' });
    }
  }
  
  const hash = password ? bcrypt.hashSync(password, 10) : null;
  
  // Handle 2FA toggle logic
  let otpEnabledValue = existing.otp_enabled;
  let otpSecretValue = existing.otp_secret;
  
  if (otp_enabled !== undefined) {
    if (otp_enabled === 1) {
      // Admin is enabling 2FA - force user to set it up on next login
      otpEnabledValue = 1;
      otpSecretValue = null; // Clear secret to force setup
    } else {
      // Admin is disabling 2FA - clear both enabled flag and secret
      otpEnabledValue = 0;
      otpSecretValue = null;
    }
  }
  
  try {
    await db.prepare('UPDATE users SET passwordHash = COALESCE(?, passwordHash), role = COALESCE(?, role), otp_enabled = ?, otp_secret = ? WHERE id = ?')
      .run(hash, role || null, otpEnabledValue, otpSecretValue, id);
    const updated = await db.prepare('SELECT id, username, role, otp_enabled FROM users WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id/password', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare('UPDATE users SET passwordhash = ? WHERE id = ?').run(hash, id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.status(204).send();
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const info = await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.status(204).send();
});

// Profile APIs (authenticated)
app.get('/api/profile', requireAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (row) {
    // Map PostgreSQL column names to expected frontend format
    row.firstName = row.firstname;
    row.lastName = row.lastname;
  }
  res.json(row);
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { username, firstName, lastName, password } = req.body || {};
  const existing = await db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  let hash = null;
  if (password) hash = bcrypt.hashSync(password, 10);
  try {
    if (username && username !== existing.username) {
      const taken = await db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, existing.id);
      if (taken) return res.status(409).json({ error: 'username exists' });
    }
    await db.prepare('UPDATE users SET username = COALESCE(?, username), firstname = COALESCE(?, firstname), lastname = COALESCE(?, lastname), passwordhash = COALESCE(?, passwordhash) WHERE id = ?')
      .run(username || null, firstName || null, lastName || null, hash, existing.id);
    const updated = await db.prepare('SELECT id, username, role, firstname, lastname, avatar FROM users WHERE id = ?').get(existing.id);
    req.session.user.username = updated.username;
    res.json(updated);
  } catch (e) {
    console.error('Update profile failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Personal information update endpoint
app.put('/api/profile/personal', requireAuth, async (req, res) => {
  const { firstName, lastName } = req.body || {};
  const existing = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.session.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  
  try {
    await db.prepare('UPDATE users SET firstname = COALESCE(?, firstname), lastname = COALESCE(?, lastname) WHERE id = ?')
      .run(firstName || null, lastName || null, existing.id);
    const updated = await db.prepare('SELECT id, username, role, firstname, lastname, avatar FROM users WHERE id = ?').get(existing.id);
    res.json(updated);
  } catch (e) {
    console.error('Update personal info failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Security update endpoint (password only)
app.put('/api/profile/security', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password required' });
  
  const existing = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.session.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  
  try {
    const hash = bcrypt.hashSync(password, 10);
    await db.prepare('UPDATE users SET passwordhash = ? WHERE id = ?').run(hash, existing.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Update password failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Store temporary secrets for verification (in production, use Redis or similar)
const tempSecrets = new Map();

// OTP Setup: generate secret and QR code (don't save to DB yet)
app.post('/api/profile/otp/setup', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `RoutingServer (${req.session.user.username})` });
  // Store temporarily, don't save to DB until verified
  tempSecrets.set(req.session.user.id, secret.base32);
  try {
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qr: qrDataUrl });
  } catch (err) {
    console.error('Error generating QR code', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// OTP Verify: confirm code and enable (now saves secret to DB)
app.post('/api/profile/otp/verify', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code required' });
  
  // Get temporary secret
  const tempSecret = tempSecrets.get(req.session.user.id);
  if (!tempSecret) return res.status(400).json({ error: 'No setup in progress' });
  
  const verified = speakeasy.totp.verify({ secret: tempSecret, encoding: 'base32', token: code });
  if (!verified) return res.status(400).json({ error: 'Invalid code' });
  
  // Code verified - now save to database and enable 2FA
  await db.prepare('UPDATE users SET otp_enabled = 1, otp_secret = ? WHERE id = ?').run(tempSecret, req.session.user.id);
  tempSecrets.delete(req.session.user.id); // Clean up temporary secret
  res.json({ ok: true });
});

// OTP Disable
app.post('/api/profile/otp/disable', requireAuth, async (req, res) => {
  await db.prepare('UPDATE users SET otp_enabled = 0, otp_secret = NULL WHERE id = ?').run(req.session.user.id);
  // Clean up any temporary secrets
  tempSecrets.delete(req.session.user.id);
  res.json({ ok: true });
});

// OTP Cancel setup (cleanup temporary secret)
app.post('/api/profile/otp/cancel', requireAuth, (req, res) => {
  tempSecrets.delete(req.session.user.id);
  res.json({ ok: true });
});

// OTP Cancel setup for login flow
app.post('/api/auth/otp/cancel', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  
  const user = await db.prepare('SELECT id, username, passwordhash FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordhash)) return res.status(401).json({ error: 'Invalid credentials' });
  
  tempSecrets.delete(`login_${user.id}`);
  res.json({ ok: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${req.session.user.id}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  const rel = `/uploads/${req.file.filename}`;
  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(rel, req.session.user.id);
  res.json({ avatar: rel });
});

app.get('/api/routes', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const search = (req.query.q || '').toString().trim();

    let whereSql = '';
    let params = [];
    if (search) {
      whereSql = 'WHERE "dstUri" LIKE $1 OR "dstIPGname" LIKE $1';
      params.push(`%${search}%`);
    }

    const totalStmt = db.prepare(`SELECT COUNT(1) as cnt FROM routes ${whereSql}`);
    const total = (await totalStmt.get(...params)).cnt;

    const offset = (page - 1) * pageSize;
    const listStmt = db.prepare(`
      SELECT id, "dstUri", "dstIPGname", days, "startTime", "endTime"
      FROM routes
      ${whereSql}
      ORDER BY id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `);
    const items = await listStmt.all(...params, pageSize, offset);

    res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('Error listing routes', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create
app.post('/api/routes', requireAuth, async (req, res) => {
  const { dstUri, dstIPGname, days, startTime, endTime } = req.body || {};
  if (!dstUri || !dstIPGname) {
    return res.status(400).json({ error: 'dstUri and dstIPGname are required' });
  }
  try {
    const info = await db.prepare('INSERT INTO routes ("dstUri", "dstIPGname", days, "startTime", "endTime") VALUES (?, ?, ?, ?, ?)').run(dstUri, dstIPGname, days || '', startTime || '', endTime || '');
    const row = await db.prepare('SELECT id, "dstUri", "dstIPGname", days, "startTime", "endTime" FROM routes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Duplicate route for same dstUri and time window' });
    }
    console.error('Error creating route', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update
app.put('/api/routes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { dstUri, dstIPGname, days, startTime, endTime } = req.body || {};
  if (!dstUri && !dstIPGname && !days && !startTime && !endTime) {
    return res.status(400).json({ error: 'Provide a field to update' });
  }
  try {
    const existing = await db.prepare('SELECT id, "dstUri", "dstIPGname", days, "startTime", "endTime" FROM routes WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Route not found' });
    const newDstUri = dstUri ?? existing.dstUri;
    const newName = dstIPGname ?? existing.dstIPGname;
    const newDays = days === undefined ? existing.days : (days || '');
    const newStart = startTime === undefined ? existing.startTime : (startTime || '');
    const newEnd = endTime === undefined ? existing.endTime : (endTime || '');
    await db.prepare('UPDATE routes SET "dstUri" = ?, "dstIPGname" = ?, days = ?, "startTime" = ?, "endTime" = ? WHERE id = ?').run(newDstUri, newName, newDays, newStart, newEnd, id);
    const updated = await db.prepare('SELECT id, "dstUri", "dstIPGname", days, "startTime", "endTime" FROM routes WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Duplicate route for same dstUri and time window' });
    }
    console.error('Error updating route', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete
app.delete('/api/routes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const info = await db.prepare('DELETE FROM routes WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Route not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting route', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV Export
app.get('/api/routes/export', requireAuth, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT "dstUri", "dstIPGname", days, "startTime", "endTime" FROM routes ORDER BY id ASC').all();
    const header = 'dstUri,dstIPGname,days,startTime,endTime';
    const lines = rows.map(r => `${escapeCsv(r.dstUri)},${escapeCsv(r.dstIPGname)},${escapeCsv(r.days||'')},${escapeCsv(r.startTime||'')},${escapeCsv(r.endTime||'')}`);
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="routes.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting CSV', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

// CSV Import: expects text/csv with header dstUri,dstIPGname
app.post('/api/routes/import', requireAuth, async (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('text/csv')) {
    return res.status(415).json({ error: 'Content-Type must be text/csv' });
  }
  const csv = req.body || '';
  try {
    const { inserted, updated, skipped } = await importCsv(csv);
    res.json({ inserted, updated, skipped });
  } catch (err) {
    console.error('Error importing CSV', err);
    res.status(400).json({ error: 'Invalid CSV format' });
  }
});

async function importCsv(csv) {
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
  const header = lines[0].trim().toLowerCase();
  if (!header.startsWith('dsturi') || !header.includes('dstipgname')) {
    throw new Error('Bad header');
  }
  let inserted = 0, updated = 0, skipped = 0;
  
  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === ',') { result.push(current); current = ''; }
        else if (ch === '"') { inQuotes = true; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  };
  
  const txn = db.transaction(async () => {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 2) { skipped++; continue; }
      const [dstUri, dstIPGname, days, startTime, endTime] = cols;
      if (!dstUri || !dstIPGname) { skipped++; continue; }
      
      try {
        // Try to insert first
        const info = await db.prepare('INSERT INTO routes ("dstUri", "dstIPGname", days, "startTime", "endTime") VALUES (?, ?, ?, ?, ?)').run(dstUri, dstIPGname, days || '', startTime || '', endTime || '');
        if (info.lastInsertRowid) inserted++;
      } catch (err) {
        if (err.message && err.message.includes('unique')) {
          // Update existing record
          await db.prepare('UPDATE routes SET "dstIPGname" = ? WHERE "dstUri" = ? AND days = ? AND "startTime" = ? AND "endTime" = ?').run(dstIPGname, dstUri, days || '', startTime || '', endTime || '');
          updated++;
        } else {
          skipped++;
        }
      }
    }
  });
  await txn();
  return { inserted, updated, skipped };
}

// Roles management (admin only)
app.get('/api/roles', requireAdmin, async (req, res) => {
  try {
    const roles = await db.prepare('SELECT id, name, permissions, createdat, updatedat FROM roles ORDER BY id ASC').all();
    res.json(roles);
  } catch (err) {
    console.error('Error listing roles', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/roles', requireAdmin, async (req, res) => {
  const { name, permissions } = req.body || {};
  if (!name || !permissions) {
    return res.status(400).json({ error: 'name and permissions are required' });
  }
  try {
    const info = await db.prepare('INSERT INTO roles (name, permissions) VALUES ($1, $2)').run(name, JSON.stringify(permissions));
    const role = await db.prepare('SELECT id, name, permissions, createdat, updatedat FROM roles WHERE id = $1').get(info.lastInsertRowid);
    res.status(201).json(role);
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    console.error('Error creating role', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/roles/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body || {};
  if (!name && !permissions) {
    return res.status(400).json({ error: 'Provide name or permissions to update' });
  }
  try {
    const existing = await db.prepare('SELECT id, name, permissions FROM roles WHERE id = $1').get(id);
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    
    const newName = name ?? existing.name;
    const newPermissions = permissions ? JSON.stringify(permissions) : (typeof existing.permissions === 'string' ? existing.permissions : JSON.stringify(existing.permissions));
    
    await db.prepare('UPDATE roles SET name = $1, permissions = $2, updatedat = NOW() WHERE id = $3').run(newName, newPermissions, id);
    const updated = await db.prepare('SELECT id, name, permissions, createdat, updatedat FROM roles WHERE id = $1').get(id);
    res.json(updated);
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    console.error('Error updating role', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/roles/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const info = await db.prepare('DELETE FROM roles WHERE id = $1').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Role not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting role', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List tokens
app.get('/api/tokens', requireAdmin, async (req, res) => {
  const tokens = await db.prepare('SELECT username, token, createdat FROM tokens ORDER BY username ASC').all();
  res.json(tokens);
});

// Create token
app.post('/api/tokens', requireAdmin, async (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username required' });
  const exists = await db.prepare('SELECT 1 FROM tokens WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Token for this username already exists' });
  const token = crypto.randomBytes(24).toString('hex');
  await db.prepare('INSERT INTO tokens (username, token) VALUES (?, ?)').run(username, token);
  res.status(201).json({ username, token });
});

// Delete token
app.delete('/api/tokens/:username', requireAdmin, async (req, res) => {
  const { username } = req.params;
  const info = await db.prepare('DELETE FROM tokens WHERE username = ?').run(username);
  if (info.changes === 0) return res.status(404).json({ error: 'Token not found' });
  res.status(204).end();
});

// Regenerate token
app.post('/api/tokens/:username/regenerate', requireAdmin, async (req, res) => {
  const { username } = req.params;
  const token = crypto.randomBytes(24).toString('hex');
  const info = await db.prepare('UPDATE tokens SET token = ?, createdat = NOW() WHERE username = ?').run(token, username);
  if (info.changes === 0) return res.status(404).json({ error: 'Token not found' });
  const updated = await db.prepare('SELECT username, token, createdat FROM tokens WHERE username = ?').get(username);
  res.json(updated);
});

// Web Settings management (admin only)
app.get('/api/web-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await db.prepare('SELECT * FROM web_settings ORDER BY id DESC LIMIT 1').get();
    if (!settings) {
      // Return default settings if none exist
      return res.json({
        access_mode: 'http_https',
        private_key_path: null,
        certificate_path: null,
        certificate_info: null
      });
    }
    res.json(settings);
  } catch (err) {
    console.error('Error fetching web settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/web-settings', requireAdmin, async (req, res) => {
  try {
    const { access_mode } = req.body || {};
    if (!access_mode || !['http_https', 'https_only', 'https_redirect'].includes(access_mode)) {
      return res.status(400).json({ error: 'Valid access_mode required' });
    }

    // Check if settings exist
    const existing = await db.prepare('SELECT id FROM web_settings ORDER BY id DESC LIMIT 1').get();
    
    if (existing) {
      // Update existing settings
      await db.prepare('UPDATE web_settings SET access_mode = ?, updatedat = NOW() WHERE id = ?').run(access_mode, existing.id);
    } else {
      // Create new settings
      await db.prepare('INSERT INTO web_settings (access_mode) VALUES (?)').run(access_mode);
    }

    const updated = await db.prepare('SELECT * FROM web_settings ORDER BY id DESC LIMIT 1').get();
    
    // Reload web settings to apply changes
    await loadWebSettings();
    
    res.json(updated);
  } catch (err) {
    console.error('Error updating web settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Certificate upload endpoints
const uploadCert = multer({ 
  dest: 'uploads/certificates/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.key', '.pem', '.crt', '.cer'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Log file info for debugging
    console.log('File upload attempt:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      extension: ext
    });
    
    if (allowedTypes.includes(ext) || file.mimetype === 'application/x-x509-ca-cert' || file.mimetype === 'application/pkcs8') {
      cb(null, true);
    } else {
      console.error('File rejected:', file.originalname, 'Extension:', ext, 'MIME:', file.mimetype);
      cb(new Error(`Invalid file type. Only .key, .pem, .crt, .cer files allowed. Got: ${ext}`));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Private key validation endpoint
app.post('/api/web-settings/validate-key', requireAdmin, uploadCert.single('privateKeyFile'), async (req, res) => {
  try {
    const { privateKeyPassphrase } = req.body || {};
    const privateKeyFile = req.file;

    if (!privateKeyFile) {
      return res.status(400).json({ error: 'Private key file is required' });
    }

    // Validate private key with passphrase
    try {
      const keyContent = fs.readFileSync(privateKeyFile.path, 'utf8');
      
      // Try to create a secure context to validate the key and passphrase
      const crypto = require('crypto');
      const options = { key: keyContent };
      
      if (privateKeyPassphrase) {
        options.passphrase = privateKeyPassphrase;
      }
      
      // This will throw an error if the key is invalid or passphrase is wrong
      crypto.createPrivateKey(options);
      
      // Clean up the temporary file
      fs.unlinkSync(privateKeyFile.path);
      
      res.json({ valid: true, message: 'Private key and passphrase are valid' });
      
    } catch (keyError) {
      // Clean up the temporary file
      fs.unlinkSync(privateKeyFile.path);
      
      if (keyError.code === 'ERR_OSSL_BAD_DECRYPT') {
        return res.status(400).json({ 
          valid: false, 
          error: 'Invalid passphrase for encrypted private key' 
        });
      } else if (keyError.code === 'ERR_OSSL_PEM_NO_START_LINE') {
        return res.status(400).json({ 
          valid: false, 
          error: 'Invalid private key format' 
        });
      } else {
        return res.status(400).json({ 
          valid: false, 
          error: 'Private key validation failed: ' + keyError.message 
        });
      }
    }
    
  } catch (err) {
    console.error('Error validating private key:', err);
    // Clean up uploaded file on error
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/web-settings/certificate', requireAdmin, uploadCert.fields([
  { name: 'privateKeyFile', maxCount: 1 },
  { name: 'certificateFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { privateKeyPassphrase } = req.body || {};
    const privateKeyFile = req.files?.privateKeyFile?.[0];
    const certificateFile = req.files?.certificateFile?.[0];

    if (!privateKeyFile || !certificateFile) {
      return res.status(400).json({ error: 'Both private key and certificate files are required' });
    }

    // Validate certificate files
    let certificateInfo = null;
    try {
      const certContent = fs.readFileSync(certificateFile.path, 'utf8');
      certificateInfo = await parseCertificateInfo(certContent);
    } catch (err) {
      console.error('Certificate parsing error:', err);
      // Clean up uploaded files
      if (privateKeyFile) fs.unlinkSync(privateKeyFile.path);
      if (certificateFile) fs.unlinkSync(certificateFile.path);
      return res.status(400).json({ error: 'Invalid certificate file' });
    }

    // Get current settings
    const existing = await db.prepare('SELECT id FROM web_settings ORDER BY id DESC LIMIT 1').get();
    
    if (existing) {
      // Update existing settings
      await db.prepare(`
        UPDATE web_settings 
        SET private_key_path = ?, certificate_path = ?, private_key_passphrase = ?, certificate_info = ?, updatedat = NOW() 
        WHERE id = ?
      `).run(privateKeyFile.path, certificateFile.path, privateKeyPassphrase || null, JSON.stringify(certificateInfo), existing.id);
    } else {
      // Create new settings
      await db.prepare(`
        INSERT INTO web_settings (private_key_path, certificate_path, private_key_passphrase, certificate_info) 
        VALUES (?, ?, ?, ?)
      `).run(privateKeyFile.path, certificateFile.path, privateKeyPassphrase || null, JSON.stringify(certificateInfo));
    }

    const updated = await db.prepare('SELECT * FROM web_settings ORDER BY id DESC LIMIT 1').get();
    
    // Restart HTTPS server with new certificate
    try {
      await restartHttpsServer();
      console.log('HTTPS server restarted with new certificate');
    } catch (restartErr) {
      console.error('Failed to restart HTTPS server:', restartErr);
      // Don't fail the request, just log the error
    }
    
    res.json({ 
      message: 'Certificate uploaded successfully and HTTPS server restarted',
      settings: updated,
      certificateInfo 
    });
  } catch (err) {
    console.error('Error uploading certificate:', err);
    // Clean up uploaded files on error
    if (req.files?.privateKeyFile?.[0]) fs.unlinkSync(req.files.privateKeyFile[0].path);
    if (req.files?.certificateFile?.[0]) fs.unlinkSync(req.files.certificateFile[0].path);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to parse certificate information
async function parseCertificateInfo(certContent) {
  const crypto = require('crypto');
  
  try {
    // Extract certificate from PEM format
    const certMatch = certContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
    if (!certMatch) {
      throw new Error('No certificate found in file');
    }

    // Parse certificate
    const cert = new crypto.X509Certificate(certMatch[0]);
    
    return {
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      serialNumber: cert.serialNumber,
      fingerprint: cert.fingerprint,
      status: new Date() > new Date(cert.validTo) ? 'expired' : 
              new Date() > new Date(cert.validTo) - (30 * 24 * 60 * 60 * 1000) ? 'warning' : 'valid'
    };
  } catch (err) {
    console.error('Certificate parsing error:', err);
    throw new Error('Failed to parse certificate');
  }
}

function acPatternToRegex(pattern) {
  // Escape regex special chars except for AudioCodes wildcards
  let re = pattern.replace(/([.+^${}()|[\]\\])/g, '\\$1');
  // Replace AudioCodes wildcards with regex equivalents
  re = re.replace(/\*/g, '.*');      // * => any number of any chars
  re = re.replace(/\?/g, '.');       // ? => any single char
  // [0-9] and similar are already valid regex
  return new RegExp('^' + re + '$');
}

function findBestRoute(dstUri, routes) {
  // Find all matching routes
  const matches = routes
    .map(route => ({
      ...route,
      pattern: route.dstUri,
      regex: acPatternToRegex(route.dstUri),
    }))
    .filter(route => route.regex.test(dstUri));

  if (matches.length === 0) return null;

  // Best match: longest pattern, then most specific (fewest wildcards)
  matches.sort((a, b) => {
    if (b.pattern.length !== a.pattern.length) {
      return b.pattern.length - a.pattern.length;
    }
    // Fewer wildcards is more specific
    const wildA = (a.pattern.match(/[\*\?]/g) || []).length;
    const wildB = (b.pattern.match(/[\*\?]/g) || []).length;
    return wildA - wildB;
  });

  return matches[0];
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Global server references for restart functionality
let httpServerInstance = null;
let httpsServerInstance = null;

// Function to start HTTPS server
async function startHttpsServer() {
  if (currentWebSettings && currentWebSettings.private_key_path && currentWebSettings.certificate_path) {
    try {
      // Check if certificate files exist
      if (fs.existsSync(currentWebSettings.private_key_path) && fs.existsSync(currentWebSettings.certificate_path)) {
        const privateKey = fs.readFileSync(currentWebSettings.private_key_path, 'utf8');
        const certificate = fs.readFileSync(currentWebSettings.certificate_path, 'utf8');
        
        const httpsOptions = {
          key: privateKey,
          cert: certificate
        };
        
        // Add passphrase if provided
        if (currentWebSettings.private_key_passphrase) {
          httpsOptions.passphrase = currentWebSettings.private_key_passphrase;
        }
        
        httpsServerInstance = https.createServer(httpsOptions, app);
        
        return new Promise((resolve, reject) => {
          httpsServerInstance.listen(HTTPS_PORT, () => {
            console.log(`HTTPS Server listening on https://localhost:${HTTPS_PORT}`);
            resolve();
          });
          
          // Handle HTTPS server errors
          httpsServerInstance.on('error', (error) => {
            console.error('HTTPS Server error:', error);
            reject(error);
          });
        });
      } else {
        console.log('Certificate files not found, HTTPS server not started');
      }
    } catch (error) {
      console.error('Error starting HTTPS server:', error);
      throw error;
    }
  } else {
    console.log('No SSL certificate configured, HTTPS server not started');
  }
}

// Function to restart HTTPS server
async function restartHttpsServer() {
  console.log('Restarting HTTPS server...');
  
  // Close existing HTTPS server if running
  if (httpsServerInstance) {
    await new Promise((resolve) => {
      httpsServerInstance.close(() => {
        console.log('HTTPS server stopped');
        httpsServerInstance = null;
        resolve();
      });
    });
  }
  
  // Reload web settings to get updated certificate paths
  await loadWebSettings();
  
  // Start HTTPS server with new certificate
  await startHttpsServer();
}

// Function to start servers based on web settings
async function startServers() {
  // Load web settings first
  await loadWebSettings();
  
  // Always start HTTP server
  httpServerInstance = app.listen(PORT, () => {
    console.log(`HTTP Server listening on http://localhost:${PORT}`);
  });
  
  // Start HTTPS server if certificate is available
  await startHttpsServer();
  
  // Handle HTTP server errors
  httpServerInstance.on('error', (error) => {
    console.error('HTTP Server error:', error);
  });
}

// Start the servers
startServers().catch(err => {
  console.error('Failed to start servers:', err);
  process.exit(1);
});



