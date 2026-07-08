# Execution Contract: homepage-filter

> Generated: 2026-07-08 | State: specifying → bridging

---

## Intent Lock

在首页增加底部弹出筛选面板（Bottom Sheet），支持**标签多选 / 来源筛选 / 时间范围**三维度组合筛选，无需跳转独立页面。筛选条件同步到 URL query params，支持分享和浏览器回退。

## Scope Fence

### In Scope
- HomePage 筛选按钮 + 底部弹出面板 UI
- 标签多选（复用 `api.listTags()`）
- 来源单选（子串匹配规则：github / bilibili / weixin / web / note）
- 时间范围预设（今天/昨天/近7天/近30天/自定义）
- URL 参数同步（`useSearchParams`）
- 激活筛选条件 chip 显示（可逐个移除）
- 筛选缓存独立（不同筛选组合不同缓存键）
- 后端 `GET /bookmarks` 新增 `source` 参数
- Feishu 服务端过滤（来源+时间用 filter 公式，标签+关键词客户端过滤）

### Out of Scope
- TagsPage / TagFilterPage / SearchPage 不修改
- 服务端排序选项不变
- 飞书多维表格 Schema 不变

## Approved Behavior

| ID | Requirement | Source | Batch | Test Obligation |
|----|-------------|--------|-------|-----------------|
| R-FS-1 | 筛选按钮 + 激活高亮 | filter-sheet.md | 4 | 点击弹出面板 |
| R-FS-2 | Bottom Sheet 遮罩/动画/关闭 | filter-sheet.md | 3 | 打开/关闭面板 |
| R-FS-3 | 标签多选 | filter-sheet.md | 3 | 多选切换 |
| R-FS-4 | 来源单选 | filter-sheet.md | 3 | 选择来源 |
| R-FS-5 | 时间范围预设+自定义 | filter-sheet.md | 3 | 选择时间范围、自定义日期 |
| R-FS-6 | 应用/重置按钮 | filter-sheet.md | 3 | 应用触发刷新，重置清空 |
| R-FS-7 | URL 参数同步 | filter-state.md | 4 | URL query ↔ 筛选状态双向同步 |
| R-FS-8 | 激活筛选 chip 显示 | filter-state.md | 4 | chip 显示/逐个移除 |
| R-FS-9 | 缓存协同 | filter-state.md | 4 | 不同筛选不同缓存键 |
| R-BE-1 | GET /bookmarks 支持 source | backend-api.md | 1 | source 参数过滤 |
| R-BE-2 | listFeishuRecords() filter 参数 | backend-api.md | 1 | filter 透传飞书 API |
| R-BE-3 | searchFeishuRecords() 混合过滤 | backend-api.md | 1 | 时间+来源服务端，标签+关键词客户端 |

## Architecture Constraints

- **来源识别规则**: 子串匹配（不区分大小写）。Web=空或非特殊；GitHub=含"github"；Bilibili=含"bilibili"；微信=含"weixin"/"mp.weixin"；笔记=无 URL
- **Feishu 过滤语法**: `FIND("xxx", {来源}) > 0`（来源）；`{保存时间} >= timestamp && {保存时间} <= timestamp`（时间范围）；多条件 `&&` 组合
- **无筛选时**: 保持现有分页模式（listFeishuRecords + 游标分页）
- **标签+关键词**: 始终使用客户端过滤（Feishu 服务端无法处理多选字段复杂过滤）
- **URL 同步**: `useSearchParams`（React Router 7）
- **面板 UI**: Bottom Sheet，桌面端 max-w-md 居中
- **pageCache 缓存键**: `home_filter_<tags>_<source>_<range>`

## Execution Batches

### Batch 1: 后端 API 扩展
| # | Task | File | Depends |
|---|------|------|---------|
| 1.1 | `listFeishuRecords()` 新增 `filter` 参数 | `worker/src/feishu.ts` | — |
| 1.2 | `searchFeishuRecords()` 重构混合过滤 | `worker/src/feishu.ts` | 1.1 |
| 1.3 | `GET /bookmarks` 新增 source/时间参数 | `worker/src/handlers/bookmarks.ts` | 1.2 |

### Batch 2: 前端 API 扩展
| # | Task | File | Depends |
|---|------|------|---------|
| 2.1 | 新增 `BookmarkFilter` 类型 | `frontend/src/types.ts` | — |
| 2.2 | `listBookmarks()` 新增 source/时间参数 | `frontend/src/api.ts` | 2.1 |

### Batch 3: HomeFilterSheet 组件
| # | Task | File | Depends |
|---|------|------|---------|
| 3.1 | 组件骨架（遮罩+动画+Props） | `frontend/src/components/HomeFilterSheet.tsx` | — |
| 3.2 | 标签多选区域 | `frontend/src/components/HomeFilterSheet.tsx` | 3.1 |
| 3.3 | 来源选择区域 | `frontend/src/components/HomeFilterSheet.tsx` | 3.1 |
| 3.4 | 时间范围选择区域 | `frontend/src/components/HomeFilterSheet.tsx` | 3.1 |
| 3.5 | 底部操作栏（应用/重置） | `frontend/src/components/HomeFilterSheet.tsx` | 3.2+3.3+3.4 |

### Batch 4: HomePage 集成
| # | Task | File | Depends |
|---|------|------|---------|
| 4.1 | 筛选状态管理 + useSearchParams | `frontend/src/pages/HomePage.tsx` | — |
| 4.2 | 集成 HomeFilterSheet | `frontend/src/pages/HomePage.tsx` | 3.5+4.1 |
| 4.3 | 激活筛选条件 chip | `frontend/src/pages/HomePage.tsx` | 4.1 |
| 4.4 | 数据加载逻辑调整 | `frontend/src/pages/HomePage.tsx` | 4.1 |
| 4.5 | 缓存适配 | `frontend/src/pages/HomePage.tsx` | 4.4 |

## Review Gates

- **Batch 1 完成 → 手动 review**: 后端 API 变更（Feishu filter 语法、混合过滤逻辑）
- **Batch 3 完成 → code-reviewer**: 组件结构和 UI 逻辑
- **Batch 4 完成 → 完整 review**: 全功能验证 + code-reviewer

## Build Rules

- 无 `as any` / `@ts-ignore` / `@ts-expect-error`
- 每个 Task 遵循 TDD 模式（Read → Modify/Implement → Verify → Lint）
- 每个 Batch 完成后运行 `lsp_diagnostics` 检查
- `worker/` 变更后运行 `npm run typecheck`
- 不修改未在任务中列出的文件

## Escalation Rules

1. **Feishu filter 语法不兼容** → 回退到客户端过滤（全部拉取 + MAX_PAGES=10）
2. **来源识别误判严重** → 调整子串匹配规则，增加映射表
3. **useSearchParams 与 pageCache 冲突** → 以 URL 参数为唯一数据源
4. **自定义时间范围组件复杂度过高** → 简化为基础 date input
5. **测试/工件不匹配**: 如果验证发现需求偏离，停止执行并回退到规划阶段（specifying）

---

## DP-3: 契约批准

请确认以上执行契约。批准后我将按 Batch 顺序开始实现（每批次完成后 review gate）。