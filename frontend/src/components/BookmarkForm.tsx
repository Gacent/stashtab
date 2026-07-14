import { useState, useRef, useEffect } from "react";
import { readClipboard, isUrl } from "../clipboard";
import { api } from "../api";
import TagBadge from "./TagBadge";

interface PreviewData {
  type: "link" | "note";
  url?: string;
  title: string;
  original_title?: string;
  cover_image?: string;
  source: string;
  content?: string;
  tags: string[];
  summary?: string;
}

const tagOptions = ["技术", "AI", "商业", "产品", "设计", "生活", "开源", "教程", "新闻", "观点", "工具", "资源", "阅读", "其它"];

export default function BookmarkForm({ onSaved, onActiveChange }: { onSaved: () => void; onActiveChange?: (active: boolean) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showForm) inputRef.current?.focus();
    onActiveChange?.(showForm);
  }, [showForm]);

  async function handlePaste() {
    const text = input.trim();
    if (!text) return;
    setLoading(true);

    try {
      if (isUrl(text)) {
        const meta = await api.fetchMeta(text);
        let tags: string[] = [];
        let summary = "";
        let title = meta.title || text;

        if (meta.description || meta.content) {
          try {
            const ai = await api.aiExtract({ type: "link", content: [meta.description, meta.content].filter(Boolean).join("\n\n"), title: meta.title });
            if (ai.title) title = ai.title;
            tags = ai.tags || [];
            summary = ai.summary || "";
          } catch {}
        }

        setPreview({
          type: "link", url: text, title,
          original_title: meta.title !== title ? meta.title : undefined,
          cover_image: meta.cover_image, source: meta.source,
          tags, summary,
        });
        setSelectedTags(tags);
      } else {
        // Notes: skip AI, let user fill title directly
        setPreview({ type: "note", title: "", source: "", content: text, tags: [], summary: "" });
        setSelectedTags([]);
      }
    } catch (err) {
      console.error("fetchMeta error:", err);
      // Show a basic preview so user can still save manually
      if (isUrl(text)) {
        setPreview({ type: "link", url: text, title: text, source: "", tags: [], summary: "" });
        setSelectedTags([]);
      } else {
        setPreview({ type: "note", title: "", source: "", content: text, tags: [], summary: "" });
        setSelectedTags([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const created = await api.createBookmark({
        url: preview.url,
        title: preview.title,
        original_title: preview.original_title || "",
        summary: preview.summary || preview.content || "",
        tags: selectedTags,
        source: preview.source,
      });
      setInput(""); setPreview(null); setSelectedTags([]); setShowForm(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tag: string) { 
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]); 
  }

  function addCustomTag() {
    const t = customTag.trim();
    if (t && !selectedTags.includes(t)) setSelectedTags((prev) => [...prev, t]);
    setCustomTag("");
  }

  if (!showForm) {
    return (
      <button 
        onClick={() => setShowForm(true)}
        className="w-full py-3 px-4 
          bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
          border-2 border-dashed border-[var(--color-hairline)] 
          dark:border-[var(--color-surface-dark-elevated)]
          rounded-[var(--radius-lg)] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] 
          text-[14px] font-sans 
          hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] 
          transition-colors duration-200 btn-press"
      >
        <span className="text-[var(--color-primary)] font-semibold mr-1">+</span> 粘贴链接或文字来拾签
      </button>
    );
  }

  return (
    <div className="bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)] 
      rounded-[var(--radius-lg)] border border-[var(--color-hairline)] 
      dark:border-[var(--color-surface-dark-elevated)] p-4 space-y-3 fade-in-up">
      
      {!preview ? (
        <>
          <textarea 
            ref={inputRef} 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="在此粘贴链接或文字..."
            className="w-full min-h-[80px] p-3 
              bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark-soft)] 
              border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)] 
              rounded-[var(--radius-md)] resize-none text-[var(--color-ink)] dark:text-[var(--color-on-dark)]
              text-[14px] font-sans placeholder:text-[var(--color-muted-soft)]
              focus-ring transition-all duration-200" 
            rows={3} 
          />
          <div className="flex gap-2">
            <button 
              onClick={handlePaste} 
              disabled={loading || !input.trim()}
              className="flex-1 py-2 px-4 
                bg-[var(--color-primary)] text-[var(--color-on-primary)] 
                rounded-[var(--radius-md)] text-[14px] font-sans font-medium 
                disabled:opacity-50 disabled:cursor-not-allowed 
                hover:bg-[var(--color-primary-active)] transition-colors duration-200 btn-press"
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-[var(--color-on-primary)]/30 
                    border-t-[var(--color-on-primary)] rounded-full animate-spin" />
                  处理中...
                </span>
              ) : "预览"}
            </button>
            <button 
              onClick={() => setShowForm(false)} 
              className="py-2 px-4 text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] 
                text-[14px] font-sans 
                hover:text-[var(--color-body)] dark:hover:text-[var(--color-on-dark)] 
                transition-colors btn-press"
            >
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          {preview.cover_image && (
            <img 
              src={preview.cover_image} 
              alt="" 
              className="w-full h-40 object-cover rounded-[var(--radius-md)]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} 
            />
          )}
          <div className="space-y-1.5">
            {preview.type === "note" ? (
              <input 
                value={preview.title}
                onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                placeholder="输入标题..."
                className="w-full font-display font-semibold text-[var(--color-ink)] dark:text-[var(--color-on-dark)] 
                  text-[18px] leading-tight bg-transparent border-b border-[var(--color-hairline)] 
                  dark:border-[var(--color-surface-dark-elevated)] focus:outline-none focus:border-[var(--color-primary)] 
                  pb-1 transition-colors"
              />
            ) : (
              <h3 className="font-display font-semibold text-[var(--color-ink)] dark:text-[var(--color-on-dark)] 
                text-[18px] leading-tight">{preview.title}</h3>
            )}
            {preview.original_title && preview.original_title !== preview.title && (
              <p className="text-[12px] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)]">
                {preview.original_title}
              </p>
            )}
            {preview.summary && (
              <p className="text-[13px] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] 
                line-clamp-2">{preview.summary}</p>
            )}
            {preview.source && (
              <p className="text-[12px] text-[var(--color-muted-soft)] dark:text-[var(--color-on-dark-soft)]">
                {preview.source}
              </p>
            )}
            {preview.type === "note" && preview.content && (
              <p className="text-[12px] text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] 
                line-clamp-3 whitespace-pre-wrap">
                {preview.content}
              </p>
            )}
          </div>
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagOptions.map((tag) => (
                <TagBadge 
                  key={tag} 
                  name={tag} 
                  onClick={() => toggleTag(tag)}
                  active={selectedTags.includes(tag)}
                  variant={selectedTags.includes(tag) ? 'coral' : 'default'}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                value={customTag} 
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()} 
                placeholder="自定义标签..."
                className="flex-1 text-[13px] p-1.5 px-3
                  bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark-soft)] 
                  border border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)] 
                  rounded-[var(--radius-md)] focus-ring 
                  text-[var(--color-ink)] dark:text-[var(--color-on-dark)] transition-all" 
              />
              <button 
                onClick={addCustomTag} 
                className="py-1.5 px-3 
                  bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)] 
                  text-[var(--color-muted)] dark:text-[var(--color-on-dark)] text-[13px] font-sans font-medium
                  rounded-[var(--radius-md)] hover:bg-[var(--color-surface-soft)] dark:hover:bg-[var(--color-surface-dark-soft)]
                  transition-colors btn-press"
              >
                添加
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-[var(--color-hairline)] dark:border-[var(--color-surface-dark-elevated)]">
            <button 
              onClick={handleSave} 
              disabled={saving || (preview.type === "note" && !preview.title.trim())}
              className="flex-1 py-2 px-4 
                bg-[var(--color-primary)] text-[var(--color-on-primary)] 
                rounded-[var(--radius-md)] text-[14px] font-sans font-medium 
                disabled:opacity-50 disabled:cursor-not-allowed 
                hover:bg-[var(--color-primary-active)] transition-colors duration-200 btn-press"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-[var(--color-on-primary)]/30 
                    border-t-[var(--color-on-primary)] rounded-full animate-spin" />
                  保存中...
                </span>
              ) : "保存"}
            </button>
            <button 
              onClick={() => { setPreview(null); setInput(""); }} 
              className="py-2 px-4 text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] 
                text-[14px] font-sans 
                hover:text-[var(--color-body)] dark:hover:text-[var(--color-on-dark)] 
                transition-colors btn-press"
            >
              重新输入
            </button>
          </div>
        </>
      )}
    </div>
  );
}