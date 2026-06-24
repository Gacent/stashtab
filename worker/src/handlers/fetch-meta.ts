import { Hono } from "hono";
import { Env } from "../types";
import puppeteer from "@cloudflare/puppeteer";

export const fetchMetaRouter = new Hono<{ Bindings: Env }>();

// Search engine bot UAs that bypass byted_acrawler (Toutiao/ByteDance anti-bot)
const BOT_UAs = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
];

/** SSRF protection: validate URL scheme + block private IPs */
function validateUrl(urlStr: string): { ok: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  // Only allow http/https
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http/https URLs are allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  // Block private/internal IPs
  const privatePatterns = [
    /^127\./,                    // 127.x.x.x
    /^10\./,                     // 10.x.x.x
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16-31.x.x
    /^192\.168\./,              // 192.168.x.x
    /^0\./,                      // 0.x.x.x
    /^169\.254\./,              // link-local
    /^::1$/,                     // IPv6 loopback
    /^fc00:/,                    // IPv6 ULA
    /^fe80:/,                    // IPv6 link-local
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      return { ok: false, error: "Private/internal URLs are not allowed" };
    }
  }

  // Block localhost
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, error: "localhost is not allowed" };
  }

  return { ok: true };
}

/** POST /api/fetch-meta - Fetch link preview info */
fetchMetaRouter.post("/", async (c) => {
  const { url: rawUrl } = await c.req.json<{ url: string }>();
  if (!rawUrl) return c.json({ error: "url is required" }, 400);

  // SSRF protection
  const validation = validateUrl(rawUrl);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  try {
    const url = cleanUrl(rawUrl);
    const hostname = new URL(url).hostname;

    console.log(`[fetch-meta] Processing: ${url}`);

    // Special handling for GitHub repo URLs — use GitHub API since direct fetch fails from CF Workers
    const githubResult = await tryGithubApi(url, hostname);
    if (githubResult) {
      console.log(`[fetch-meta] ✓ GitHub API: ${githubResult.title}`);
      return c.json(githubResult);
    }

    // Special handling for Bilibili — use Bilibili API since all bot UAs are blocked
    const bilibiliResult = await tryBilibiliApi(url, hostname);
    if (bilibiliResult) {
      console.log(`[fetch-meta] ✓ Bilibili API: ${bilibiliResult.title}`);
      return c.json(bilibiliResult);
    }

// Toutiao handled by tryFetch with Googlebot UA

    const html = await tryFetch(url);

    if (html) {
      const rawTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title") || extractTitle(html) || "";
      let decodedTitle = "";
      try { decodedTitle = decode(decodeURIComponent(rawTitle)); } catch { decodedTitle = decode(rawTitle); }
      const title = decodedTitle;
      const description = decode(extractMeta(html, "og:description") || extractMeta(html, "twitter:description") || extractMeta(html, "description") || "");
      const image = extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || "";

      // If we got meaningful OG tags, return them
      if (title && title !== "视频号") {
        console.log(`[fetch-meta] ✓ OG tags: ${title}`);
        return c.json({
          title: title || hostname,
          description: description || `来自 ${hostname}`,
          cover_image: image,
          source: hostname,
          content: extractContent(html).slice(0, 2000),
        });
      }
    }

    // Fallback to Browser Run for JS-rendered pages
    console.log(`[fetch-meta] ⏳ Trying Browser Run...`);
    const browserResult = await tryBrowserRender(c.env, url);
    if (browserResult) {
      console.log(`[fetch-meta] ✓ Browser Run: ${browserResult.title}`);
      return c.json(browserResult);
    }

    // Final fallback
    console.log(`[fetch-meta] ⚠ Fallback: ${hostname}`);
    return c.json(fallback(url, hostname));
  } catch {
    try {
      return c.json(fallback(rawUrl, new URL(rawUrl).hostname));
    } catch {
      return c.json({ title: rawUrl, description: "", cover_image: "", source: "", content: "" });
    }
  }
});

