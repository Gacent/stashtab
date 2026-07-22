import { Hono } from "hono";
import { Env } from "../types";

export const fetchMetaRouter = new Hono<{ Bindings: Env }>();

interface MetaResult {
  title: string;
  description: string;
  cover_image: string;
  source: string;
  content: string;
}

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

    // 1. Check KV cache
    const cacheKey = `og:${url}`;
    if (c.env.OG_CACHE) {
      const cached = await c.env.OG_CACHE.get(cacheKey, { type: "json" });
      if (cached) {
        const result = cached as MetaResult;
        console.log(`[fetch-meta] ✓ Cache hit: ${result.title}`);
        return c.json(result);
      }
    }

    // 2. Parallel UA fetch
    const bestHtml = await tryFetchParallel(url);

    if (bestHtml) {
      // 3. Extract OG metadata from HTML
      const meta = extractMetaFromHtml(bestHtml);

      if (meta.title) {
        const result: MetaResult = {
          title: meta.title || hostname,
          description: meta.description || `来自 ${hostname}`,
          cover_image: meta.cover_image,
          source: hostname,
          content: extractContent(bestHtml).slice(0, 2000),
        };

        // 4. Write to KV cache
        if (c.env.OG_CACHE) {
          await c.env.OG_CACHE.put(cacheKey, JSON.stringify(result), {
            expirationTtl: 86400,
          });
        }

        console.log(`[fetch-meta] ✓ OG tags: ${result.title}`);
        return c.json(result);
      }
    }

    // 5. Microlink API fallback
    console.log(`[fetch-meta] ⏳ Trying Microlink API...`);
    const microlinkResult = await tryMicrolink(url);
    if (microlinkResult) {
      // Write to KV cache
      if (c.env.OG_CACHE) {
        await c.env.OG_CACHE.put(cacheKey, JSON.stringify(microlinkResult), {
          expirationTtl: 86400,
        });
      }
      console.log(`[fetch-meta] ✓ Microlink: ${microlinkResult.title}`);
      return c.json(microlinkResult);
    }

    // 6. Final fallback
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

/** Fetch with 4 parallel UAs, score each response, return the best HTML text */
async function tryFetchParallel(url: string): Promise<string | null> {
  const uas = [
    "Twitterbot/1.0",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
  ];

  const results = await Promise.allSettled(
    uas.map((ua) => fetchWithTimeout(url, ua, 5000)),
  );

  // Read each successful response body and score it
  const scored: { html: string; score: number }[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value) continue;
    try {
      const html = await result.value.text();
      const score = qualityScore(html);
      if (score > 0) scored.push({ html, score });
    } catch {
      // If reading body fails, skip this response
    }
  }

  if (scored.length === 0) return null;

  // Sort by score descending, return the best HTML
  scored.sort((a, b) => b.score - a.score);
  return scored[0].html;
}

/** Fetch a URL with a specific User-Agent and timeout */
async function fetchWithTimeout(
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Score an HTML response for quality */
function qualityScore(html: string): number {
  let score = 0;

  // OG tags indicate rich metadata
  if (html.includes("og:title")) score += 3;
  if (html.includes("og:description")) score += 2;

  // Substantial content (not a thin anti-bot page)
  if (html.length > 2000) score += 1;

  // No anti-bot / challenge page signals
  const antiBotKeywords = [
    "captcha",
    "安全验证",
    "人机验证",
    "Checking your browser",
    "byted_acrawler",
  ];
  const lower = html.toLowerCase();
  if (!antiBotKeywords.some((k) => lower.includes(k.toLowerCase()))) {
    score += 1;
  }

  // Empty body = anti-bot challenge or non-page
  if (/<body>\s*<\/body>/i.test(html)) score -= 10;

  return score;
}

/** Extract OG metadata from HTML text using regex (no DOM/clone needed) */
function extractMetaFromHtml(html: string): Pick<MetaResult, "title" | "description" | "cover_image"> {
  const extract = (property: string): string | null => {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, "i"),
    ];
    for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
    return null;
  };

  const rawTitle = extract("og:title") || extract("twitter:title") || extract("title") || html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
  let decodedTitle = "";
  try { decodedTitle = decode(decodeURIComponent(rawTitle)); } catch { decodedTitle = decode(rawTitle); }

  return {
    title: decodedTitle,
    description: decode(extract("og:description") || extract("twitter:description") || extract("description") || ""),
    cover_image: extract("og:image") || extract("twitter:image") || "",
  };
}

/** Try Microlink API as fallback (no artificial timeout — let CF Workers' 30s limit handle it) */
async function tryMicrolink(url: string): Promise<MetaResult | null> {
  try {
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) {
      console.log(`[Microlink] ✗ HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { data?: { title?: string; description?: string; image?: { url?: string } } };
    if (!data?.data?.title) {
      console.log(`[Microlink] ✗ No title in response`);
      return null;
    }
    const hostname = new URL(url).hostname;
    return {
      title: decode(data.data.title || ""),
      description: decode(data.data.description || `来自 ${hostname}`),
      cover_image: data.data.image?.url || "",
      source: hostname,
      content: data.data.description || "",
    };
  } catch (e) {
    console.log(`[Microlink] ✗ Error: ${e}`);
    return null;
  }
}

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

function fallback(url: string, hostname: string) {
  return {
    title: makeReadableTitle(url, hostname),
    description: `来自 ${hostname}`,
    cover_image: "",
    source: hostname,
    content: "",
  };
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