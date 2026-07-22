# Design: refactor-api-speed

## Context

### Current State

- `fetch-meta.ts`（452行）：顺序尝试4个UA → 每个8s超时 → Browser Run → 兜底。代码量大，含 GitHub/Bilibili/Toutiao/WeChat 等特殊处理
- `ai-extract.ts`（71行）：直接调 SenseNova API → 无超时 → 无重试 → 失败返回 fallback
- `sensenova.ts`（75行）：简单 fetch 封装，无超时无重试
- `BookmarkForm.tsx`：单一 loading 状态，用户必须等 fetch-meta + ai-extract 都完成才能看到预览

### Constraints

- Cloudflare Workers 环境，不能使用 Node.js 原生模块
- 不引入新的 npm 依赖
- API 返回格式保持不变（前端兼容）
- KV 需在 wrangler.toml 中配置绑定
- SensNova API 需要 60s 超时（模型推理时间不确定）

### Stakeholders

- 用户：粘贴链接后等待时间，直接感知
- 开发者：代码可维护性，去掉特殊处理的通用方案

## Goals

1. fetch-meta 最坏响应时间从 32s 降至 5s
2. 反爬站点（Zhihu 等）有可靠兜底方案
3. 重复 URL 请求从缓存返回（~30ms）
4. ai-extract 有超时和重试机制
5. 前端预览即时展示，AI 结果异步更新
6. 代码量减少，去掉平台特殊处理

## Decisions

### D-1: Promise.allSettled + 质量评分排序

**Choice**: 用 `Promise.allSettled` 并行发起 4 个 UA 请求，全部完成后按质量评分选最优

**Rationale**:
- `Promise.race()` 取最快响应可能拿到反爬空页面
- 顺序尝试最坏 32s，不可接受
- 并行 + 评分 = 最快速度 + 最可靠内容

**Scoring formula**:
```
score = 0
if has("og:title")    → +3
if has("og:description") → +2
if length > 2000      → +1
if no captcha signals → +1
```

**Alternatives considered**:
- `Promise.race()`：最快响应但可能为空 → 已排除
- 顺序尝试：当前方案，太慢 → 已排除
- 只用一个 UA：失败率高 → 已排除

### D-2: HTMLRewriter 流式解析

**Choice**: 使用 CF Workers 内置 HTMLRewriter 流式解析 `<head>`，提取到 `</head>` 后停止

**Rationale**:
- 不下载完整 HTML（典型页面 200-400KB，OG 标签在 `<head>` 中 2-5KB）
- 零拷贝流式解析，无内存缓冲
- 内置 API，无需额外依赖
- 比正则更健壮

**Alternatives considered**:
- 正则解析：当前方案，脆弱，错位匹配风险 → 已排除
- 安装 `cheerio` 或 `linkpeek`：需引入依赖 → 用户要求不引入新依赖，已排除

### D-3: KV 缓存分层

**Choice**: 使用 Workers KV 缓存 fetch-meta 和 ai-extract 结果

**Rationale**:
- 同一个 URL 24h 内再次访问直接返回，无需网络请求
- 同一个内容 24h 内再次 AI 提取，省 token 省时间
- KV 是 CF Workers 原生服务，无需额外配置

**Cache keys**:
- fetch-meta: `og:${url}` → 24h TTL
- ai-extract: `ai:${sha1(content)}` → 24h TTL

**Alternatives considered**:
- Cache API：每个 CF 数据中心独立缓存，不全局共享 → 已排除
- 不缓存：每次都重新抓取 → 当前方案，排除

### D-4: Microlink 作为抓取兜底

**Choice**: 并行 UA 全部失败后，调用 Microlink API 兜底

**Rationale**:
- 免费 25 次/天，足够兜底场景
- 测试验证对 Zhihu 等反爬站点有效
- 放在 Browser Run 之前，减少 Browser Run 消耗

**Alternatives considered**:
- Browser Run：10 分钟/天免费额度，太贵 → 已排除
- 跳过兜底直接返回 fallback：用户收藏成功率降低 → 已排除

### D-5: 移除特殊平台处理

**Choice**: 移除 `tryGithubApi()`、`tryBilibiliApi()`、`tryBrowserRender()` 等所有平台特殊处理

**Rationale**:
- 测试验证 Twitterbot UA 对 GitHub 和 Bilibili 都能获取 OG 标签
- 通用方案代码更少、更易维护
- 移除 `@cloudflare/puppeteer` 依赖

**Alternatives considered**:
- 保留特殊处理：代码复杂，维护成本高，新增平台需继续加特殊分支 → 已排除

### D-6: ai-extract 输入裁剪 + 简化 prompt

**Choice**: 输入裁剪到 500 字，prompt 只问 title + tags，失败重试时只问 tags

**Rationale**:
- 输入越小推理越快：1500 字 → 500 字，减少 2/3 输入 token
- 输出越少推理越快：去掉 summary 和 type，减少输出 token
- 重试时只问 tags：进一步缩小范围，提高成功率

**Alternatives considered**:
- 保持 1500 字完整 prompt：推理时间长，失败率高 → 已排除
- 异步队列处理：架构复杂，CF Workers 不支持持久化队列 → 已排除

### D-7: 前端分步展示

**Choice**: fetch-meta 返回后立即展示预览，ai-extract 异步更新

**Rationale**:
- 用户粘贴链接后第一优先级是看到预览
- AI 标题/标签是增强信息，不是必需信息
- 分步展示让用户感知到"已有结果，AI 在后台处理中"

**State flow**:
```
粘贴 URL → setLoading(true)
  → fetchMeta() 完成 → setLoading(false) → 展示预览
  → aiExtract() 开始 → setAiLoading(true) → 显示 "AI 分析中..."
  → aiExtract() 完成 → setAiLoading(false) → 更新 title/tags/summary
  → aiExtract() 失败 → setAiLoading(false) → 保持原始标题
```

## Risks And Trade-Offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Microlink 免费额度 25 次/天可能不够 | 兜底失败 | 只用于并行 UA 全部失败的场景，正常 URL 不走 Microlink |
| 并行 4 个 UA 请求可能被目标站点限流 | 4 个请求全失败 | 5s 短超时，失败后走 Microlink |
| 移除 Browser Run 后 JS 渲染页面无法获取内容 | 部分 SPA 站点元数据为空 | 这些站点本来也没多少，Microlink 可处理部分 |
| KV 缓存与数据一致性 | 24h 内 URL 内容更新了但缓存未更新 | 24h TTL 可接受，收藏工具不需要实时最新 |
| AI 裁剪 500 字可能丢失关键信息 | 标题提取不准确 | 500 字通常包含标题和首段，足够 AI 理解内容 |
| 前端分步展示可能导致 UI 闪烁 | 用户体验下降 | 使用过渡动画，AI 更新时平滑替换而非闪烁 |