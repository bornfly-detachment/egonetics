const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');

function openDb(filename, label) {
  const db = new sqlite3.Database(path.join(DB_DIR, filename), (err) => {
    if (err) {
      console.error(`❌ ${label} 数据库连接失败:`, err.message);
      process.exit(1);
    }
    console.log(`✅ ${label} 数据库已连接`);
  });

  // ── 核心防护：wrap db.run，确保永远带回调 ──────────────────────
  // sqlite3 的 Statement 没有 error listener 时会把错误抛到进程级别
  // 导致 Node.js 崩溃（典型案例：ROLLBACK without active transaction）
  // 这里统一兜底，无论调用方有没有传 callback，都保证有人处理错误
  const _run = db.run.bind(db);
  db.run = function wrappedRun(sql, ...args) {
    const last = args[args.length - 1];
    if (typeof last !== 'function') {
      args.push(function(err) {
        if (err) console.error(`[${label}] db.run error "${sql.slice(0, 60)}":`, err.message);
      });
    }
    return _run(sql, ...args);
  };

  return db;
}

const memoryDb  = openDb('memory.db',  'Memory');
const pagesDb   = openDb('pages.db',   'Pages');   // 统一富文本 DB（含 tasks）
const agentsDb  = openDb('agents.db',  'Agents');
const authDb    = openDb('auth.db',    'Auth');
const signalsDb = openDb('signals.db', 'Signals'); // L0 信号层：未处理池 / 分类冲突 / 训练数据

// WAL 模式 + 外键约束
[memoryDb, pagesDb, agentsDb, authDb, signalsDb].forEach(db => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
});

// 初始化 signals.db 表结构
const fs   = require('fs');
const signalsSql = path.join(__dirname, 'scripts', 'signals_schema.sql');
if (fs.existsSync(signalsSql)) {
  const stmts = fs.readFileSync(signalsSql, 'utf8')
    .split(';').map(s => s.trim()).filter(Boolean);
  stmts.forEach(stmt => signalsDb.run(stmt));
}

module.exports = { memoryDb, pagesDb, agentsDb, authDb, signalsDb };