/** Try GitHub API for github.com/owner/repo URLs */
async function tryGithubApi(url: string, hostname: string): Promise<ReturnType<typeof fallback> | null> {
  if (!hostname.includes("github.com")) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "BookmarkApp/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;

    const description = data.description ? decode(data.description) : "";
    const stars = data.stargazers_count > 0 ? `⭐ ${data.stargazers_count}` : "";
    const lang = data.language || "";
    const summary = [description, stars, lang].filter(Boolean).join(" · ");

    return {
      title: `${owner}/${repo}`,
      description: summary || `${owner}/${repo} on GitHub`,
      cover_image: "",
      source: "github.com",
      content: description,
    };
  } catch {
    return null;
  }
}

/** Try Bilibili API for bilibili.com/video/BVxxx URLs */
async function tryBilibiliApi(url: string, hostname: string): Promise<ReturnType<typeof fallback> | null> {
  if (!hostname.includes("bilibili.com") && !hostname.includes("b23.tv")) return null;

  // Extract BV id from URL
  const bvidMatch = url.match(/(BV[\w]{10})/i);
  if (!bvidMatch) return null;
  const bvid = bvidMatch[1];

  try {
    const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BookmarkApp/1.0)" },
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    if (json.code !== 0 || !json.data) return null;

    const d = json.data;
    const title = decode(d.title || "");
    const desc = decode(d.desc || "");
    const owner = d.owner?.name || "";
    const pic = d.pic || "";
    const duration = d.duration ? `${Math.floor(d.duration / 60)}:${String(d.duration % 60).padStart(2, "0")}` : "";
    const view = d.stat?.view ?? 0;
    const like = d.stat?.like ?? 0;
    const favorite = d.stat?.favorite ?? 0;

    // Build summary: UP主 + 播放量 + 时长 + 描述
    const stats = [
      owner && `UP: ${owner}`,
      view > 0 && `${view} 播放`,
      duration && `时长 ${duration}`,
      like > 0 && `${like} 点赞`,
      favorite > 0 && `${favorite} 收藏`,
    ].filter(Boolean).join(" · ");

    const summary = [stats, desc].filter(Boolean).join("\n\n");

    return {
      title: `【B站】${title}`,
      description: summary || `${title} - Bilibili`,
      cover_image: pic,
      source: "bilibili.com",
      content: desc,
    };
  } catch {
    return null;
  }
}

