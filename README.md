# deepagents-frontend

deepagents 后端（FastAPI）的 Web 前端：Vue 3 + TypeScript + Element Plus + Tailwind CSS 4。

## 功能

| 页面 | 路由 | 覆盖的后端端点组 |
| --- | --- | --- |
| 登录 / 注册 | `/login` | `auth`（双令牌 + 401 单飞刷新） |
| 对话 | `/` | `chat`（SSE 流式、interrupt 审批、停止、历史/状态、删消息/文件/会话） |
| 记忆 | `/memories` | `memory`（清单 / 读 / 写 / 上传 / 删） |
| 知识库 | `/kb` | `kb`（shared/private 两层目录、文本读写、二进制下载、super 上传删） |
| 微服务 | `/microservices` | `microservice`（建删授权收权、list 与 mine 两个问题） |

领域词（中断 ≠ 停止、记忆 ≠ 知识库、super、可见范围）见 [CONTEXT.md](./CONTEXT.md)，
后端接口全文见 [docs/backend-api.md](./docs/backend-api.md)。

## 环境要求

- Node ≥ 20，包管理用 pnpm
- 后端跑在 `127.0.0.1:8000`（已开 CORS；开发默认仍走 Vite proxy 同源转发，直连也没问题）

## 进入前端

```bash
# 1) 起后端（另一个终端，仓库 deepagents_template/）
uv run python main.py          # 监听 127.0.0.1:8000

# 2) 起前端（本仓库）
pnpm install                   # 首次
pnpm dev                       # 监听 http://localhost:5173
```

浏览器打开 **http://localhost:5173** → 未登录会自动跳 `/login`：

1. 首次使用切「注册」标签，填账号（3–50 位字母数字 `_ . -`）、邮箱、密码（≥8 位）→ 注册并自动登录
2. 之后用账号或邮箱登录；忘记密码只能改库（后端无重置接口）
3. 进入后顶栏切换：对话 / 记忆 / 知识库 / 微服务
4. 聊天页：左侧「新对话」开轮次，流式作答；agent 要写记忆时会出**批准卡片**，点「批准」继续、「拒绝」作罢；右侧「停止」结束本轮
5. 知识库的写操作（建删微服务、授权、上传写入）需要 super：
   `update users set is_super = true where account = '你的账号';` 改完无需重登，刷新页面即可见按钮

生产部署：`pnpm build` 产物在 `dist/`，丢给任意静态服务器（nginx 等），反代 `/auth` `/chat` `/memories` `/kb` `/microservices` `/health` 到后端即可（这些路径是前端请求的原生路径，无前缀）。

## 常用命令

```bash
pnpm build          # vue-tsc 类型检查 + 生产构建（产物 dist/）
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm gen:api        # openapi.json 更新后重新生成 src/api/schema.d.ts
```

## 结构

```
openapi.json              # 后端契约快照，类型生成的输入（路径: pnpm gen:api）
src/
├── api/                  # 薄封装：http.ts（鉴权/单飞刷新/下载）+ 5 组端点模块
│   ├── schema.d.ts       #   由 openapi-typescript 生成，勿手改
│   └── chat.ts           #   含 streamChat()：POST+SSE（fetch-event-source）
├── stores/auth.ts        # 登录态 + is_super（每次导航回查，改库即生效）
├── router/index.ts       # 路由守卫：未登录去 /login；/login 已登录回 /
├── layouts/MainLayout.vue# 顶栏导航 + 用户菜单
├── views/                # 五个页面
└── components/chat/      # ChatWindow（流式/审批/停止）、FilesDrawer
docs/
├── backend-api.md        # 后端 README 副本（接口、权限模型、curl 示例）
└── adr/0001-*.md         # 为什么 API 客户端手写而不用全量代码生成
```

## 对接要点

- **鉴权**：access/refresh 存 localStorage；任何请求 401 → 只发一次 refresh（并发排队）→ 重试；刷新失败踢回 `/login`
- **SSE**：`POST /chat/stream` 不是 `EventSource`（它只支持 GET），用 `fetch-event-source`，
  新会话 id 从响应头 `X-Thread-Id` 拿；`onerror` 必须抛出，否则库会重试把同一条消息再发一遍
- **super 门控**：写操作按钮（建删微服务、授权、知识库写）由 `/auth/me` 的 `is_super` 控制
- **权限边界**：不可见 = 404，前端不区分「不存在」和「没权限」，提示统一为不存在

## 已知问题（后端侧）

- 聊天流无任何输出就结束：`.env` 的 `OPEN_API_KEY` 还是占位符 `sk-你的密钥`，中文进
  HTTP 头导致 `UnicodeEncodeError`，轮次秒挂（见后端 `logs/app_*.log`）。换真 key 即恢复。
- 后端流中途异常掐断时，开发期 Vite proxy 不会把断连转发给浏览器（http-proxy 对 abort
  的处理），表现为请求干等；正常结束的流不受影响，生产用 nginx 无此问题。
