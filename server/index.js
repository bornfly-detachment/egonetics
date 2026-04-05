require('dotenv').config()   // 加载 server/.env

// ── 进程级兜底：任何漏网的未捕获错误只记日志，不崩进程 ──────────
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const { memoryDb, pagesDb, agentsDb, authDb, signalsDb } = require('./db');
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
const constitutionRouter = require('./routes/constitution');
const llmRouter          = require('./routes/llm');
const ontologyRouter     = require('./routes/ontology');
const prvsRouter         = require('./routes/prvs');
const tagsRouter         = require('./routes/tags');
const cyberneticsRouter  = require('./routes/cybernetics');
const prvseGraphModule   = require('./routes/prvse-graph');
const { cyberGitAdvice } = require('./middleware/cyberGit');
const proposalsModule    = require('./routes/proposals');
const nodeChatRouter     = require('./routes/node-chat')
const protocolRouter     = require('./routes/protocol')
const protocolBuilderModule = require('./routes/protocol-builder');
const kernelRuntime      = require('./lib/kernel-runtime');
const kernelRouter       = require('./routes/kernel');
const mq                 = require('./lib/mq');
const mqContracts        = require('./lib/mq-contracts');
const mqRouter           = require('./routes/mq');
const aopModule          = require('./routes/aop');
const seaiRouter         = require('./routes/seai');
const aiWorldRouter      = require('./routes/ai-world');
const webhookRouter      = require('./routes/webhook');
const gatewayWs          = require('./routes/gateway-ws');
const heartbeat          = require('./lib/heartbeat');
const perceiverRouter    = require('./routes/perceiver');
const resourcePerceiver  = require('./lib/resource-perceiver');
const schedulerRouter    = require('./routes/scheduler');
const controllerModule   = require('./routes/controller');
const controllerLib      = require('./lib/controller');
const codeAgentRouter    = require('./routes/code-agent')
const t2ConfigRouter     = require('./routes/t2-config');
const acpGatewayRouter   = require('./routes/acp-gateway')
const t0InferenceRouter  = require('./routes/t0-inference')
const signalsRouter      = require('./routes/signals');
const compilerModule     = require('./routes/compiler');

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
const AGENT_MUTATION_PATHS = ['/tasks', '/kanban', '/agents', '/notion', '/canvases', '/pages', '/relations', '/cybernetics', '/kernel', '/seai'];

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth')) return next();

  // ── 开发者模式：本机跳过 Token 验证，注入 admin 身份 ──
  if (process.env.DEV_MODE === 'true') {
    req.user = { id: 0, username: 'bornfly', role: 'admin' };
    return next();
  }

  // SSE 无法设置 Authorization header，支持 ?token= query param
  if (req.path === '/events' || req.path === '/code-agent/chat' ||
      req.originalUrl?.startsWith('/api/acp/runs/stream')) {
    const qToken = req.query.token;
    if (qToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${qToken}`;
    }
  }

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
app.use('/api/constitution', constitutionRouter);
app.use('/api/llm', llmRouter);
app.use('/api/ai', aiWorldRouter);
app.use('/api', ontologyRouter.init());
app.use('/api', prvsRouter.init());
app.use('/api', tagsRouter.init());
prvseGraphModule.init(pagesDb);
app.use('/api/tasks/:taskId/graph', prvseGraphModule.router);
app.use('/api', cyberGitAdvice(pagesDb));
app.use('/api', cyberneticsRouter.init(pagesDb));
app.use('/api', proposalsModule.init(pagesDb));
app.use('/api', nodeChatRouter.init(pagesDb))
app.use('/api', protocolRouter.init(pagesDb));
app.use('/api', protocolBuilderModule.init(pagesDb));
app.use('/api', kernelRouter.init(kernelRuntime));
app.use('/api', mqRouter);
app.use('/api', aopModule.init(pagesDb));
app.use('/api', seaiRouter.init());
app.use('/api', webhookRouter);
app.use('/api', perceiverRouter);
app.use('/api', schedulerRouter);
app.use('/api', controllerModule.init(kernelRuntime));
app.use('/api', codeAgentRouter);
app.use('/api', t2ConfigRouter);
app.use('/api/acp', acpGatewayRouter);
app.use('/api/signals', signalsRouter.init(signalsDb));
app.use('/api', compilerModule.init());

const httpServer = http.createServer(app);
proposalsModule.attachWebSocket(httpServer, pagesDb);
gatewayWs.attach(httpServer);

// Init kernel runtime, then start server
Promise.all([kernelRuntime.init(), mq.init(kernelRuntime)]).then(async () => {
  // Register MQ-consuming contracts into kernel (感知器/控制器)
  await mqContracts.register(kernelRuntime);

  // Start resource perceiver (auto-starts periodic monitoring)
  resourcePerceiver.start();

  // Register controller contracts and start periodic evaluation
  controllerLib.registerContracts(kernelRuntime);
  controllerLib.start(kernelRuntime);

  // 启动心跳（24/7 自触发）
  heartbeat.start();

  httpServer.listen(PORT, () => {
    console.log(`🚀 后端运行在 http://localhost:${PORT}`);
    console.log(`📊 数据库: memory.db + pages.db (统一) + agents.db`);
    console.log(`🔌 SEAI WebSocket: ws://localhost:${PORT}/ws/seai`);
    console.log(`⚙️ Kernel Runtime: active (tick=${kernelRuntime.getState().tick})`);

    console.log(`🤖 Coding Agent: tmux session "egonetics-coding-agent" (按需启动)`);
  });
}).catch(err => {
  console.error('Init failed, starting with fallback:', err.message);
  httpServer.listen(PORT, () => {
    console.log(`🚀 后端运行在 http://localhost:${PORT} (kernel offline)`);
  });
});
