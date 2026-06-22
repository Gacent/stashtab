# 个人资源收藏工具设计文档

## 概述

一个 PWA 跨平台应用，用于聚合分散在各 App（今日头条、微信公众号、Twitter 等）的收藏内容。用户通过"复制链接 → 打开工具 → 粘贴"的方式保存资源，工具自动抓取网页信息 + AI 提取摘要和标签，支持云同步多设备访问。

## 用户需求

| 需求 | 方案 |
|---|---|
| 保存方式 | 手动粘贴链接/文字 |
| 内容类型 | 链接 + 图片/视频预览 + 文字笔记 |
| 收藏量 | 5-15条/天 |
| 用途 | 知识管理，搜索回顾 |
| 设备 | iOS + Android + PC（全平台） |
| 存储 | 云同步 |
| 分类 | 标签系统（AI 自动打标签） |
| 搜索 | 标题 + 描述搜索 |
| AI 引擎 | SenseNova 6.7 Flash-Lite（免费额度） |
| 成本 | ¥0/月 |

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vite + React + TailwindCSS | PWA 可安装到桌面 |
| 后端 | Cloudflare Workers | API 接口 + 网页抓取 |
| 数据库 | Cloudflare D1 (SQLite) | 收藏/标签/用户配置 |
| AI | SenseNova 6.7 Flash-Lite | 摘要生成 + 自动标签 |
| 托管 | Cloudflare Pages | 静态站点托管（免费） |

所有组件均使用免费额度，前期零成本运营。

## 功能设计

### 1. 收藏保存

**统一入口**：粘贴检测 + 自动识别内容类型

```
粘贴内容自动识别逻辑：

if 内容以 http:// 或 https:// 开头:
  类型 = "链接收藏"
  动作 = 抓取网页 meta 信息 → AI 提取摘要 + 推荐标签
  
else:
  类型 = "文字笔记"
  动作 = AI 基于文字内容生成标题 + 推荐标签
```

**保存流程**：

1. 用户在任意 App 复制内容（链接或文字）
2. 打开 PWA → 点击粘贴输入区域（触发浏览器剪贴板读取权限）
3. 应用读取剪贴板内容，自动识别类型（链接/文字）
4. 显示预览卡片（标题、摘要、封面图、AI 推荐标签）
5. 用户可编辑标签、添加备注
6. 点保存 → 写入云端 → 所有设备同步

> 注：出于浏览器安全策略，Web 应用无法在后台自动读取剪贴板，需要用户主动点击触发。实际交互上就是打开工具后点一下粘贴框，体验依然流畅。

**预览卡片结构**：

```
┌──────────────────────────────────────┐
│  📰 标题（自动抓取或 AI 生成）         │
│  📝 摘要（网页描述或 AI 提取）         │
│  🖼️ [封面图]（如有）                  │
│  🏷️ 标签：技术 · AI · 产品（AI 推荐）  │
│  ✏️ [添加备注...]（可选）              │
│                                      │
│           [💾 保存]  [取消]            │
└──────────────────────────────────────┘
```

### 2. 首页时间线

- 瀑布流卡片布局，按保存时间倒序排列
- 每张卡片：封面图（如果有）+ 标题 + 摘要 + 来源标注 + 标签
- 下拉加载更多（分页）
- 点击卡片进入详情页
- 顶部搜索框常驻

### 3. 标签系统

- 每条内容支持多个标签
- AI 自动推荐标签（技术/AI/商业/产品/生活/开源/教程等分类）
- 标签页：展示所有标签及对应内容数量，点击筛选
- 支持多标签交集筛选
- 用户可手动添加/删除/修改标签

### 4. 详情页

- 展示完整内容（标题、大图、描述、标签、备注、来源、保存时间）
- 如果是链接收藏：点击"阅读原文"跳转浏览器
- 如果是文字笔记：展示全文
- 编辑按钮：可修改标签、备注
- 删除按钮
- 左右滑动切换上一条/下一条内容

### 5. 搜索

- 顶部搜索框，输入即搜
- 搜索范围：标题 + 描述
- 筛选维度：标签（下拉选择）、来源（自动识别的域名）、日期范围
- 搜索结果以卡片列表展示

