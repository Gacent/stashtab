import { Env, Bookmark, BookmarkWithTags, Tag } from "./types";

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export async function createBookmark(
  db: D1Database,
  data: {
    type: "link" | "note";
    url?: string;
    title: string;
    description?: string;
    cover_image?: string;
    source?: string;
    content?: string;
    ai_summary?: string;
    notes?: string;
    tagIds: string[];
  }
): Promise<BookmarkWithTags> {
  const id = generateId();
  const timestamp = now();

  await db
    .prepare(
      `INSERT INTO bookmarks (id, type, url, title, description, cover_image, source, content, ai_summary, notes, is_read, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      id,
      data.type,
      data.url || null,
      data.title,
      data.description || "",
      data.cover_image || "",
      data.source || "",
      data.content || "",
      data.ai_summary || "",
      data.notes || "",
      timestamp,
      timestamp
    )
    .run();

  // Insert bookmark-tag relations
  if (data.tagIds.length > 0) {
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`
    );
    for (const tagId of data.tagIds) {
      await stmt.bind(id, tagId).run();
    }
  }

  return getBookmarkById(db, id) as Promise<BookmarkWithTags>;
}

export async function getBookmarkById(
  db: D1Database,
  id: string
): Promise<BookmarkWithTags | null> {
  const bookmark = await db
    .prepare("SELECT * FROM bookmarks WHERE id = ?")
    .bind(id)
    .first<Bookmark>();

  if (!bookmark) return null;

  const tags = await db
    .prepare(
      `SELECT t.* FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?`
    )
    .bind(id)
    .all<Tag>();

  return { ...bookmark, tags: tags.results };
}

export async function listBookmarks(
  db: D1Database,
  options: { cursor?: string; limit: number; type?: string; tagId?: string }
): Promise<{ bookmarks: BookmarkWithTags[]; nextCursor: string | null }> {
  const limit = Math.min(options.limit, 50);

  let query: string;
  let params: any[];

  if (options.tagId) {
    query = `SELECT b.* FROM bookmarks b
             JOIN bookmark_tags bt ON bt.bookmark_id = b.id
             WHERE bt.tag_id = ?
             ORDER BY b.created_at DESC LIMIT ?`;
    params = [options.tagId, limit + 1];
  } else if (options.type) {
    query = `SELECT * FROM bookmarks WHERE type = ? ORDER BY created_at DESC LIMIT ?`;
    params = [options.type, limit + 1];
  } else {
    query = `SELECT * FROM bookmarks ORDER BY created_at DESC LIMIT ?`;
    params = [limit + 1];
  }

  const result = await db.prepare(query).bind(...params).all<Bookmark>();
  const hasMore = result.results.length > limit;
  const rows = hasMore ? result.results.slice(0, limit) : result.results;

  const bookmarks: BookmarkWithTags[] = [];
  for (const row of rows) {
    const tags = await db
      .prepare(
        `SELECT t.* FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?`
      )
      .bind(row.id)
      .all<Tag>();
    bookmarks.push({ ...row, tags: tags.results });
  }

  return {
    bookmarks,
    nextCursor: hasMore ? rows[rows.length - 1].created_at : null,
  };
}

export async function updateBookmark(
  db: D1Database,
  id: string,
  data: {
    title?: string;
    description?: string;
    notes?: string;
    is_read?: number;
    tagIds?: string[];
  }
): Promise<BookmarkWithTags | null> {
  const timestamp = now();
  const updates: string[] = ["updated_at = ?"];
  const params: any[] = [timestamp];

  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?");
    params.push(data.notes);
  }
  if (data.is_read !== undefined) {
    updates.push("is_read = ?");
    params.push(data.is_read);
  }

  params.push(id);

  await db
    .prepare(`UPDATE bookmarks SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...params)
    .run();

  if (data.tagIds !== undefined) {
    await db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").bind(id).run();
    if (data.tagIds.length > 0) {
      const stmt = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
      for (const tagId of data.tagIds) {
        await stmt.bind(id, tagId).run();
      }
    }
  }

  return getBookmarkById(db, id);
}

export async function deleteBookmark(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db.prepare("DELETE FROM bookmarks WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}
