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
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SenseNova API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as SenseNovaResponse;
  return data.choices[0].message.content;
}

export const LINK_EXTRACT_PROMPT = `你是一个专业的信息整理助手。根据提供的网页标题和内容，生成以下三部分：

1. 简洁的中文摘要（80-150字）：概括文章的核心观点、主要论据和结论，让读者不点开原文也能理解文章精华
2. 3-5个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）
3. 文章类型（article/video/tool/paper/social）

只返回 JSON 格式，不要包含任何其他内容：
{"summary": "...", "tags": ["...", "..."], "type": "article"}`;

export const NOTE_EXTRACT_PROMPT = `根据提供的文字内容，生成：
1. 一个简洁的标题（15字以内）
2. 一段简短的摘要（50字以内）
3. 3-5个中文分类标签（从以下类别中匹配：技术、AI、商业、产品、设计、生活、开源、教程、新闻、观点、工具、资源、阅读、其它）

只返回 JSON 格式，不要包含任何其他内容：
{"title": "...", "summary": "...", "tags": ["...", "..."]}`;