/** Try Browser Run for JS-rendered pages (WeChat Channels, etc.) */
async function tryBrowserRender(env: Env, url: string): Promise<ReturnType<typeof fallback> | null> {
  // Only use Browser Run if binding is available
  if (!env.BROWSER) {
    console.log(`[Browser Run] ⚠ BROWSER binding not available`);
    return null;
  }

  try {
    console.log(`[Browser Run] Launching browser...`);
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    // Set mobile viewport
    await page.setViewport({ width: 375, height: 812 });

    // Navigate with timeout
    console.log(`[Browser Run] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract metadata from the rendered page
    const result = await page.evaluate(() => {
      // @ts-ignore - This runs in browser context, not Worker
      const getMeta = (prop: string): string | null => {
        // @ts-ignore
        const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
        return el?.getAttribute("content") || null;
      };

      return {
        // @ts-ignore
        title: getMeta("og:title") || document.title || null,
        // @ts-ignore
        description: getMeta("og:description") || document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
        image: getMeta("og:image") || null,
        // @ts-ignore
        content: document.body?.innerText?.slice(0, 2000) || null,
      };
    });

    await browser.close();

    // Only return if we got meaningful content
    if (!result.title || result.title === "视频号") {
      console.log(`[Browser Run] ⚠ No meaningful content extracted`);
      return null;
    }

    console.log(`[Browser Run] ✓ Extracted: ${result.title}`);
    const hostname = new URL(url).hostname;
    return {
      title: decode(result.title || ""),
      description: decode(result.description || `来自 ${hostname}`),
      cover_image: result.image || "",
      source: hostname,
      content: result.content || "",
    };
  } catch (error) {
    console.log(`[Browser Run] ✗ Error: ${error}`);
    return null;
  }
}

/*
 * NOTE: Zhihu, Juejin, Douyin, Xiaohongshu, Toutiao adapters removed.
 * These platforms require authentication/anti-bot signatures that cannot
 * be obtained in a CF Workers environment, OR ByteDance directly blocks
 * CF Workers IP ranges (Toutiao):
 * - Zhihu: 403 without login cookies
 * - Juejin: requires msToken + a_bogus browser-computed signatures
 * - Douyin: iteminfo API returns status 11110 (closed/changed)
 * - Xiaohongshu: no public API, requires paid third-party service
 * - Toutiao: byted_acrawler blocks CF Workers IPs regardless of UA
 *
 * For Toutiao specifically: both www and mobile subdomains are blocked.
 * Even Googlebot UA returns content from local curl but not from Workers.
 * TryFetch handles whatever it can; Browser Run is the only reliable fallback.
 * Known "accessible" vs "blocked" is inconsistent per-video (probably content
 * moderation settings).
 */

/** Strip tracking params and keep only meaningful ones */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** Try to fetch the page, falling back through multiple UAs */
async function tryFetch(url: string): Promise<string | null> {
  // Try search engine bot UAs first — these bypass byted_acrawler anti-bot on Toutiao
  const allUAs = [
    ...BOT_UAs,
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  ];

  for (const ua of allUAs) {
    try {
      const html = await fetchWithUA(url, ua);
      if (!html) continue;

      // Must have OG meta or a proper title tag
      if (!html.includes("og:title") && !html.includes("<title")) continue;
      // Must be substantial enough to be a real page
      if (html.length < 2000) continue;

      return html;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchWithUA(url: string, userAgent: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();

  // Reject known anti-bot / challenge pages
  const signals = [
    "安全验证", "captcha", "verification",
    "Checking your browser", "人机验证", "byted_acrawler",
  ];
  if (signals.some((s) => html.toLowerCase().includes(s.toLowerCase()))) return null;
  // Obfuscated JS bundle with empty body = anti-bot challenge
  if (html.includes("<body></body>") || html.includes("<head></head>")) return null;

  return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fallback(url: string, hostname: string) {
  return {
    title: makeReadableTitle(url, hostname),
    description: `来自 ${hostname}`,
    cover_image: "",
    source: hostname,
    content: "",
  };
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1] : null;
}

function extractContent(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function makeReadableTitle(url: string, hostname: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    if (hostname.includes("toutiao")) {
      const id = parts.find((p) => /^\d+$/.test(p)) || "";
      return `今日头条文章 ${id ? `#${id.slice(0, 8)}` : ""}`.trim();
    }
    if (hostname.includes("mp.weixin") || hostname.includes("weixin.qq")) {
      return "微信公众号文章";
    }
    if (hostname.includes("twitter") || hostname.includes("x.com")) {
      return `Twitter ${parts[0] ? `@${parts[0]}` : ""}`.trim();
    }
    if (hostname.includes("github.com")) {
      if (parts.length >= 2) return `GitHub: ${parts[0]}/${parts[1]}`;
    }
    if (hostname.includes("zhihu")) {
      if (parts[0] === "question") return `知乎问题 #${(parts[1] || "").slice(0, 8)}`;
      if (parts[0] === "answer") return `知乎回答 #${(parts[1] || "").slice(0, 8)}`;
      return "知乎";
    }
    if (hostname.includes("bilibili") || hostname.includes("b23")) {
      return `B站视频 ${u.searchParams.get("bvid") || parts.find((p) => /^BV/i.test(p)) || ""}`.trim();
    }

    const path = parts.slice(0, 2).join(" › ");
    return path ? `${hostname} › ${path}` : hostname;
  } catch {
    return hostname;
  }
}