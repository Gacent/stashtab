import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Bookmark, BookmarkFilter } from "../types";
import BookmarkCard from "../components/BookmarkCard";
import BookmarkForm from "../components/BookmarkForm";
import HomeFilterSheet from "../components/HomeFilterSheet";
import { getPageCache, setPageCache, clearPageCache, getScrollPosition, saveScrollPosition } from "../pageCache";
import PullToRefresh from "../components/PullToRefresh";

const CACHE_PREFIX = "home_filter";

const today = new Date();
today.setHours(0, 0, 0, 0);

const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const threeDaysAgo = new Date(today);
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

function getDateLabel(dateStr: string): string {
  if (!dateStr) return "未知";
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const time = d.getTime();
  if (time === today.getTime()) return "今天";
  if (time === yesterday.getTime()) return "昨天";
  if (time >= threeDaysAgo.getTime()) return "前3天";
  return "更早";
}

function getCacheKey(filter: BookmarkFilter): string {
  const parts = [CACHE_PREFIX];
  if (filter.tags?.length) parts.push(`tags:${filter.tags.sort().join(",")}`);
  if (filter.source) parts.push(`src:${filter.source}`);
  if (filter.timeRange) parts.push(`range:${filter.timeRange}`);
  if (filter.timeStart) parts.push(`start:${filter.timeStart}`);
  if (filter.timeEnd) parts.push(`end:${filter.timeEnd}`);
  return parts.join("_");
}

function parseFilterFromParams(sp: URLSearchParams): BookmarkFilter {
  const tags = sp.get("tags");
  const source = sp.get("source");
  const range = sp.get("range");
  const start = sp.get("start");
  const end = sp.get("end");
  return {
    tags: tags ? tags.split(",").filter(Boolean) : undefined,
    source: source || undefined,
    timeRange: range || undefined,
    timeStart: start || undefined,
    timeEnd: end || undefined,
  };
}

function filterToParams(filter: BookmarkFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.tags?.length) params.tags = filter.tags.join(",");
  if (filter.source) params.source = filter.source;
  if (filter.timeRange) params.range = filter.timeRange;
  if (filter.timeStart) params.start = filter.timeStart;
  if (filter.timeEnd) params.end = filter.timeEnd;
  return params;
}

function hasActiveFilter(filter: BookmarkFilter): boolean {
  return !!(
    filter.tags?.length ||
    filter.source ||
    filter.timeRange ||
    filter.timeStart ||
    filter.timeEnd
  );
}

/** Human-readable label for a source value */
function sourceLabel(val: string): string {
  const map: Record<string, string> = {
    web: "来源: Web",
    github: "来源: GitHub",
    bilibili: "来源: Bilibili",
    weixin: "来源: 微信",
    note: "笔记",
  };
  return map[val] || val;
}

