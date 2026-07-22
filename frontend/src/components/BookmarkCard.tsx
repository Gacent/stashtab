import { useNavigate } from "react-router-dom";
import { Bookmark } from "../types";
import TagBadge from "./TagBadge";
import { cleanText } from "../clean";
import { clearAllPageCache } from "../pageCache";
import { api } from "../api";
import { useState, useRef, useEffect } from "react";

interface BookmarkCardProps {
  bookmark: Bookmark;
  index?: number;
}

export default function BookmarkCard({ bookmark, index = 0 }: BookmarkCardProps) {
  const navigate = useNavigate();
  const staggerClass = index > 0 ? `stagger-${Math.min(index, 5)}` : 'fade-in-up';
  const [deleting, setDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      const el = scrollRef.current;
      if (!el) return;
      const snapped = el.scrollLeft >= 60;
      if (snapped !== isOpen) {
        setIsOpen(snapped);
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isOpen]);

  function handleCardClick() {
    if (isOpen) {
      scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    navigate(`/bookmark/${bookmark.id}`, { state: { bookmark } });
  }

  async function handleDelete() {
    if (!confirm("确定删除？")) {
      scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    setDeleting(true);
    try {
      await api.deleteBookmark(bookmark.id);
      clearAllPageCache();
      window.location.reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative rounded-[var(--radius-lg)] overflow-hidden select-none">
      {/* Scrollable container: card + delete button side by side */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden scrollbar-none"
        style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex" style={{ width: "calc(100% + 80px)" }}>
          {/* Card content */}
          <div
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
            className="flex-shrink-0 bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
              rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-hairline)]
              dark:border-[var(--color-surface-dark-elevated)] cursor-pointer
              fade-in-up transition-all duration-200 ease-out"
            style={{
              width: "calc(100% - 80px)",
              animationDelay: `${Math.min(index * 0.05, 0.25)}s`,
            }}
          >
            {bookmark.cover_image && (
              <div className="w-full h-36 overflow-hidden">
                <img src={bookmark.cover_image} alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10
                  dark:bg-[var(--color-primary)]/20
                  flex items-center justify-center text-[var(--color-primary)]
                  dark:text-[var(--color-on-dark)] text-xs flex-shrink-0">
                  🔗
                </div>
                <h3 className="font-sans font-medium text-[var(--color-ink)]
                  dark:text-[var(--color-on-dark)] text-[15px]
                  line-clamp-2 flex-1 leading-tight">{cleanText(bookmark.title)}</h3>
              </div>

              {bookmark.summary && (
                <p className="text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)]
                  text-[13px] line-clamp-2 leading-relaxed">
                  {cleanText(bookmark.summary)}
                </p>
              )}

              <div className="flex items-center gap-2 text-[11px]
                text-[var(--color-muted-soft)] dark:text-[var(--color-on-dark-soft)]">
                {bookmark.source && <span>{bookmark.source}</span>}
                <span>•</span>
                <span>{new Date(bookmark.created_at).toLocaleDateString("zh-CN")}</span>
              </div>

              {bookmark.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {bookmark.tags.map((tag) => (
                    <TagBadge key={tag} name={tag} />
                  ))}
                </div>
              )}

              {bookmark.url && (
                <div className="pt-1">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--color-primary)] dark:text-[var(--color-primary)]
                      text-[12px] font-sans hover:underline transition-colors">
                    阅读原文
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Delete button (to the right of the card) */}
          <div className="flex-shrink-0 w-20 flex items-center justify-center
            bg-[var(--color-error)] text-white text-sm font-medium cursor-pointer"
            onClick={handleDelete}
          >
            {deleting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "删除"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}