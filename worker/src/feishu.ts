/**
 * Feishu Base API client for Cloudflare Workers.
 *
 * Provides token management (cached with 60s expiry buffer) and CRUD
 * operations for Feishu Bitable (多维表格) records.
 */

/* ------------------------------------------------------------------ */
/*  Token cache (module-level, keyed by appId)                        */
/* ------------------------------------------------------------------ */

interface TokenCache {
  value: string;
  expiresAt: number; // epoch ms
  appId: string;
}

let tokenCache: TokenCache | null = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

async function feishuFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...(options.headers as Record<string, string> | undefined),
  };

  const resp = await globalThis.fetch(url, { ...options, headers });

  if (!resp.ok) {
    let bodyText = "";
    try {
      bodyText = await resp.text();
    } catch {
      bodyText = "(unable to read response body)";
    }
    throw new Error(
      `Feishu API error ${resp.status} ${resp.statusText}: ${bodyText}`,
    );
  }

  return resp;
}

/* ------------------------------------------------------------------ */
/*  1. getFeishuToken                                                  */
/* ------------------------------------------------------------------ */

export async function getFeishuToken(
  appId: string,
  appSecret: string,
): Promise<string> {
  const now = Date.now();

  // Use cached token if same appId and still valid (with 60 s safety buffer)
  if (tokenCache && tokenCache.appId === appId && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const resp = await feishuFetch(
    `${FEISHU_BASE}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );

  const data = (await resp.json()) as {
    code: number;
    msg: string;
    tenant_access_token: string;
    expire: number; // seconds until expiry
  };

  if (data.code !== 0) {
    throw new Error(
      `Feishu getTenantAccessToken failed: code=${data.code} msg=${data.msg}`,
    );
  }

  // expire is in seconds, convert to absolute ms
  const expiresAt = Date.now() + data.expire * 1000;
  tokenCache = { value: data.tenant_access_token, expiresAt, appId };

  return data.tenant_access_token;
}

/* ------------------------------------------------------------------ */
/*  2. createFeishuRecord                                              */
/* ------------------------------------------------------------------ */

export async function createFeishuRecord(
  token: string,
  appToken: string,
  tableId: string,
  fields: Record<string, any>,
): Promise<{ record_id: string; fields: Record<string, any> }> {
  const resp = await feishuFetch(
    `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    },
  );

  const data = (await resp.json()) as {
    code: number;
    msg: string;
    data: { record: { record_id: string; fields: Record<string, any> } };
  };

  if (data.code !== 0) {
    throw new Error(
      `Feishu createRecord failed: code=${data.code} msg=${data.msg}`,
    );
  }

  return data.data.record;
}

/* ------------------------------------------------------------------ */
/*  3. listFeishuRecords                                               */
/* ------------------------------------------------------------------ */

export async function listFeishuRecords(
  token: string,
  appToken: string,
  tableId: string,
  pageSize?: number,
  pageToken?: string,
): Promise<{
  items: { record_id: string; fields: Record<string, any> }[];
  page_token: string | null;
  has_more: boolean;
}> {
  const params = new URLSearchParams();
  if (pageSize !== undefined) params.set("page_size", String(pageSize));
  if (pageToken !== undefined) params.set("page_token", pageToken);
  // Sort by 保存时间 descending (newest first)
  params.set("sort", JSON.stringify(["保存时间 desc"]));

  const url = `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records${params.size > 0 ? "?" + params.toString() : ""}`;

  const resp = await feishuFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await resp.json()) as {
    code: number;
    msg: string;
    data: {
      items: { record_id: string; fields: Record<string, any> }[];
      page_token: string | null;
      has_more: boolean;
    };
  };

  if (data.code !== 0) {
    throw new Error(
      `Feishu listRecords failed: code=${data.code} msg=${data.msg}`,
    );
  }

  const resultData = data.data;
  return {
    items: resultData?.items ?? [],
    page_token: resultData?.page_token ?? null,
    has_more: resultData?.has_more ?? false,
  };
}

/* ------------------------------------------------------------------ */
/*  4. deleteFeishuRecord                                              */
/* ------------------------------------------------------------------ */

export async function deleteFeishuRecord(
  token: string,
  appToken: string,
  tableId: string,
  recordId: string,
): Promise<void> {
  const resp = await feishuFetch(
    `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const data = (await resp.json()) as { code: number; msg: string };

  if (data.code !== 0) {
    throw new Error(
      `Feishu deleteRecord failed: code=${data.code} msg=${data.msg}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  5. listFeishuFieldOptions                                          */
/* ------------------------------------------------------------------ */

export async function listFeishuFieldOptions(
  token: string,
  appToken: string,
  tableId: string,
  fieldName: string,
): Promise<{ name: string }[]> {
  const url = `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;

  const resp = await feishuFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await resp.json()) as {
    code: number;
    msg: string;
    data: {
      items: {
        field_name: string;
        propertie_options?: { name: string }[];
      }[];
    };
  };

  if (data.code !== 0) {
    throw new Error(
      `Feishu listFields failed: code=${data.code} msg=${data.msg}`,
    );
  }

  const field = data.data.items.find((f) => f.field_name === fieldName);
  if (!field) {
    throw new Error(
      `Feishu listFieldOptions: field "${fieldName}" not found`,
    );
  }

  return field.propertie_options ?? [];
}

/* ------------------------------------------------------------------ */
/*  6. searchFeishuRecords                                             */
/* ------------------------------------------------------------------ */

export async function searchFeishuRecords(
  token: string,
  appToken: string,
  tableId: string,
  options: { query?: string; tag?: string; pageSize?: number },
): Promise<{
  items: { record_id: string; fields: Record<string, any> }[];
}> {
  const { query, tag } = options;
  const allItems: { record_id: string; fields: Record<string, any> }[] = [];
  let pageToken: string | undefined;
  let hasMore = true;
  let pageCount = 0;
  const MAX_PAGES = 5; // Safety: cap at 5 pages (2500 records with default 500/page)

  // Fetch pages (with safety limit)
  while (hasMore && pageCount < MAX_PAGES) {
    const result = await listFeishuRecords(
      token,
      appToken,
      tableId,
      Math.min(options.pageSize ?? 500, 500),
      pageToken,
    );
    allItems.push(...result.items);
    hasMore = result.has_more;
    pageToken = result.page_token ?? undefined;
    pageCount++;
  }

  // Client-side filtering
  const filtered = allItems.filter((item) => {
    const fields = item.fields;

    // Tag filter: 标签 is an array of objects/strings
    if (tag) {
      const tagField = fields["标签"];
      if (!Array.isArray(tagField)) return false;

      const tagNames = tagField.map((t: any) =>
        typeof t === "string" ? t : t.name ?? t.text ?? String(t),
      );
      if (!tagNames.some((n) => n.toLowerCase() === tag.toLowerCase())) {
        return false;
      }
    }

    // Query filter: search in AI标题, 原文标题, AI摘要
    if (query) {
      const lowerQuery = query.toLowerCase();
      const searchFields = ["AI标题", "原文标题", "AI摘要"];
      const matched = searchFields.some((fieldName) => {
        const val = fields[fieldName];
        return (
          val !== undefined &&
          val !== null &&
          String(val).toLowerCase().includes(lowerQuery)
        );
      });
      if (!matched) return false;
    }

    return true;
  });

  return { items: filtered };
}
