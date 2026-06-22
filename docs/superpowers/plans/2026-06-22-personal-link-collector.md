# 个人资源收藏工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA cross-platform personal bookmark/note collector with Cloudflare backend and SenseNova AI enrichment

**Architecture:** Vite + React + TailwindCSS PWA frontend hosted on Cloudflare Pages, Cloudflare Workers API backend with D1 SQLite database, SenseNova API for AI title/summary/tag extraction

**Tech Stack:** Vite 6, React 19, TypeScript, TailwindCSS 4, Cloudflare Workers, Cloudflare D1, Cloudflare Pages, SenseNova 6.7 Flash-Lite

## Global Constraints

- PWA must work on iOS Safari, Android Chrome, and desktop Chrome/Edge
- All backend API must run on Cloudflare Workers free tier
- Database: Cloudflare D1 (SQLite-compatible)
- AI integration: SenseNova API at `https://token.sensenova.cn/v1/chat/completions` with model `sensenova-6.7-flash-lite`
- User must configure their own SenseNova API Key in Settings page
- Zero server cost at launch; all Cloudflare services within free plan
- Frontend and backend are separate packages in the same repo under `frontend/` and `worker/`

---

## File Structure

```
/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── sw.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types.ts
│       ├── api.ts
│       ├── clipboard.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── BookmarkCard.tsx
│       │   ├── BookmarkForm.tsx
│       │   ├── TagBadge.tsx
│       │   └── SearchBar.tsx
│       └── pages/
│           ├── HomePage.tsx
│           ├── DetailPage.tsx
│           ├── TagsPage.tsx
│           ├── TagFilterPage.tsx
│           └── SettingsPage.tsx
│
├── worker/
│   ├── package.json
│   ├── wrangler.toml
│   ├── tsconfig.json
│   ├── schema.sql
│   └── src/
│       ├── index.ts
│       ├── db.ts
│       ├── sensenova.ts
│       └── handlers/
│           ├── bookmarks.ts
│           ├── tags.ts
│           ├── search.ts
│           ├── fetch-meta.ts
│           └── ai-extract.ts
│
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-06-22-personal-link-collector-design.md
        └── plans/
            └── 2026-06-22-personal-link-collector.md
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/tsconfig.json`

**Interfaces:**
- Consumes: Nothing
- Produces: Runnable frontend dev server + configurable worker project

- [ ] **Step 1: Create frontend package.json**

```json
{
  "name": "link-collector-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 3: Create tsconfig.json (frontend)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="manifest" href="/manifest.json" />
    <title>收藏夹</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 6: Create src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 7: Create worker package.json**

```json
{
  "name": "link-collector-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:migrate": "wrangler d1 execute link-collector-db --file=schema.sql",
    "db:migrate:remote": "wrangler d1 execute link-collector-db --file=schema.sql --remote"
  },
  "dependencies": {
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250201.0",
    "wrangler": "^3.100.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 8: Create wrangler.toml**

```toml
name = "link-collector-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "link-collector-db"
database_id = "link-collector-db"

[[d1_databases]]
binding = "DB"
database_name = "link-collector-db"
database_id = "link-collector-db"
preview_database_id = "link-collector-db"
```

- [ ] **Step 9: Create worker tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 10: Install dependencies and verify**

```bash
cd frontend && npm install
cd ../worker && npm install
cd ../frontend && npx vite --version
```

---

### Task 2: Backend Database Schema + Bookmarks CRUD API

**Files:**
- Create: `worker/schema.sql`
- Create: `worker/src/db.ts`
- Create: `worker/src/index.ts`
- Create: `worker/src/handlers/bookmarks.ts`
- Create: `worker/src/types.ts`

**Interfaces:**
- Consumes: Task 1 (project scaffold)
- Produces: `POST /api/bookmarks`, `GET /api/bookmarks`, `GET /api/bookmarks/:id`, `PUT /api/bookmarks/:id`, `DELETE /api/bookmarks/:id`

- [ ] **Step 1: Create schema.sql**

```sql
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
```

- [ ] **Step 2: Create types.ts (worker)**

```ts
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
}
```

- [ ] **Step 3: Create db.ts**

```ts
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
```

- [ ] **Step 4: Create index.ts (worker entry)**

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { bookmarksRouter } from "./handlers/bookmarks";
import { tagsRouter } from "./handlers/tags";
import { searchRouter } from "./handlers/search";
import { fetchMetaRouter } from "./handlers/fetch-meta";
import { aiExtractRouter } from "./handlers/ai-extract";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

app.route("/api/bookmarks", bookmarksRouter);
app.route("/api/tags", tagsRouter);
app.route("/api/search", searchRouter);
app.route("/api/fetch-meta", fetchMetaRouter);
app.route("/api/ai-extract", aiExtractRouter);

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 5: Create handlers/bookmarks.ts**

```ts
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
```

---

### Task 3: Backend Tags + Search API

**Files:**
- Create: `worker/src/handlers/tags.ts`
- Create: `worker/src/handlers/search.ts`

**Interfaces:**
- Consumes: Task 2 (db.ts, types.ts)
- Produces: Tags CRUD + stats API, Search API

- [ ] **Step 1: Create handlers/tags.ts**

```ts
import { Hono } from "hono";
import { Env, Tag } from "../types";

export const tagsRouter = new Hono<{ Bindings: Env }>();

// List all tags with bookmark count
tagsRouter.get("/", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT t.*, COUNT(bt.bookmark_id) as count
     FROM tags t
     LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
     GROUP BY t.id
     ORDER BY count DESC, t.name ASC`
  ).all();
  return c.json(result.results);
});

