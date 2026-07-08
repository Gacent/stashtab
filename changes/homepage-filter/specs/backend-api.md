# Spec: 后端 API 扩展 (Backend)

## Capabilities

C3 · C4

## ADDED Requirements

### R-BE-1: `GET /bookmarks` 新增 `source` 查询参数

`GET /bookmarks` SHALL 接受可选的 `source` 查询参数。
- `source` 为字符串，不区分大小写
- 当 `source` 提供时，只返回来源匹配的记录
- 当 `source` 与 `tag` 或 `q` 同时提供时，取交集（AND 逻辑）

#### Scenario: 按来源过滤
WHEN 请求 `GET /bookmarks?source=github`
THEN 只返回 `来源` 字段包含 "github" 的记录（不区分大小写）

#### Scenario: 来源 + 标签组合筛选
WHEN 请求 `GET /bookmarks?source=web&tag=AI`
THEN 返回 `来源` 为 "web" 且标签包含 "AI" 的记录

## MODIFIED Requirements

### R-BE-2: `listFeishuRecords()` 新增 `filter` 参数

`listFeishuRecords()` SHALL 支持可选的 `filter` 参数，传递给飞书 API 的 `filter` 字段（使用 Feishu 公式语法）。
- 当 `filter` 提供时，飞书服务端只返回匹配的记录
- 公式语法：`FIND("github", {来源}) > 0`（来源包含）、`{保存时间} >= 1748707200000`（时间范围）

#### Scenario: source 过滤
WHEN `listFeishuRecords()` 收到 `{ filter: 'FIND("github", {来源}) > 0' }`
THEN 飞书 API 请求中包含 `filter=FIND("github", {来源}) > 0`，只返回来源包含 github 的记录

### R-BE-3: `searchFeishuRecords()` 重构为混合过滤

`searchFeishuRecords()` SHALL 重构：时间范围和来源使用 Feishu 服务端过滤，标签和关键词保持客户端过滤。

- 当提供 `source` 参数时，构造对应的 Feishu filter 公式
- 当提供 `timeRange` 参数时，构造对应的日期范围 filter 公式
- 多个服务端条件用 `&&` 组合
- 标签和关键词仍通过客户端过滤处理
- MAX_PAGES=5 限制可放宽到 10 页（因为飞书已预过滤，返回数量大幅减少）

#### Scenario: 全维度组合过滤
WHEN 请求 `GET /bookmarks?source=web&tag=React&range=7d`
THEN 
1. 后端构造 filter: `FIND("web", {来源}) > 0 && {保存时间} >= <7天前的时间戳>`
2. 传给 Feishu listRecords API 获取预过滤记录
3. 在 Worker 端再对"标签"做客户端过滤（含 React 标签）
4. 返回最终结果