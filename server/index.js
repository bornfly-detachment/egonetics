const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { memoryDb, tasksDb, pagesDb, agentsDb } = require('./db');
const tasksRouter    = require('./routes/tasks');
const pagesRouter    = require('./routes/pages');
const memoryRouter   = require('./routes/memory');
const chronicleRouter = require('./routes/chronicle');
const agentsRouter   = require('./routes/agents');
const mediaRouter    = require('./routes/media');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    databases: { memory: 'connected', tasks: 'connected', pages: 'connected', agents: 'connected' }
  });
});

// 注册路由模块
app.use('/api', tasksRouter.init(tasksDb));
app.use('/api', pagesRouter.init({ pagesDb, tasksDb }));
app.use('/api', memoryRouter.init(memoryDb));
app.use('/api', chronicleRouter.init(memoryDb));
app.use('/api', agentsRouter.init(agentsDb));
app.use('/api', mediaRouter.init());

app.listen(PORT, () => {
  console.log(`🚀 后端运行在 http://localhost:${PORT}`);
  console.log(`📊 数据库: memory.db + tasks.db + pages.db + agents.db`);
});
