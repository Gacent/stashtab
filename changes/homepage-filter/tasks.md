# Tasks: 首页多维度筛选

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `worker/src/feishu.ts` | Modify | `listFeishuRecords()` 新增 `filter` 参数透传到飞书 API |
| `worker/src/handlers/bookmarks.ts` | Modify | `GET /bookmarks` 处理 `source` 参数；`searchFeishuRecords()` 混合过滤策略 |
| `frontend/src/types.ts` | Modify | 新增 `BookmarkFilter` 接口 |
| `frontend/src/api.ts` | Modify | `listBookmarks()` 新增 `source` 参数 |
| `frontend/src/components/HomeFilterSheet.tsx` | Create | 底部弹出筛选面板组件 |
| `frontend/src/pages/HomePage.tsx` | Modify | 集成筛选状态、面板、URL 同步、激活指示器、缓存适配 |

## Interfaces

```
BookmarkFilter {
  tags?: string[];      // 已选标签列表
  source?: string;       // 来源筛选 (web | github | bilibili | weixin | note | '')
  timeRange?: string;    // 预设: '' | 'today' | 'yesterday' | '7d' | '30d' | custom
  timeStart?: string;    // 自定义起始日期 YYYY-MM-DD
  timeEnd?: string;      // 自定义结束日期 YYYY-MM-DD
}

Consumes:
  Batch 1 → listFeishuRecords(token, appToken, tableId, pageSize, pageToken, filter?)
  Batch 1 → searchFeishuRecords(token, appToken, tableId, { query?, tag?, source?, timeRange? })
  Batch 2 → api.listBookmarks({ cursor?, limit?, tag?, q?, source? })
  Batch 3 → api.listTags() → { name: string; count: number }[]
  Batch 4 → useSearchParams() → URL query ↔ filter state

Produces:
  Batch 1 → GET /bookmarks?source=...&tag=... → { bookmarks, nextCursor }
  Batch 4 → URL/?tags=AI,React&source=github&range=7d
  Batch 4 → 筛选缓存键: home_filter_<tags>_<source>_<range>
```

---

## Batch 1: 后端 API 扩展

### Depends on: None

- [x] ### Task 1.1: `listFeishuRecords()` 新增 filter 参数

**File**: `worker/src/feishu.ts`

**TDD**:
1. Read: 现有 `listFeishuRecords()` 函数签名和 `URLSearchParams` 构建逻辑（行 144-150）
2. Modify: 增加可选 `filter?: string` 参数
3. Modify: 当 `filter` 提供时，追加 `params.set("filter", filter)`
4. Verify: 无 `filter` 时行为不变；有 `filter` 时 URL 包含 `filter=...`
5. Lint: 检查无 TS 错误

**Depends on**: None

- [x] ### Task 1.2: `searchFeishuRecords()` 重构为混合过滤

**File**: `worker/src/feishu.ts`

**TDD**:
1. Read: 现有 `searchFeishuRecords()` 完整实现（行 254-319）
2. Modify: 参数类型新增 `source?: string` 和 `timeRange?: string` 和 `timeStart?: string` 和 `timeEnd?: string`
3. Implement: 构造 Feishu filter 公式逻辑
   - `source` 不为空 → `FIND("xxx", {来源}) > 0`
   - `timeRange` 为 `today` → `{保存时间} >= <当天0点时间戳>`
   - `timeRange` 为 `7d` → `{保存时间} >= <7天前时间戳>`
   - `timeStart`/`timeEnd` → `{保存时间} >= <startTs> && {保存时间} <= <endTs>`
   - 多个条件用 `&&` 组合
4. Modify: 将构造好的 `filter` 传入 `listFeishuRecords()`
5. Verify: 标签和关键词的客户端过滤逻辑保持不变
6. Lint: 检查无 TS 错误

**Depends on**: Task 1.1

- [x] ### Task 1.3: `GET /bookmarks` 新增 source/时间参数

**File**: `worker/src/handlers/bookmarks.ts`

**TDD**:
1. Read: 现有 `GET /bookmarks` handler（行 30-54）
2. Modify: 读取 `source`、`range`、`start`、`end` 四个 query 参数
3. Modify: 传入 `searchFeishuRecords()` 的 options 对象中
4. Verify: 无源参数时行为不变；有参数时正确透传
5. Lint: 检查无 TS 错误

**Depends on**: Task 1.2

---

## Batch 2: 前端 API 扩展

### Depends on: Batch 1

- [x] ### Task 2.1: 新增 BookmarkFilter 类型

**File**: `frontend/src/types.ts`

**TDD**:
1. Read: 现有 `Bookmark` 和 `BookmarkListResponse` 接口
2. Add: 新增 `BookmarkFilter` 接口（tags、source、timeRange、timeStart、timeEnd）
3. Lint: 检查无 TS 错误

**Depends on**: None

- [x] ### Task 2.2: `listBookmarks()` 新增参数

**File**: `frontend/src/api.ts`

**TDD**:
1. Read: 现有 `listBookmarks()` 方法（行 38-44）
2. Modify: 参数类型新增 `source`、`range`、`start`、`end`
3. Modify: URLSearchParams 追加对应参数
4. Lint: 检查无 TS 错误

**Depends on**: Task 2.1

---

## Batch 3: HomeFilterSheet 组件

### Depends on: Batch 2

