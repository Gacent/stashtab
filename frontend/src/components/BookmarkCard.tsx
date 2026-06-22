import { Link } from "react-router-dom";
import { Bookmark } from "../types";
import TagBadge from "./TagBadge";
import { cleanText } from "../clean";

interface BookmarkCardProps {
  bookmark: Bookmark;
}

export default function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const isNote = bookmark.type === "note";

  return (
    <Link
      to={`/bookmark/${bookmark.id}`}
      className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
    >
      {bookmark.cover_image && (
        <img
          src={bookmark.cover_image}
          alt=""
          className="w-full h-36 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs mt-0.5">{isNote ? "📝" : "🔗"}</span>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 flex-1">{cleanText(bookmark.title)}</h3>
        </div>

        {(bookmark.ai_summary || bookmark.description) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{cleanText(bookmark.ai_summary || bookmark.description)}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400">
          {bookmark.source && <span>{bookmark.source}</span>}
          <span>{new Date(bookmark.created_at).toLocaleDateString("zh-CN")}</span>
          {bookmark.is_read === 1 && <span className="text-green-500">✓ 已读</span>}
        </div>

        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bookmark.tags.map((tag) => (<TagBadge key={tag.id} name={tag.name} />))}
          </div>
        )}
      </div>
    </Link>
  );
}
