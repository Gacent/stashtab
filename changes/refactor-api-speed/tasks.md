# Tasks: refactor-api-speed

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `worker/wrangler.toml` | Modify | 添加 KV namespace 绑定 |
| `worker/src/types.ts` | Modify | 添加 OG_CACHE 和 AI_CACHE 类型定义 |
| `worker/src/sensenova.ts` | Modify | 添加超时和重试机制 |
| `worker/src/handlers/fetch-meta.ts` | Rewrite | 通用 OG 元数据获取（并行UA + HTMLRewriter + KV + Microlink） |
| `worker/src/handlers/ai-extract.ts` | Modify | 输入裁剪 + 简化prompt + 超时重试 + KV缓存 |
| `frontend/src/components/BookmarkForm.tsx` | Modify | 分步展示 + AI 分析状态 |

## Interfaces

### Batch 1 → Batch 3
```
Consumes: 无
Produces: wrangler.toml 中 [[kv_namespaces]] 配置
          types.ts 中 OG_CACHE: KVNamespace 类型
```

### Batch 2 → Batch 4
```
Consumes: sensenova.ts 的 callSenseNova() 函数
Produces: callSenseNova() 带超时和重试
```

### Batch 3 → Batch 5
```
Consumes: fetch-meta handler 返回格式不变
Produces: 不变的 API 响应格式
```

### Batch 4 → Batch 5
```
Consumes: ai-extract handler 返回格式不变
Produces: 不变的 API 响应格式（title + tags + _fallback）
```

---

## Batch 1: 基础设施配置

### Task 1.1: wrangler.toml 添加 KV 绑定

**File**: `worker/wrangler.toml`

Steps:
1. Read current wrangler.toml
2. 添加 `[[kv_namespaces]]` 配置，binding 名为 `OG_CACHE` 和 `AI_CACHE`
3. Validate toml 格式

```
Depends on: 无
```

### Task 1.2: types.ts 添加 KV 类型

**File**: `worker/src/types.ts`

Steps:
1. Read current types.ts
2. 在 Env 接口中添加 `OG_CACHE: KVNamespace` 和 `AI_CACHE: KVNamespace`

```
Depends on: 1.1
```

---

## Batch 2: sensenova.ts 超时 + 重试

### Task 2.1: 添加超时控制

**File**: `worker/src/sensenova.ts`

Steps:
1. Read current sensenova.ts
2. 给 fetch 调用添加 `AbortController`，超时时间 60000ms
3. 超时时抛出明确错误（`SenseNova timeout after 60s`）

```
Depends on: 无
```

### Task 2.2: 添加自动重试

**File**: `worker/src/sensenova.ts`

Steps:
1. 在 `callSenseNova` 内部添加重试循环
2. 首次失败后等待 1s 重试
3. 最多重试 1 次
4. 只有网络错误/超时/非 200 才重试，JSON 解析错误不重试

```
Depends on: 2.1
```

---

## Batch 3: fetch-meta.ts 完全重写

### Task 3.1: 重写 fetch-meta 主流程

**File**: `worker/src/handlers/fetch-meta.ts`

Steps:
1. Read current fetch-meta.ts
2. 删除所有特殊处理函数：`tryGithubApi`、`tryBilibiliApi`、`tryBrowserRender`
3. 删除 `import puppeteer from "@cloudflare/puppeteer"`
4. 保留 `validateUrl`、`cleanUrl`、`fallback`、`decode`、`makeReadableTitle`、`extractContent`
5. 主流程改为：
   a. 检查 KV 缓存（`OG_CACHE.get(cacheKey)`）→ 命中直接返回
   b. 并行发起 4 个 UA 请求（`Promise.allSettled`）
   c. 质量评分排序选最优
   d. HTMLRewriter 流式解析 HTML
   e. 成功 → 写入 KV 缓存 → 返回
   f. 失败 → 尝试 Microlink API
   g. 全部失败 → 返回兜底

```
Depends on: 1.2, 3.2, 3.3
```

### Task 3.2: 实现并行 UA 抓取 + 质量评分

**File**: `worker/src/handlers/fetch-meta.ts`

Steps:
1. 实现 `tryFetchParallel(url)`: 用 `Promise.allSettled` 发起 4 个 fetch
2. UAs: `Twitterbot/1.0`, `Googlebot/2.1`, `Bingbot/2.0`, `Baiduspider/2.0`
3. 每个请求 5s 超时（`AbortController`）
4. 实现 `qualityScore(html)`: 按 OG 标签完整性 + 内容长度 + 反爬检测评分
5. 返回评分最高的 HTML

```
Depends on: 无
```

### Task 3.3: 实现 HTMLRewriter 流式解析

**File**: `worker/src/handlers/fetch-meta.ts`

Steps:
1. 实现 `extractMetaStreaming(html)`: 使用 HTMLRewriter 提取
   - `meta[property="og:title"]` → content
   - `meta[property="og:description"]` → content
   - `meta[property="og:image"]` → content
   - `meta[name="description"]` → content
   - `title` → text content
2. 返回 `{ title, description, image }`

```
Depends on: 无
```

### Task 3.4: 实现 Microlink 兜底

**File**: `worker/src/handlers/fetch-meta.ts`

Steps:
1. 实现 `tryMicrolink(url)`: fetch `https://api.microlink.io/?url={encodedUrl}`
2. 解析返回的 `data.title`、`data.description`、`data.image.url`
3. 超时 5s

```
Depends on: 无
```

---

## Batch 4: ai-extract.ts 重构

### Task 4.1: 输入裁剪 + 简化 prompt

**File**: `worker/src/handlers/ai-extract.ts`

Steps:
1. Read current ai-extract.ts
2. 将输入裁剪从 1500 字改为 500 字
3. 简化 prompt 只要求 title + tags，去掉 summary 和 type
4. 移除 `NOTE_EXTRACT_PROMPT` 相关逻辑（笔记不做 AI 提取）

```
Depends on: 2.2
```

### Task 4.2: 添加超时 + 重试 + KV 缓存

**File**: `worker/src/handlers/ai-extract.ts`

Steps:
1. 主流程改为：
   a. 检查 KV 缓存（`AI_CACHE.get(cacheKey)`）→ 命中直接返回
   b. 调用 `callSenseNova`（已内置超时和重试）
   c. 成功 → 写入 KV 缓存 → 返回
   d. 失败 → 重试时用更短 prompt（只问 tags）
   e. 全部失败 → 返回 fallback
2. 缓存键：`ai:${sha1(content)}`

```
Depends on: 4.1
```

---

## Batch 5: 前端分步展示

### Task 5.1: 分离加载状态 + 分步展示

**File**: `frontend/src/components/BookmarkForm.tsx`

Steps:
1. Read current BookmarkForm.tsx
2. 将单一 `loading` 拆分为 `loading`（fetch-meta）和 `aiLoading`（ai-extract）
3. handlePaste 改为：
   a. `setLoading(true)` → fetchMeta → `setLoading(false)` → 立即展示预览
   b. 同时触发 aiExtract → `setAiLoading(true)` → 完成后 `setAiLoading(false)` → 更新预览
4. 预览中显示 "AI 分析中..." 状态（`aiLoading && <span>AI 分析中...</span>`）
5. aiExtract 失败时保持原始标题，不阻塞用户操作

```
Depends on: 3.1, 4.2
```