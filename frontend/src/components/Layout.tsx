import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

  // Check for dark mode preference
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark)] 
      flex flex-col transition-colors duration-300">
      
      {/* Top Bar */}
      <header className="sticky top-0 z-20 
        bg-[var(--color-canvas)]/95 dark:bg-[var(--color-surface-dark)]/95 
        backdrop-blur-sm border-b border-[var(--color-hairline)] 
        dark:border-[var(--color-surface-dark-elevated)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-semibold text-[var(--color-ink)] 
              dark:text-[var(--color-on-dark)] text-[20px] tracking-tight">
              拾签
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-[var(--radius-md)] 
                bg-[var(--color-surface-card)] dark:bg-[var(--color-surface-dark-elevated)]
                text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)]
                hover:text-[var(--color-primary)] transition-colors btn-press"
              aria-label="切换深色模式"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-20">
        {children}
      </main>

          {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 
        bg-[var(--color-canvas)] dark:bg-[var(--color-surface-dark)] 
        border-t border-[var(--color-hairline)] 
        dark:border-[var(--color-surface-dark-elevated)]">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-14">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button 
                key={item.path} 
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center h-full px-4 text-xs font-medium 
                  transition-colors duration-200 ${
                    isActive 
                      ? 'text-[var(--color-primary)]' 
                      : 'text-[var(--color-muted)] dark:text-[var(--color-on-dark-soft)] hover:text-[var(--color-body)]'
                  }`}>
                <span className={`w-5 h-5 mb-0.5 flex items-center justify-center text-[16px] 
                  ${isActive ? 'text-[var(--color-primary)]' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-[11px] uppercase tracking-[1px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}