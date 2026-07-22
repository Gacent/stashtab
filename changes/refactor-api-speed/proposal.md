# Proposal: refactor-api-speed

## Why

`/api/fetch-meta` 和 `/api/ai-extract` 是两个核心接口，直接影响用户粘贴链接后的等待时间。当前存在以下问题：

- **fetch-meta 响应慢**：4个UA顺序尝试，每个8s超时，最坏情况32s才返回结果
- **fetch-meta 失败率高**：反爬严格的站点（如 Cloudflare 防护的网站）直接失败，依赖 Browser Run 兜底（免费版每天仅10分钟）
- **fetch-meta 无缓存**：同一个URL每次都重新抓取完整的HTML页面（几百KB），但只需要 `<head>` 中的OG标签（2-5KB）
- **ai-extract 无超时控制**：SenseNova API 调用可能长时间挂起
- **ai-extract 无重试**：失败后直接返回 fallback，没有重试机制
- **ai-extract 无缓存**：相同内容反复调用 AI，浪费 token 和等待时间

## What Changes

### fetch-meta 重构

1. **通用方案，不区分URL类型**：统一用 Twitterbot UA + HTMLRewriter 流式解析，不再对 GitHub/Bilibili 做特殊处理
2. **并行UA抓取**：`Promise.allSettled` 并行发起4个UA请求，5s超时，最快 + 最优质响应优先
3. **质量评分排序**：不取最快响应，等所有响应回来（或超时）后，按 OG 标签完整性、内容长度等评分选最优
4. **HTMLRewriter 流式解析**：使用 CF Workers 内置的 HTMLRewriter 流式读取HTML，只提取 `<head>` 中的OG标签，不下载完整页面
5. **KV缓存**：首次抓取结果缓存到 KV，24h TTL，同URL第二次请求直接 ~30ms 返回
6. **Microlink 第三方兜底**：免费25次/天，处理反爬严格的站点，放在 Browser Run 之前

### ai-extract 重构

1. **输入裁剪**：从当前 1500 字缩减到 500 字（只保留关键信息，减少推理时间）
2. **简化 prompt**：主请求只提取 title + tags，去掉 summary 和 type（减少输出 token）
3. **60s 超时**：SenseNova API 调用设 60s AbortController 超时
4. **自动重试**：失败后自动重试1次，重试时使用更短的 prompt（只问 tags）
5. **KV缓存**：相同内容（content hash）24h内不再调 AI

### 前端体验优化

1. **分步展示**：fetch-meta 返回后立即显示预览（标题、封面、描述），不等 ai-extract
2. **AI 分析状态**：预览中显示 "AI 分析中..." 提示，让用户知道有后台处理
3. **异步更新**：ai-extract 完成后自动填充 AI 标题、摘要、标签

## Scope

### In Scope
- `worker/src/handlers/fetch-meta.ts` — 重构 OG 元数据获取逻辑（通用方案，去掉特殊处理）
- `worker/src/handlers/ai-extract.ts` — 重构 AI 提取逻辑（输入裁剪、简化 prompt）
- `worker/src/sensenova.ts` — 添加超时和重试
- `worker/src/types.ts` — 添加 KV namespace 类型绑定
- `worker/wrangler.toml` — 添加 KV namespace 配置
- `frontend/src/components/BookmarkForm.tsx` — 分步展示 + AI 分析状态提示

### Out of Scope
- 不引入新的 npm 依赖
- 不改变 API 返回格式（保持兼容）
- 不修改飞书数据存储逻辑
- 不修改其他前端页面

## Impact

- **fetch-meta 缓存命中**：响应时间从 2-32s 降至 ~30ms
- **fetch-meta 直接抓取**：最坏情况从 32s 降至 ~5s
- **fetch-meta 反爬站点**：从高失败率变为 Microlink 兜底
- **ai-extract**：增加超时/重试/缓存，提升稳定性
- **Browser Run 消耗**：大幅减少，仅作为最后手段

## Capabilities

- 用户粘贴链接后等待时间大幅缩短
- 收藏成功率提升（反爬站点有兜底）
- 重复收藏同一链接几乎即时响应