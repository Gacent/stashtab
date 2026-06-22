import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";
import BookmarkCard from "../components/BookmarkCard";

export default function TagFilterPage() {
  const { tagName } = useParams<{ tagName: string }>();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tagName) return;
    api.listTags().then(async (tags) => {
      const tag = tags.find((t) => t.name === tagName);
      if (tag) {
        const res = await api.listBookmarks({ tagId: tag.id, limit: 50 });
        setBookmarks(res.bookmarks);
      }
      setLoading(false);
    });
  }, [tagName]);

  return (
    <div className="py-4 space-y-4">
      <Link to="/tags" className="text-sm text-blue-500 hover:text-blue-600">← 所有标签</Link>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">标签：{tagName}</h2>
      {loading ? <div className="text-center text-gray-400 py-8">加载中...</div>
      : bookmarks.length === 0 ? <div className="text-center text-gray-400 py-8">该标签下暂无内容</div>
      : <div className="space-y-3">{bookmarks.map((b) => (<BookmarkCard key={b.id} bookmark={b} />))}</div>}
    </div>
  );
}
