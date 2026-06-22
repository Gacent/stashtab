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
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface BookmarkWithTags extends Bookmark {
  tags: Tag[];
}

export interface Env {
  DB: D1Database;
  SENSENOVA_API_KEY?: string;
  APP_PASSWORD?: string;
}
