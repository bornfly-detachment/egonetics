const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const { memoryDb, pagesDb, agentsDb, authDb } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const tasksRouter        = require('./routes/tasks');
const pagesRouter        = require('./routes/pages');
const memoryRouter       = require('./routes/memory');
const chronicleRouter    = require('./routes/chronicle');
const agentsRouter       = require('./routes/agents');
const egoneticsRouter    = require('./routes/egonetics');
const mediaRouter        = require('./routes/media');
const authRouter         = require('./routes/auth');
const graphRouter        = require('./routes/graph');
const relationsRouter      = require('./routes/relations');
const canvasesRouter       = require('./routes/canvases');
const relationTypesRouter  = require('./routes/relation-types');
const notionImportRouter = require('./routes/notion-import');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));

// 健康检查 (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    databases: { memory: 'connected', pages: 'connected', agents: 'connected', auth: 'connected' }
  });
});

// Auth routes (public)
app.use('/api', authRouter.init(authDb));

// Global auth middleware
const AGENT_MUTATION_PATHS = ['/tasks', '/kanban', '/agents', '/notion'];

app.use('/api', (req, res, next) => {
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

// 路由注册
app.use('/api', tasksRouter.init(pagesDb));          // 统一用 pagesDb
app.use('/api', pagesRouter.init({ pagesDb }));
app.use('/api', memoryRouter.init(memoryDb));
app.use('/api', chronicleRouter.init(memoryDb));
app.use('/api', agentsRouter.init(agentsDb));
app.use('/api', egoneticsRouter.init(agentsDb));
app.use('/api', mediaRouter.init());
app.use('/api', graphRouter.init());
app.use('/api', relationsRouter.init(pagesDb));
app.use('/api', canvasesRouter.init(pagesDb));
app.use('/api', relationTypesRouter.init(pagesDb));
app.use('/api', notionImportRouter.init({ pagesDb }));  // 不再传 tasksDb

app.listen(PORT, () => {
  console.log(`🚀 后端运行在 http://localhost:${PORT}`);
  console.log(`📊 数据库: memory.db + pages.db (统一) + agents.db`);
});
