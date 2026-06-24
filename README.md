<div align="center">

<img src="docs/icons/icon-brush-tag.png" alt="拾签 StashTab" width="120" height="120">

# 拾签 StashTab

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff)](https://vitejs.dev/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-4.7-e36002)](https://hono.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Supported-5a0fc7)](https://web.dev/progressive-web-apps/)

> 拾起链接，拾起灵感

AI 驱动的个人收藏工具。粘贴链接或文字，自动提取标题、标签、摘要，存入飞书多维表格，支持全文搜索和标签筛选。

[English](#english) · 简体中文

</div>

## 截图

| 首页 | 搜索 | 标签 | 详情 |
|------|------|------|------|
| ![首页](docs/screenshots/home.png) | ![搜索](docs/screenshots/search.png) | ![标签](docs/screenshots/tags.png) | ![详情](docs/screenshots/detail.png) |

## 功能

- **粘贴即收藏**：粘贴链接自动抓取 OG 元数据，AI 提取标题、标签、摘要
- **AI 去标题党**：SenseNova AI 自动生成 10 字以内的简洁标题（如 "React Server Components 官方文档" 而非 "震惊！React 19 发布了"）
- **随手笔记**：支持纯文字笔记，可直接编辑标题，不经过 AI
- **全文搜索**：模糊搜索标题/原文标题/摘要/来源
- **标签筛选**：按标签分类，快速定位
- **自动标签**：AI 从预设类别（技术/AI/商业/产品/设计/开源/教程等）自动匹配标签
- **链接预览**：自动抓取 OG 标题、描述、封面图
- **时间线分组**：按日期分组展示
- **暗色模式**：支持暗色主题
- **PWA**：可添加到手机桌面，支持离线缓存
- **Pull-to-refresh**：下拉刷新

### 支持的链接类型

| 类型 | 方式 |
|------|------|
| 普通网页 | OG 标签提取 |
| GitHub 仓库 | GitHub API（仓库名、描述、Star 数、语言） |
| B 站视频 | Bilibili API（标题、UP主、播放量、时长） |
| 今日头条 | Googlebot 降级抓取（部分视频受反爬限制） |
| 微信公众号 | 标题 + 来源 |
| JS 渲染页面 | Cloudflare Browser Run 降级渲染（可选） |

## 技术栈

### 后端

- **运行时**：Cloudflare Workers
- **框架**：Hono
- **数据库**：飞书多维表格（Feishu Base）
- **AI**：SenseNova 6.7 Flash-Lite
- **浏览器渲染**：Cloudflare Browser Run（可选，免费版 10 分钟/天）
- **部署**：`wrangler deploy`

### 前端

- **框架**：React 19
- **路由**：React Router 7
- **构建**：Vite 6
- **样式**：Tailwind CSS 4
- **部署**：Cloudflare Pages
- **字体**：Copernicus（标题衬线体）、Inter（正文字体）

### 设计系统

- 画布色：暖白 `#faf9f5`
- 主色：珊瑚 `#cc785c`
- 暗色：深海军蓝 `#181715`

## 快速开始

### 前提

1. [Cloudflare 账号](https://dash.cloudflare.com/)（免费版即可）
2. [SenseNova API Key](https://platform.sensenova.cn/)（免费 token 套餐）
3. [飞书](https://www.feishu.cn/) 账号，创建一个多维表格

### 1. 飞书多维表格配置

创建一个空的多维表格，添加以下 7 个字段：

| 字段名 | 类型 |
|--------|------|
| AI标题 | 文本 |
| 原文标题 | 文本 |
| URL | 超链接 |
| 标签 | 多选 |
| AI摘要 | 文本 |
| 保存时间 | 日期 |
| 来源 | 文本 |

### 2. 配置环境变量

**本地开发**：复制 `.dev.vars.example` 为 `.dev.vars`，填入你的密钥：

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

编辑 `worker/.dev.vars`：

```
APP_PASSWORD = "你的密码"          # 前端登录密码
SENSENOVA_API_KEY = "sk-xxx"      # SenseNova API Key
FEISHU_APP_ID = "cli_xxx"         # 飞书自建应用 App ID
FEISHU_APP_SECRET = "xxx"         # 飞书自建应用 App Secret
FEISHU_BASE_APP_TOKEN = "xxx"     # 飞书多维表格 App Token（URL 中）
FEISHU_BASE_TABLE_ID = "tblxxx"   # 飞书多维表格 ID（URL 中）
```

**生产部署**：在 [Cloudflare 仪表盘](https://dash.cloudflare.com/) → Workers → stashtab-worker → Settings → Variables 添加上述 6 个变量（勾选 Encrypt）。

### 3. 启动后端

```bash
cd worker
npm install
npm run dev  # http://localhost:8787
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### 5. 开发环境一键启动

项目根目录有 `dev.bat`（Windows），自动启动前后端。

### 6. 部署

```bash
# 部署后端 Worker
cd worker
npm run deploy

# 构建前端并部署到 Pages
cd frontend
VITE_API_BASE=https://你的-worker域名.workers.dev/api npm run build
npx wrangler pages deploy dist --project-name=stashtab
```

## 项目结构

```
├── frontend/                  # React PWA 前端
│   ├── src/
│   │   ├── components/        # UI 组件
│   │   │   ├── BookmarkCard.tsx    # 收藏卡片
│   │   │   ├── BookmarkForm.tsx    # 收藏表单（粘贴链接/写笔记）
│   │   │   ├── Layout.tsx          # 布局 + 底部导航
│   │   │   ├── PullToRefresh.tsx   # 下拉刷新
│   │   │   ├── SearchBar.tsx       # 搜索栏
│   │   │   └── TagBadge.tsx        # 标签徽章
│   │   ├── pages/             # 页面
│   │   │   ├── HomePage.tsx        # 首页（时间线）
│   │   │   ├── DetailPage.tsx      # 详情/删除
│   │   │   ├── LoginPage.tsx       # 登录
│   │   │   ├── SearchPage.tsx      # 搜索
│   │   │   ├── SettingsPage.tsx    # 设置
│   │   │   ├── TagFilterPage.tsx   # 标签筛选结果
│   │   │   └── TagsPage.tsx        # 标签列表
│   │   ├── api.ts             # API 客户端
│   │   ├── types.ts           # 类型定义
│   │   ├── pageCache.ts       # 页面状态缓存
│   │   └── index.css          # Tailwind 主题
│   ├── functions/             # Cloudflare Pages Functions
│   └── vite.config.ts
│
├── worker/                    # Cloudflare Worker 后端
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── bookmarks.ts   # 收藏 CRUD + 搜索
│   │   │   ├── fetch-meta.ts  # 链接抓取（OG/B站/GitHub/头条/Browser Run）
│   │   │   └── ai-extract.ts  # AI 提取标题/标签/摘要
│   │   ├── feishu.ts          # 飞书 Base API 客户端
│   │   ├── sensenova.ts       # SenseNova AI API 客户端
│   │   ├── index.ts           # 路由入口
│   │   └── types.ts           # 环境变量类型
│   ├── wrangler.toml.example  # 配置模板（复制为 wrangler.toml）
│   └── package.json
│
├── dev.bat                    # Windows 一键开发启动
└── README.md
```

## 数据流

```
用户粘贴链接
  │
  ▼
  ├── GitHub 链接 ──→ GitHub API ──→ 仓库信息
  ├── B站 链接 ────→ Bilibili API ──→ 视频信息
  ├── 今日头条 ────→ Googlebot 降级抓取 → OG 标签
  ├── JS 渲染页面 ──→ Browser Run → OG 标签（可选）
  └── 普通网页 ────→ 直接抓取 → OG 标签
      │
      ▼
  AI 提取（标题 + 标签 + 摘要）
      │
      ▼
  保存到飞书多维表格
```

## 搜藏流程

1. **收藏链接**：粘贴 URL → 自动抓取元数据 → AI 提取 → 保存到飞书
2. **写笔记**：粘贴文字 → 可选编辑标题 → 保存
3. **搜索**：按关键词搜索所有字段
4. **标签管理**：查看所有标签，点击筛选
5. **删除**：左滑或详情页删除

## 许可证

[MIT](LICENSE)

## 相关项目

- [Hono](https://hono.dev/) - 超轻量 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) - 原子化 CSS
- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算
- [SenseNova](https://platform.sensenova.cn/) - 商汤大模型 API
- [飞书开放平台](https://open.feishu.cn/) - 飞书 API

---

## English

**StashTab** — AI-powered personal bookmark aggregator.

Paste a link or note → AI auto-extracts title, tags, and summary → Save to Feishu Base.

### Features

- Paste-to-collect with auto OG metadata extraction
- AI-powered de-clickbait titles (≤10 chars) via SenseNova
- Full-text search and tag filtering
- PWA with offline support
- Dark mode

### Tech Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS 4, React Router 7
- **Backend**: Cloudflare Workers, Hono
- **AI**: SenseNova 6.7 Flash-Lite
- **Database**: Feishu Base (飞书多维表格)
- **Browser Rendering**: Cloudflare Browser Run (optional)

### Quick Start

```bash
# Clone
git clone https://github.com/Gacent/stashtab.git
cd stashtab

# Configure (local dev)
cp worker/.dev.vars.example worker/.dev.vars
# Edit worker/.dev.vars with your keys

# Dev
cd worker && npm install && npm run dev
cd frontend && npm install && npm run dev
```

See [README (Chinese)](#拾签-stashtab) for full documentation.
