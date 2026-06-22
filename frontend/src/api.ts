import { Bookmark, BookmarkListResponse, Tag } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  listBookmarks(params?: { cursor?: string; limit?: number; type?: string; tagId?: string }) {
    const sp = new URLSearchParams();
    if (params?.cursor) sp.set("cursor", params.cursor);
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.type) sp.set("type", params.type);
    if (params?.tagId) sp.set("tagId", params.tagId);
    const qs = sp.toString();
    return request<BookmarkListResponse>(`/bookmarks${qs ? `?${qs}` : ""}`);
  },

  getBookmark(id: string) {
    return request<Bookmark>(`/bookmarks/${id}`);
  },

  createBookmark(data: {
    type: "link" | "note";
    url?: string;
    title: string;
    description?: string;
    cover_image?: string;
    source?: string;
    content?: string;
    ai_summary?: string;
    notes?: string;
    tagIds?: string[];
  }) {
    return request<Bookmark>("/bookmarks", { method: "POST", body: JSON.stringify(data) });
  },

  updateBookmark(id: string, data: { title?: string; description?: string; notes?: string; is_read?: number; tagIds?: string[] }) {
    return request<Bookmark>(`/bookmarks/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteBookmark(id: string) {
    return request<{ success: boolean }>(`/bookmarks/${id}`, { method: "DELETE" });
  },

  listTags() {
    return request<(Tag & { count: number })[]>("/tags");
  },

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
      "/fetch-meta",
      { method: "POST", body: JSON.stringify({ url }) }
    );
  },

  aiExtract(data: { type: "link" | "note"; content: string; title?: string; apiKey: string }) {
    return request<{ summary?: string; title?: string; tags: string[]; _fallback?: boolean }>(
      "/ai-extract",
      { method: "POST", body: JSON.stringify(data) }
    );
  },
};
