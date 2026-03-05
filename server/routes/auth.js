const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken, verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { sendVerificationCode } = require('../lib/email');

const SALT_ROUNDS = 12;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting: 5 failures per identifier in 15 min, 10 per IP in 15 min
const MAX_FAIL_PER_USER = 5;
const MAX_FAIL_PER_IP = 10;
const WINDOW_MIN = 15;

// ── Validation ───────────────────────────────────────────────────────────────

function validateUsername(username) {
  if (!username || typeof username !== 'string') return '用户名不能为空';
  const s = username.trim();
  if (s.length < 3 || s.length > 20) return '用户名长度必须在 3-20 个字符之间';
  if (!USERNAME_REGEX.test(s)) return '用户名只能包含字母、数字、下划线(_)和连字符(-)';
  return null;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return '邮箱不能为空';
  if (!EMAIL_REGEX.test(email.trim())) return '邮箱格式不正确';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return '密码不能为空';
  if (password.length < 8) return '密码至少需要 8 位';
  if (!/[A-Z]/.test(password)) return '密码必须包含至少一个大写字母';
  if (!/[a-z]/.test(password)) return '密码必须包含至少一个小写字母';
  if (!/[0-9]/.test(password)) return '密码必须包含至少一个数字';
  return null;
}

// ── DB Helpers ───────────────────────────────────────────────────────────────

