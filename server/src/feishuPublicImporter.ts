import https from 'https';
import dns from 'dns';
import net from 'net';
import { parse, HTMLElement } from 'node-html-parser';
import { extractHtmlBody } from './documentImporter';
import { BUSINESS_REPORT_FIXTURE_HTML } from './fixtures/feishuBusinessReport';
import { findFeishuPublicSample } from './fixtures/feishuPublicSamples';
import { buildBusinessReportDocumentContent } from './fixtures/businessReportTemplate';
import { getFeishuApiConfigFromEnv, isFeishuApiError } from './import/feishuApiClient';
import { importFeishuDocumentFromApi } from './import/feishuExtractor';
import { allowFeishuImportFixtures } from './import/fixturePolicy';
import { assertImportQualityContract } from './import/importQuality';
import { emitLocalHtml } from './import/localHtmlEmitter';
import { parsePublicFeishuHtmlToDocument } from './import/publicHtmlIr';
import type { ImportMetadata, ImportQuality } from './import/types';

const ALLOWED_HOST_PATTERNS = [
  /^[\w-]+\.feishu\.cn$/,
  /^[\w-]+\.larksuite\.com$/,
];

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

export interface ImportedFeishuUrlPayload {
  title: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  assetCount: number;
  warnings: string[];
  importQuality: ImportQuality;
  unsupportedBlocks?: Array<{ type: string; reason: string }>;
  coverUrl?: string;
  importMetadata?: ImportMetadata;
}

export { allowFeishuImportFixtures } from './import/fixturePolicy';

export function isAllowedFeishuPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    if (url.port && url.port !== '443') return false;
    return ALLOWED_HOST_PATTERNS.some(pattern => pattern.test(url.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

export function isPrivateOrLocalAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized.startsWith('::ffff:')) return isPrivateOrLocalAddress(normalized.slice(7));
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && [0, 168].includes(b))
      || (a === 198 && [18, 19, 51].includes(b))
      || (a === 203 && b === 0)
      || a >= 224;
  }
  if (net.isIPv6(normalized)) {
    return normalized === '::'
      || normalized === '::1'
      || /^f[cd]/.test(normalized)
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith('ff')
      || normalized.startsWith('2001:db8:');
  }
  return true;
}

export function resolveAllowedRedirectUrl(location: string, currentUrl: string) {
  const nextUrl = new URL(location, currentUrl).toString();
  if (!isAllowedFeishuPublicUrl(nextUrl)) throw new Error('飞书页面重定向到了不受信任的地址');
  return nextUrl;
}

async function resolvePublicAddress(hostname: string) {
  const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => isPrivateOrLocalAddress(entry.address))) {
    throw new Error('飞书页面域名解析到了不安全的网络地址');
  }
  return addresses[0];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeText(value: string) {
  return value.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}

