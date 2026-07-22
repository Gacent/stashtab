# fetch-meta Spec

## ADDED Requirements

### R-FM-1: 并行UA抓取

fetch-meta SHALL 使用 `Promise.allSettled` 并行发起至少 4 个不同 User-Agent 的 HTTP 请求。

#### Scenario: 并行请求
GIVEN 一个可访问的 URL
WHEN 发起 fetch-meta 请求
THEN 同时发起 4 个不同 UA 的请求（Googlebot / Bingbot / Baiduspider / Twitterbot）
AND 每个请求独立超时时间为 5s

### R-FM-2: 质量评分排序

fetch-meta SHALL 在并行请求完成后，按质量评分选择最优响应。

#### Scenario: 质量评分
WHEN 多个 UA 请求都返回 HTML
THEN 按以下优先级评分：
- 包含 `og:title` 标签（+3 分）
- 包含 `og:description` 标签（+2 分）
- 页面内容长度 > 2000 字节（+1 分）
- 不包含反爬关键词（captcha/安全验证等）（+1 分）
AND 选择评分最高的响应

#### Scenario: 部分成功
WHEN 部分 UA 请求成功，部分失败
THEN 只在成功响应中评分排序
AND 不因部分失败而整体报错

### R-FM-3: HTMLRewriter 流式解析

fetch-meta SHALL 使用 Cloudflare Workers 内置的 HTMLRewriter 流式解析 HTML，不下载完整页面。

#### Scenario: 流式提取
WHEN 收到 HTML 响应
THEN 使用 HTMLRewriter 流式读取 `<head>` 部分
AND 提取 `og:title`、`og:description`、`og:image`、`twitter:title`、`twitter:description`、`twitter:image`
AND 提取 `<title>` 标签内容作为兜底
AND 提取 `<meta name="description">` 作为兜底
AND 在读取完 `</head>` 后停止解析

### R-FM-4: KV 缓存

fetch-meta SHALL 将成功获取的元数据缓存到 KV，24h TTL。

#### Scenario: 缓存命中
GIVEN 一个 URL 在 24h 内已被成功抓取过
WHEN 发起 fetch-meta 请求
THEN 直接从 KV 返回缓存结果
AND 响应时间 < 100ms

#### Scenario: 缓存未命中
GIVEN 一个 URL 从未被抓取过，或缓存已过期
WHEN 发起 fetch-meta 请求
THEN 按正常流程执行（并行UA → 质量评分 → 解析）
AND 成功后写入 KV 缓存（24h TTL）

### R-FM-5: Microlink 兜底

当直接抓取全部失败时，fetch-meta SHALL 尝试 Microlink API 兜底。

#### Scenario: 直接抓取失败
GIVEN 一个 URL（如 Zhihu）
WHEN 所有并行 UA 请求都失败（返回空/反爬/超时）
THEN 调用 `https://api.microlink.io/?url={encodedUrl}`
AND 解析返回结果中的 title、description、image.url
AND 返回解析结果

#### Scenario: Microlink 也失败
WHEN Microlink API 也返回失败
THEN 返回兜底结果（hostname 作为标题）

### R-FM-6: 无特殊 URL 处理

fetch-meta SHALL 不针对任何特定平台（GitHub/Bilibili/等）写特殊处理逻辑。

#### Scenario: 统一处理
GIVEN 任何 http/https URL
WHEN 发起 fetch-meta 请求
THEN 使用完全相同的处理流程（并行UA → 质量评分 → HTMLRewriter → Microlink）
AND 不检查 hostname 或路径模式

## MODIFIED Requirements

### R-FM-7: 移除 Browser Run 依赖

fetch-meta SHALL 不再使用 `@cloudflare/puppeteer` 进行 Browser Run 渲染。

#### Scenario: 移除 Browser Run
WHEN 所有抓取方式（并行UA + Microlink）都失败
THEN 直接返回兜底结果
AND 不再尝试启动 Browser Run

## REMOVED Requirements

- 移除 `tryGithubApi()` 函数
- 移除 `tryBilibiliApi()` 函数
- 移除 `tryBrowserRender()` 函数
- 移除 `@cloudflare/puppeteer` 依赖