function dbGet(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────

async function checkRateLimit(db, identifier, ip) {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();

  const userFails = await dbGet(db,
    'SELECT COUNT(*) AS cnt FROM login_attempts WHERE identifier = ? AND success = 0 AND attempted_at > ?',
    [identifier, since]
  );
  if (userFails.cnt >= MAX_FAIL_PER_USER) {
    return { blocked: true, reason: 'user', message: `账号已被暂时锁定，请 ${WINDOW_MIN} 分钟后再试` };
  }

  const ipFails = await dbGet(db,
    'SELECT COUNT(*) AS cnt FROM login_attempts WHERE ip_address = ? AND success = 0 AND attempted_at > ?',
    [ip, since]
  );
  if (ipFails.cnt >= MAX_FAIL_PER_IP) {
    return { blocked: true, reason: 'ip', message: `登录尝试过多，请 ${WINDOW_MIN} 分钟后再试` };
  }

  return { blocked: false, userFails: userFails.cnt };
}

async function recordAttempt(db, identifier, ip, success) {
  await dbRun(db,
    'INSERT INTO login_attempts (identifier, ip_address, success) VALUES (?, ?, ?)',
    [identifier, ip, success ? 1 : 0]
  );
}

// ── Code Generator ───────────────────────────────────────────────────────────

function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

async function issueVerificationCode(db, userId, email) {
  // Invalidate any previous unused codes for this email
  await dbRun(db,
    'UPDATE verification_codes SET used = 1 WHERE email = ? AND used = 0',
    [email]
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await dbRun(db,
    'INSERT INTO verification_codes (user_id, email, code, expires_at) VALUES (?, ?, ?, ?)',
    [userId, email, code, expiresAt]
  );
  return code;
}

// ── Route Module ─────────────────────────────────────────────────────────────

module.exports = {
  init(authDb) {
    const router = express.Router();

    // GET /auth/check-username — real-time uniqueness check (public)
    router.get('/auth/check-username', async (req, res) => {
      const username = (req.query.username || '').trim();
      const err = validateUsername(username);
      if (err) return res.json({ available: false, error: err });

      const row = await dbGet(authDb,
        'SELECT id FROM users WHERE username = ? COLLATE NOCASE', [username]
      ).catch(() => null);
      res.json({ available: !row });
    });

    // GET /auth/check-email — real-time uniqueness check (public)
    router.get('/auth/check-email', async (req, res) => {
      const email = (req.query.email || '').trim().toLowerCase();
      const err = validateEmail(email);
      if (err) return res.json({ available: false, error: err });

      const row = await dbGet(authDb,
        'SELECT id FROM users WHERE email = ? COLLATE NOCASE', [email]
      ).catch(() => null);
      res.json({ available: !row });
    });

    // POST /auth/register — public
    router.post('/auth/register', async (req, res) => {
      try {
        const { role, password } = req.body;
        const allowedRoles = ['guest', 'agent'];
        const userRole = allowedRoles.includes(role) ? role : 'guest';

        const pwErr = validatePassword(password);
        if (pwErr) return res.status(400).json({ error: pwErr });

        // Guest: registers with email
        if (userRole === 'guest') {
          const email = (req.body.email || '').trim().toLowerCase();
          const emailErr = validateEmail(email);
          if (emailErr) return res.status(400).json({ error: emailErr });

          const existing = await dbGet(authDb,
            'SELECT id FROM users WHERE email = ? COLLATE NOCASE', [email]
          );
          if (existing) return res.status(409).json({ error: '该邮箱已被注册' });

          const hash = await bcrypt.hash(password, SALT_ROUNDS);
          // Auto-generate username from email prefix
          const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'user';
          const suffix = crypto.randomBytes(3).toString('hex');
          const username = `${prefix}_${suffix}`;

          const { lastID } = await dbRun(authDb,
            'INSERT INTO users (username, email, password_hash, role, email_verified) VALUES (?, ?, ?, "guest", 0)',
            [username, email, hash]
          );

          const code = await issueVerificationCode(authDb, lastID, email);
          await sendVerificationCode(email, code);

          return res.status(201).json({ requiresVerification: true, email });
        }

        // Agent: registers with username
        const usernameRaw = (req.body.username || '').trim();
        const usernameErr = validateUsername(usernameRaw);
        if (usernameErr) return res.status(400).json({ error: usernameErr });

        const existing = await dbGet(authDb,
          'SELECT id FROM users WHERE username = ? COLLATE NOCASE', [usernameRaw]
        );
        if (existing) return res.status(409).json({ error: '用户名已被占用' });

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const { lastID } = await dbRun(authDb,
          'INSERT INTO users (username, password_hash, role, email_verified) VALUES (?, ?, "agent", 1)',
          [usernameRaw, hash]
        );

        const token = signToken({ userId: lastID, username: usernameRaw, role: 'agent' }, '30d');
        res.status(201).json({
          token,
          user: { id: lastID, username: usernameRaw, role: 'agent' },
        });
      } catch (err) {
        console.error('Register error:', err);
        if (err.message?.includes('UNIQUE')) {
          return res.status(409).json({ error: '用户名或邮箱已被占用' });
        }
        res.status(500).json({ error: '注册失败，请稍后重试' });
      }
    });

    // POST /auth/verify-email — public
    router.post('/auth/verify-email', async (req, res) => {
      try {
        const email = (req.body.email || '').trim().toLowerCase();
        const code = String(req.body.code || '').trim();

        if (!email || !code) {
          return res.status(400).json({ error: '请填写邮箱和验证码' });
        }

        const record = await dbGet(authDb,
          `SELECT * FROM verification_codes
           WHERE email = ? AND code = ? AND used = 0
           AND expires_at > datetime('now')
           ORDER BY created_at DESC LIMIT 1`,
          [email, code]
        );

        if (!record) {
          return res.status(400).json({ error: '验证码无效或已过期' });
        }

        // Mark code as used and activate user
        await dbRun(authDb, 'UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
        await dbRun(authDb,
          'UPDATE users SET email_verified = 1, updated_at = datetime("now") WHERE id = ?',
          [record.user_id]
        );

        const user = await dbGet(authDb,
          'SELECT id, username, email, role FROM users WHERE id = ?', [record.user_id]
        );

        const token = signToken({ userId: user.id, username: user.username, role: user.role }, '24h');
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
      } catch (err) {
        console.error('Verify email error:', err);
        res.status(500).json({ error: '验证失败，请稍后重试' });
      }
    });

    // POST /auth/resend-code — public, rate limited
    router.post('/auth/resend-code', async (req, res) => {
      try {
        const email = (req.body.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: '请提供邮箱' });

        const user = await dbGet(authDb,
          'SELECT id, email_verified FROM users WHERE email = ? COLLATE NOCASE', [email]
        );
        if (!user) return res.status(404).json({ error: '该邮箱未注册' });
        if (user.email_verified) return res.status(400).json({ error: '邮箱已验证，无需重新发送' });

        // Rate limit: max 3 resends per 10 min
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const recent = await dbGet(authDb,
          'SELECT COUNT(*) AS cnt FROM verification_codes WHERE email = ? AND created_at > ?',
          [email, since]
        );
        if (recent.cnt >= 3) {
          return res.status(429).json({ error: '发送过于频繁，请 10 分钟后再试' });
        }

        const code = await issueVerificationCode(authDb, user.id, email);
        await sendVerificationCode(email, code);

        res.json({ success: true });
      } catch (err) {
        console.error('Resend code error:', err);
        res.status(500).json({ error: '发送失败，请稍后重试' });
      }
    });

    // POST /auth/login — public, with rate limiting
    router.post('/auth/login', async (req, res) => {
      try {
        const identifier = (req.body.identifier || '').trim();
        const { password } = req.body;
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';

        if (!identifier || !password) {
          return res.status(400).json({ error: '请填写账号和密码' });
        }

        // Check rate limit
        const rateCheck = await checkRateLimit(authDb, identifier, ip);
        if (rateCheck.blocked) {
          return res.status(429).json({ error: rateCheck.message, locked: true });
        }

        // Find user by username or email
        const user = await dbGet(authDb,
          `SELECT * FROM users WHERE is_active = 1
           AND (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE)`,
          [identifier, identifier]
        );

        if (!user) {
          await recordAttempt(authDb, identifier, ip, false);
          return res.status(401).json({ error: '账号或密码错误' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
          await recordAttempt(authDb, identifier, ip, false);
          const remaining = MAX_FAIL_PER_USER - rateCheck.userFails - 1;
          const hint = remaining > 0 ? `，还有 ${remaining} 次机会` : '，账号即将被锁定';
          return res.status(401).json({ error: `账号或密码错误${hint}` });
        }

        // Check email verification for guests
        if (user.role === 'guest' && !user.email_verified) {
          await recordAttempt(authDb, identifier, ip, false);
          return res.status(403).json({
            error: '邮箱尚未验证，请先完成邮箱验证',
            requiresVerification: true,
            email: user.email,
          });
        }

        await recordAttempt(authDb, identifier, ip, true);

        const expiresIn = user.role === 'agent' ? '30d' : '24h';
        const token = signToken(
          { userId: user.id, username: user.username, role: user.role },
          expiresIn
        );
        res.json({
          token,
          user: { id: user.id, username: user.username, email: user.email, role: user.role },
        });
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: '登录失败，请稍后重试' });
      }
    });

    // GET /auth/me — requires auth
    router.get('/auth/me', verifyToken, async (req, res) => {
      try {
        const user = await dbGet(authDb,
          'SELECT id, username, email, role, created_at FROM users WHERE id = ? AND is_active = 1',
          [req.user.userId]
        );
        if (!user) return res.status(404).json({ error: '用户不存在' });
        res.json(user);
      } catch (err) {
        res.status(500).json({ error: '获取用户信息失败' });
      }
    });

    // GET /auth/users — admin only
    router.get('/auth/users', verifyToken, requireAdmin, async (req, res) => {
      try {
        const users = await dbAll(authDb,
          'SELECT id, username, email, role, email_verified, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ users });
      } catch (err) {
        res.status(500).json({ error: '获取用户列表失败' });
      }
    });

    // PATCH /auth/users/:id — admin only
    router.patch('/auth/users/:id', verifyToken, requireAdmin, async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        if (userId === req.user.userId) {
          return res.status(400).json({ error: '不能修改自己的账号状态' });
        }

        const { role, is_active } = req.body;
        const sets = [];
        const vals = [];

        if (role !== undefined && ['admin', 'agent', 'guest'].includes(role)) {
          sets.push('role = ?'); vals.push(role);
        }
        if (is_active !== undefined) {
          sets.push('is_active = ?'); vals.push(is_active ? 1 : 0);
        }
        if (sets.length === 0) return res.status(400).json({ error: '无有效字段' });

        sets.push('updated_at = datetime("now")');
        vals.push(userId);

        await dbRun(authDb, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: '更新失败' });
      }
    });

    return router;
  },
};
