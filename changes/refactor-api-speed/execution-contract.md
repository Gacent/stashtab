# Execution Contract: refactor-api-speed

> Generated: 2026-07-22 | State: specifying → bridging

---

## Intent Lock

重构 `/api/fetch-meta` 和 `/api/ai-extract` 接口，提升响应速度和稳定性。fetch-meta 改为通用方案（并行UA + 质量评分 + HTMLRewriter流式解析 + KV缓存 + Microlink兜底，移除所有特殊平台处理）。ai-extract 增加输入裁剪、简化 prompt、60s超时、自动重试、KV缓存。前端分步展示预览 + AI 分析状态。

## Scope Fence

### In Scope
- `worker/wrangler.toml` — 添加 KV namespace 绑定
- `worker/src/types.ts` — 添加 KV 类型
- `worker/src/sensenova.ts` — 添加超时和重试
- `worker/src/handlers/fetch-meta.ts` — 完全重写（通用方案）
- `worker/src/handlers/ai-extract.ts` — 重构（输入裁剪、简化prompt、超时重试、缓存）
- `frontend/src/components/BookmarkForm.tsx` — 分步展示 + AI 分析状态

### Out of Scope
- 不引入新的 npm 依赖
- 不改变 API 返回格式（保持兼容）
- 不修改飞书数据存储逻辑
- 不修改其他前端页面
- 不修改 `worker/src/handlers/bookmarks.ts`
- 不修改 `worker/src/feishu.ts`

## Approved Behavior

| ID | Requirement | Source | Batch | Test Obligation |
|----|-------------|--------|-------|-----------------|
| R-FM-1 | 并行UA抓取（Promise.allSettled，4个UA，5s超时） | fetch-meta.md | 3 | 4个请求同时发起 |
| R-FM-2 | 质量评分排序（OG标签+内容长度+反爬检测） | fetch-meta.md | 3 | 评分最优的响应被选中 |
| R-FM-3 | HTMLRewriter 流式解析（只读 `<head>`） | fetch-meta.md | 3 | 提取 og:title/description/image |
| R-FM-4 | KV 缓存（24h TTL，缓存命中 < 100ms） | fetch-meta.md | 3 | 同URL二次请求从缓存返回 |
| R-FM-5 | Microlink 兜底（并行UA全失败后调用） | fetch-meta.md | 3 | 反爬站点有兜底结果 |
| R-FM-6 | 无特殊 URL 处理（移除所有平台分支） | fetch-meta.md | 3 | 所有URL走相同流程 |
| R-FM-7 | 移除 Browser Run 依赖 | fetch-meta.md | 3 | 不再调用 @cloudflare/puppeteer |
| R-AE-1 | 输入裁剪到 500 字 | ai-extract.md | 4 | 超过500字的内容被裁剪 |
| R-AE-2 | 简化 prompt（只提取 title + tags） | ai-extract.md | 4 | AI 只返回两个字段 |
| R-AE-3 | 60s 超时控制 | ai-extract.md | 4 | 超时后中断并重试 |
| R-AE-4 | 自动重试 1 次（重试时用更短 prompt） | ai-extract.md | 4 | 失败后重试只问 tags |
| R-AE-5 | KV 缓存（content hash 缓存 AI 结果） | ai-extract.md | 4 | 相同内容从缓存返回 |
| R-FP-1 | 分步展示（fetch-meta 返回立即显示预览） | frontend-preview.md | 5 | 不等 ai-extract 就展示 |
| R-FP-2 | AI 分析状态（"AI 分析中..." 提示） | frontend-preview.md | 5 | AI 处理期间有状态提示 |
| R-FP-3 | 加载状态分离（loading + aiLoading） | frontend-preview.md | 5 | 两个状态互不影响 |

## Architecture Constraints

