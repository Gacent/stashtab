# Spec: 筛选状态保持与激活指示 (FilterState)

## Capabilities

C6 · C7 · C8

## MODIFIED Requirements

### R-FS-7: 筛选条件同步到 URL

HomePage SHALL 将当前激活的筛选条件同步到 URL query parameters。
- 标签多选 → `?tags=AI,React`（逗号分隔）
- 来源 → `?source=github`
- 时间范围预设 → `?range=7d`
- 自定义时间 → `?range=2026-07-01_2026-07-08`
- 页面加载时 SHALL 从 URL 参数恢复筛选状态

#### Scenario: 筛选后 URL 更新
WHEN 用户应用筛选（标签="AI", 来源="GitHub", 时间="近7天"）
THEN URL 更新为 `/?tags=AI&source=github&range=7d`，页面不刷新（仅 pushState）

#### Scenario: 从 URL 恢复筛选
WHEN 用户直接访问 `/?tags=React&source=web`
THEN 首页加载时自动应用该筛选条件，数据为过滤后的结果

#### Scenario: 清除筛选后 URL 恢复
WHEN 用户重置所有筛选条件
THEN URL 恢复为 `/`（无 query params）

### R-FS-8: 首页激活筛选条件标签

HomePage SHALL 在搜索栏下方显示当前激活的筛选条件标签（chip）。
- 每个筛选条件显示为一个 chip，如 "标签: AI"、"来源: GitHub"、"近7天"
- 每个 chip 右侧有 × 按钮，点击后移除该条件并重新加载数据
- 无激活条件时，该区域隐藏

#### Scenario: 显示激活的筛选条件
WHEN 筛选条件为 标签:AI + 来源:GitHub
THEN 搜索栏下方显示两个 chip："标签: AI [×]" 和 "来源: GitHub [×]"

#### Scenario: 逐个移除筛选条件
WHEN 用户点击 "标签: AI [×]"
THEN 该标签从筛选条件中移除，数据重新加载，URL 更新（移除 `tags=AI`）

### R-FS-9: 筛选与页面缓存协同

HomePage 的 pageCache SHALL 在筛选条件变化时失效。
- 不同筛选条件组合 SHALL 使用不同的缓存键（如 `home_filter_<tags>_<source>_<range>`）
- 清除筛选时 SHALL 清除所有筛选缓存

#### Scenario: 筛选缓存独立
WHEN 用户应用筛选（标签:AI），然后切换到其他页面再返回
THEN 首页恢复筛选状态（标签:AI），数据从对应缓存读取（如果有）

#### Scenario: 新增数据时清除筛选缓存
WHEN 用户在筛选状态下收藏新书签（`handleSaved`）
THEN 所有筛选缓存被清除，数据重新加载