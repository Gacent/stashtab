import { Hono } from "hono";
import { Env } from "../types";
import { createBookmark, getBookmarkById, listBookmarks, updateBookmark, deleteBookmark } from "../db";

export const bookmarksRouter = new Hono<{ Bindings: Env }>();

// List bookmarks (with pagination, type filter, tag filter)
bookmarksRouter.get("/", async (c) => {
  const cursor = c.req.query("cursor");
  const limit = parseInt(c.req.query("limit") || "20");
  const type = c.req.query("type");
  const tagId = c.req.query("tagId");

  const result = await listBookmarks(c.env.DB, { cursor, limit, type, tagId });
  return c.json(result);
});

// Get single bookmark
bookmarksRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const bookmark = await getBookmarkById(c.env.DB, id);
  if (!bookmark) return c.json({ error: "Not found" }, 404);
  return c.json(bookmark);
});

// Create bookmark
bookmarksRouter.post("/", async (c) => {
  const body = await c.req.json<{
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
  }>();

  if (!body.type || !body.title) {
    return c.json({ error: "type and title are required" }, 400);
  }

  const bookmark = await createBookmark(c.env.DB, {
    ...body,
    tagIds: body.tagIds || [],
  });
  return c.json(bookmark, 201);
});

// Update bookmark
bookmarksRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    notes?: string;
    is_read?: number;
    tagIds?: string[];
  }>();

  const bookmark = await updateBookmark(c.env.DB, id, body);
  if (!bookmark) return c.json({ error: "Not found" }, 404);
  return c.json(bookmark);
});

// Delete bookmark
bookmarksRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await deleteBookmark(c.env.DB, id);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
