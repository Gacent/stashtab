CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('link', 'note')),
  url TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  source TEXT DEFAULT '',
  content TEXT DEFAULT '',
  ai_summary TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (bookmark_id, tag_id),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(type);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_id ON bookmark_tags(tag_id);
