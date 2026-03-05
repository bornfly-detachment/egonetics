const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../data/auth.db');
const SALT_ROUNDS = 12;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ask(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function askHidden(prompt) {
  return new Promise(resolve => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, answer => { rl.close(); resolve(answer); });
      return;
    }

    process.stdout.write(prompt);
    let password = '';

    process.stdin.setRawMode(true);
    process.stdin.resume();

    function onData(buf) {
      const char = buf.toString();
      if (char === '\r' || char === '\n') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        resolve(password);
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\u007f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    }

    process.stdin.on('data', onData);
  });
}

function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 20) {
    return '用户名长度必须在 3-20 个字符之间';
  }
  if (!USERNAME_REGEX.test(username)) {
    return '用户名只能包含字母、数字、下划线(_)和连字符(-)';
  }
  return null;
}

function validatePassword(password) {
  if (password.length < 8) return '密码至少需要 8 位';
  if (!/[A-Z]/.test(password)) return '密码必须包含至少一个大写字母';
  if (!/[a-z]/.test(password)) return '密码必须包含至少一个小写字母';
  if (!/[0-9]/.test(password)) return '密码必须包含至少一个数字';
  return null;
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Egonetics 认证系统初始化 ===\n');

  const db = await new Promise((resolve, reject) => {
    const d = new sqlite3.Database(DB_PATH, err => {
      if (err) reject(err);
      else resolve(d);
    });
  });

  // Create tables
  await new Promise((resolve, reject) => {
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;

      CREATE TABLE IF NOT EXISTS users (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        username       TEXT UNIQUE COLLATE NOCASE,
        email          TEXT UNIQUE COLLATE NOCASE,
        password_hash  TEXT NOT NULL,
        role           TEXT NOT NULL DEFAULT 'guest'
                         CHECK(role IN ('admin','agent','guest')),
        email_verified INTEGER NOT NULL DEFAULT 0,
        is_active      INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier   TEXT,
        ip_address   TEXT,
        success      INTEGER NOT NULL DEFAULT 0,
        attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_la_identifier
        ON login_attempts(identifier, attempted_at);
      CREATE INDEX IF NOT EXISTS idx_la_ip
        ON login_attempts(ip_address, attempted_at);

      CREATE TABLE IF NOT EXISTS verification_codes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER,
        email      TEXT NOT NULL,
        code       TEXT NOT NULL,
        type       TEXT NOT NULL DEFAULT 'email_verification',
        expires_at TEXT NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS agent_tokens (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER NOT NULL,
        token_prefix TEXT NOT NULL,
        token_hash   TEXT NOT NULL,
        label        TEXT NOT NULL DEFAULT 'Default Token',
        scopes       TEXT NOT NULL DEFAULT '[]',
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT,
        expires_at   TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `, err => { if (err) reject(err); else resolve(); });
  });

  console.log('数据库表已创建\n');

  // Check if admin already exists
  const existingAdmin = await dbGet(db, 'SELECT id FROM users WHERE role = "admin" LIMIT 1');
  if (existingAdmin) {
    console.log('管理员账号已存在，无需重新创建。');
    console.log('如需添加新管理员，请直接操作 server/data/auth.db\n');
    db.close();
    return;
  }

  console.log('请创建初始管理员账号\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Get username
  let username;
  while (true) {
    username = (await ask(rl, '用户名: ')).trim();
    const err = validateUsername(username);
    if (err) { console.log(`  错误: ${err}`); continue; }

    const dup = await dbGet(db, 'SELECT id FROM users WHERE username = ? COLLATE NOCASE', [username]);
    if (dup) { console.log('  错误: 该用户名已存在'); continue; }
    break;
  }
  rl.close();

  // Get password (hidden)
  let password;
  while (true) {
    password = await askHidden('密码: ');
    const err = validatePassword(password);
    if (err) { console.log(`  错误: ${err}`); continue; }

    const confirm = await askHidden('确认密码: ');
    if (password !== confirm) { console.log('  错误: 两次密码不一致'); continue; }
    break;
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await dbRun(db,
    'INSERT INTO users (username, password_hash, role, email_verified) VALUES (?, ?, "admin", 1)',
    [username, hash]
  );

  console.log(`\n管理员账号 "${username}" 创建成功！`);
  console.log('运行 ./start.sh 启动服务\n');
  db.close();
}

main().catch(err => {
  console.error('初始化失败:', err.message);
  process.exit(1);
});
