export interface ApiPayload<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

export function parseJsonPayload<T>(text: string): ApiPayload<T> {
  if (!text) return { code: -1, message: '服务器响应为空' };
  try {
    return JSON.parse(text) as ApiPayload<T>;
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    const suffix = snippet ? `：${snippet}` : '';
    return { code: -1, message: `服务器返回了非 JSON 响应，请确认后端服务或代理是否正常${suffix}` };
  }
}

export async function readApiPayload<T>(res: Response): Promise<ApiPayload<T>> {
  const text = await res.text();
  if (!text) {
    return res.ok
      ? { code: 0 }
      : { code: res.status, message: `请求失败 (${res.status})` };
  }

  const body = parseJsonPayload<T>(text);
  if (!res.ok) {
    return {
      code: body.code ?? res.status,
      message: body.message || `请求失败 (${res.status})`,
      data: body.data,
    };
  }
  return body;
}