- [x] ### Task 3.1: 创建 HomeFilterSheet 组件骨架

**File**: `frontend/src/components/HomeFilterSheet.tsx`

**TDD**:
1. Read: 现有组件风格（如 TagBadge.tsx 查看原子样式模式）
2. Create: 组件骨架 — 带遮罩层的底部面板
3. Implement: 面板打开/关闭动画（滑入/滑出）
4. Implement: 遮罩点击关闭
5. Implement: Props 类型 `{ open, onClose, onApply, onReset, initialFilter, tags: Tag[] }`
6. Lint: 检查无 TS 错误

**Depends on**: None

- [x] ### Task 3.2: 标签多选区域

**File**: `frontend/src/components/HomeFilterSheet.tsx`

**TDD**:
1. Read: `api.listTags()` 返回格式 `{ name: string; count: number }[]`
2. Implement: 标签列表渲染（传入 props，不做 API 调用）
3. Implement: 多选状态管理（选中/取消切换）
4. Implement: 选中状态视觉（高亮/勾选图标）
5. Lint: 检查无 TS 错误

**Depends on**: Task 3.1

- [x] ### Task 3.3: 来源选择区域

**File**: `frontend/src/components/HomeFilterSheet.tsx`

**TDD**:
1. Implement: 来源选项列表（全部、Web、GitHub、Bilibili、笔记、微信公众号）
2. Implement: 单选状态管理
3. Implement: 选项对应的图标或标识
4. Lint: 检查无 TS 错误

**Depends on**: Task 3.1

- [x] ### Task 3.4: 时间范围选择区域

**File**: `frontend/src/components/HomeFilterSheet.tsx`

**TDD**:
1. Implement: 预设选项（全部时间、今天、昨天、近7天、近30天、自定义）
2. Implement: 单选状态管理
3. Implement: 选择"自定义"时展开日期输入框（两个 `<input type="date">`）
4. Lint: 检查无 TS 错误

**Depends on**: Task 3.1

- [x] ### Task 3.5: 底部操作栏（应用/重置按钮）

**File**: `frontend/src/components/HomeFilterSheet.tsx`

**TDD**:
1. Implement: "重置"按钮（清除所有已选条件）
2. Implement: "应用"按钮（触发 `onApply(filter)`）
3. Implement: 无变化时"应用"按钮禁用逻辑（比较 currentFilter vs initialFilter）
4. Lint: 检查无 TS 错误

**Depends on**: Tasks 3.2, 3.3, 3.4

---

## Batch 4: HomePage 集成

### Depends on: Batch 2, Batch 3

- [x] ### Task 4.1: 筛选状态管理 + useSearchParams 同步

**File**: `frontend/src/pages/HomePage.tsx`

**TDD**:
1. Read: 现有 HomePage 完整代码
2. Implement: 使用 `useSearchParams()` 管理筛选状态
3. Implement: URL → filter 状态的反向恢复（页面加载时解析 URL params）
4. Implement: filter 状态 → URL 的同步（`setSearchParams`）
5. Lint: 检查无 TS 错误

**Depends on**: None

- [x] ### Task 4.2: 集成 HomeFilterSheet

**File**: `frontend/src/pages/HomePage.tsx`

**TDD**:
1. Modify: 在搜索栏旁增加筛选按钮（漏斗图标）
2. Implement: 点击打开 HomeFilterSheet（传入 tags 数据、当前 filter、onApply、onReset）
3. Implement: `onApply` 回调 — 更新筛选状态、更新 URL、重新加载数据
4. Implement: `onReset` 回调 — 清空筛选、更新 URL、重新加载数据
5. Lint: 检查无 TS 错误

**Depends on**: Tasks 3.5, 4.1

- [x] ### Task 4.3: 首页激活筛选条件标签

**File**: `frontend/src/pages/HomePage.tsx`

**TDD**:
1. Implement: 在搜索栏下方渲染激活的筛选条件 chip（`tags`, `source`, `range` 各一个）
2. Implement: 每个 chip 右侧 × 按钮，点击移除对应条件
3. Implement: 无激活条件时隐藏该区域
4. Modify: 移除条件后更新 URL 并重新加载数据
5. Lint: 检查无 TS 错误

**Depends on**: Task 4.1

- [x] ### Task 4.4: 筛选时数据加载逻辑调整

**File**: `frontend/src/pages/HomePage.tsx`

**TDD**:
1. Read: 现有 `loadBookmarks()` 和 `loadMore()` 逻辑
2. Modify: `loadBookmarks()` 在筛选条件存在时传递 `tag`, `source`, `range`, `start`, `end` 参数
3. Modify: `loadMore()` — 当有筛选条件时，禁用分页（筛选结果不分页）或保持分页在已过滤数据集上
4. Verify: 无筛选时行为不变
5. Lint: 检查无 TS 错误

**Depends on**: Task 4.1

- [x] ### Task 4.5: 缓存适配

**File**: `frontend/src/pages/HomePage.tsx`

**TDD**:
1. Read: 现有 `pageCache.ts` 缓存机制
2. Modify: 缓存键从 `"home"` 改为 `"home_filter_<tags>_<source>_<range>"`
3. Verify: 不同筛选条件使用不同缓存
4. Verify: 新增书签时清除所有筛选缓存
5. Lint: 检查无 TS 错误

**Depends on**: Task 4.4
