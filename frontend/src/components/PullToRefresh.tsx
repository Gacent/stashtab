import { useRef, useState, useCallback } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 60;

export default function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0); // ref mirrors pullDistance for closure-safe reads

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing || disabled) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { pullRef.current = 0; setPullDistance(0); return; }
    const distance = Math.min(Math.sqrt(delta * 10), 120);
    pullRef.current = distance;
    setPullDistance(distance);
  }, [refreshing, disabled]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || refreshing || disabled) return;
    pulling.current = false;
    if (pullRef.current >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        pullRef.current = 0;
        setPullDistance(0);
      }
    } else {
      pullRef.current = 0;
      setPullDistance(0);
    }
  }, [refreshing, onRefresh, disabled]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-none"
        style={{
          height: pullDistance,
          opacity: Math.min(pullDistance / THRESHOLD, 1),
        }}
      >
        <div className={`text-[var(--color-primary)] text-sm font-medium transition-opacity`}>
          {refreshing ? (
            <span className="loading-pulse">刷新中...</span>
          ) : pullDistance >= THRESHOLD ? (
            "释放刷新"
          ) : (
            "下拉刷新"
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
