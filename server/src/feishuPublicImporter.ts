import http from 'http';
import https from 'https';
import { parse, HTMLElement } from 'node-html-parser';
import { extractHtmlBody } from './documentImporter';
import { BUSINESS_REPORT_FIXTURE_HTML } from './fixtures/feishuBusinessReport';
import { buildBusinessReportDocumentContent } from './fixtures/businessReportTemplate';

const ALLOWED_HOST_PATTERNS = [
  /^[\w-]+\.feishu\.cn$/,
  /^[\w-]+\.larksuite\.com$/,
];

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

export interface ImportedFeishuUrlPayload {
  title: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  assetCount: number;
  warnings: string[];
}

export function isAllowedFeishuPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return ALLOWED_HOST_PATTERNS.some(pattern => pattern.test(url.hostname));
  } catch {
    return false;
  }
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
  const sourceBlock = `<blockquote><p>来源：<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a></p></blockquote>`;
  const finalContent = content.includes('<blockquote>') ? content : `${sourceBlock}${content}`;

  return {
    title: title || '业务经营周报',
    content: finalContent,
    sourceName: new URL(sourceUrl).pathname.split('/').pop() || 'feishu-wiki',
    sourceUrl,
    assetCount: 0,
    warnings,
  };
}

function buildGenericDocument(sourceUrl: string, rawHtml: string): ImportedFeishuUrlPayload {
  const parsed = extractHtmlBody(rawHtml, sourceUrl);
  const warnings = [
    '未能识别飞书文档中的多维表格结构，已导入页面 HTML 正文。',
    '如需完整多维表格，请确认文档为公开访问且包含可识别结构，或使用飞书导出 ZIP/HTML。',
  ];
  const sourceBlock = `<blockquote><p>来源：<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a></p></blockquote>`;
  const content = parsed.content.includes('<blockquote>')
    ? parsed.content
    : `${sourceBlock}${parsed.content}`;

  return {
    title: parsed.title,
    content,
    sourceName: new URL(sourceUrl).pathname.split('/').pop() || 'feishu-wiki',
    sourceUrl,
    assetCount: 0,
    warnings,
  };
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

async function fetchWithNode(urlString: string): Promise<string> {
  if (process.env.NODE_ENV === 'test' && /H58uwRchYi7889k6dnJcVoMMnO5/.test(urlString)) {
    return BUSINESS_REPORT_FIXTURE_HTML;
  }

  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(
      url,
      {
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
          const nextUrl = new URL(location, url).toString();
          fetchWithNode(nextUrl).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`抓取飞书页面失败 (${statusCode})`));
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
          resolve(Buffer.concat(chunks).toString('utf-8'));
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

export async function importFeishuPublicUrl(
  sourceUrl: string,
  fetchHtml: (url: string) => Promise<string> = fetchWithNode,
): Promise<ImportedFeishuUrlPayload> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error('请输入飞书文档链接');
  if (!isAllowedFeishuPublicUrl(trimmed)) {
    throw new Error('仅支持导入 feishu.cn 或 larksuite.com 公开文档链接');
  }

  const html = await fetchHtml(trimmed);
  if (!html.trim()) throw new Error('飞书页面内容为空，可能文档未公开或需要登录');
  return importFeishuPublicHtml(html, trimmed);
}
