import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ImportedAsset, ImportWarning } from './types';

const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');

/** 飞书素材下载上限约 5 QPS；导入时并行块转换容易打爆，统一排队。 */
const MEDIA_DOWNLOAD_CONCURRENCY = 2;
const MEDIA_DOWNLOAD_MAX_RETRIES = 4;

let activeDownloads = 0;
const downloadWaitQueue: Array<() => void> = [];

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function safeAssetName(sourceUrl: string, contentType: string) {
  const url = new URL(sourceUrl);
  const original = path.basename(url.pathname) || 'asset';
  const extFromPath = path.extname(original);
  const ext = extFromPath || extensionFromContentType(contentType);
  const stem = original
    .replace(/\.[^.]+$/, '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'asset';
  return `${uuidv4()}-${stem}${ext}`;
}

function extensionFromContentType(contentType: string) {
  if (/image\/png/i.test(contentType)) return '.png';
  if (/image\/jpe?g/i.test(contentType)) return '.jpg';
  if (/image\/gif/i.test(contentType)) return '.gif';
  if (/image\/webp/i.test(contentType)) return '.webp';
  if (/image\/svg/i.test(contentType)) return '.svg';
  if (/video\/mp4/i.test(contentType)) return '.mp4';
  if (/application\/pdf/i.test(contentType)) return '.pdf';
  return '';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withMediaDownloadSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeDownloads >= MEDIA_DOWNLOAD_CONCURRENCY) {
    await new Promise<void>(resolve => downloadWaitQueue.push(resolve));
  }
  activeDownloads += 1;
  try {
    return await task();
  } finally {
    activeDownloads -= 1;
    const next = downloadWaitQueue.shift();
    if (next) next();
  }
}

function extractMediaToken(sourceUrl: string): string | null {
  try {
    const match = new URL(sourceUrl).pathname.match(/\/medias\/([^/]+)\/download\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function isFeishuMediaDownloadUrl(sourceUrl: string) {
  return /\/open-apis\/drive\/v1\/medias\/[^/]+\/download\/?$/i.test(sourceUrl);
}

function formatDownloadFailure(status: number, sourceUrl: string, bodyText: string): string {
  let message = `资源下载失败 (${status})：${sourceUrl}`;
  if (/99991400|frequency limit|rate limit|触发频率/i.test(bodyText)) {
    message += '。飞书素材下载触发频控，已自动重试仍失败。';
    return message;
  }
  if (status === 400 && /extra|bitablePerm/i.test(bodyText)) {
    message += '。多维表格高级权限素材缺少 extra 鉴权参数。';
    return message;
  }
  if (status === 403) {
    message += '。应用已开通 docs:document.media:download 仍 403 时，请把应用加为该文档/知识库协作者，并确认文档权限允许「创建副本/打印/下载」；跨租户公开文档通常无法用本租户应用身份下载素材。';
    return message;
  }
  if (bodyText) {
    const compact = bodyText.replace(/\s+/g, ' ').slice(0, 180);
    message += `。详情：${compact}`;
  }
  return message;
}

async function fetchMediaBinary(
  sourceUrl: string,
  headers: Record<string, string>,
): Promise<{ ok: true; contentType: string; buffer: Buffer } | { ok: false; status: number; bodyText: string }> {
  const mediaToken = extractMediaToken(sourceUrl);
  const authHeaders: Record<string, string> = {};
  if (headers.Authorization) authHeaders.Authorization = headers.Authorization;
  else if (headers.authorization) authHeaders.Authorization = headers.authorization;

  let lastStatus = 0;
  let lastBody = '';

  for (let attempt = 0; attempt <= MEDIA_DOWNLOAD_MAX_RETRIES; attempt += 1) {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: authHeaders,
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return { ok: true, contentType, buffer };
    }

    const bodyText = (await response.text().catch(() => '')).slice(0, 500);
    lastStatus = response.status;
    lastBody = bodyText;

    const rateLimited = response.status === 400 && /99991400|frequency limit|rate limit|触发频率/i.test(bodyText);
    const retryable = rateLimited || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MEDIA_DOWNLOAD_MAX_RETRIES) break;
    await sleep(250 * (attempt + 1) * (attempt + 1));
  }

  // 直链失败时尝试临时下载链接（仍需素材权限；主要用于规避瞬时异常）。
  if (mediaToken && authHeaders.Authorization && isFeishuMediaDownloadUrl(sourceUrl)) {
    try {
      const apiBase = new URL(sourceUrl).origin;
      const tmpApi = `${apiBase}/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${encodeURIComponent(mediaToken)}`;
      const tmpRes = await fetch(tmpApi, {
        headers: {
          Authorization: authHeaders.Authorization,
          Accept: 'application/json',
        },
      });
      if (tmpRes.ok) {
        const payload = await tmpRes.json() as {
          data?: { tmp_download_urls?: Array<{ file_token?: string; tmp_download_url?: string }> };
        };
        const tmpUrl = payload.data?.tmp_download_urls?.find(item => item.file_token === mediaToken)?.tmp_download_url
          || payload.data?.tmp_download_urls?.[0]?.tmp_download_url;
        if (tmpUrl) {
          const fileRes = await fetch(tmpUrl);
          if (fileRes.ok) {
            return {
              ok: true,
              contentType: fileRes.headers.get('content-type') || '',
              buffer: Buffer.from(await fileRes.arrayBuffer()),
            };
          }
          lastStatus = fileRes.status;
          lastBody = (await fileRes.text().catch(() => '')).slice(0, 500);
        }
      }
    } catch {
      // keep lastStatus/lastBody from direct download
    }
  }

  return { ok: false, status: lastStatus || 0, bodyText: lastBody };
}

export async function mirrorRemoteAsset(
  sourceUrl: string,
  headers: Record<string, string>,
  warnings: ImportWarning[],
): Promise<ImportedAsset> {
  try {
    const result = await withMediaDownloadSlot(() => fetchMediaBinary(sourceUrl, headers));
    if (!result.ok) {
      const message = formatDownloadFailure(result.status, sourceUrl, result.bodyText);
      warnings.push({ type: 'asset', message });
      return { id: uuidv4(), sourceUrl, status: 'failed', warning: message };
    }

    ensureUploadDir();
    const fileName = safeAssetName(sourceUrl, result.contentType);
    fs.writeFileSync(path.join(uploadDir, fileName), result.buffer);
    return {
      id: uuidv4(),
      sourceUrl,
      localUrl: `/static/uploads/${fileName}`,
      name: fileName,
      mimeType: result.contentType,
      status: 'downloaded',
    };
  } catch (error) {
    const message = `资源下载失败：${error instanceof Error ? error.message : sourceUrl}`;
    warnings.push({ type: 'asset', message });
    return { id: uuidv4(), sourceUrl, status: 'failed', warning: message };
  }
}
