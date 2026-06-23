import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";
import BookmarkCard from "../components/BookmarkCard";

const STAGGER_DELAYS = ["0s", "0.05s", "0.1s", "0.15s", "0.2s", "0.25s", "0.3s", "0.35s", "0.4s", "0.45s"];

export default function TagFilterPage() {
  const { tagName } = useParams<{ tagName: string }>();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tagName) return;
    let cancelled = false;
    setLoading(true);
    api.listBookmarks({ tag: tagName, limit: 50 }).then((res) => {
      if (cancelled) return;
      setBookmarks(res.bookmarks);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tagName]);

  return (
    <div className="py-4 space-y-4">
      <Link
        to="/tags"
        className="inline-flex items-center gap-1 text-[var(--color-primary)] 
          text-sm hover:opacity-80 transition-opacity"
      >
        ← 所有标签
      </Link>
      <h2 className="font-display text-lg text-[var(--color-ink)] dark:text-[var(--color-on-dark)]">
        标签：{tagName}
      </h2>
      {loading ? (
        <div className="text-center text-[var(--color-muted)] py-8">
          <p className="text-4xl mb-2">⏳</p>
          <p className="text-sm loading-pulse">加载中...</p>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center text-[var(--color-muted)] py-8">
          <p className="text-4xl mb-2">🏷️</p>
          <p className="text-sm">该标签下暂无内容</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((b, index) => (
            <div
              key={b.id}
              className="fade-in-up"
              style={{ animationDelay: STAGGER_DELAYS[index % STAGGER_DELAYS.length] }}
            >
              <BookmarkCard bookmark={b} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
