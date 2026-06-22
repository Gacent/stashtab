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
