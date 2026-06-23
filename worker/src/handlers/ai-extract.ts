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
      const input = `标题：${body.title || ""}\n内容：${body.content}`;
      const text = await callSenseNova(apiKey, LINK_EXTRACT_PROMPT, input);
      const parsed = JSON.parse(text);
      result = {
        title: parsed.title || "",
        summary: parsed.summary || "",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        type: parsed.type || "article",
      };
    } else {
      const text = await callSenseNova(apiKey, NOTE_EXTRACT_PROMPT, body.content);
      result = JSON.parse(text);
    }

    return c.json(result);
  } catch (e) {
    // Graceful fallback - if AI fails, return basic info
    if (body.type === "link") {
      return c.json({ title: "", summary: "", tags: [], _fallback: true });
    } else {
      return c.json({ title: body.content.slice(0, 30), tags: [], _fallback: true });
    }
  }
});