// Create a tag
tagsRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; color?: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: "name is required" }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)")
    .bind(id, body.name.trim(), body.color || "")
    .run();

  const tag = await c.env.DB
    .prepare("SELECT * FROM tags WHERE id = ?")
    .bind(id)
    .first<Tag>();

  return c.json(tag, 201);
});

// Delete tag
tagsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});
```

- [ ] **Step 2: Create handlers/search.ts**

```ts
import { Hono } from "hono";
import { Env, Bookmark, Tag } from "../types";

export const searchRouter = new Hono<{ Bindings: Env }>();

// GET /api/search?q=keyword&tag=tagId&source=domain
searchRouter.get("/", async (c) => {
  const q = c.req.query("q")?.trim();
  const tag = c.req.query("tag");
  const source = c.req.query("source");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);

  if (!q && !tag && !source) {
    return c.json({ bookmarks: [] });
  }

  let query = `SELECT DISTINCT b.* FROM bookmarks b`;
  const params: any[] = [];
  const conditions: string[] = [];

  // Join with bookmark_tags if filtering by tag
  if (tag) {
    query += ` JOIN bookmark_tags bt ON bt.bookmark_id = b.id`;
    conditions.push(`bt.tag_id = ?`);
    params.push(tag);
  }

  if (q) {
    conditions.push(`(b.title LIKE ? OR b.description LIKE ? OR b.notes LIKE ? OR b.ai_summary LIKE ?)`);
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  if (source) {
    conditions.push(`b.source = ?`);
    params.push(source);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY b.created_at DESC LIMIT ?`;
  params.push(limit);

  const result = await c.env.DB.prepare(query).bind(...params).all<Bookmark>();

  // Attach tags to each result
  const bookmarks = [];
  for (const row of result.results) {
    const tags = await c.env.DB
      .prepare(`SELECT t.* FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?`)
      .bind(row.id)
      .all<Tag>();
    bookmarks.push({ ...row, tags: tags.results });
  }

  return c.json({ bookmarks });
});
```

---

### Task 4: Backend Link Meta Fetcher + AI Extraction

**Files:**
- Create: `worker/src/handlers/fetch-meta.ts`
- Create: `worker/src/handlers/ai-extract.ts`
- Create: `worker/src/sensenova.ts`

**Interfaces:**
- Consumes: Task 1 (project scaffold)
- Produces: `POST /api/fetch-meta`, `POST /api/ai-extract`

- [ ] **Step 1: Create handlers/fetch-meta.ts**

```ts
import { Hono } from "hono";
import { Env } from "../types";

export const fetchMetaRouter = new Hono<{ Bindings: Env }>();

// POST /api/fetch-meta - Fetch link preview info
fetchMetaRouter.post("/", async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ error: "url is required" }, 400);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkCollector/1.0)",
      },
    });

    const html = await response.text();

    // Extract meta tags
    const title = extractMeta(html, "og:title") || extractMeta(html, "twitter:title") || extractTitle(html) || url;
    const description = extractMeta(html, "og:description") || extractMeta(html, "twitter:description") || extractMeta(html, "description") || "";
    const image = extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || "";
    const hostname = new URL(url).hostname;

    return c.json({
      title,
      description,
      cover_image: image,
      source: hostname,
      content: extractTextContent(html).slice(0, 2000), // First 2000 chars for AI
    });
  } catch (e) {
    return c.json({
      title: url,
      description: "",
      cover_image: "",
      source: new URL(url).hostname,
      content: "",
    });
  }
});

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : null;
}

function extractTextContent(html: string): string {
  // Remove scripts, styles, and tags
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 2: Create sensenova.ts**

```ts
interface SenseNovaResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function callSenseNova(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await fetch("https://token.sensenova.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sensenova-6.7-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SenseNova API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as SenseNovaResponse;
  return data.choices[0].message.content;
}

export const LINK_EXTRACT_PROMPT = `你是一个信息整理助手。根据提供的网页内容，提取：
1. 一段简洁的中文摘要（50字以内）
2. 3-5个中文标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）

只返回 JSON 格式，不要包含任何其他内容：
{"summary": "...", "tags": ["...", "..."]}`;

export const NOTE_EXTRACT_PROMPT = `根据提供的文字内容，生成：
1. 一个简洁的标题（15字以内）
2. 3-5个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）

只返回 JSON 格式，不要包含任何其他内容：
{"title": "...", "tags": ["...", "..."]}`;
```

- [ ] **Step 3: Create handlers/ai-extract.ts**

```ts
import { Hono } from "hono";
import { Env } from "../types";
import { callSenseNova, LINK_EXTRACT_PROMPT, NOTE_EXTRACT_PROMPT } from "../sensenova";

export const aiExtractRouter = new Hono<{ Bindings: Env }>();

// POST /api/ai-extract
aiExtractRouter.post("/", async (c) => {
  const body = await c.req.json<{
    type: "link" | "note";
    content: string;
    title?: string;
    apiKey: string;
  }>();

  if (!body.apiKey) {
    return c.json({ error: "API Key is required" }, 400);
  }

  if (!body.content) {
    return c.json({ error: "content is required" }, 400);
  }

  try {
    let result: { summary?: string; title?: string; tags: string[] };

    if (body.type === "link") {
      const input = `标题：${body.title || ""}\n内容：${body.content}`;
      const text = await callSenseNova(body.apiKey, LINK_EXTRACT_PROMPT, input);
      result = JSON.parse(text);
    } else {
      const text = await callSenseNova(body.apiKey, NOTE_EXTRACT_PROMPT, body.content);
      result = JSON.parse(text);
    }

    return c.json(result);
  } catch (e) {
    // Graceful fallback - if AI fails, return basic info
    if (body.type === "link") {
      return c.json({
        summary: "",
        tags: [],
        _fallback: true,
      });
    } else {
      return c.json({
        title: body.content.slice(0, 30),
        tags: [],
        _fallback: true,
      });
    }
  }
});
```

---

### Task 5: Frontend Types + API Client + Layout + Routing

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Task 1 (project scaffold), Task 2-4 (API backend)
- Produces: Working app shell with routing and API client

- [ ] **Step 1: Create types.ts**

```ts
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
```

- [ ] **Step 2: Create api.ts**

```ts
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
  // Bookmarks
  listBookmarks(params?: {
    cursor?: string;
    limit?: number;
    type?: string;
    tagId?: string;
  }) {
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
    return request<Bookmark>("/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateBookmark(
    id: string,
    data: {
      title?: string;
      description?: string;
      notes?: string;
      is_read?: number;
      tagIds?: string[];
    }
  ) {
    return request<Bookmark>(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteBookmark(id: string) {
    return request<{ success: boolean }>(`/bookmarks/${id}`, {
      method: "DELETE",
    });
  },

  // Tags
  listTags() {
    return request<(Tag & { count: number })[]>("/tags");
  },

  createTag(name: string, color?: string) {
    return request<Tag>("/tags", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
  },

  // Search
  search(params: { q?: string; tag?: string; source?: string }) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.tag) sp.set("tag", params.tag);
    if (params.source) sp.set("source", params.source);
    return request<{ bookmarks: Bookmark[] }>(`/search?${sp.toString()}`);
  },

  // Meta fetch
  fetchMeta(url: string) {
    return request<{
      title: string;
      description: string;
      cover_image: string;
      source: string;
      content: string;
    }>("/fetch-meta", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  // AI extract
  aiExtract(data: {
    type: "link" | "note";
    content: string;
    title?: string;
    apiKey: string;
  }) {
    return request<{
      summary?: string;
      title?: string;
      tags: string[];
      _fallback?: boolean;
    }>("/ai-extract", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
```

- [ ] **Step 3: Create Layout.tsx**

```tsx
import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/", label: "时间线", icon: "🏠" },
  { path: "/tags", label: "标签", icon: "🏷️" },
  { path: "/settings", label: "设置", icon: "⚙️" },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-gray-900 dark:text-white">
            收藏夹
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-full text-sm font-medium"
          >
            + 收藏
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center py-2 text-xs ${
                  isActive
                    ? "text-blue-500"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Create App.tsx**

```tsx
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import DetailPage from "./pages/DetailPage";
import TagsPage from "./pages/TagsPage";
import TagFilterPage from "./pages/TagFilterPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/bookmark/:id" element={<DetailPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/tags/:tagName" element={<TagFilterPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
```

---

### Task 6: Frontend Paste & Save Flow

**Files:**
- Create: `frontend/src/clipboard.ts`
- Create: `frontend/src/components/BookmarkForm.tsx`

**Interfaces:**
- Consumes: Task 5 (api.ts, types.ts)
- Produces: Paste-to-save form that detects link/note, fetches meta, calls AI, and saves

- [ ] **Step 1: Create clipboard.ts**

```ts
export async function readClipboard(): Promise<string> {
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch {
    // Fallback for browsers that don't support clipboard API
    return "";
  }
}

export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+/.test(text.trim());
}
```

- [ ] **Step 2: Create BookmarkForm.tsx**

```tsx
import { useState, useRef, useEffect } from "react";
import { readClipboard, isUrl } from "../clipboard";
import { api } from "../api";
import TagBadge from "./TagBadge";

const API_KEY_KEY = "link-collector-api-key";

interface PreviewData {
  type: "link" | "note";
  url?: string;
  title: string;
  description: string;
  cover_image: string;
  source: string;
  content: string;
  tags: string[];
  ai_summary: string;
}

const tagOptions = ["技术", "AI", "商业", "产品", "设计", "生活", "开源", "教程", "新闻", "观点", "工具", "资源", "阅读", "其它"];

export default function BookmarkForm({ onSaved }: { onSaved: () => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [showForm]);

  async function handlePaste() {
    const text = input.trim();
    if (!text) return;

    setLoading(true);

    if (isUrl(text)) {
      // Fetch meta
      const meta = await api.fetchMeta(text);
      const apiKey = localStorage.getItem(API_KEY_KEY) || "";

      let tags: string[] = [];
      let summary = "";

      if (apiKey && meta.content) {
        try {
          const ai = await api.aiExtract({
            type: "link",
            content: meta.content,
            title: meta.title,
            apiKey,
          });
          tags = ai.tags || [];
          summary = ai.summary || "";
        } catch {
          // AI failed, use default
        }
      }

      setPreview({
        type: "link",
        url: text,
        title: meta.title || text,
        description: meta.description,
        cover_image: meta.cover_image,
        source: meta.source,
        content: meta.content,
        tags,
        ai_summary: summary,
      });
      setSelectedTags(tags);
    } else {
      // It's a text note
      const apiKey = localStorage.getItem(API_KEY_KEY) || "";
      let title = text.slice(0, 30);
      let tags: string[] = [];

      if (apiKey) {
        try {
          const ai = await api.aiExtract({
            type: "note",
            content: text,
            apiKey,
          });
          if (ai.title) title = ai.title;
          tags = ai.tags || [];
        } catch {
          // AI failed
        }
      }

      setPreview({
        type: "note",
        title,
        description: text.slice(0, 200),
        cover_image: "",
        source: "",
        content: text,
        tags,
        ai_summary: "",
      });
      setSelectedTags(tags);
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!preview) return;

    // Ensure tags exist in the backend
    const tagIds: string[] = [];
    for (const tagName of selectedTags) {
      try {
        const tag = await api.createTag(tagName);
        tagIds.push(tag.id);
      } catch {
        // Tag might already exist - fetch it
        const tags = await api.listTags();
        const existing = tags.find((t) => t.name === tagName);
        if (existing) tagIds.push(existing.id);
      }
    }

    await api.createBookmark({
      type: preview.type,
      url: preview.url,
      title: preview.title,
      description: preview.description,
      cover_image: preview.cover_image,
      source: preview.source,
      content: preview.type === "note" ? preview.content : undefined,
      ai_summary: preview.ai_summary || undefined,
      notes,
      tagIds,
    });

    // Reset form
    setInput("");
    setPreview(null);
    setNotes("");
    setSelectedTags([]);
    setShowForm(false);
    onSaved();
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag() {
    const t = customTag.trim();
    if (t && !selectedTags.includes(t)) {
      setSelectedTags((prev) => [...prev, t]);
    }
    setCustomTag("");
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-3 px-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm hover:border-blue-400 transition-colors"
      >
        + 粘贴链接或文字来收藏
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      {!preview ? (
        <>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="在此粘贴链接或文字..."
            className="w-full min-h-[80px] p-3 border border-gray-200 dark:border-gray-600 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 dark:text-white"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handlePaste}
              disabled={loading || !input.trim()}
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? "处理中..." : "预览"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="py-2 px-4 text-gray-500 text-sm"
            >
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview card */}
          {preview.cover_image && (
            <img
              src={preview.cover_image}
              alt=""
              className="w-full h-40 object-cover rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          <div className="space-y-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {preview.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {preview.ai_summary || preview.description}
            </p>
            {preview.source && (
              <p className="text-xs text-gray-400">{preview.source}</p>
            )}
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="添加备注...（可选）"
            className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 dark:text-white"
            rows={2}
          />

          {/* Tags */}
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300"
                      : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                placeholder="自定义标签..."
                className="flex-1 text-xs p-1.5 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 dark:text-white"
              />
              <button
                onClick={addCustomTag}
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded"
              >
                添加
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              保存
            </button>
            <button
              onClick={() => {
                setPreview(null);
                setInput("");
              }}
              className="py-2 px-4 text-gray-500 text-sm"
            >
              重新输入
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

### Task 7: Frontend Timeline + Detail Page

**Files:**
- Create: `frontend/src/components/BookmarkCard.tsx`
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/DetailPage.tsx`

**Interfaces:**
- Consumes: Task 5 (api.ts, types.ts), Task 6 (BookmarkForm.tsx)
- Produces: Home timeline with infinite scroll + detail view

- [ ] **Step 1: Create BookmarkCard.tsx**

```tsx
import { Link } from "react-router-dom";
import { Bookmark } from "../types";
import TagBadge from "./TagBadge";

interface BookmarkCardProps {
  bookmark: Bookmark;
}

export default function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const isNote = bookmark.type === "note";

  return (
    <Link
      to={`/bookmark/${bookmark.id}`}
      className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
    >
      {bookmark.cover_image && (
        <img
          src={bookmark.cover_image}
          alt=""
          className="w-full h-36 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs mt-0.5">
            {isNote ? "📝" : "🔗"}
          </span>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 flex-1">
            {bookmark.title}
          </h3>
        </div>

        {(bookmark.ai_summary || bookmark.description) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {bookmark.ai_summary || bookmark.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400">
          {bookmark.source && <span>{bookmark.source}</span>}
          <span>
            {new Date(bookmark.created_at).toLocaleDateString("zh-CN")}
          </span>
          {bookmark.is_read === 1 && <span className="text-green-500">✓ 已读</span>}
        </div>

        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bookmark.tags.map((tag) => (
              <TagBadge key={tag.id} name={tag.name} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create HomePage.tsx**

```tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { Bookmark } from "../types";
import BookmarkCard from "../components/BookmarkCard";
import BookmarkForm from "../components/BookmarkForm";
import SearchBar from "../components/SearchBar";

export default function HomePage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadBookmarks = useCallback(async () => {
    const result = await api.listBookmarks({ limit: 20 });
    setBookmarks(result.bookmarks);
    setCursor(result.nextCursor);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  async function loadMore() {
    if (!cursor) return;
    const result = await api.listBookmarks({ cursor, limit: 20 });
    setBookmarks((prev) => [...prev, ...result.bookmarks]);
    setCursor(result.nextCursor);
  }

  function handleSaved() {
    loadBookmarks();
  }

  return (
    <div className="space-y-4 py-4">
      {/* Search */}
      <SearchBar />

      {/* Bookmark form (paste to save) */}
      <BookmarkForm onSaved={handleSaved} />

      {/* Timeline */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">加载中...</div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-sm">还没有收藏，粘贴一个链接开始吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
          {cursor && (
            <button
              onClick={loadMore}
              className="w-full py-3 text-sm text-blue-500 hover:text-blue-600"
            >
              加载更多
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create DetailPage.tsx**

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";
import TagBadge from "../components/TagBadge";

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    api.getBookmark(id).then((b) => {
      setBookmark(b);
      setNotes(b.notes || "");
      setLoading(false);
    });
  }, [id]);

  async function handleDelete() {
    if (!bookmark || !confirm("确定删除？")) return;
    await api.deleteBookmark(bookmark.id);
    navigate("/");
  }

  async function handleToggleRead() {
    if (!bookmark) return;
    const updated = await api.updateBookmark(bookmark.id, {
      is_read: bookmark.is_read === 1 ? 0 : 1,
    });
    setBookmark(updated);
  }

  async function handleSaveNotes() {
    if (!bookmark) return;
    const updated = await api.updateBookmark(bookmark.id, { notes });
    setBookmark(updated);
    setEditing(false);
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }

  if (!bookmark) {
    return <div className="text-center text-gray-400 py-8">未找到</div>;
  }

  return (
    <div className="py-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-blue-500 hover:text-blue-600"
      >
        ← 返回
      </button>

      {bookmark.cover_image && (
        <img
          src={bookmark.cover_image}
          alt=""
          className="w-full h-48 object-cover rounded-xl"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        {bookmark.title}
      </h1>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        {bookmark.source && <span>{bookmark.source}</span>}
        <span>{new Date(bookmark.created_at).toLocaleString("zh-CN")}</span>
        <button
          onClick={handleToggleRead}
          className={`ml-auto text-xs px-2 py-1 rounded ${
            bookmark.is_read
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {bookmark.is_read ? "✓ 已读" : "标记已读"}
        </button>
      </div>

      {bookmark.ai_summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-gray-700 dark:text-gray-300">
          <strong>AI 摘要：</strong>
          {bookmark.ai_summary}
        </div>
      )}

      {bookmark.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {bookmark.description}
        </p>
      )}

      {bookmark.type === "note" && bookmark.content && (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {bookmark.content}
        </div>
      )}

      {bookmark.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bookmark.tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} />
          ))}
        </div>
      )}

      {/* Notes / editing */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 dark:text-white resize-none"
              rows={3}
              placeholder="添加备注..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveNotes}
                className="py-1.5 px-4 bg-blue-500 text-white rounded-lg text-sm"
              >
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="py-1.5 px-4 text-gray-500 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {bookmark.notes || "添加备注..."}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-500"
            >
              编辑
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {bookmark.url && (
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm text-center font-medium"
          >
            阅读原文
          </a>
        )}
        <button
          onClick={handleDelete}
          className="py-2 px-4 text-red-500 text-sm"
        >
          删除
        </button>
      </div>
    </div>
  );
}
```

---

### Task 8: Frontend Tags Pages + Search Bar

**Files:**
- Create: `frontend/src/pages/TagsPage.tsx`
- Create: `frontend/src/pages/TagFilterPage.tsx`
- Create: `frontend/src/components/TagBadge.tsx`
- Create: `frontend/src/components/SearchBar.tsx`

**Interfaces:**
- Consumes: Task 5 (api.ts, types.ts), Task 7 (BookmarkCard.tsx)
- Produces: Tags management + filtered browsing + search functionality

- [ ] **Step 1: Create TagBadge.tsx**

```tsx
interface TagBadgeProps {
  name: string;
  onClick?: () => void;
  active?: boolean;
}

export default function TagBadge({ name, onClick, active }: TagBadgeProps) {
  const colors: Record<string, string> = {
    "技术": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    "AI": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    "商业": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    "产品": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    "设计": "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    "生活": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    "开源": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    "教程": "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    "新闻": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    "观点": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    "工具": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    "资源": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    "阅读": "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  };

  const colorClass = colors[name] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

  return (
    <span
      onClick={onClick}
      className={`inline-block text-xs px-2 py-0.5 rounded-full cursor-pointer ${
        active ? "ring-2 ring-blue-400" : ""
      } ${colorClass}`}
    >
      {name}
    </span>
  );
}
```

- [ ] **Step 2: Create SearchBar.tsx**

```tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.search({ q: query });
        setResults(res.bookmarks.slice(0, 10));
        setShowResults(true);
      } catch {
        // ignore
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function goToBookmark(id: string) {
    setShowResults(false);
    setQuery("");
    navigate(`/bookmark/${id}`);
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索收藏..."
        className="w-full py-2 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
      />

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
          {searching ? (
            <div className="p-3 text-sm text-gray-400 text-center">搜索中...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-gray-400 text-center">无结果</div>
          ) : (
            results.map((b) => (
              <button
                key={b.id}
                onClick={() => goToBookmark(b.id)}
                className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                  {b.title}
                </div>
                <div className="text-xs text-gray-400 line-clamp-1">
                  {b.description || b.ai_summary}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create TagsPage.tsx**

```tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface TagWithCount {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTags().then((data) => {
      setTags(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">标签</h2>

      {tags.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p className="text-4xl mb-2">🏷️</p>
          <p className="text-sm">还没有标签</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              to={`/tags/${encodeURIComponent(tag.name)}`}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {tag.name}
              </div>
              <div className="text-sm text-gray-400">{tag.count} 条</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create TagFilterPage.tsx**

```tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Bookmark } from "../types";
import BookmarkCard from "../components/BookmarkCard";

export default function TagFilterPage() {
  const { tagName } = useParams<{ tagName: string }>();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tagName) return;

    // Find tag by name first
    api.listTags().then(async (tags) => {
      const tag = tags.find((t) => t.name === tagName);
      if (tag) {
        const res = await api.listBookmarks({ tagId: tag.id, limit: 50 });
        setBookmarks(res.bookmarks);
      }
      setLoading(false);
    });
  }, [tagName]);

  return (
    <div className="py-4 space-y-4">
      <Link to="/tags" className="text-sm text-blue-500 hover:text-blue-600">
        ← 所有标签
      </Link>

      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        标签：{tagName}
      </h2>

      {loading ? (
        <div className="text-center text-gray-400 py-8">加载中...</div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center text-gray-400 py-8">该标签下暂无内容</div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((b) => (
            <BookmarkCard key={b.id} bookmark={b} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Task 9: Frontend Settings + PWA Config + Dark Mode

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/sw.js`

**Interfaces:**
- Consumes: Task 1 (project scaffold)
- Produces: Settings page (API key, export), PWA installable, dark mode toggle

- [ ] **Step 1: Create SettingsPage.tsx**

```tsx
import { useState } from "react";
import { api } from "../api";

const API_KEY_KEY = "link-collector-api-key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(localStorage.getItem(API_KEY_KEY) || "");
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );

  function saveApiKey() {
    if (apiKey.trim()) {
      localStorage.setItem(API_KEY_KEY, apiKey.trim());
    } else {
      localStorage.removeItem(API_KEY_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleDarkMode() {
    const isDark = !darkMode;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  async function handleExport() {
    setExporting(true);
    const all: any[] = [];
    let cursor: string | null = null;

    do {
      const res = await api.listBookmarks({ cursor: cursor || undefined, limit: 50 });
      all.push(...res.bookmarks);
      cursor = res.nextCursor;
    } while (cursor);

    const blob = new Blob([JSON.stringify(all, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `link-collector-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div className="py-4 space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">设置</h2>

      {/* API Key */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
          AI 配置
        </h3>
        <p className="text-xs text-gray-500">
          配置 SenseNova API Key 后，保存时会自动提取摘要和推荐标签。
          可在 https://platform.sensenova.cn 获取免费 Key。
        </p>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="输入你的 SenseNova API Key"
          type="password"
          className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={saveApiKey}
          className="py-1.5 px-4 bg-blue-500 text-white rounded-lg text-sm"
        >
          {saved ? "✓ 已保存" : "保存"}
        </button>
      </section>

      {/* Display */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">显示</h3>
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">深色模式</span>
          <button
            onClick={toggleDarkMode}
            className={`w-10 h-5 rounded-full transition-colors ${
              darkMode ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                darkMode ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </section>

      {/* Export */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
          数据管理
        </h3>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="py-1.5 px-4 bg-gray-500 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {exporting ? "导出中..." : "导出备份（JSON）"}
        </button>
      </section>

      {/* About */}
      <section className="text-center text-xs text-gray-400">
        <p>个人收藏工具 v1.0</p>
        <p>数据存储在 Cloudflare D1 云端</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create manifest.json**

```json
{
  "name": "收藏夹",
  "short_name": "收藏夹",
  "description": "个人资源收藏工具 - 聚合管理你的链接和笔记",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f9fafb",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Create sw.js (basic service worker for offline)**

```js
const CACHE_NAME = "link-collector-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful responses for same-origin requests
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Return cached fallback if offline
        return caches.match(event.request);
      });
    })
  );
});
```

- [ ] **Step 4: Generate placeholder icons**

Create 192x192 and 512x512 PNG icons (can use a simple colored square). For initial development, a simple SVG-based approach or placeholder is acceptable. The user can replace later.

- [ ] **Step 5: Update index.html with PWA meta tags (already done in Task 1, verify)**

Ensure the manifest link and theme-color meta tag are present in index.html.

---

### Task 10: Dark Mode Initialization

**Files:**
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: Task 1 (main.tsx)
- Produces: Dark mode applied on load based on saved preference

- [ ] **Step 1: Update main.tsx to apply dark mode on load**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Apply dark mode on load
const theme = localStorage.getItem("theme");
if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Paste detection (link vs note) — Task 6 (BookmarkForm)
- ✅ Timeline view — Task 7 (HomePage + BookmarkCard)
- ✅ Tag system + AI auto-tagging — Task 4 (AI extraction) + Task 6 (tag selection in form)
- ✅ Detail page with read/notes/delete — Task 7 (DetailPage)
- ✅ Search (title + description) — Task 3 (search API) + Task 8 (SearchBar)
- ✅ Text notes — Task 6 (note type handling)
- ✅ Tag management page — Task 8 (TagsPage)
- ✅ Tag filtering — Task 8 (TagFilterPage)
- ✅ Settings (API key config, export, dark mode) — Task 9 (SettingsPage)
- ✅ PWA installable — Task 9 (manifest.json + sw.js)
- ✅ Cloud sync via D1 — Tasks 2-4 (backend)
- ✅ SenseNova AI integration — Task 4 (ai-extract handler + sensenova.ts)
- ✅ Export backup — Task 9 (SettingsPage export function)
- ✅ Dark mode — Task 9 + Task 10

**2. Placeholder scan:** No TBD, TODO, or incomplete sections found.

**3. Type consistency:** Types match across all tasks. Bookmark/Tag interfaces are consistent between frontend and backend.
