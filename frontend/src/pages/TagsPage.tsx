import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface TagWithCount {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.listTags().then((data) => { setTags(data); setLoading(false); }); }, []);

  if (loading) return <div className="text-center text-gray-400 py-8">加载中...</div>;

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">标签</h2>
      {tags.length === 0 ? (
        <div className="text-center text-gray-400 py-8"><p className="text-4xl mb-2">🏷️</p><p className="text-sm">还没有标签</p></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tags.map((tag) => (
            <Link key={tag.id} to={`/tags/${encodeURIComponent(tag.name)}`}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{tag.name}</div>
              <div className="text-sm text-gray-400">{tag.count} 条</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
