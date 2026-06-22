import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/", label: "首页", icon: "🏠" },
  { path: "/tags", label: "标签", icon: "🏷️" },
  { path: "/settings", label: "设置", icon: "⚙️" },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-gray-900 dark:text-white">收藏集</Link>
          <Link to="/" className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-full text-sm font-medium">+ 收藏</Link>
        </div>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`flex-1 flex flex-col items-center py-2 text-xs ${isActive ? "text-blue-500" : "text-gray-500 dark:text-gray-400"}`}>
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
