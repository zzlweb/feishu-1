import { Router } from 'express';
import type { Request, Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  createFeishuApiClient,
  getFeishuMediaApiConfigFromEnv,
} from '../import/feishuApiClient';

const router = Router();

const MEDIA_PROXY_CONCURRENCY = 3;
let activeProxyDownloads = 0;
const proxyWaitQueue: Array<() => void> = [];

async function withProxySlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeProxyDownloads >= MEDIA_PROXY_CONCURRENCY) {
    await new Promise<void>(resolve => proxyWaitQueue.push(resolve));
  }
  activeProxyDownloads += 1;
  try {
    return await task();
  } finally {
    activeProxyDownloads -= 1;
    const next = proxyWaitQueue.shift();
    if (next) next();
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFeishuMedia(
  downloadUrl: string,
  accessToken: string,
  rangeHeader?: string,
): Promise<globalThis.Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (rangeHeader) headers.Range = rangeHeader;
  return fetch(downloadUrl, { method: 'GET', headers });
}

function pipeUpstreamToResponse(upstream: globalThis.Response, res: Response) {
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  const acceptRanges = upstream.headers.get('accept-ranges');

  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 图片/视频需 inline，否则部分浏览器会当成下载而不是播放
  res.setHeader('Content-Disposition', 'inline');
  if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
  else res.setHeader('Accept-Ranges', 'bytes');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  if (contentRange) res.setHeader('Content-Range', contentRange);

  if (!upstream.body) {
    res.end();
    return Promise.resolve();
  }

  const nodeStream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
  return pipeline(nodeStream, res);
}

/**
 * 浏览器无法给 <img>/<video> 带飞书 Authorization，因此由后端代理直出素材。
 * 支持 Range，便于视频首帧与拖动进度。
 * GET /api/feishu-media/:token
 */
router.get('/:token', async (req: Request, res: Response) => {
  const token = String(req.params.token || '').trim();
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) {
    res.status(400).json({ code: -1, message: '无效的飞书素材 token' });
    return;
  }

  const config = getFeishuMediaApiConfigFromEnv();
  if (!config) {
    res.status(503).json({ code: -1, message: '未配置飞书 Open API，无法代理素材' });
    return;
  }

  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;

  try {
    await withProxySlot(async () => {
      const client = createFeishuApiClient(config);
      const accessToken = await client.getTenantAccessToken();
      const apiBase = (config.baseUrl || 'https://open.feishu.cn').replace(/\/$/, '');
      const downloadUrl = `${apiBase}/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`;

      let upstream: globalThis.Response | null = null;
      let lastStatus = 0;
      let lastBody = '';

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await fetchFeishuMedia(downloadUrl, accessToken, rangeHeader);
        if (response.ok || response.status === 206) {
          upstream = response;
          break;
        }
        lastStatus = response.status;
        lastBody = (await response.text().catch(() => '')).slice(0, 240);
        const rateLimited = response.status === 400 && /99991400|frequency limit|rate limit/i.test(lastBody);
        if (!(rateLimited || response.status === 429 || response.status >= 500) || attempt === 3) break;
        await sleep(200 * (attempt + 1) * (attempt + 1));
      }

      if (!upstream) {
        const tmpApi = `${apiBase}/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${encodeURIComponent(token)}`;
        const tmpRes = await fetch(tmpApi, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        if (tmpRes.ok) {
          const payload = await tmpRes.json() as {
            data?: { tmp_download_urls?: Array<{ file_token?: string; tmp_download_url?: string }> };
          };
          const tmpUrl = payload.data?.tmp_download_urls?.find(item => item.file_token === token)?.tmp_download_url
            || payload.data?.tmp_download_urls?.[0]?.tmp_download_url;
          if (tmpUrl) {
            const headers: Record<string, string> = {};
            if (rangeHeader) headers.Range = rangeHeader;
            const fileRes = await fetch(tmpUrl, { headers });
            if (fileRes.ok || fileRes.status === 206) {
              upstream = fileRes;
            } else {
              lastStatus = fileRes.status;
              lastBody = (await fileRes.text().catch(() => '')).slice(0, 240);
            }
          }
        }
      }

      if (!upstream) {
        res.status(lastStatus || 502).json({
          code: -1,
          message: lastBody || '飞书素材代理失败',
        });
        return;
      }

      await pipeUpstreamToResponse(upstream, res);
    });
  } catch (error) {
    if (res.headersSent) return;
    res.status(502).json({
      code: -1,
      message: error instanceof Error ? error.message : '飞书素材代理失败',
    });
  }
});

export default router;
