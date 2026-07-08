# Proposal: 首页多维度筛选功能

## Why

当前首页仅按时间线分组展示所有书签，用户无法在首页直接筛选内容。筛选功能分散在三个独立页面：

- **搜索** → `/search`（关键词搜索跳转）
- **标签筛选** → `/tags/:tagName`（单标签跳转）
- **标签列表** → `/tags`（查看所有标签）

用户需要一个在首页 **原地** 进行多维度筛选的能力，无需跳转页面即可快速缩小浏览范围。对于书签数量增长后的日常使用，筛选是高频刚需。

## What Changes

在首页（HomePage）增加一个底部弹出的筛选面板（Bottom Sheet），支持 **标签 / 来源 / 时间范围** 三个维度的组合筛选。

### 前端

- **HomePage.tsx** — 修改：增加筛选状态管理、筛选面板组件、筛选后重新加载数据
- **新增组件 HomeFilterSheet.tsx** — 底部弹出筛选面板 UI，含标签多选、来源选择、时间范围选择
- **api.ts** — 修改：`listBookmarks()` 新增 `source` 参数

### 后端

- **bookmarks.ts handler** — 修改：`GET /bookmarks` 新增 `source` 查询参数（如 `web`, `github`, `bilibili`）
- **feishu.ts** — 修改：`searchFeishuRecords()` 新增 `source` 过滤逻辑
- **types.ts (worker)** — 如有必要，补充类型

## Scope

### In Scope

- 首页底部弹出筛选面板 UI
- 标签多选筛选（复用已有 `tag` 参数）
- 来源单选/多选筛选（新增 `source` 参数）
- 时间范围筛选（自定义起止日期）
- 筛选状态保持（当前筛选条件保存到 URL query params，支持分享/回退）
- 筛选与已有的搜索/标签跳转功能互不冲突

### Out of Scope

- 不修改 TagsPage / TagFilterPage / SearchPage 现有逻辑
- 不新增服务端排序选项（保持按保存时间倒序）
- 不涉及飞书多维表格的 Schema 变更

## Impact

| 领域 | 影响 |
|------|------|
| 前端 | HomePage.tsx 重构（~+150 行），新增 HomeFilterSheet.tsx（~+200 行） |
| 后端 API | `GET /bookmarks` 新增可选 `source` 参数，向后兼容 |
| 后端搜索 | `searchFeishuRecords()` 增加 `source` 过滤维度 |
| 用户体验 | 首页可直接多维度筛选，降低跳转频率 |
| 性能 | 标签/来源/时间组合筛选 = 客户端过滤（已有模式），数据量大时注意 MAX_PAGES |

## Capabilities

- **C1**: 用户在首页点击筛选按钮 → 底部弹出筛选面板
- **C2**: 面板包含标签多选列表（从 `listTags()` 获取）
- **C3**: 面板包含来源选择（Web / GitHub / Bilibili / 笔记 等）
- **C4**: 面板包含时间范围选择（今天 / 昨天 / 近7天 / 近30天 / 自定义）
- **C5**: 选中筛选条件后自动重新加载数据并关闭面板
- **C6**: 筛选条件反映在 URL 参数中（如 `?tag=AI,React&source=github&range=7d`）
- **C7**: 首页显示当前激活的筛选条件标签（可逐个移除）
- **C8**: 筛选状态与页面缓存（pageCache）协同，切换页面后返回仍保留筛选