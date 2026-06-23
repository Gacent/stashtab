import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";
import BookmarkCard from "../components/BookmarkCard";
import BookmarkForm from "../components/BookmarkForm";
import { cleanText } from "../clean";
import { getPageCache, setPageCache, clearPageCache, getScrollPosition, saveScrollPosition } from "../pageCache";
import PullToRefresh from "../components/PullToRefresh";

const CACHE_KEY = "home";

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

export default function HomePage() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getPageCache<Bookmark[]>(CACHE_KEY) || []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!getPageCache(CACHE_KEY));
  const restored = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs to avoid stale closures in loadMore
  const bookmarksRef = useRef(bookmarks);
  const cursorRef = useRef(cursor);
  bookmarksRef.current = bookmarks;
  cursorRef.current = cursor;

  const loadBookmarks = useCallback(async () => {
    const result = await api.listBookmarks({ limit: 20 });
    setBookmarks(result.bookmarks);
    setCursor(result.nextCursor);
    setPageCache(CACHE_KEY, result.bookmarks);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Continuously save scroll position during scrolling
    const handleScroll = () => saveScrollPosition(CACHE_KEY);
    window.addEventListener("scroll", handleScroll, { passive: true });

    if (!getPageCache(CACHE_KEY)) {
      loadBookmarks();
    } else {
      setLoading(false);
      if (!restored.current) {
        restored.current = true;
        // Wait two frames to ensure DOM is fully laid out from cached data
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, getScrollPosition(CACHE_KEY));
          });
        });
      }
    }

    return () => {
      saveScrollPosition(CACHE_KEY);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loadBookmarks]);

  async function loadMore() {
    const currentCursor = cursorRef.current;
    if (!currentCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await api.listBookmarks({ cursor: currentCursor, limit: 20 });
      const all = [...bookmarksRef.current, ...result.bookmarks];
      setBookmarks(all);
      setPageCache(CACHE_KEY, all);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSaved() {
    clearPageCache(CACHE_KEY);
    setLoading(true);
    loadBookmarks();
  }

  async function handleRefresh() {
    clearPageCache(CACHE_KEY);
    await loadBookmarks();
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

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4 pb-4">
        {/* Sticky header: search icon + paste row */}
        <div className="sticky top-[65px] z-10 -mx-4 px-4 pt-4 pb-3 
          bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark)]
          border-b border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]">
          <div className="flex items-center gap-2">
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
        </div>

        {loading ? (
          <div className="text-center text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] py-8 loading-pulse">加载中...</div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] text-sm">还没有收藏，粘贴一个链接开始吧</p>
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
            {cursor && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full py-3 text-sm text-[var(--color-primary)] hover:opacity-80 transition-opacity font-medium disabled:opacity-50">
                {loadingMore ? "加载中..." : "加载更多"}
              </button>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}