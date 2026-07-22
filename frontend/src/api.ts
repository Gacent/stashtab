import { Bookmark, BookmarkListResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options?.headers as Record<string, string>) },
  });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
    throw new Error("未登录");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  login(password: string) {
    return request<{ token: string }>("/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  // Bookmarks - list, search, filter by tag all through /bookmarks
  listBookmarks(params?: { cursor?: string; limit?: number; tag?: string; q?: string; source?: string; range?: string; start?: string; end?: string }) {
    const sp = new URLSearchParams();
    if (params?.cursor) sp.set("cursor", params.cursor);
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.tag) sp.set("tag", params.tag);
    if (params?.q) sp.set("q", params.q);
    if (params?.source) sp.set("source", params.source);
    if (params?.range) sp.set("range", params.range);
    if (params?.start) sp.set("start", params.start);
    if (params?.end) sp.set("end", params.end);
    return request<BookmarkListResponse>(`/bookmarks${sp.toString() ? `?${sp}` : ""}`);
  },

  // Create bookmark - new payload shape
  createBookmark(data: {
    url?: string;
    title: string;
    original_title?: string;
    summary?: string;
    tags?: string[];
    source?: string;
    cover_image?: string;
  }) {
    return request<Bookmark>("/bookmarks", { method: "POST", body: JSON.stringify(data) });
  },

  // Delete bookmark
  deleteBookmark(id: string) {
    return request<{ success: boolean }>(`/bookmarks/${id}`, { method: "DELETE" });
  },

  // Tags - now just lists tag names from Feishu multi-select options
  listTags() {
    return request<{ name: string; count: number }[]>("/bookmarks/tags");
  },

  // Fetch link metadata (unchanged)
  fetchMeta(url: string) {
    return request<{ title: string; description: string; cover_image: string; source: string; content: string }>(
      "/fetch-meta", { method: "POST", body: JSON.stringify({ url }) }
    );
  },

  // AI extract - returns title, summary, tags, and _fallback flag
  aiExtract(data: { content: string; title?: string }) {
    return request<{ title?: string; summary?: string; tags: string[]; _fallback?: boolean }>(
      "/ai-extract", { method: "POST", body: JSON.stringify(data) }
    );
  },
};