/** Human-readable label for a time range value */
function timeLabel(val: string): string {
  const map: Record<string, string> = {
    today: "今天",
    yesterday: "昨天",
    "7d": "近7天",
    "30d": "近30天",
    custom: "自定义",
  };
  return map[val] || val;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter from URL params
  const currentFilter = useMemo(() => parseFilterFromParams(searchParams), [searchParams]);
  const cacheKey = useMemo(() => getCacheKey(currentFilter), [currentFilter]);
  const filterActive = hasActiveFilter(currentFilter);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getPageCache<Bookmark[]>(cacheKey) || []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!getPageCache(cacheKey));
  const restored = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [allTags, setAllTags] = useState<{ name: string; count: number }[]>([]);

  // Refs to avoid stale closures in loadMore
  const bookmarksRef = useRef(bookmarks);
  const cursorRef = useRef(cursor);
  bookmarksRef.current = bookmarks;
  cursorRef.current = cursor;

  // Load tags for the filter sheet
  useEffect(() => {
    api.listTags().then(setAllTags).catch(() => {});
  }, []);

  const loadBookmarks = useCallback(async (filter: BookmarkFilter) => {
    const params: {
      limit?: number;
      tag?: string;
      source?: string;
      range?: string;
      start?: string;
      end?: string;
    } = { limit: 20 };

    // Filtered mode: combine tags into a single tag param (backend supports one tag at a time)
    // For multi-tag, we send the first tag and filter the rest client-side
    if (filter.tags?.length) {
      params.tag = filter.tags[0];
    }
    if (filter.source) params.source = filter.source;
    if (filter.timeRange) params.range = filter.timeRange;
    if (filter.timeStart) params.start = filter.timeStart;
    if (filter.timeEnd) params.end = filter.timeEnd;

    const result = await api.listBookmarks(params);

    // Client-side multi-tag filtering (backend only supports single tag)
    let filtered = result.bookmarks;
    if (filter.tags && filter.tags.length > 1) {
      const lowerTags = filter.tags.map((t) => t.toLowerCase());
      filtered = filtered.filter((b) =>
        b.tags.some((t) => lowerTags.includes(t.toLowerCase())),
      );
    }

    setBookmarks(filtered);
    // Only set cursor for unfiltered results (filtered results don't support cursor pagination)
    setCursor(hasActiveFilter(filter) ? null : result.nextCursor);
    setPageCache(getCacheKey(filter), filtered);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => saveScrollPosition(cacheKey);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const cached = getPageCache<Bookmark[]>(cacheKey);
    if (!cached) {
      loadBookmarks(currentFilter);
    } else {
      setBookmarks(cached);
      setLoading(false);
      if (!restored.current) {
        restored.current = true;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, getScrollPosition(cacheKey));
          });
        });
      }
    }

    return () => {
      saveScrollPosition(cacheKey);
      window.removeEventListener("scroll", handleScroll);
    };
    // Re-run when filter changes (URL params change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  async function loadMore() {
    const currentCursor = cursorRef.current;
    if (!currentCursor || loadingMore) return;
    // When filter is active, disable loadMore
    if (filterActive) return;
    setLoadingMore(true);
    try {
      const result = await api.listBookmarks({ cursor: currentCursor, limit: 20 });
      const all = [...bookmarksRef.current, ...result.bookmarks];
      setBookmarks(all);
      setPageCache(cacheKey, all);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSaved() {
    // Clear all home filter caches
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("pageCache_") && key.includes(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
    setLoading(true);
    loadBookmarks(currentFilter);
  }

  async function handleRefresh() {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("pageCache_") && key.includes(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
    await loadBookmarks(currentFilter);
  }

  function handleApplyFilter(filter: BookmarkFilter) {
    setFilterOpen(false);
    setLoading(true);
    const params = filterToParams(filter);
    setSearchParams(params, { replace: true });
  }

  function handleResetFilter() {
    setFilterOpen(false);
    setLoading(true);
    setSearchParams({}, { replace: true });
  }

  function removeFilterTag(tag: string) {
    const newTags = (currentFilter.tags || []).filter((t) => t !== tag);
    const newFilter = { ...currentFilter, tags: newTags.length > 0 ? newTags : undefined };
    const params = filterToParams(newFilter);
    setSearchParams(params, { replace: true });
  }

  function removeFilterSource() {
    const newFilter = { ...currentFilter, source: undefined };
    const params = filterToParams(newFilter);
    setSearchParams(params, { replace: true });
  }

  function removeFilterTime() {
    const newFilter = { ...currentFilter, timeRange: undefined, timeStart: undefined, timeEnd: undefined };
    const params = filterToParams(newFilter);
    setSearchParams(params, { replace: true });
  }

  const groups = useMemo(() => {
    const map = new Map<string, Bookmark[]>();
    for (const b of bookmarks) {
      const label = getDateLabel(b.created_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(b);
    }
    const order = ["今天", "昨天", "前3天", "更早"];
    return order.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }));
  }, [bookmarks]);

  if (loading) {
    return (
      <div className="py-4 text-center text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] py-8 loading-pulse">
        加载中...
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={filterOpen}>
      <div className="space-y-4 pb-4">
        {/* Sticky header: filter + search + paste row */}
        <div className="sticky top-[65px] z-10 -mx-4 px-4 pt-4 pb-3
          bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark)]
          border-b border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]">
          <div className="flex items-center gap-2">
            {/* Filter button */}
            <button onClick={() => setFilterOpen(true)}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center
                bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
                rounded-[var(--radius-lg)] text-[var(--color-muted)] hover:text-[var(--color-primary)]
                transition-colors btn-press relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {/* Active indicator dot */}
              {filterActive && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
              )}
            </button>
            {/* Search button */}
            <button onClick={() => navigate("/search")}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center
                bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
                rounded-[var(--radius-lg)] text-[var(--color-muted)] hover:text-[var(--color-primary)]
                transition-colors btn-press">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <div className="flex-1">
              <BookmarkForm onSaved={handleSaved} />
            </div>
          </div>

          {/* Active filter chips */}
          {filterActive && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(currentFilter.tags || []).map((tag) => (
                <span key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-sans font-medium
                    px-2 py-1 rounded-[var(--radius-pill)]
                    bg-[var(--color-primary)]/10 text-[var(--color-primary)]
                    border border-[var(--color-primary)]/20">
                  标签: {tag}
                  <button onClick={() => removeFilterTag(tag)}
                    className="hover:opacity-60 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {currentFilter.source && (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium
                  px-2 py-1 rounded-[var(--radius-pill)]
                  bg-[var(--color-accent-teal)]/10 text-[var(--color-accent-teal)]
                  border border-[var(--color-accent-teal)]/20">
                  {sourceLabel(currentFilter.source)}
                  <button onClick={removeFilterSource}
                    className="hover:opacity-60 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {currentFilter.timeRange && (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium
                  px-2 py-1 rounded-[var(--radius-pill)]
                  bg-[var(--color-accent-amber)]/10 text-[var(--color-accent-amber)]
                  border border-[var(--color-accent-amber)]/20">
                  {timeLabel(currentFilter.timeRange)}
                  <button onClick={removeFilterTime}
                    className="hover:opacity-60 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {bookmarks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] text-sm">
              {filterActive ? "没有匹配的书签" : "还没有拾签，粘贴一个链接开始吧"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--color-muted-soft)] dark:text-[var(--color-on-dark-soft)] mb-3 px-1">
                  {group.label}
                </h3>
                <div className="space-y-3">
                  {group.items.map((bookmark, idx) => (
                    <BookmarkCard key={bookmark.id} bookmark={bookmark} index={idx} />
                  ))}
                </div>
              </div>
            ))}
            {cursor && !filterActive && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full py-3 text-sm text-[var(--color-primary)] hover:opacity-80 transition-opacity font-medium disabled:opacity-50">
                {loadingMore ? "加载中..." : "加载更多"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter sheet */}
      <HomeFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
        initialFilter={currentFilter}
        tags={allTags}
      />
    </PullToRefresh>
  );
}