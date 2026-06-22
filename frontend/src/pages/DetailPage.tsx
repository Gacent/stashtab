import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";
import TagBadge from "../components/TagBadge";
import { cleanText } from "../clean";

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    api.getBookmark(id).then((b) => { setBookmark(b); setNotes(b.notes || ""); setLoading(false); });
  }, [id]);

  async function handleDelete() {
    if (!bookmark || !confirm("确定删除？")) return;
    await api.deleteBookmark(bookmark.id);
    navigate("/");
  }

  async function handleToggleRead() {
    if (!bookmark) return;
    const updated = await api.updateBookmark(bookmark.id, { is_read: bookmark.is_read === 1 ? 0 : 1 });
    setBookmark(updated);
  }

  async function handleSaveNotes() {
    if (!bookmark) return;
    const updated = await api.updateBookmark(bookmark.id, { notes });
    setBookmark(updated);
    setEditing(false);
  }

  if (loading) return <div className="text-center text-gray-400 py-8">加载中...</div>;
  if (!bookmark) return <div className="text-center text-gray-400 py-8">未找到</div>;

  return (
    <div className="py-4 space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-500 hover:text-blue-600">← 返回</button>

      {bookmark.cover_image && (
        <img src={bookmark.cover_image} alt="" className="w-full h-48 object-cover rounded-xl"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}

      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{cleanText(bookmark.title)}</h1>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        {bookmark.source && <span>{bookmark.source}</span>}
        <span>{new Date(bookmark.created_at).toLocaleString("zh-CN")}</span>
        <button onClick={handleToggleRead}
          className={`ml-auto text-xs px-2 py-1 rounded ${bookmark.is_read === 1 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {bookmark.is_read === 1 ? "✓ 已读" : "标记已读"}
        </button>
      </div>

      {bookmark.ai_summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-gray-700 dark:text-gray-300">
          <strong>AI 摘要：</strong>{cleanText(bookmark.ai_summary)}
        </div>
      )}

      {bookmark.description && <p className="text-sm text-gray-600 dark:text-gray-400">{cleanText(bookmark.description)}</p>}

      {bookmark.type === "note" && bookmark.content && (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{cleanText(bookmark.content)}</div>
      )}

      {bookmark.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{bookmark.tags.map((tag) => (<TagBadge key={tag.id} name={tag.name} />))}</div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        {editing ? (
          <div className="space-y-2">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 dark:text-white resize-none" rows={3} placeholder="添加备注..." />
            <div className="flex gap-2">
              <button onClick={handleSaveNotes} className="py-1.5 px-4 bg-blue-500 text-white rounded-lg text-sm">保存</button>
              <button onClick={() => setEditing(false)} className="py-1.5 px-4 text-gray-500 text-sm">取消</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{bookmark.notes || "添加备注..."}</p>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-500">编辑</button>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {bookmark.url && (
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer"
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm text-center font-medium">阅读原文</a>
        )}
        <button onClick={handleDelete} className="py-2 px-4 text-red-500 text-sm">删除</button>
      </div>
    </div>
  );
}