### 6. 文字笔记

- 脱离链接的独立笔记功能
- 适用于：收藏一段有启发的段落、个人想法、待办事项等
- AI 基于文字内容自动生成标题和标签
- 与其他链接收藏在时间线中统一展示，通过图标区分类型

### 7. 辅助功能

- **已读/未读标记**：侧滑或长按标记已读
- **导出备份**：导出为 JSON 格式，用于迁移或备份
- **暗色模式**：跟随系统或手动切换

## 数据库设计

### 表结构

```sql
-- 收藏表
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,           -- UUID
  type TEXT NOT NULL,            -- 'link' | 'note'
  url TEXT,                      -- 链接地址（type=link 时）
  title TEXT NOT NULL,           -- 标题
  description TEXT,              -- 摘要/描述
  cover_image TEXT,              -- 封面图 URL
  source TEXT,                   -- 来源（域名自动识别）
  content TEXT,                  -- 文字笔记内容（type=note 时）
  ai_summary TEXT,               -- AI 生成的摘要
  notes TEXT,                    -- 用户备注
  is_read INTEGER DEFAULT 0,     -- 已读标记
  created_at TEXT NOT NULL,      -- 保存时间 ISO8601
  updated_at TEXT NOT NULL       -- 更新时间 ISO8601
);

-- 标签表
CREATE TABLE tags (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL UNIQUE,     -- 标签名
  color TEXT                     -- 标签颜色（可选）
);

-- 收藏-标签关联表（多对多）
CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (bookmark_id, tag_id),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

## API 接口设计

```
POST   /api/bookmarks       创建收藏（链接或笔记）
GET    /api/bookmarks       获取收藏列表（分页 + 筛选）
GET    /api/bookmarks/:id   获取单个收藏详情
PUT    /api/bookmarks/:id   更新收藏（标签/备注/已读状态）
DELETE /api/bookmarks/:id   删除收藏
GET    /api/tags            获取所有标签（含数量统计）
GET    /api/search?q=&tag=  搜索 + 筛选
POST   /api/fetch-meta      抓取链接预览信息（标题/描述/封面）
POST   /api/ai-extract      AI 提取摘要 + 推荐标签
```

## AI 集成设计

**Model**: `sensenova-6.7-flash-lite`
**Endpoint**: `https://token.sensenova.cn/v1/chat/completions`

### AI 场景一：链接摘要 + 标签

```
System Prompt: 你是一个信息整理助手。根据提供的网页内容，提取：
1. 一段简洁的中文摘要（50字以内）
2. 3-5个中文标签

只返回 JSON 格式：{"summary": "...", "tags": ["...", "..."]}

User Input: 网页抓取到的标题、meta description、正文前 500 字
```

### AI 场景二：文字笔记标题 + 标签

```
System Prompt: 根据提供的文字内容，生成：
1. 一个简洁的标题（15字以内）
2. 3-5个中文分类标签

只返回 JSON 格式：{"title": "...", "tags": ["...", "..."]}

User Input: 用户粘贴的文字内容
```

## 用户界面结构

```
/
├── /                    首页 - 时间线瀑布流
├── /search              搜索结果页
├── /tags                标签管理页
├── /tags/:tag           按标签筛选
├── /bookmark/:id        详情页
└── /settings            设置（API Key 配置、导出、主题）
```

## 架构图

```
┌─────────────────────────────────────────────────┐
│            PWA 前端（所有设备）                      │
│  iOS Safari / Android Chrome / PC Chrome        │
│                                                 │
│  粘贴链接/文字 → AI 提取 → 保存 → 时间线 → 搜索    │
└────────────────────┬────────────────────────────┘
                     │ HTTPS API
                     ▼
┌─────────────────────────────────────────────────┐
│            Cloudflare Workers                    │
│  链接抓取服务  │  AI提取服务  │  CRUD API          │
│  搜索服务      │  用户认证                         │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare D1（SQLite）   │  SenseNova API       │
│  bookmarks  │  tags  │     │  （外部）              │
└─────────────────────────────────────────────────┘
```
