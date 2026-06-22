import { useState, useRef, useEffect } from "react";
import { readClipboard, isUrl } from "../clipboard";
import { api } from "../api";
import TagBadge from "./TagBadge";

interface PreviewData {
  type: "link" | "note";
  url?: string;
  title: string;
  description: string;
  cover_image: string;
  source: string;
  content: string;
  tags: string[];
  ai_summary: string;
}

const tagOptions = ["技术", "AI", "商业", "产品", "设计", "生活", "开源", "教程", "新闻", "观点", "工具", "资源", "阅读", "其它"];

export default function BookmarkForm({ onSaved }: { onSaved: () => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [showForm]);

  async function handlePaste() {
    const text = input.trim();
    if (!text) return;
    setLoading(true);

    if (isUrl(text)) {
      const meta = await api.fetchMeta(text);
      let tags: string[] = [];
      let summary = "";

      if (meta.content) {
        try {
          const ai = await api.aiExtract({ type: "link", content: meta.content, title: meta.title });
          tags = ai.tags || [];
          summary = ai.summary || "";
        } catch {}
      }

      setPreview({ type: "link", url: text, title: meta.title || text, description: meta.description, cover_image: meta.cover_image, source: meta.source, content: meta.content, tags, ai_summary: summary });
      setSelectedTags(tags);
    } else {
      let title = text.slice(0, 30);
      let tags: string[] = [];

      try {
        const ai = await api.aiExtract({ type: "note", content: text });
        if (ai.title) title = ai.title;
        tags = ai.tags || [];
      } catch {}

      setPreview({ type: "note", title, description: text.slice(0, 200), cover_image: "", source: "", content: text, tags, ai_summary: "" });
      setSelectedTags(tags);
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!preview) return;
    const tagIds: string[] = [];
    for (const tagName of selectedTags) {
      try {
        const tag = await api.createTag(tagName);
        tagIds.push(tag.id);
      } catch {
        const tags = await api.listTags();
        const existing = tags.find((t) => t.name === tagName);
        if (existing) tagIds.push(existing.id);
      }
    }

    await api.createBookmark({
      type: preview.type, url: preview.url, title: preview.title, description: preview.description,
      cover_image: preview.cover_image, source: preview.source,
      content: preview.type === "note" ? preview.content : undefined,
      ai_summary: preview.ai_summary || undefined, notes, tagIds,
    });

    setInput(""); setPreview(null); setNotes(""); setSelectedTags([]); setShowForm(false);
    onSaved();
  }

  function toggleTag(tag: string) { setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]); }

  function addCustomTag() {
    const t = customTag.trim();
    if (t && !selectedTags.includes(t)) setSelectedTags((prev) => [...prev, t]);
    setCustomTag("");
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)}
        className="w-full py-3 px-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm hover:border-blue-400 transition-colors">
        + 粘贴链接或文字来收藏
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      {!preview ? (
        <>
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="在此粘贴链接或文字..."
            className="w-full min-h-[80px] p-3 border border-gray-200 dark:border-gray-600 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 dark:text-white" rows={3} />
          <div className="flex gap-2">
            <button onClick={handlePaste} disabled={loading || !input.trim()}
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">{loading ? "处理中..." : "预览"}</button>
            <button onClick={() => setShowForm(false)} className="py-2 px-4 text-gray-500 text-sm">取消</button>
          </div>
        </>
      ) : (
        <>
          {preview.cover_image && (
            <img src={preview.cover_image} alt="" className="w-full h-40 object-cover rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="space-y-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{preview.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{preview.ai_summary || preview.description}</p>
            {preview.source && <p className="text-xs text-gray-400">{preview.source}</p>}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="添加备注...（可选）"
            className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 dark:text-white" rows={2} />
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagOptions.map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedTags.includes(tag) ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300" : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400"}`}>{tag}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={customTag} onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()} placeholder="自定义标签..."
                className="flex-1 text-xs p-1.5 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 dark:text-white" />
              <button onClick={addCustomTag} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">添加</button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">保存</button>
            <button onClick={() => { setPreview(null); setInput(""); }} className="py-2 px-4 text-gray-500 text-sm">重新输入</button>
          </div>
        </>
      )}
    </div>
  );
}
