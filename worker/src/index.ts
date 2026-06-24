import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { Env } from "./types";
import { bookmarksRouter } from "./handlers/bookmarks";
import { fetchMetaRouter } from "./handlers/fetch-meta";
import { aiExtractRouter } from "./handlers/ai-extract";
import puppeteer from "@cloudflare/puppeteer";

const app = new Hono<{ Bindings: Env }>();
app.use("/*", cors());

const auth = createMiddleware(async (c, next) => {
  if (c.req.path === "/api/health" || c.req.path === "/api/login" || c.req.path === "/api/test-browser") return await next();
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== c.env.APP_PASSWORD) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.use("/api/*", auth);

app.post("/api/login", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  if (!password || password !== c.env.APP_PASSWORD) return c.json({ error: "密码错误" }, 401);
  return c.json({ token: password });
});

// Test endpoint: check if Browser Run works
app.get("/api/test-browser", async (c) => {
  if (!c.env.BROWSER) return c.json({ error: "BROWSER binding not available" });
  try {
    const browser = await puppeteer.launch(c.env.BROWSER);
    const page = await browser.newPage();
    await page.goto("https://example.com", { waitUntil: "networkidle0", timeout: 15000 });
    const title = await page.title();
    await browser.close();
    return c.json({ ok: true, title });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e) });
  }
});

app.route("/api/bookmarks", bookmarksRouter);
app.route("/api/fetch-meta", fetchMetaRouter);
app.route("/api/ai-extract", aiExtractRouter);

app.get("/api/health", (c) => c.json({ ok: true }));
export default app;
