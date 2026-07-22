import { Hono } from "hono";
import { Env } from "../types";
import {
  getFeishuToken,
  createFeishuRecord,
  listFeishuRecords,
  deleteFeishuRecord,
  listFeishuFieldOptions,
  searchFeishuRecords,
} from "../feishu";

export const bookmarksRouter = new Hono<{ Bindings: Env }>();

/** Tags cache: avoids full table scan on every /tags request */
let tagsCache: { data: { name: string; count: number }[]; expiresAt: number } | null = null;
const TAGS_CACHE_TTL = 60_000; // 60 seconds

async function withFeishu<T>(c: any, fn: (token: string) => Promise<T>): Promise<Response> {
  try {
    const token = await getFeishuToken(c.env.FEISHU_APP_ID, c.env.FEISHU_APP_SECRET);
    const result = await fn(token);
    return c.json(result as any);
  } catch (e: any) {
    console.error("Feishu API error:", e);
    return c.json({ error: e.message || "Feishu API error" }, 500);
  }
}

// List bookmarks
bookmarksRouter.get("/", async (c) => {
  const tag = c.req.query("tag");
  const q = c.req.query("q");
  const source = c.req.query("source");
  const range = c.req.query("range");
  const start = c.req.query("start");
  const end = c.req.query("end");
  const pageSize = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const pageToken = c.req.query("cursor");

  return withFeishu(c, async (token) => {
    if (q || tag || source || range || start || end) {
      const result = await searchFeishuRecords(token, c.env.FEISHU_BASE_APP_TOKEN, c.env.FEISHU_BASE_TABLE_ID, {
        query: q || undefined,
        tag: tag || undefined,
        source: source || undefined,
        timeRange: range || undefined,
        timeStart: start || undefined,
        timeEnd: end || undefined,
        pageSize,
      });
      // Sort by date descending for filtered results
      result.items.sort((a, b) => {
        const ta = new Date(a.fields["保存时间"] ?? 0).getTime();
        const tb = new Date(b.fields["保存时间"] ?? 0).getTime();
        return tb - ta;
      });
      return { bookmarks: result.items.map(toBookmark), nextCursor: null };
    }
    const result = await listFeishuRecords(token, c.env.FEISHU_BASE_APP_TOKEN, c.env.FEISHU_BASE_TABLE_ID, pageSize, pageToken || undefined);
    const bookmarks = result.items.map(toBookmark);
    // Sort by date descending (newest first)
    bookmarks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return {
      bookmarks,
      nextCursor: result.has_more ? result.page_token : null,
    };
  });
});

// Create bookmark
bookmarksRouter.post("/", async (c) => {
  const body = await c.req.json<{
    url?: string;
    title: string;
    original_title?: string;
    summary?: string;
    tags?: string[];
    source?: string;
    cover_image?: string;
  }>();

  // --- Input validation ---
  if (!body.title || typeof body.title !== "string") {
    return c.json({ error: "title is required" }, 400);
  }
  const title = body.title.trim().slice(0, 200);
  if (!title) return c.json({ error: "title cannot be blank" }, 400);

  const summary = (typeof body.summary === "string" ? body.summary : "").slice(0, 5000);
  const originalTitle = (typeof body.original_title === "string" ? body.original_title : "").slice(0, 500);
  const source = (typeof body.source === "string" ? body.source : "").slice(0, 200);

  // Tags: max 20, each max 50 chars, strings only
  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 20)
        .map((t) => t.slice(0, 50))
    : [];

  // URL: validate format if provided
  let validUrl = "";
  if (body.url && typeof body.url === "string") {
    try {
      const u = new URL(body.url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        validUrl = u.toString();
      }
    } catch {
      // invalid URL — ignore
    }
  }

  return withFeishu(c, async (token) => {
    const fields: Record<string, any> = {
      "AI标题": title,
      "原文标题": originalTitle,
      "标签": tags,
      "AI摘要": summary,
      "保存时间": Date.now(),
      "来源": source,
    };
    // URL field: only include when URL exists, use Feishu hyperlink format
    if (validUrl) {
      fields["URL"] = { text: title, link: validUrl };
    }
    // 封面图: only include when non-empty
    if (body.cover_image) {
      fields["封面图"] = body.cover_image;
    }
    const record = await createFeishuRecord(token, c.env.FEISHU_BASE_APP_TOKEN, c.env.FEISHU_BASE_TABLE_ID, fields);
    return c.json(toBookmark(record), 201);
  });
});

// Delete bookmark
bookmarksRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  return withFeishu(c, async (token) => {
    await deleteFeishuRecord(token, c.env.FEISHU_BASE_APP_TOKEN, c.env.FEISHU_BASE_TABLE_ID, id);
    return { success: true };
  });
});

// List all tags (multi-select options from Feishu)
bookmarksRouter.get("/tags", async (c) => {
  // Serve from cache if valid
  if (tagsCache && Date.now() < tagsCache.expiresAt) {
    return c.json(tagsCache.data);
  }

  return withFeishu(c, async (token) => {
    // Collect all unique tag names with counts from actual records
    const tagCounts = new Map<string, number>();
    let pageToken: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 5;
    while (hasMore && pageCount < MAX_PAGES) {
      const result = await listFeishuRecords(token, c.env.FEISHU_BASE_APP_TOKEN, c.env.FEISHU_BASE_TABLE_ID, 500, pageToken);
      for (const item of result.items) {
        const tagField = item.fields["标签"];
        if (Array.isArray(tagField)) {
          for (const t of tagField) {
            const name = typeof t === "string" ? t : t.name ?? String(t);
            if (name) tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
          }
        }
      }
      hasMore = result.has_more;
      pageToken = result.page_token ?? undefined;
      pageCount++;
    }
    const data = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    tagsCache = { data, expiresAt: Date.now() + TAGS_CACHE_TTL };
    return data;
  });
});

function toBookmark(record: { record_id: string; fields: Record<string, any> }) {
  const f = record.fields;
  let url = "";
  if (typeof f["URL"] === "string") url = f["URL"];
  else if (f["URL"] && typeof f["URL"] === "object") url = f["URL"]?.link || f["URL"]?.url || "";

  let tags: string[] = [];
  if (Array.isArray(f["标签"])) {
    tags = f["标签"].map((t: any) => (typeof t === "string" ? t : t.name ?? String(t)));
  }

  // Parse the date: Feishu returns timestamp (ms) or ISO string
  let createdAt = "";
  const rawDate = f["保存时间"];
  if (typeof rawDate === "number") {
    createdAt = new Date(rawDate).toISOString();
  } else if (typeof rawDate === "string") {
    createdAt = rawDate;
  }

  return {
    id: record.record_id,
    title: f["AI标题"] || "",
    original_title: f["原文标题"] || "",
    url,
    tags,
    summary: f["AI摘要"] || "",
    created_at: createdAt,
    source: f["来源"] || "",
    cover_image: f["封面图"] || "",
  };
}
