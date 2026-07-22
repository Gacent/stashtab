interface SenseNovaResponse {
  choices: Array<{
    message: {
      content: string | null;
      reasoning_content?: string;
      reasoning?: string;
    };
  }>;
}

export async function callSenseNova(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
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
          max_tokens: 4096,
          reasoning_effort: "none",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SenseNova API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as SenseNovaResponse;
      const msg = data.choices?.[0]?.message;
      let content = msg?.content;

      // Some models put reasoning in a separate field - try to extract JSON from it
      if (!content) {
        const reasoning = msg?.reasoning_content || msg?.reasoning;
        if (reasoning) {
          const jsonMatch = reasoning.match(/\{[\s\S]*"title"[\s\S]*"tags"[\s\S]*\}/);
          if (jsonMatch) return jsonMatch[0];
          // Fallback: return reasoning text and let caller parse
          return reasoning;
        }
      }

      if (!content) {
        console.error("SenseNova empty response:", JSON.stringify(data).slice(0, 500));
        throw new Error("SenseNova returned empty content");
      }
      return content;
    } catch (err) {
      clearTimeout(timeoutId);

      // JSON parse errors: don't retry
      if (err instanceof SyntaxError) {
        throw err;
      }

      // Empty content errors: don't retry
      if (err instanceof Error && err.message === "SenseNova returned empty content") {
        throw err;
      }

      // Last attempt exhausted: throw
      if (attempt >= maxRetries) {
        throw err;
      }

      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error("Unexpected error in callSenseNova");
}

export const LINK_EXTRACT_PROMPT = `你是一个专业的信息整理助手。根据提供的网页标题和内容，生成以下四部分：

1. 简洁的标题（10字以内）：这个资源真正是什么？去掉营销噱头和震惊体，概括核心内容
   例如："React Server Components 官方文档" 而非 "震惊！React 19 终于发布了"
   例如："TailwindCSS v4 新特性解析" 而非 "前端圈炸了！这个CSS框架彻底颠覆了我们的认知"
   例如："Figma AI 设计工具" 而非 "设计师要失业了？Figma 推出革命性AI功能"
2. 简洁的中文摘要（80-150字）：概括文章的核心观点、主要论据和结论
3. 3-5个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）
4. 文章类型（article/video/tool/paper/social）

只返回 JSON 格式，不要包含任何其他内容：
{"title": "...", "summary": "...", "tags": ["..."], "type": "article"}`;

export const NOTE_EXTRACT_PROMPT = `根据提供的文字内容，生成：
1. 一个简洁的标题（15字以内）
2. 一段简短的摘要（50字以内）
3. 3-5个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）

只返回 JSON 格式，不要包含任何其他内容：
{"title": "...", "summary": "...", "tags": ["...", "..."]}`;