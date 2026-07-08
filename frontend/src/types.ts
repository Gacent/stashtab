export interface Bookmark {
  id: string;
  title: string;           // AI标题 - from Feishu
  original_title?: string;  // 原文标题 - from Feishu
  url?: string;
  tags: string[];          // tag names as strings (no longer Tag objects)
  summary?: string;        // AI摘要
  created_at: string;      // 保存时间
  source?: string;         // 来源
}

export interface BookmarkFilter {
  tags?: string[];         // 已选标签列表
  source?: string;         // 来源筛选 (web | github | bilibili | weixin | note | '')
  timeRange?: string;      // 预设: '' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'
  timeStart?: string;      // 自定义起始日期 YYYY-MM-DD
  timeEnd?: string;        // 自定义结束日期 YYYY-MM-DD
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
  nextCursor: string | null;
}