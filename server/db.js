const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');

function openDb(filename, label) {
  return new sqlite3.Database(path.join(DB_DIR, filename), (err) => {
    if (err) {
      console.error(`❌ ${label} 数据库连接失败:`, err.message);
      process.exit(1);
    }
    console.log(`✅ ${label} 数据库已连接`);
  });
}

const memoryDb  = openDb('memory.db',  'Memory');
const tasksDb   = openDb('tasks.db',   'Tasks');
const pagesDb   = openDb('pages.db',   'Pages');
const agentsDb  = openDb('agents.db',  'Agents');
const authDb    = openDb('auth.db',    'Auth');

// Enable WAL mode for better concurrency on all databases
[memoryDb, tasksDb, pagesDb, agentsDb, authDb].forEach(db => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
});

module.exports = { memoryDb, tasksDb, pagesDb, agentsDb, authDb };
