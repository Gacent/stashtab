# ai-extract Spec

## ADDED Requirements

### R-AE-1: 输入裁剪

ai-extract SHALL 将输入内容裁剪到 500 字以内再发送给 AI 模型。

#### Scenario: 输入裁剪
GIVEN 一段超过 500 字的网页内容
WHEN 调用 ai-extract
THEN 只取前 500 字发送给 SenseNova API
AND 保留原文前 500 字的关键信息

### R-AE-2: 简化 Prompt

ai-extract SHALL 使用简化后的 prompt，主请求只提取 title + tags。

#### Scenario: 简化提取
WHEN 调用 SenseNova API
THEN prompt 只要求返回 title 和 tags 两个字段
AND 不再要求返回 summary 和 type
AND 返回格式为 `{"title": "...", "tags": ["..."]}`

### R-AE-3: 60s 超时

ai-extract SHALL 为 SenseNova API 调用设置 60s AbortController 超时。

#### Scenario: 正常响应
WHEN SenseNova API 在 60s 内返回
THEN 正常解析并返回结果

#### Scenario: 超时
WHEN SenseNova API 超过 60s 未返回
THEN 中断请求
AND 记录超时日志
AND 进入重试流程

### R-AE-4: 自动重试

ai-extract SHALL 在 AI 调用失败后自动重试 1 次，重试时使用更短的 prompt。

#### Scenario: 首次失败重试
WHEN 首次 SenseNova 调用失败（超时/网络错误/非 200 响应）
THEN 等待 1s 后重试
AND 重试时使用缩短的 prompt：只要求返回 tags
AND 重试超时仍为 60s

#### Scenario: 重试也失败
WHEN 重试也失败
THEN 返回 fallback 结果（空 title + 空 tags）
AND 设置 `_fallback: true` 标记

### R-AE-5: KV 缓存

ai-extract SHALL 将 AI 提取结果按 content hash 缓存到 KV，24h TTL。

#### Scenario: 缓存命中
GIVEN 相同内容在 24h 内已被 AI 处理过
WHEN 调用 ai-extract
THEN 直接从 KV 返回缓存结果（title + tags）
AND 响应时间 < 100ms
AND 不实际调用 SenseNova API

#### Scenario: 缓存键
WHEN 写入缓存
THEN 缓存键为 `ai:${sha1(content)}`
AND 缓存值为完整结果（title + tags）
AND TTL 为 86400s（24h）

## REMOVED Requirements

- 移除 `summary` 和 `type` 字段（不再从 AI 提取）
- 移除 `NOTE_EXTRACT_PROMPT`（笔记不做 AI 提取）