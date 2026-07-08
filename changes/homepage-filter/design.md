# Design: 首页多维度筛选

## Context

**当前状态**:
- 首页（HomePage.tsx）从 `api.listBookmarks()` 获取全部书签，按时间线分组展示
- 标签筛选通过跳转 `/tags/:tagName` 独立页面实现，不支持多选
- 后端搜索在 `searchFeishuRecords()` 中做客户端过滤（遍历最多 5 页 x 500 条）
- 页面数据通过 pageCache 做简单缓存（单键 `home`）
- 无来源筛选能力，无时间范围筛选能力

**约束**:
- 飞书多维表格 `listRecords` API 支持 `filter` 参数（公式语法），可实现服务端过滤
- 多选字段（如"标签"）的公式过滤有语法限制，仍需客户端处理
- Worker 端单次执行最多 30 秒（Cloudflare Workers free plan）
- 飞书表格无专门的"来源"字段选项枚举，来源来自 OG 元数据提取的自由文本

**Stakeholders**: 前端用户（减少跳转，快捷筛选）

## Goals

1. **零页面跳转**：筛选操作完全在首页完成
2. **多维度组合**：标签 + 来源 + 时间范围可同时生效（AND 逻辑）
3. **状态持久化**：筛选条件反映在 URL 中，支持分享和浏览器回退
4. **向后兼容**：现有 API 消费者不受影响

## Decisions

### D1: 筛选面板采用 Bottom Sheet 而非内联展开

| 项 | 内容 |
|---|---|
| **Choice** | 底部弹出式面板 (Bottom Sheet) |
| **Rationale** | 全维度筛选需要较多 UI 空间（标签列表 + 来源 + 时间范围 + 自定义日期），内联展开会严重挤压首页内容区。Bottom Sheet 是移动端多选筛选的成熟模式，用户体验一致。 |
| **Alternatives** | 内联 Chip 行展开（空间不足，标签多时难用）；Modal 居中弹窗（视觉上不如底部自然）；Dropup（不适合多维度） |

### D2: 筛选执行位置 — 前端重新调用 API

| 项 | 内容 |
|---|---|
| **Choice** | 每次筛选条件变化时前端调用 `api.listBookmarks()`（传递 tag/source/range）重新拉取数据 |
| **Rationale** | 与现有搜索/标签页模式一致；无需在前端维护全部数据副本；缓存由 pageCache 按筛选组合键管理 |
| **Alternatives** | 前端一次性加载全部数据后本地过滤（适合数据量小<200条，但用户数据量可能大）；WebSocket 实时过滤（过度设计） |

### D3: 过滤执行策略 — Feishu 服务端过滤 + 标签客户端过滤

| 项 | 内容 |
|---|---|
| **Choice** | 混合策略：来源和时间范围使用 Feishu `filter` 公式做服务端过滤；标签保持客户端过滤 |
| **Rationale** | 时间范围和来源可以使用 Feishu 公式（`FIND`, `AND`, `>=` 等运算符），大幅减少数据传输量，消除分页上限问题。标签字段为多选类型，Feishu 公式对数组的过滤能力有限，保持现有客户端过滤方式。组合使用时先服务端过滤（时间+来源）再客户端过滤（标签+关键词）。 |
| **Alternatives** | 全量拉取后客户端过滤（现有模式，受分页上限限制）；全部服务端过滤（多选字段不支持） |

### D3a: 无过滤时保持分页

| 项 | 内容 |
|---|---|
| **Choice** | 当无任何筛选条件时，保持现有 `listFeishuRecords()` 分页模式（使用 Feishu 排序 + 游标分页） |
| **Rationale** | 首页默认展示不需要过滤，分页模式性能最优。`loadMore` 按钮模式保持不变。 |
| **Alternatives** | 无」

### D4: URL 状态同步使用 `useSearchParams` 而非手动 pushState

| 项 | 内容 |
|---|---|
| **Choice** | React Router 的 `useSearchParams`（基于 `searchParams` API） |
| **Rationale** | React Router 7 原生支持；与页面路由状态自然集成；浏览器前进/后退自动触发；无需手动管理 popstate 事件 |
| **Alternatives** | `useState` + 手动 `window.history.pushState`（重复造轮子，容易遗漏边界情况） |

### D5: 来源识别规则

| 项 | 内容 |
|---|---|
| **Choice** | 基于 `Bookmark.source` 字段做不区分大小写的子串匹配 |
| **Rationale** | 来源为自由文本（非枚举），"github.com" 或 "GitHub" 都可能存在。子串匹配比精确匹配更宽容。匹配规则：Web（空来源或非特殊来源）、GitHub（含 "github"）、Bilibili（含 "bilibili"）、微信（含 "weixin" 或 "mp.weixin"）、笔记（无 URL） |
| **Alternatives** | 精确匹配（过于严格，容易漏）；AI 来源分类（过度设计，延迟高） |

## Risks And Trade-Offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Feishu filter 公式语法限制导致过滤不准确 | 部分记录未被正确过滤 | 实施时充分测试 `FIND`、`AND`、日期比较等公式；标签仍用客户端过滤兜底 |
| 多维度组合过滤 + 标签客户端过滤数据量大 | Worker 响应慢 | 时间+来源已在飞书层面减少数据量，标签过滤在已缩减的数据集上做，大幅降低压力 |
| 来源子串匹配可能误判 | 分类不准确 | 接受约 95% 准确率，不增加复杂度 |
| URL 参数过多导致 URL 长度超限 | 标签选 20+ 个可能超 2048 字符 | 标签数量上限已在后端限制为 20，URL 安全 |
| 筛选缓存键过多 | localStorage 膨胀 | pageCache 使用 LRU 策略（已有）；设置最大缓存条目上限 |
| Bottom Sheet 在桌面端大屏幕体验不佳 | 全屏宽度下面板过宽 | 桌面端限制面板最大宽度（如 max-w-md），居中显示