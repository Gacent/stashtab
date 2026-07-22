/** Simple module-level page cache to preserve state across navigations */

interface CacheEntry<T> {
  data: T;
  scrollY: number;
}

const store = new Map<string, CacheEntry<any>>();

export function getPageCache<T>(key: string): T | null {
  return store.get(key)?.data ?? null;
}

export function setPageCache<T>(key: string, data: T): void {
  const existing = store.get(key);
  store.set(key, { data, scrollY: existing?.scrollY ?? 0 });
}

export function saveScrollPosition(key: string): void {
  const existing = store.get(key);
  if (existing) {
    existing.scrollY = window.scrollY;
  }
}

export function getScrollPosition(key: string): number {
  return store.get(key)?.scrollY ?? 0;
}

export function clearPageCache(key: string): void {
  store.delete(key);
}

/** Clear all cached page data — use after delete to force re-fetch */
export function clearAllPageCache(): void {
  store.clear();
}
