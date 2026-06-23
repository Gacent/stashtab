import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { getPageCache, setPageCache, clearPageCache, getScrollPosition, saveScrollPosition } from "../pageCache";
import PullToRefresh from "../components/PullToRefresh";

const CACHE_KEY = "tags";

export default function TagsPage() {
  const [tags, setTags] = useState<{ name: string; count: number }[]>(() => getPageCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(!getPageCache(CACHE_KEY));
  const restored = useRef(false);

  useEffect(() => {
    if (getPageCache(CACHE_KEY)) {
      setLoading(false);
      if (!restored.current) {
        restored.current = true;
        requestAnimationFrame(() => {
          window.scrollTo(0, getScrollPosition(CACHE_KEY));
        });
      }
      return () => saveScrollPosition(CACHE_KEY);
    }

    let cancelled = false;
    api.listTags().then((data) => {
      if (cancelled) return;
      setTags(data);
      setPageCache(CACHE_KEY, data);
      setLoading(false);
    });

    return () => { cancelled = true; saveScrollPosition(CACHE_KEY); };
  }, []);

  async function handleRefresh() {
    clearPageCache(CACHE_KEY);
    const data = await api.listTags();
    setTags(data);
    setPageCache(CACHE_KEY, data);
  }

  if (loading) return (
    <div className="text-center text-[var(--color-muted)] py-8">
      <p className="text-4xl mb-2">🏷️</p>
      <p className="text-sm loading-pulse">加载中...</p>
    </div>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="py-4 space-y-4">
        <h2 className="font-display text-xl text-[var(--color-ink)] dark:text-[var(--color-on-dark)]">
          标签
        </h2>
        {tags.length === 0 ? (
          <div className="text-center text-[var(--color-muted)] py-8">
            <p className="text-4xl mb-2">🏷️</p>
            <p className="text-sm">还没有标签</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tags.map((tag, index) => (
              <Link
                key={tag.name}
                to={`/tags/${encodeURIComponent(tag.name)}`}
                className={`bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)] 
                  rounded-[var(--radius-lg)] p-4 card-hover border border-[var(--color-hairline)] 
                  dark:border-[var(--color-surface-dark-elevated)] fade-in-up`}
                style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
              >
                <div className="font-display text-lg font-bold text-[var(--color-ink)] dark:text-[var(--color-on-dark)]">
                  {tag.name}
                </div>
                <div className="text-sm text-[var(--color-muted-soft)] mt-1">
                  {tag.count} 条
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}