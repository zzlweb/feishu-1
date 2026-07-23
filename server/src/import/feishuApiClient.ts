export interface FeishuApiConfig {
  appId: string;
  appSecret: string;
  baseUrl?: string;
}

export interface FeishuApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  getTenantAccessToken(): Promise<string>;
}

export type FeishuApiErrorCode =
  | 'FEISHU_AUTH_FAILED'
  | 'FEISHU_API_ERROR'
  | 'FEISHU_TIMEOUT'
  | 'FEISHU_CONFIG_MISSING';

export class FeishuApiError extends Error {
  readonly code: FeishuApiErrorCode;
  readonly httpStatus?: number;
  readonly apiCode?: number;

  constructor(
    code: FeishuApiErrorCode,
    message: string,
    options?: { httpStatus?: number; apiCode?: number; cause?: unknown },
  ) {
    super(message);
    this.name = 'FeishuApiError';
    this.code = code;
    this.httpStatus = options?.httpStatus;
    this.apiCode = options?.apiCode;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isFeishuApiError(error: unknown): error is FeishuApiError {
  return error instanceof FeishuApiError;
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

/**
 * 图片和附件可由另一个已获 Drive 媒体下载权限的应用读取。
 * 未配置时与正文导入共用 FEISHU_APP_ID / FEISHU_APP_SECRET。
 */
export function getFeishuMediaApiConfigFromEnv(): FeishuApiConfig | null {
  const appId = process.env.FEISHU_MEDIA_APP_ID?.trim();
  const appSecret = process.env.FEISHU_MEDIA_APP_SECRET?.trim();
  if (appId && appSecret) {
    return {
      appId,
      appSecret,
      baseUrl: process.env.FEISHU_OPEN_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    };
  }
  return getFeishuApiConfigFromEnv();
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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FeishuApiError('FEISHU_TIMEOUT', '飞书 Open API 请求超时，请检查网络或稍后重试', { cause: error });
    }
    throw error;
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
    let body: TenantAccessTokenResponse;
    try {
      body = await response.json() as TenantAccessTokenResponse;
    } catch (error) {
      throw new FeishuApiError(
        'FEISHU_AUTH_FAILED',
        `获取飞书 tenant_access_token 失败：响应无法解析 (${response.status})`,
        { httpStatus: response.status, cause: error },
      );
    }
    if (!response.ok || !isSuccessCode(body.code) || !body.tenant_access_token) {
      throw new FeishuApiError(
        'FEISHU_AUTH_FAILED',
        body.msg || `获取飞书 tenant_access_token 失败 (${response.status})。请检查 FEISHU_APP_ID / FEISHU_APP_SECRET。`,
        { httpStatus: response.status, apiCode: body.code },
      );
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
    let body: FeishuApiEnvelope<T>;
    try {
      body = await response.json() as FeishuApiEnvelope<T>;
    } catch (error) {
      throw new FeishuApiError(
        'FEISHU_API_ERROR',
        `飞书 API 响应无法解析 (${response.status})：${path}`,
        { httpStatus: response.status, cause: error },
      );
    }
    if (!response.ok || !isSuccessCode(body.code)) {
      throw new FeishuApiError(
        'FEISHU_API_ERROR',
        body.msg || `飞书 API 请求失败 (${response.status})：${path}`,
        { httpStatus: response.status, apiCode: body.code },
      );
    }
    return (body.data || {}) as T;
  }

  return { request, getTenantAccessToken };
}
