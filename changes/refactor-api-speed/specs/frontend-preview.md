# Frontend Preview Spec

## ADDED Requirements

### R-FP-1: 分步展示

BookmarkForm SHALL 在 fetch-meta 返回后立即显示预览，不等 ai-extract 完成。

#### Scenario: 分步展示
GIVEN 用户粘贴一个 URL
WHEN fetch-meta 返回结果
THEN 立即显示预览（标题、封面、描述、来源）
AND 同时触发 ai-extract 请求
AND 不等待 ai-extract 完成才展示预览

### R-FP-2: AI 分析状态

BookmarkForm SHALL 在 ai-extract 执行期间显示 "AI 分析中..." 状态提示。

#### Scenario: AI 分析中
WHEN fetch-meta 已返回且 ai-extract 正在执行
THEN 预览中显示 "AI 分析中..." 标签或骨架屏
AND 用户可以看到预览内容，同时知道 AI 在后台处理

#### Scenario: AI 完成
WHEN ai-extract 成功返回
THEN 自动更新预览中的 title、tags、summary
AND 移除 "AI 分析中..." 状态

#### Scenario: AI 失败
WHEN ai-extract 失败（超时/错误/返回 fallback）
THEN 保持 fetch-meta 的原始标题
AND 移除 "AI 分析中..." 状态
AND 标签区域显示为空，用户可手动选择

### R-FP-3: 加载状态分离

BookmarkForm SHALL 使用两个独立的 loading 状态分别控制 fetch-meta 和 ai-extract。

#### Scenario: 加载状态
WHEN 用户粘贴 URL 后
THEN `loading` 状态控制 fetch-meta 阶段（按钮禁用 + 处理中...）
AND `aiLoading` 状态控制 ai-extract 阶段（AI 分析中提示）
AND 两者互不影响