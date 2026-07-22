import { Hono } from "hono";
import { Env } from "../types";
import { callSenseNova } from "../sensenova";

export const aiExtractRouter = new Hono<{ Bindings: Env }>();

/** SHA-1 hash for cache key generation */
async function sha1(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Safe JSON parse: extracts JSON object from AI response, strips markdown fences,
 *  reasoning prefixes, and trailing text. Blocks prototype pollution. */
function safeJsonParse(text: string): Record<string, unknown> {
  // Strip markdown code fences
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
  
  // Find the first '{' and last '}' to extract the JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in response");
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  
  return JSON.parse(cleaned, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
    return value;
  });
}

const FULL_PROMPT = `你是一个专业的信息整理助手。根据提供的网页标题和内容，生成：
1. 简洁的标题（10字以内）：这个资源真正是什么？去掉营销噱头和震惊体，概括核心内容
2. 简洁的中文摘要（80-150字）：概括文章的核心观点、主要论据和结论
3. 3-5个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）

只返回 JSON 格式，不要包含任何其他内容：
{"title": "...", "summary": "...", "tags": ["...", "..."]}`;

const RETRY_PROMPT = `根据以下内容，生成 3-5 个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）：

只返回 JSON 格式：
{"tags": ["...", "..."]}`;

/** POST /api/ai-extract */
aiExtractRouter.post("/", async (c) => {
  const body = await c.req.json<{
    content: string;
    title?: string;
  }>();

  const apiKey = c.env.SENSENOVA_API_KEY;
  if (!apiKey) {
    return c.json({ tags: [], _fallback: true, _error: "AI 未配置" });
  }

  if (!body.content) {
    return c.json({ error: "content is required" }, 400);
  }

  try {
    // Truncate content to 500 chars to avoid hitting model limits
    const truncatedContent = body.content.slice(0, 500);
    const input = `标题：${body.title || ""}\n内容：${truncatedContent}`;

    // Check KV cache
    const cacheKey = `ai:${await sha1(input)}`;
    const cached = await c.env.AI_CACHE.get(cacheKey, { type: "json" });
    if (cached) {
      const result = cached as Record<string, unknown>;
      return c.json({
        title: typeof result.title === "string" ? result.title : "",
        summary: typeof result.summary === "string" ? result.summary : "",
        tags: Array.isArray(result.tags) ? result.tags.filter((t): t is string => typeof t === "string") : [],
      });
    }

    // First attempt: full prompt with title + summary + tags
    let title = "";
    let summary = "";
    let tags: string[] = [];

    try {
      const text = await callSenseNova(apiKey, FULL_PROMPT, input);
      const parsed = safeJsonParse(text) as Record<string, unknown>;
      title = typeof parsed.title === "string" ? parsed.title : "";
      summary = typeof parsed.summary === "string" ? parsed.summary : "";
      tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : [];
    } catch (firstErr) {
      console.error("SenseNova first attempt failed:", firstErr);
      // Retry with shorter prompt (only tags)
      try {
        const text = await callSenseNova(apiKey, RETRY_PROMPT, input);
        const parsed = safeJsonParse(text) as Record<string, unknown>;
        tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : [];
      } catch (secondErr) {
        console.error("SenseNova retry also failed:", secondErr);
        return c.json({ title: "", summary: "", tags: [], _fallback: true });
      }
    }

    // Write to KV cache with 24h TTL
    try {
      await c.env.AI_CACHE.put(cacheKey, JSON.stringify({ title, summary, tags }), { expirationTtl: 86400 });
    } catch (cacheErr) {
      console.error("Failed to write AI cache:", cacheErr);
    }

    return c.json({ title, summary, tags });
  } catch (e) {
    console.error("AI extract error:", e);
    return c.json({ title: "", tags: [], _fallback: true });
  }
});