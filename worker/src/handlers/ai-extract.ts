import { Hono } from "hono";
import { Env } from "../types";
import { callSenseNova, LINK_EXTRACT_PROMPT, NOTE_EXTRACT_PROMPT } from "../sensenova";

export const aiExtractRouter = new Hono<{ Bindings: Env }>();

/** Safe JSON parse: strips markdown fences + blocks prototype pollution */
function safeJsonParse(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
  return JSON.parse(cleaned, (key, value) => {
    // Block prototype pollution keys
    if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
    return value;
  });
}

/** POST /api/ai-extract */
aiExtractRouter.post("/", async (c) => {
  const body = await c.req.json<{
    type: "link" | "note";
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
    let result: { title?: string; summary?: string; tags: string[]; type?: string; _fallback?: boolean };

    if (body.type === "link") {
      // Truncate content to 1500 chars to avoid hitting model limits
      const truncatedContent = body.content.slice(0, 1500);
      const input = `标题：${body.title || ""}\n内容：${truncatedContent}`;
      const text = await callSenseNova(apiKey, LINK_EXTRACT_PROMPT, input);
      const parsed = safeJsonParse(text) as Record<string, unknown>;
      console.log(`[ai-extract] Raw AI response: ${text.slice(0, 200)}`);
      result = {
        title: typeof parsed.title === "string" ? parsed.title : "",
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : [],
        type: typeof parsed.type === "string" ? parsed.type : "article",
      };
    } else {
      const text = await callSenseNova(apiKey, NOTE_EXTRACT_PROMPT, body.content);
      const parsed = safeJsonParse(text) as Record<string, unknown>;
      result = {
        title: typeof parsed.title === "string" ? parsed.title : body.content.slice(0, 30),
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : [],
      };
    }

    return c.json(result);
  } catch (e) {
    console.error("SenseNova AI extract error:", e);
    // Graceful fallback - if AI fails, return basic info
    if (body.type === "link") {
      return c.json({ title: "", summary: "", tags: [], _fallback: true });
    } else {
      return c.json({ title: body.content.slice(0, 30), tags: [], _fallback: true });
    }
  }
});