export interface FeishuApiConfig {
  appId: string;
  appSecret: string;
  baseUrl?: string;
}

export interface FeishuApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  getTenantAccessToken(): Promise<string>;
}

interface FeishuApiEnvelope<T> {
  code?: number;
  msg?: string;
  data?: T;
}

const DEFAULT_BASE_URL = 'https://open.feishu.cn';
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

export function getFeishuApiConfigFromEnv(): FeishuApiConfig | null {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    baseUrl: process.env.FEISHU_OPEN_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}

export function extractFeishuToken(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export type FeishuObjectType =
  | 'wiki'
  | 'docx'
  | 'doc'
  | 'bitable'
  | 'sheet'
  | 'mindnote'
  | 'file'
  | 'slides'
  | 'unknown';

export interface ParsedFeishuUrl {
  token: string;
  type: FeishuObjectType;
  tableId?: string;
  viewId?: string;
}

const URL_SEGMENT_TYPE_MAP: Record<string, FeishuObjectType> = {
  wiki: 'wiki',
  docx: 'docx',
  docs: 'doc',
  doc: 'doc',
  base: 'bitable',
  bitable: 'bitable',
  sheets: 'sheet',
  sheet: 'sheet',
  mindnotes: 'mindnote',
  minder: 'mindnote',
  file: 'file',
  slides: 'slides',
};

/**
 * 解析飞书链接，区分 wiki / docx / 多维表格等对象类型，并提取 table / view 参数。
 * wiki 链接拿到的是节点 token，需要后续再解析出真正的 obj_token。
 */
export function parseFeishuUrl(sourceUrl: string): ParsedFeishuUrl {
  const url = new URL(sourceUrl);
  const parts = url.pathname.split('/').filter(Boolean);
  const token = parts[parts.length - 1] || '';
  const segment = (parts[parts.length - 2] || '').toLowerCase();
  return {
    token,
    type: URL_SEGMENT_TYPE_MAP[segment] || 'unknown',
    tableId: url.searchParams.get('table') || undefined,
    viewId: url.searchParams.get('view') || undefined,
  };
}

function isSuccessCode(code: number | undefined) {
  return code === undefined || code === 0;
}

function getRequestTimeoutMs() {
  const value = Number(process.env.FEISHU_OPEN_API_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRequestTimeoutMs());
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface TenantAccessTokenResponse {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
}

export function createFeishuApiClient(config: FeishuApiConfig): FeishuApiClient {
  let tenantToken: string | null = null;
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

  async function getTenantAccessToken() {
    if (tenantToken) return tenantToken;
    const response = await fetchWithTimeout(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret,
      }),
    });
    const body = await response.json() as TenantAccessTokenResponse;
    if (!response.ok || !isSuccessCode(body.code) || !body.tenant_access_token) {
      throw new Error(body.msg || `获取飞书 tenant_access_token 失败 (${response.status})`);
    }
    tenantToken = body.tenant_access_token;
    return tenantToken;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getTenantAccessToken();
    const response = await fetchWithTimeout(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    const body = await response.json() as FeishuApiEnvelope<T>;
    if (!response.ok || !isSuccessCode(body.code)) {
      throw new Error(body.msg || `飞书 API 请求失败 (${response.status})`);
    }
    return (body.data || {}) as T;
  }

  return { request, getTenantAccessToken };
}
