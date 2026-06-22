import { Bookmark, BookmarkListResponse, Tag } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    ...options,
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
  // Auth
  login(password: string) {
    return request<{ token: string }>("/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  listBookmarks(params?: { cursor?: string; limit?: number; type?: string; tagId?: string }) {
    const sp = new URLSearchParams();
    if (params?.cursor) sp.set("cursor", params.cursor);
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.type) sp.set("type", params.type);
    if (params?.tagId) sp.set("tagId", params.tagId);
    const qs = sp.toString();
    return request<BookmarkListResponse>(`/bookmarks${qs ? `?${qs}` : ""}`);
  },

  getBookmark(id: string) { return request<Bookmark>(`/bookmarks/${id}`); },

  createBookmark(data: {
    type: "link" | "note"; url?: string; title: string; description?: string;
    cover_image?: string; source?: string; content?: string; ai_summary?: string;
    notes?: string; tagIds?: string[];
  }) { return request<Bookmark>("/bookmarks", { method: "POST", body: JSON.stringify(data) }); },

  updateBookmark(id: string, data: { title?: string; description?: string; notes?: string; is_read?: number; tagIds?: string[] }) {
    return request<Bookmark>(`/bookmarks/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteBookmark(id: string) { return request<{ success: boolean }>(`/bookmarks/${id}`, { method: "DELETE" }); },

  listTags() { return request<(Tag & { count: number })[]>("/tags"); },

  createTag(name: string, color?: string) {
    return request<Tag>("/tags", { method: "POST", body: JSON.stringify({ name, color }) });
  },

  search(params: { q?: string; tag?: string; source?: string }) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.tag) sp.set("tag", params.tag);
    if (params.source) sp.set("source", params.source);
    return request<{ bookmarks: Bookmark[] }>(`/search?${sp.toString()}`);
  },

  fetchMeta(url: string) {
    return request<{ title: string; description: string; cover_image: string; source: string; content: string }>(
      "/fetch-meta", { method: "POST", body: JSON.stringify({ url }) }
    );
  },

  aiExtract(data: { type: "link" | "note"; content: string; title?: string }) {
    return request<{ summary?: string; title?: string; tags: string[]; _fallback?: boolean }>(
      "/ai-extract", { method: "POST", body: JSON.stringify(data) }
    );
  },
};