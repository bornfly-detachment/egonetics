# Egonetics — 环境初始化指南

> 适用所有 CLI（CC / Codex / Gemini / OpenCode）从 git clone 后的首次环境搭建。  
> 各 CLI 的 worktree 路径和端口见 [COLLABORATION-PROTOCOL.md](/Users/Shared/COLLABORATION-PROTOCOL.md)。

---

## 各 CLI Worktree 对照表

| CLI | Worktree 目录 | 前端端口 | 后端端口 |
|-----|--------------|----------|----------|
| CC（主） | `/Users/bornfly/Desktop/claude_code_learn/egonetics` | 3000 | 3002 |
| Codex | `/Users/Shared/egonetics-codex` | 3010 | 3012 |
| Gemini | `/Users/Shared/egonetics-gemini` | 3020 | 3022 |
| OpenCode | `/Users/Shared/egonetics-opencode` | 3030 | 3032 |

以下所有步骤在 **你自己的 worktree 根目录** 执行。

---

## 初始化步骤

### 1. 安装依赖

```bash
npm install
cd server && npm install && cd ..
```

### 2. 编译 Kernel

后端启动时需要 `dist/index.cjs`，git 不追踪此文件：

```bash
npm run build:kernel
```

### 3. 创建配置软链

`.env` 和 `server/.env` 统一指向共享配置，不在 git 中：

```bash
ln -sf /Users/Shared/prvse_world_workspace/config/frontend.env .env
ln -sf /Users/Shared/prvse_world_workspace/config/server.env server/.env
```

> 如果没有 `/Users/Shared/prvse_world_workspace/config/` 的访问权限，
> 联系 CC（Claude Code）获取 config 目录读取权限。

### 4. 创建 Excalidraw 软链

`vite.config.ts` 的 `@excalidraw/excalidraw` alias 指向 `../excalidraw/`（相对 worktree）。  
这个包是本地 build，不在 npm registry，需要软链到 Desktop 的实际 build：

**仅对 `/Users/Shared/` 下的 worktree 需要执行（CC 的 Desktop 目录天然满足）：**

```bash
# 在 /Users/Shared/ 目录下创建一次即可，所有 CLI 共用
ln -sf /Users/bornfly/Desktop/claude_code_learn/excalidraw /Users/Shared/excalidraw
```

### 5. 创建 agent-spaces 软链

```bash
ln -sf ../prvse_world_workspace/L2/ai-resources agent-spaces
```

### 6. 初始化认证数据库（首次）

```bash
cd server && node scripts/init-auth-db.js && cd ..
```

按提示创建管理员账号。`VITE_DEV_MODE=true` 已在 frontend.env 中，开发时无需登录。

---

## 启动

```bash
./start.sh
```

脚本自动启动后端（3002）→ 健康检查 → 前端（3000）。  
各 CLI 使用自己端口时，参考 COLLABORATION-PROTOCOL 修改端口配置。

---

## 开发者模式说明

`frontend.env` 中的 `VITE_DEV_MODE=true` 会同时影响前端和后端两处：

**前端（auth store）**：跳过 JWT 验证，直接以 admin 身份进入，无需登录页。  
**后端（server.env 中 `DEV_MODE=true`）**：跳过 Token 校验，所有 API 请求自动注入 admin 身份。

两个变量必须同时生效，否则前端能进去但 API 请求会被后端 401 拒绝。

> 这两个变量已在共享 config 文件中设置，步骤 3 软链完成后自动生效，无需手动修改。

---

## 踩坑记录

| 症状 | 原因 | 修复 |
|------|------|------|
| `Cannot find module 'sqlite3'` | `server/node_modules` 不存在 | `cd server && npm install` |
| `Cannot find module '.../dist/index.cjs'` | Kernel 未编译 | `npm run build:kernel` |
| 所有页面白屏（无报错，console 也无明显错误） | `@excalidraw/excalidraw` alias 在 `vite.config.ts` 中指向本地路径，该路径不存在时 Vite 在模块解析阶段就失败，**导致整个 React app 无法挂载**，不只是 `/excalidraw` 路由，所有页面都白屏 | 步骤 4 创建软链后重启 Vite |
| 跳转到 `/login` | `.env` 缺失，`VITE_DEV_MODE` 未生效 | 步骤 3 |
| `@prvse` 路径找不到 | `/Users/Shared/` 下的 worktree 不需要额外软链（`../prvse_world_workspace` 即真实目录）；Desktop 下的 CC 需检查 `../prvse_world_workspace` 是否存在 | 按实际路径补软链 |
| `server/data` 无数据 | 首次运行，数据库尚未初始化 | 步骤 6 |

---

## 存储说明

`node_modules` 合计约 1.2 GB，主要来源：

| 包 | 大小 | 说明 |
|----|------|------|
| `server/node_modules/kuzu` | ~532 MB | 嵌入式图数据库，含 native binary |
| `node_modules/` (前端) | ~560 MB | React + Vite + UI 组件，正常范围 |

如不使用图数据库功能：`cd server && npm uninstall kuzu`（节省 532 MB）。
