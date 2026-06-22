import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));
  const navigate = useNavigate();

  function toggleDarkMode() {
    const isDark = !darkMode;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    navigate("/login");
  }

  async function handleExport() {
    setExporting(true);
    const all: any[] = [];
    let cursor: string | null = null;
    do {
      const res = await api.listBookmarks({ cursor: cursor || undefined, limit: 50 });
      all.push(...res.bookmarks);
      cursor = res.nextCursor;
    } while (cursor);

    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `link-collector-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div className="py-4 space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">设置</h2>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">显示</h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">深色模式</span>
          <button onClick={toggleDarkMode}
            className={`w-10 h-5 rounded-full transition-colors ${darkMode ? "bg-blue-500" : "bg-gray-300"}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${darkMode ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </label>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">数据管理</h3>
        <button onClick={handleExport} disabled={exporting}
          className="py-1.5 px-4 bg-gray-500 text-white rounded-lg text-sm disabled:opacity-50">
          {exporting ? "导出中..." : "导出备份（JSON）"}
        </button>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">账号</h3>
        <button onClick={handleLogout}
          className="py-1.5 px-4 bg-red-500 text-white rounded-lg text-sm">
          退出登录
        </button>
      </section>

      <section className="text-center text-xs text-gray-400">
        <p>个人收藏工具 v1.0</p>
        <p>数据存储在 Cloudflare D1 云端</p>
      </section>
    </div>
  );
}
