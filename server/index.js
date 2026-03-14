const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const { memoryDb, tasksDb, pagesDb, agentsDb, authDb } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const tasksRouter     = require('./routes/tasks');
const pagesRouter     = require('./routes/pages');
const memoryRouter    = require('./routes/memory');
const chronicleRouter = require('./routes/chronicle');
const agentsRouter    = require('./routes/agents');
const egoneticsRouter = require('./routes/egonetics');
const mediaRouter     = require('./routes/media');
const authRouter      = require('./routes/auth');
const graphRouter     = require('./routes/graph');
const relationsRouter     = require('./routes/relations');
const canvasesRouter      = require('./routes/canvases');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));

// 健康检查 (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    databases: { memory: 'connected', tasks: 'connected', pages: 'connected', agents: 'connected', auth: 'connected' }
  });
});

// Auth routes (public — must come BEFORE global auth middleware)
app.use('/api', authRouter.init(authDb));

// Global auth middleware — applies to all /api routes below
// Agent can mutate: /tasks /kanban /agents /notion
// Guest: read-only
const AGENT_MUTATION_PATHS = ['/tasks', '/kanban', '/agents', '/notion'];

app.use('/api', (req, res, next) => {
  // Skip auth for health and all /auth/* endpoints
  if (req.path === '/health' || req.path.startsWith('/auth')) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权：缺少 Token' });
  }

  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? '未授权：Token 已过期，请重新登录'
      : '未授权：Token 无效';
    return res.status(401).json({ error: msg, expired: err.name === 'TokenExpiredError' });
  }

  // Mutation check (POST / PUT / PATCH / DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.user.role === 'guest') {
      return res.status(403).json({ error: '权限不足：游客不可修改数据' });
    }
    if (req.user.role === 'agent') {
      const allowed = AGENT_MUTATION_PATHS.some(p => req.path.startsWith(p));
      if (!allowed) {
        return res.status(403).json({ error: '权限不足：Agent 只能操作 tasks 和 agents 相关资源' });
      }
    }
  }

  next();
});

// 注册路由模块 (all protected by global middleware above)
app.use('/api', tasksRouter.init(tasksDb));
app.use('/api', pagesRouter.init({ pagesDb, tasksDb }));
app.use('/api', memoryRouter.init(memoryDb));
app.use('/api', chronicleRouter.init(memoryDb));
app.use('/api', agentsRouter.init(agentsDb));
app.use('/api', egoneticsRouter.init(agentsDb));
app.use('/api', mediaRouter.init());
app.use('/api', graphRouter.init());
app.use('/api', relationsRouter.init(pagesDb));
app.use('/api', canvasesRouter.init(pagesDb));
// notionImportRouter — notion-import.js 尚未完成，暂时注释
// app.use('/api', notionImportRouter.init({ memoryDb, pagesDb, tasksDb }));

app.listen(PORT, () => {
  console.log(`🚀 后端运行在 http://localhost:${PORT}`);
  console.log(`📊 数据库: memory.db + tasks.db + pages.db + agents.db`);
});
