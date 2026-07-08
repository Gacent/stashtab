import { useState, useEffect, useCallback, useRef } from "react";
import { BookmarkFilter } from "../types";

const SOURCE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "web", label: "Web" },
  { value: "github", label: "GitHub" },
  { value: "bilibili", label: "Bilibili" },
  { value: "weixin", label: "微信公众号" },
  { value: "note", label: "笔记" },
] as const;

const TIME_OPTIONS = [
  { value: "", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "7d", label: "近7天" },
  { value: "30d", label: "近30天" },
  { value: "custom", label: "自定义" },
] as const;

interface HomeFilterSheetProps {
  open: boolean;
  onClose: () => void;
  onApply: (filter: BookmarkFilter) => void;
  onReset: () => void;
  initialFilter: BookmarkFilter;
  tags: { name: string; count: number }[];
}

export default function HomeFilterSheet({
  open,
  onClose,
  onApply,
  onReset,
  initialFilter,
  tags,
}: HomeFilterSheetProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilter.tags || []);
  const [selectedSource, setSelectedSource] = useState(initialFilter.source || "");
  const [selectedTime, setSelectedTime] = useState(initialFilter.timeRange || "");
  const [customStart, setCustomStart] = useState(initialFilter.timeStart || "");
  const [customEnd, setCustomEnd] = useState(initialFilter.timeEnd || "");
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset local state when initialFilter changes (e.g., from URL params)
  useEffect(() => {
    if (open) {
      setSelectedTags(initialFilter.tags || []);
      setSelectedSource(initialFilter.source || "");
      setSelectedTime(initialFilter.timeRange || "");
      setCustomStart(initialFilter.timeStart || "");
      setCustomEnd(initialFilter.timeEnd || "");
    }
  }, [open, initialFilter]);

  // Check if anything changed vs initial
  const hasChanges = useCallback(() => {
    const tagsChanged = JSON.stringify(selectedTags.sort()) !== JSON.stringify([...(initialFilter.tags || [])].sort());
    const sourceChanged = (selectedSource || "") !== (initialFilter.source || "");
    const timeChanged = (selectedTime || "") !== (initialFilter.timeRange || "");
    const customChanged = customStart !== (initialFilter.timeStart || "") || customEnd !== (initialFilter.timeEnd || "");
    return tagsChanged || sourceChanged || timeChanged || customChanged;
  }, [selectedTags, selectedSource, selectedTime, customStart, customEnd, initialFilter]);

  function toggleTag(tagName: string) {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName],
    );
  }

  function handleApply() {
    onApply({
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      source: selectedSource || undefined,
      timeRange: selectedTime || undefined,
      timeStart: selectedTime === "custom" ? customStart : undefined,
      timeEnd: selectedTime === "custom" ? customEnd : undefined,
    });
  }

  function handleReset() {
    setSelectedTags([]);
    setSelectedSource("");
    setSelectedTime("");
    setCustomStart("");
    setCustomEnd("");
    onReset();
  }

  // Close on overlay click (not on sheet content)
  function handleOverlayClick(e: React.MouseEvent) {
    // If click is NOT inside the sheet panel, close the overlay
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      onClick={handleOverlayClick}
    >
      {/* Overlay - covers everything including bottom nav */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity" />

      {/* Sheet - full width at bottom */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 w-full
          bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark)]
          rounded-t-[var(--radius-xl)] shadow-xl animate-slide-up
          max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-hairline)] dark:bg-[var(--color-surface-dark-elevated)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]">
          <h2 className="font-display text-lg text-[var(--color-ink)] dark:text-[var(--color-on-dark)]">
            筛选
          </h2>
          <button
            onClick={handleReset}
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            重置
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Tags section */}
          <section>
            <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--color-muted-soft)] mb-3">
              标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.name);
                return (
                  <button
                    key={tag.name}
                    onClick={() => toggleTag(tag.name)}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-sans font-medium
                      px-3 py-1.5 rounded-[var(--radius-pill)] transition-all duration-200 btn-press
                      ${active
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface-dark-soft)] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)] hover:border-[var(--color-primary)]/50"
                      }`}
                  >
                    {tag.name}
                    <span className={`text-[10px] ${active ? "text-white/70" : "text-[var(--color-muted-soft)]"}`}>
                      {tag.count}
                    </span>
                  </button>
                );
              })}
              {tags.length === 0 && (
                <p className="text-sm text-[var(--color-muted-soft)]">暂无标签</p>
              )}
            </div>
          </section>

          {/* Source section */}
          <section>
            <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--color-muted-soft)] mb-3">
              来源
            </h3>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((opt) => {
                const active = selectedSource === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedSource(opt.value)}
                    className={`text-[12px] font-sans font-medium px-3 py-1.5 rounded-[var(--radius-pill)] transition-all duration-200 btn-press
                      ${active
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface-dark-soft)] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)] hover:border-[var(--color-primary)]/50"
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Time range section */}
          <section>
            <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--color-muted-soft)] mb-3">
              时间
            </h3>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((opt) => {
                const active = selectedTime === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedTime(opt.value)}
                    className={`text-[12px] font-sans font-medium px-3 py-1.5 rounded-[var(--radius-pill)] transition-all duration-200 btn-press
                      ${active
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface-dark-soft)] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)] hover:border-[var(--color-primary)]/50"
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Custom date inputs */}
            {selectedTime === "custom" && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-[var(--radius-md)]
                    bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
                    text-[var(--color-ink)] dark:text-[var(--color-on-dark)]
                    border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  placeholder="开始日期"
                />
                <span className="text-[var(--color-muted-soft)] text-sm">至</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-[var(--radius-md)]
                    bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
                    text-[var(--color-ink)] dark:text-[var(--color-on-dark)]
                    border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  placeholder="结束日期"
                />
              </div>
            )}
          </section>
        </div>

        {/* Bottom action bar */}
        <div className="shrink-0 px-5 py-4 border-t border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]">
          <button
            onClick={handleApply}
            disabled={!hasChanges()}
            className="w-full py-3 rounded-[var(--radius-lg)] font-sans font-medium text-sm
              transition-all duration-200 btn-press
              bg-[var(--color-primary)] text-white
              hover:bg-[var(--color-primary-active)]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-primary)]"
          >
            应用筛选
          </button>
        </div>
      </div>
    </div>
  );
}