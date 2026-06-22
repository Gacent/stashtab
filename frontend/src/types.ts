export interface Bookmark {
  id: string;
  type: "link" | "note";
  url?: string;
  title: string;
  description?: string;
  cover_image?: string;
  source?: string;
  content?: string;
  ai_summary?: string;
  notes?: string;
  is_read: number;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  count?: number;
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
  nextCursor: string | null;
}