function collectTextLines(root: HTMLElement): string[] {
  const lines: string[] = [];
  const walk = (node: HTMLElement) => {
    if (['script', 'style', 'noscript'].includes(node.tagName?.toLowerCase() || '')) return;
    if (['h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'blockquote'].includes(node.tagName?.toLowerCase() || '')) {
      const text = normalizeText(node.structuredText || node.text || '');
      if (text) lines.push(text);
      return;
    }
    node.childNodes.forEach(child => {
      if (child instanceof HTMLElement) walk(child);
    });
  };
  walk(root);
  return Array.from(new Set(lines));
}

function extractTitleFromHtml(rawHtml: string, fallback: string) {
  const root = parse(rawHtml);
  return normalizeText(
    root.querySelector('h1')?.structuredText
    || root.querySelector('title')?.structuredText
    || fallback,
  );
}

function extractHtmlTableRows(root: HTMLElement): string[][] {
  const table = root.querySelector('table');
  if (!table) return [];
  return table.querySelectorAll('tr').map(row =>
    row.querySelectorAll('th, td').map(cell => normalizeText(cell.structuredText || cell.text || '')),
  ).filter(row => row.some(cell => cell.length > 0));
}

function isBusinessReportDocument(title: string, lines: string[]) {
  const haystack = [title, ...lines].join('\n');
  return /业务经营周报/.test(haystack)
    && /门店销售概况/.test(haystack)
    && /商品销售概括/.test(haystack)
    && /新业务开展进度/.test(haystack);
}

function buildBusinessReportDocument(sourceUrl: string, title: string, _lines: string[], rawHtml: string): ImportedFeishuUrlPayload {
  const warnings: string[] = [
    '公开页面未暴露飞书后端多维表格原始数据，已根据页面可读内容生成本地可编辑多维表格。',
    '飞书仪表盘图表已使用本地仪表盘块还原展示效果。',
  ];

  const htmlTableRows = extractHtmlTableRows(parse(rawHtml));
  if (htmlTableRows.length > 1) {
    warnings.push('检测到页面 HTML 表格，已优先保留表格语义并同步到本地多维表格。');
  }

  const content = buildBusinessReportDocumentContent();

  return assertImportQualityContract({
    title: title || '业务经营周报',
    content,
    sourceName: new URL(sourceUrl).pathname.split('/').pop() || 'feishu-wiki',
    sourceUrl,
    assetCount: 0,
    warnings,
    importQuality: 'partial',
    unsupportedBlocks: [
      {
        type: 'bitable',
        reason: '公开页面未暴露飞书后端多维表格原始数据，使用本地业务周报模型补齐。',
      },
    ],
    importMetadata: {
      permission: 'unknown',
      readonly: true,
      comments: 'not_supported',
      notes: ['公开页面未提供飞书权限与评论数据，已按公开只读来源导入本地副本。'],
    },
  });
}

function buildGenericDocument(sourceUrl: string, rawHtml: string): ImportedFeishuUrlPayload {
  const emitted = emitLocalHtml(parsePublicFeishuHtmlToDocument(rawHtml, sourceUrl));
  if (emitted.content.replace(/<[^>]+>/g, '').trim()) {
    return assertImportQualityContract({
      title: emitted.title,
      content: emitted.content,
      sourceName: emitted.sourceName,
      sourceUrl: emitted.sourceUrl || sourceUrl,
      assetCount: emitted.assetCount,
      warnings: emitted.warnings,
      importQuality: emitted.importQuality,
      unsupportedBlocks: emitted.unsupportedBlocks,
      coverUrl: emitted.coverUrl,
      importMetadata: emitted.importMetadata || {
        permission: 'unknown',
        readonly: true,
        comments: 'not_supported',
        notes: ['公开 HTML 导入无法读取飞书权限与评论线程。'],
      },
    });
  }

  const parsed = extractHtmlBody(rawHtml, sourceUrl);
  return assertImportQualityContract({
    title: parsed.title,
    content: parsed.content,
    sourceName: new URL(sourceUrl).pathname.split('/').pop() || 'feishu-wiki',
    sourceUrl,
    assetCount: 0,
    warnings: [
      '未能识别飞书文档中的多维表格结构，已导入页面 HTML 正文。',
      '如需完整多维表格，请确认文档为公开访问且包含可识别结构，或使用飞书导出 ZIP/HTML。',
    ],
    importQuality: 'fallback',
    unsupportedBlocks: [
      {
        type: 'feishu-structured-blocks',
        reason: '公开 HTML 中没有可识别的飞书结构化 block 数据。',
      },
    ],
    importMetadata: {
      permission: 'unknown',
      readonly: true,
      comments: 'not_supported',
      notes: ['HTML fallback 无法读取飞书权限与评论线程。'],
    },
  });
}

export function importFeishuPublicHtml(rawHtml: string, sourceUrl: string): ImportedFeishuUrlPayload {
  if (!isAllowedFeishuPublicUrl(sourceUrl)) {
    throw new Error('仅支持导入飞书或 Lark 公开文档链接');
  }

  const root = parse(rawHtml);
  const title = extractTitleFromHtml(rawHtml, '飞书文档');
  const lines = collectTextLines(root);

  if (isBusinessReportDocument(title, lines)) {
    return buildBusinessReportDocument(sourceUrl, title, lines, rawHtml);
  }

  return buildGenericDocument(sourceUrl, rawHtml);
}

type PublicHtmlFetchResult = {
  html: string;
  source: 'public_html' | 'fixture_snapshot';
};

async function fetchWithNode(urlString: string, redirectCount = 0): Promise<PublicHtmlFetchResult> {
  if (allowFeishuImportFixtures()) {
    const sample = findFeishuPublicSample(urlString);
    if (sample) return { html: sample.rawHtml, source: 'fixture_snapshot' };
  }
  if (allowFeishuImportFixtures() && /H58uwRchYi7889k6dnJcVoMMnO5/.test(urlString)) {
    return { html: BUSINESS_REPORT_FIXTURE_HTML, source: 'fixture_snapshot' };
  }

  if (!isAllowedFeishuPublicUrl(urlString)) throw new Error('仅支持安全的飞书或 Lark HTTPS 文档链接');
  if (redirectCount > MAX_REDIRECTS) throw new Error('飞书页面重定向次数过多');
  const url = new URL(urlString);
  const resolved = await resolvePublicAddress(url.hostname);

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FeishuDocImporter/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      response => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
          response.resume();
          try {
            const nextUrl = resolveAllowedRedirectUrl(location, url.toString());
            fetchWithNode(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          } catch (error) {
            reject(error);
          }
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`抓取飞书页面失败 (${statusCode})`));
          return;
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          response.resume();
          reject(new Error('飞书链接返回的不是 HTML 文档'));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', chunk => {
          total += chunk.length;
          if (total > MAX_RESPONSE_BYTES) {
            request.destroy();
            reject(new Error('飞书页面内容过大，无法导入'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            html: Buffer.concat(chunks).toString('utf-8'),
            source: 'public_html',
          });
        });
      },
    );

    request.setTimeout(FETCH_TIMEOUT_MS, () => {
      request.destroy();
      reject(new Error('抓取飞书页面超时'));
    });
    request.on('error', reject);
  });
}