- **UA 列表**: Twitterbot/1.0, Googlebot/2.1, Bingbot/2.0, Baiduspider/2.0
- **质量评分公式**: `og:title`(+3) + `og:description`(+2) + length>2000(+1) + 无反爬(+1)
- **缓存键**: fetch-meta = `og:${url}`，ai-extract = `ai:${sha1(content)}`，TTL = 86400s
- **Microlink**: `https://api.microlink.io/?url={encodedUrl}`，5s 超时
- **AI prompt**: 主请求只问 title + tags，重试只问 tags
- **前端状态**: `loading` 控制 fetch-meta 阶段，`aiLoading` 控制 ai-extract 阶段
- **无 `as any` / `@ts-ignore` / `@ts-expect-error`**

## Execution Batches

### Batch 1: 基础设施配置
| # | Task | File | Depends |
|---|------|------|---------|
| 1.1 | wrangler.toml 添加 KV binding | `worker/wrangler.toml` | — |
| 1.2 | types.ts 添加 OG_CACHE / AI_CACHE 类型 | `worker/src/types.ts` | 1.1 |

### Batch 2: sensenova.ts 超时 + 重试
| # | Task | File | Depends |
|---|------|------|---------|
| 2.1 | 添加 AbortController 60s 超时 | `worker/src/sensenova.ts` | — |
| 2.2 | 添加自动重试（1次，1s间隔） | `worker/src/sensenova.ts` | 2.1 |

### Batch 3: fetch-meta 完全重写
| # | Task | File | Depends |
|---|------|------|---------|
| 3.1 | 并行UA抓取 + 质量评分排序 | `worker/src/handlers/fetch-meta.ts` | — |
| 3.2 | HTMLRewriter 流式解析 | `worker/src/handlers/fetch-meta.ts` | — |
| 3.3 | Microlink 兜底 | `worker/src/handlers/fetch-meta.ts` | — |
| 3.4 | 主流程重组（KV缓存 + 删除特殊处理） | `worker/src/handlers/fetch-meta.ts` | 3.1, 3.2, 3.3, 1.2 |

### Batch 4: ai-extract 重构
| # | Task | File | Depends |
|---|------|------|---------|
| 4.1 | 输入裁剪 + 简化 prompt | `worker/src/handlers/ai-extract.ts` | 2.2 |
| 4.2 | 超时 + 重试 + KV 缓存 | `worker/src/handlers/ai-extract.ts` | 4.1, 1.2 |

### Batch 5: 前端分步展示
| # | Task | File | Depends |
|---|------|------|---------|
| 5.1 | 分步展示 + AI 分析状态 + 加载状态分离 | `frontend/src/components/BookmarkForm.tsx` | 3.4, 4.2 |

## Review Gates

- **Batch 3 完成 → code-reviewer**: fetch-meta 完全重写，需 review 新架构
- **Batch 5 完成 → 完整 review**: 全功能验证 + code-reviewer

## Build Rules

- 无 `as any` / `@ts-ignore` / `@ts-expect-error`
- 每个 Task 遵循 TDD 模式（Read → Modify → Verify → Lint）
- 每个 Batch 完成后运行 `lsp_diagnostics` 检查
- `worker/` 变更后运行 `tsc --noEmit` 检查
- 不修改未在任务中列出的文件

## Escalation Rules

1. **Microlink API 不可用** → 跳过直接返回兜底（不影响主流程）
2. **HTMLRewriter 提取不到 OG 标签** → 回退到正则提取 `<title>` 作为兜底
3. **并行 UA 全部失败（网络问题）** → 直接走 Microlink 兜底
4. **AI 超时/失败** → 返回 fallback，前端展示原始标题
5. **KV 写入失败** → 不影响响应，只记录日志
6. **测试/工件不匹配**: 如果验证发现需求偏离，停止执行并回退到规划阶段（specifying）

---

## DP-3: 契约批准

请确认以上执行契约。批准后我将按 Batch 顺序开始实现（每批次完成后 review gate）。