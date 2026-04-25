# Egonetics — 本地环境初始化指南

> 新 clone 仓库后必读。git 不追踪 build 产物、软链和 env 文件，需手动补全。

---

## 前置依赖

| 依赖 | 用途 |
|------|------|
| Node.js 18+ | 前端 + 后端 |
| npm | 包管理 |
| `/Users/Shared/prvse_world_workspace/` | 共享配置、数据、知识库 |
| `/Users/bornfly/Desktop/claude_code_learn/excalidraw/` | Excalidraw 本地 build |

---

## 初始化步骤（按顺序执行）

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装后端依赖

```bash
cd server && npm install && cd ..
```

### 3. 编译 Kernel

后端启动时 `require('../../dist/index.cjs')`，需先 build：

```bash
npm run build:kernel
```

### 4. 创建软链：配置文件

`.env` 和 `server/.env` 不在 git 里，指向 prvse_world_workspace 共享配置：

```bash
ln -sf /Users/Shared/prvse_world_workspace/config/frontend.env .env
ln -sf /Users/Shared/prvse_world_workspace/config/server.env server/.env
```

### 5. 创建软链：Excalidraw

`vite.config.ts` 中 `@excalidraw/excalidraw` 指向本地 build，不在 npm registry：

```bash
ln -sf /Users/bornfly/Desktop/claude_code_learn/excalidraw /Users/Shared/egonetics/excalidraw
```

### 6. 创建软链：agent-spaces

```bash
ln -sf ../prvse_world_workspace/L2/ai-resources agent-spaces
```

### 7. 创建软链：prvse_world_workspace（@prvse 路径别名）

```bash
ln -sf /Users/Shared/prvse_world_workspace /Users/Shared/egonetics/prvse_world_workspace
```

### 8. 初始化认证数据库（首次）

```bash
cd server && node scripts/init-auth-db.js && cd ..
```

---

## 启动

```bash
./start.sh
```

- 前端：http://localhost:3000
- 后端：http://localhost:3002

`VITE_DEV_MODE=true`（已在 frontend.env 中）会跳过登录，直接以 admin 身份进入。

---

## 一键初始化脚本

以上步骤汇总为单条命令，方便 CI 或新机器：

```bash
npm install && \
cd server && npm install && cd .. && \
npm run build:kernel && \
ln -sf /Users/Shared/prvse_world_workspace/config/frontend.env .env && \
ln -sf /Users/Shared/prvse_world_workspace/config/server.env server/.env && \
ln -sf /Users/bornfly/Desktop/claude_code_learn/excalidraw /Users/Shared/egonetics/excalidraw && \
ln -sf ../prvse_world_workspace/L2/ai-resources agent-spaces && \
ln -sf /Users/Shared/prvse_world_workspace /Users/Shared/egonetics/prvse_world_workspace && \
echo "✅ 初始化完成，运行 ./start.sh 启动"
```

---

## 常见问题

| 症状 | 原因 | 修复 |
|------|------|------|
| `Cannot find module 'sqlite3'` | `server/node_modules` 不存在 | `cd server && npm install` |
| `Cannot find module '.../dist/index.cjs'` | Kernel 未编译 | `npm run build:kernel` |
| 所有页面白屏 | Excalidraw 软链缺失，Vite 无法解析模块 | 步骤 5 |
| 跳转到 `/login` 无法进入 | `.env` 缺失，`VITE_DEV_MODE` 未设置 | 步骤 4 |
| `@prvse` 路径找不到 | prvse_world_workspace 软链缺失 | 步骤 7 |

---

## 存储说明

| 目录 | 大小 | 说明 |
|------|------|------|
| `node_modules/` | ~560 MB | 前端依赖，正常 |
| `server/node_modules/` | ~648 MB | `kuzu`（532MB 图数据库）是主要来源 |
| `dist/` | ~44 KB | Kernel build 产物，不在 git |

如不使用图数据库功能，可 `cd server && npm uninstall kuzu` 节省 532MB。
