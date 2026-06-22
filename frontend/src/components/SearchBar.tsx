import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.search({ q: query });
        setResults(res.bookmarks.slice(0, 10));
        setShowResults(true);
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function goToBookmark(id: string) {
    setShowResults(false);
    setQuery("");
    navigate(`/bookmark/${id}`);
  }

  return (
    <div ref={ref} className="relative">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索收藏..."
        className="w-full py-2 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white" />
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
          {searching ? <div className="p-3 text-sm text-gray-400 text-center">搜索中...</div>
          : results.length === 0 ? <div className="p-3 text-sm text-gray-400 text-center">无结果</div>
          : results.map((b) => (
            <button key={b.id} onClick={() => goToBookmark(b.id)}
              className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{b.title}</div>
              <div className="text-xs text-gray-400 line-clamp-1">{b.description || b.ai_summary}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