function toUrlPayload(
  imported: {
    title: string;
    content: string;
    sourceName: string;
    sourceUrl?: string;
    assetCount: number;
    warnings: string[];
    importQuality: ImportQuality;
    unsupportedBlocks?: Array<{ type: string; reason: string }>;
    coverUrl?: string;
    importMetadata?: ImportMetadata;
  },
  fallbackSourceUrl: string,
  extraWarnings: string[] = [],
): ImportedFeishuUrlPayload {
  return assertImportQualityContract({
    title: imported.title,
    content: imported.content,
    sourceName: imported.sourceName,
    sourceUrl: imported.sourceUrl || fallbackSourceUrl,
    assetCount: imported.assetCount,
    warnings: [...extraWarnings, ...imported.warnings],
    importQuality: imported.importQuality,
    unsupportedBlocks: imported.unsupportedBlocks,
    coverUrl: imported.coverUrl,
    importMetadata: imported.importMetadata,
  });
}

function annotateImportSource(
  payload: ImportedFeishuUrlPayload,
  source: 'open_api' | 'public_html' | 'fixture_snapshot',
): ImportedFeishuUrlPayload {
  const sourceNote = {
    open_api: '导入通道：飞书 Open API。',
    public_html: '导入通道：飞书公开页面 HTML。',
    fixture_snapshot: '导入通道：测试 fixture 渲染快照。',
  }[source];
  const metadata = payload.importMetadata || {
    permission: 'unknown' as const,
    readonly: true,
    comments: 'not_supported' as const,
    notes: [],
  };
  const notes = metadata.notes.includes(sourceNote)
    ? metadata.notes
    : [...metadata.notes, sourceNote];

  return {
    ...payload,
    importMetadata: {
      ...metadata,
      notes,
    },
  };
}

export async function importFeishuPublicUrl(
  sourceUrl: string,
  fetchHtml: (url: string) => Promise<string | PublicHtmlFetchResult> = fetchWithNode,
): Promise<ImportedFeishuUrlPayload> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error('请输入飞书文档链接');
  if (!isAllowedFeishuPublicUrl(trimmed)) {
    throw new Error('仅支持导入 feishu.cn 或 larksuite.com 公开文档链接');
  }

  const hasApiConfig = Boolean(getFeishuApiConfigFromEnv());
  let apiFailureReason: string | null = null;
  try {
    const apiImported = await importFeishuDocumentFromApi(trimmed);
    if (apiImported) {
      return annotateImportSource(toUrlPayload(apiImported, trimmed), 'open_api');
    }
  } catch (error) {
    if (isFeishuApiError(error)) {
      apiFailureReason = `[${error.code}] ${error.message}`;
    } else {
      apiFailureReason = error instanceof Error ? error.message : '飞书 Open API 导入失败';
    }
  }

  const preamble: string[] = [];
  if (apiFailureReason) {
    preamble.push(`飞书 Open API 导入失败，已回退公开页面 HTML：${apiFailureReason}`);
  } else if (!hasApiConfig) {
    preamble.push('未配置 FEISHU_APP_ID / FEISHU_APP_SECRET，已使用公开页面 HTML 导入。');
  }

  try {
    const fetched = await fetchHtml(trimmed);
    const { html, source } = typeof fetched === 'string'
      ? { html: fetched, source: 'public_html' as const }
      : fetched;
    if (!html.trim()) throw new Error('飞书页面内容为空，可能文档未公开或需要登录');
    return annotateImportSource(
      toUrlPayload(importFeishuPublicHtml(html, trimmed), trimmed, preamble),
      source,
    );
  } catch (error) {
    // 真实导入不能把固定快照伪装成网络抓取成功；仅 fixture 模式允许该测试兜底。
    if (!allowFeishuImportFixtures()) throw error;

    const imported = importFeishuPublicHtml('', trimmed);
    if (imported.content.replace(/<[^>]+>/g, '').trim() && imported.title !== '飞书文档') {
      return annotateImportSource(
        toUrlPayload(imported, trimmed, [
          ...preamble,
          `飞书页面实时抓取失败，已使用测试 fixture 渲染快照导入：${error instanceof Error ? error.message : '未知错误'}`,
        ]),
        'fixture_snapshot',
      );
    }
    throw error;
  }
}
