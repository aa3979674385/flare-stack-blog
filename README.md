<div align="center">

# My Blog

基于 **Cloudflare Workers** 的全栈现代化博客 CMS<br>
深度集成 D1、R2、KV、Workflows 等 Serverless 服务，并在此基础上扩展了会员、积分、资源下载等一整套内容变现能力

[![License](https://img.shields.io/github/license/aa3979674385/my-blog?style=flat-square)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/aa3979674385/my-blog?style=flat-square)](https://github.com/aa3979674385/my-blog/stargazers)
[![React](https://img.shields.io/badge/React-19-blue?logo=react&style=flat-square)](https://react.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack%20Start-black?logo=tanstack&style=flat-square)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white&style=flat-square)](https://workers.cloudflare.com)

[定制功能](#定制功能) · [部署指南](#部署指南) · [本地开发](#本地开发) · [主题开发](./docs/theme-guide.md)

</div>

---

> **关于本项目**
>
> 本项目基于开源项目 [du2333/flare-stack-blog](https://github.com/du2333/flare-stack-blog) 二次开发，遵循 **GPL-3.0** 协议开源。
> 在上游的博客能力之上，本仓库补齐了**会员体系、卡密兑换、积分签到、资源下载与权限分级**等一整套内容运营功能，并重写了前台主题与移动端布局。
> 感谢原作者 [@du2333](https://github.com/du2333) 的出色工作。

> **注意**：本项目专为 Cloudflare 生态设计，**仅支持**部署在 Cloudflare Workers。

## 界面预览

<div align="center">
  <img src="docs/assets/home.png" alt="首页预览" width="49%">
  <img src="docs/assets/admin.png" alt="管理后台预览" width="49%">
</div>

---

## 定制功能

以下是本仓库相对上游新增 / 重写的部分，全部可在后台可视化配置，无需改代码。

### 会员与变现

| 模块 | 说明 |
| :--- | :--- |
| **会员中心** | 单页式会员中心，聚合套餐购买、卡密兑换、积分余额、下载记录，移动端做了完整适配（导航 4 列网格、按钮并排、内容区撑满） |
| **会员套餐** | 后台自定义套餐，说明字段支持 HTML 富文本渲染；未接入支付时自动提示使用卡密开通 |
| **卡密系统** | 卡密生成、批量导入、兑换核销；支持配置「购买卡密」外链，直接显示在兑换入口旁 |
| **积分体系** | 积分获取与消耗记录全链路留痕，奖励数值后台可调 |
| **每日签到** | 按**北京时间（UTC+8）** 每日 0:00 重置，连续签到天数独立计算，规避了 UTC 时区导致的跨日误判 |

### 内容与权限

| 模块 | 说明 |
| :--- | :--- |
| **访问权限分级** | 文章支持「免费 / 会员免费 / 付费」三档，列表页与详情页统一批量填充 `accessType`，首页角标实时准确 |
| **资源下载** | 文章可挂载下载资源，支持解压码字段与「收费时隐藏解压码」开关 |
| **下载配额** | 普通用户 / 会员分别配置每日下载次数，按当天不同文章去重计数 |
| **文章分类** | 独立于标签的分类体系，分类药丸可点击直达筛选页 |
| **版权声明** | 文章底部版权声明，后台「模板设置」中配置，与 END 分割线自动去重 |

### 站点与后台

| 模块 | 说明 |
| :--- | :--- |
| **记录中心** | 后台聚合四类记录（积分 / 下载 / 兑换 / 操作日志），各自独立开关，支持单条、批量删除与清空 |
| **悬浮工具栏** | 右侧悬浮工具栏，图标、链接、显示条件全部后台可配 |
| **弹窗公告** | 站点弹窗公告，配置项收纳在「模板设置 - 其他设置」 |
| **导航管理** | 前台导航菜单后台维护 |
| **站点文档** | 关于、隐私政策等独立页面在后台直接编辑 |
| **模板设置** | 整体卡片化重构，一个功能一张卡片，配置项分 tab 收纳 |

### 前台主题 `mytheme`

在上游主题契约之上新增的自研主题：

- **三栏 Footer** — 左品牌区 / 中导航链接 + 社交 / 右二维码，详情页通栏不被侧边栏挤占
- **网格文章卡片** — 封面大图 + 发布者头像 + 分类药丸 + 收费角标 + 发布时间右对齐，响应式列数（手机 2 / 平板 3 / 大屏 4）
- **详情页布局** — 侧边栏右置、TOC 左置防重叠；手机端隐藏整个侧边栏，下载模块内嵌到正文与版权声明之间
- **搜索页** — 复用首页同款网格卡片，关闭侧边栏

### 搜索改造

搜索行为按实际使用习惯重做：**仅匹配标题 + 子串包含**（标题含查询串即命中，不论字数），同时给索引瘦身。索引缺失时后台自动异步重建，避免每次部署后都要手动点一次。

---

## 核心功能

以下能力继承自上游项目并持续维护。

- **文章管理** — 富文本编辑器，支持代码高亮、图片上传、草稿 / 发布流程
- **版本历史** — 编辑器自动快照与文章版本回溯，方便恢复误改内容
- **标签系统** — 灵活的文章分类
- **评论系统** — 支持嵌套回复、邮件通知、AI 辅助审核与上下文化评论审核
- **友情链接** — 用户申请、管理员审核、邮件通知
- **通知系统** — 支持邮件与 Webhook 多通道通知，可按事件订阅
- **全文搜索** — 基于 Orama 的高性能搜索
- **媒体库** — R2 对象存储，图片管理与优化
- **用户认证** — 邮箱密码 / GitHub OAuth 登录，权限控制
- **MCP Server** — 支持通过 OAuth 连接 AI 客户端，进行文章、评论、标签、友链、媒体与统计管理
- **数据统计** — Umami 集成，访问分析与热门文章
- **SEO 增强** — Canonical URL、Schema.org 结构化数据、RSS / Sitemap / Robots
- **AI 辅助** — Cloudflare Workers AI 集成
- **主题系统** — 可扩展的主题模板，支持完整替换所有页面和布局
- **导入导出** — 支持 Markdown 导入导出，保留图片以及 Frontmatter

---

## 技术栈

### Cloudflare 生态

| 服务            | 用途                           |
| :-------------- | :----------------------------- |
| Workers         | 边缘计算与托管                 |
| D1              | SQLite 数据库                  |
| R2              | 对象存储（媒体文件）           |
| KV              | 缓存层                         |
| Durable Objects | 分布式限流                     |
| Workflows       | 异步任务（内容审核、定时发布） |
| Queues          | 消息队列（邮件通知）           |
| Workers AI      | AI 能力                        |
| Images          | 图片优化                       |

### 前端

- **框架**：React 19 + TanStack Router / Query / Start
- **样式**：TailwindCSS 4
- **表单**：React Hook Form + Zod
- **图表**：Recharts
- **编辑器**：TipTap 富文本 + Shiki 代码高亮

### 后端

- **网关层**：Hono（认证路由、媒体服务、缓存控制）
- **业务层**：TanStack Start（SSR、Server Functions）
- **数据库**：Drizzle ORM + drizzle-zod
- **认证**：Better Auth（邮箱密码 / GitHub OAuth）

### 目录结构

```
src/
├── features/
│   ├── posts/                  # 文章管理（其他模块结构类似）
│   │   ├── api/                # Server Functions（对外接口）
│   │   ├── data/               # 数据访问层（Drizzle 查询）
│   │   ├── posts.service.ts    # 业务逻辑
│   │   ├── posts.schema.ts     # Zod Schema + 缓存 Key 工厂
│   │   ├── components/         # 功能专属组件
│   │   ├── queries/            # TanStack Query Hooks
│   │   └── workflows/          # Cloudflare Workflows
│   │
│   ├── membership/     # ★ 会员体系、套餐、积分、签到
│   ├── card-keys/      # ★ 卡密生成与兑换
│   ├── post-resources/ # ★ 文章下载资源、解压码、下载配额
│   ├── categories/     # ★ 文章分类
│   ├── admin-log/      # ★ 记录中心（积分/下载/兑换/操作日志）
│   ├── popup/          # ★ 站点弹窗公告
│   ├── navigation/     # ★ 前台导航管理
│   ├── site-documents/ # ★ 站点独立页面（关于、隐私等）
│   │
│   ├── comments/       # 评论、嵌套回复、审核
│   ├── tags/           # 标签管理
│   ├── media/          # 媒体上传、R2 存储
│   ├── search/         # Orama 全文搜索
│   ├── auth/           # 认证、权限控制
│   ├── users/          # 用户管理、封禁
│   ├── dashboard/      # 管理后台数据统计
│   ├── email/          # 邮件通知
│   ├── notification/   # 通知订阅
│   ├── webhook/        # Webhook 通道
│   ├── pageview/       # 浏览量统计
│   ├── cache/          # KV 缓存服务
│   ├── config/         # 博客配置
│   ├── friend-links/   # 友情链接（申请、审核）
│   ├── import-export/  # Markdown 导入导出
│   ├── version/        # 版本更新检查
│   ├── mcp/            # MCP Server
│   ├── theme/          # 主题系统（契约、注册表、各主题实现）
│   └── ai/             # Workers AI 集成
├── routes/
│   ├── _public/     # 公开页面（首页、文章列表/详情、搜索）
│   ├── _auth/       # 登录/注册相关页面
│   ├── _user/       # 会员中心
│   ├── admin/       # 管理后台
│   ├── rss[.]xml.ts     # RSS Feed
│   ├── sitemap[.]xml.ts # Sitemap
│   └── robots[.]txt.ts  # Robots.txt
├── components/      # UI 组件（ui/, common/, layout/, tiptap-editor/）
├── lib/             # 基础设施（db/, auth/, hono/, middlewares）
└── hooks/           # 自定义 Hooks
```

> 标 ★ 的为本仓库新增模块。

### 主题系统

所有面向用户的页面与布局均通过 **主题契约（Theme Contract）** 与业务逻辑解耦，可以在不修改任何路由或数据逻辑的前提下，完整替换博客的视觉表现层。

→ **[主题开发教程](./docs/theme-guide.md)**

可用主题：`default`（上游默认）、`fuwari`（上游）、`mytheme`（本仓库自研，默认启用）。

站点个性化配置（标题、描述、社交链接、favicon、默认主题背景图等）统一在后台「设置」页面维护，`src/blog.config.ts` 仅作为默认值与兜底。

### 请求流程

```
请求 → Cloudflare CDN（边缘缓存）
         ↓ 未命中
      server.ts（Hono 入口）
         ├── /api/auth/* → Better Auth
         ├── /images/*   → R2 媒体服务
         └── 其他        → TanStack Start
                              ↓
                         中间件注入（db, auth, session）
                              ↓
                         路由匹配 + Loader 执行
                              ↓
                  KV 缓存 ←→ Service 层 ←→ D1 数据库
                              ↓
                         SSR 渲染（带缓存头）
```

---

## 部署指南

部署流程与上游一致，可参考原作者的 **[部署教程](https://blog.dukda.com/post/flare-stack-blog%E9%83%A8%E7%BD%B2%E6%95%99%E7%A8%8B)** 和 **[视频教程](https://www.bilibili.com/video/BV1R4fnBhEs4?p=2)**，包含 Cloudflare 资源创建、凭证获取、GitHub OAuth 配置及常见问题排查。

克隆地址换成本仓库即可：

```bash
git clone https://github.com/aa3979674385/my-blog.git
```

### 环境变量参考

| 文件        | 用途                                   |
| :---------- | :------------------------------------- |
| `.env`      | 客户端变量（`VITE_*`），Vite 读取      |
| `.dev.vars` | 服务端变量，Wrangler 注入 Worker `env` |

#### 必填

| 变量名                       | 用途   | 说明                                              |
| :--------------------------- | :----- | :------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`       | CI/CD  | Cloudflare API Token（Worker 部署 + D1 读写权限） |
| `CLOUDFLARE_ACCOUNT_ID`      | CI/CD  | Cloudflare Account ID                             |
| `D1_DATABASE_ID`             | CI/CD  | D1 数据库 ID                                      |
| `KV_NAMESPACE_ID`            | CI/CD  | KV 命名空间 ID                                    |
| `BUCKET_NAME`                | CI/CD  | R2 存储桶名称                                     |
| `BETTER_AUTH_SECRET`         | 运行时 | 会话加密密钥，运行 `openssl rand -hex 32` 生成    |
| `BETTER_AUTH_URL`            | 运行时 | 应用 URL（如 `https://blog.example.com`）         |
| `ADMIN_EMAIL`                | 运行时 | 管理员邮箱                                        |
| `GITHUB_CLIENT_ID`           | 运行时 | GitHub OAuth Client ID                            |
| `GITHUB_CLIENT_SECRET`       | 运行时 | GitHub OAuth Client Secret                        |
| `CLOUDFLARE_ZONE_ID`         | 运行时 | Cloudflare Zone ID                                |
| `CLOUDFLARE_PURGE_API_TOKEN` | 运行时 | 具有 Purge CDN 权限的 API Token                   |
| `DOMAIN`                     | 运行时 | 博客域名（如 `blog.example.com`）                 |

#### 可选

| 变量名                    | 用途   | 说明                                                                                                      |
| :------------------------ | :----- | :-------------------------------------------------------------------------------------------------------- |
| `THEME`                   | 构建时 | 主题名称，本仓库默认 `mytheme`                                                                            |
| `TURNSTILE_SECRET_KEY`    | 运行时 | Cloudflare Turnstile 人机验证 Secret Key                                                                  |
| `VITE_TURNSTILE_SITE_KEY` | 构建时 | Cloudflare Turnstile Site Key                                                                             |
| `GITHUB_TOKEN`            | 运行时 | GitHub API Token（版本更新检查，避免限流）                                                                |
| `LOCALE`                  | 运行时 | 默认语言，支持 `zh` / `en`，默认 `zh`                                                                     |
| `CDN_DOMAIN`              | 运行时 | 独立 CDN 域名（如 `cdn.example.com`），purge 时优先使用                                                   |
| `ROUTE`                   | CI/CD  | 设为 `1` 时，GitHub Actions 部署自动改用 Cloudflare `routes` 模式                                        |
| `ZONE_NAME`               | CI/CD  | 仅在 `ROUTE=1` 且 Zone 不是从 `DOMAIN` 自动推导结果时填写                                                |
| `PAGEVIEW_SALT`           | 运行时 | 浏览量统计的访客匿名化 salt，运行 `openssl rand -hex 16` 生成                                             |
| `UMAMI_SRC`               | 运行时 | Umami 客户端埋点代理 URL                                                                                  |
| `VITE_UMAMI_WEBSITE_ID`   | 构建时 | Umami Website ID（客户端埋点）                                                                            |

---

## 本地开发

### 前置要求

- [Bun](https://bun.sh) >= 1.3
- Cloudflare 账号（用于远程 D1/R2/KV 资源）

### 快速开始

```bash
# 克隆并安装依赖
git clone https://github.com/aa3979674385/my-blog.git
cd my-blog
bun install

# 配置环境变量
cp .env.example .env             # 客户端变量
cp .dev.vars.example .dev.vars   # 服务端变量

# 配置 Wrangler
cp wrangler.example.jsonc wrangler.jsonc
# 编辑 wrangler.jsonc，填入你的资源 ID
# 默认示例使用 custom_domain，也可以改成 routes 模式

# 启动开发服务器
bun dev
```

### 登录管理后台

**方式一：邮箱密码注册（无需第三方服务）**

1. 访问 `http://localhost:3000` 注册页面，使用 `.dev.vars` 中配置的 `ADMIN_EMAIL` 注册账号
2. 开发环境下验证邮件不会真正发送，验证链接会打印到控制台，复制访问即可完成验证
3. 验证后自动登录，系统根据 `ADMIN_EMAIL` 自动赋予管理员权限

**方式二：GitHub OAuth**

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers) 创建一个 OAuth App
2. Homepage URL 填 `http://localhost:3000`，Authorization callback URL 填 `http://localhost:3000/api/auth/callback/github`
3. 将 Client ID 和 Client Secret 填入 `.dev.vars`

### 常用命令

| 命令            | 说明                        |
| :-------------- | :-------------------------- |
| `bun dev`       | 启动开发服务器（端口 3000） |
| `bun run build` | 构建生产版本                |
| `bun run test`  | 运行测试                    |
| `bun lint`      | Biome 代码检查              |
| `bun check`     | Lint + 格式化 + 类型检查    |

### 数据库命令

| 命令                    | 说明                                   |
| :---------------------- | :------------------------------------- |
| `bun db:studio`         | 启动 Drizzle Studio（可视化数据库）    |
| `bun db:generate`       | 生成迁移文件                           |
| `bun db:migrate`        | 安全应用远程 D1 迁移，校验失败自动回滚 |
| `bun db:migrate:local`  | 安全应用本地 D1 迁移，校验失败自动恢复 |
| `bun db:migrate:unsafe` | 直接应用远程 D1 迁移，不做校验         |

`bun db:migrate` / `bun db:migrate:local` 会复用 schema 中定义的状态常量，在迁移前后校验以下关键计数是否一致：

- `posts`：总文章数，以及每个文章状态的数量
- `comments`：总评论数、根评论数、子评论数，以及每个评论状态的数量

安全脚本还会额外做这些事情：

- 远程模式：默认只记录 D1 Time Travel bookmark，校验失败时自动执行 restore
- 远程模式：如需额外保留 SQL 快照，可手动运行 `bun scripts/safe-d1-migrate/main.ts --remote --with-export`
- 本地模式：快照 `.wrangler/state`（或你传入的 `--persist-to`），校验失败时自动恢复本地持久化目录

### 本地模拟 Cloudflare 资源

默认配置使用远程 D1/R2/KV 资源。如需完全本地开发，可在 `wrangler.jsonc` 中移除 `remote: true`，Miniflare 会自动模拟这些服务：

```jsonc
{
  "d1_databases": [{ "binding": "DB" }],  // 移除 "remote": true
  "r2_buckets": [{ "binding": "R2" }],    // 移除 "remote": true
  "kv_namespaces": [{ "binding": "KV" }]  // 移除 "remote": true
}
```

> **注意**：本地模拟的数据不会同步到远程，适合初期开发和测试。本地数据库迁移推荐使用 `bun db:migrate:local`。

### 域名绑定方式

默认配置使用 `custom_domain`。如果希望使用 `routes` 方式接管 `blog.example.com/*`：

```jsonc
{
  "routes": [{ "pattern": "blog.example.com/*", "zone_name": "example.com" }]
}
```

使用仓库内置 GitHub Actions 部署时，不必手改 `wrangler.example.jsonc`：

- 默认：`custom_domain`
- 设置仓库变量 `ROUTE=1`：自动切到 `routes`
- `pattern` 自动使用 `${DOMAIN}/*`
- `zone_name` 默认从 `DOMAIN` 推导；如有子域单独托管场景，可额外设置 `ZONE_NAME`

---

## 开发规范

开始改动业务前，建议先阅读 [错误处理与 Result 模式快速上手](./docs/error-handling-quickstart.md)，以及 [CONTRIBUTING.md](./CONTRIBUTING.md) 中的代码规范。

---

## 许可证与致谢

本项目采用 **[GPL-3.0-only](./LICENSE)** 协议开源。

上游项目：[du2333/flare-stack-blog](https://github.com/du2333/flare-stack-blog) — 版权归原作者 [akuang (@du2333)](https://github.com/du2333) 所有。
本仓库为其衍生作品，依照 GPL-3.0 要求同样以 GPL-3.0 协议发布，并保留原始版权声明。

如果这个项目对你有帮助，欢迎点个 Star。
