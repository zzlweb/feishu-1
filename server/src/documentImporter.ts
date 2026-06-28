import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { HTMLElement, parse } from 'node-html-parser';
import { marked } from 'marked';
import { decodeUploadedFilename } from './encoding';
import type { ImportMetadata } from './import/types';

const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads');

const HTML_EXTENSIONS = new Set(['.html', '.htm', '.xhtml']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.log']);
const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp',
  '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
]);

export interface ImportedDocumentPayload {
  title: string;
  content: string;
  sourceName: string;
  assetCount: number;
  warnings: string[];
  importQuality: 'full' | 'partial' | 'fallback';
  unsupportedBlocks?: Array<{ type: string; reason: string }>;
  importMetadata?: ImportMetadata;
}

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function normalizeZipPath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPlainTextDocument(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(part => `<p>${part.split('\n').map(line => escapeHtml(line)).join('<br>') || '<br>'}</p>`)
    .join('');
}

function safeUploadedAssetName(originalName: string) {
  const decoded = decodeUploadedFilename(path.basename(originalName || 'asset'));
  const ext = path.extname(decoded).toLowerCase();
  const stem = stripExtension(decoded)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'asset';
  return `${uuidv4()}-${stem}${ext}`;
}

async function writeAsset(originalName: string, buffer: Buffer) {
  ensureUploadDir();
  const fileName = safeUploadedAssetName(originalName);
  fs.writeFileSync(path.join(uploadDir, fileName), buffer);
  return `/static/uploads/${fileName}`;
}

function isLikelyAsset(fileName: string) {
  return ASSET_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function chooseMainDocument(files: string[]) {
  const visible = files.filter(name => !name.endsWith('/') && !path.basename(name).startsWith('.'));
  const html = visible.filter(name => HTML_EXTENSIONS.has(path.extname(name).toLowerCase()));
  const markdown = visible.filter(name => MARKDOWN_EXTENSIONS.has(path.extname(name).toLowerCase()));
  const text = visible.filter(name => TEXT_EXTENSIONS.has(path.extname(name).toLowerCase()));

  const score = (name: string) => {
    const base = path.basename(name).toLowerCase();
    let value = 0;
    if (/index|document|doc|main|正文|文档|飞书/.test(base)) value -= 20;
    value += name.split('/').length;
    value += name.length / 1000;
    return value;
  };

  return [...html].sort((a, b) => score(a) - score(b))[0]
    || [...markdown].sort((a, b) => score(a) - score(b))[0]
    || [...text].sort((a, b) => score(a) - score(b))[0]
    || '';
}

function resolveAssetKey(src: string, documentPath: string, assetMap: Map<string, string>) {
  if (!src || /^(https?:|data:|blob:|\/static\/)/i.test(src)) return src;
  const clean = decodeURIComponent(src.split('#')[0].split('?')[0]);
  const candidates = [
    normalizeZipPath(clean),
    normalizeZipPath(path.posix.join(path.posix.dirname(documentPath), clean)),
    normalizeZipPath(path.posix.basename(clean)),
  ];
  for (const candidate of candidates) {
    const direct = assetMap.get(candidate);
    if (direct) return direct;
    const bySuffix = Array.from(assetMap.entries()).find(([key]) => key.endsWith(`/${candidate}`) || path.posix.basename(key) === candidate);
    if (bySuffix) return bySuffix[1];
  }
  return src;
}

function sanitizeElement(element: HTMLElement) {
  for (const attr of Object.keys(element.attributes)) {
    const lower = attr.toLowerCase();
    if (lower.startsWith('on') || lower === 'contenteditable' || lower === 'spellcheck') {
      element.removeAttribute(attr);
    }
  }
}

function normalizeTables(root: HTMLElement) {
  root.querySelectorAll('table').forEach(table => {
    table.classList.add('feishu-table');
    table.querySelectorAll('th').forEach(cell => cell.classList.add('feishu-table__header-cell'));
    table.querySelectorAll('td').forEach(cell => cell.classList.add('feishu-table__cell'));
  });
}

function normalizeImages(root: HTMLElement, documentPath: string, assetMap: Map<string, string>) {
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    img.setAttribute('src', resolveAssetKey(src, documentPath, assetMap));
    img.classList.add('feishu-image');
    if (!img.getAttribute('data-align')) img.setAttribute('data-align', 'center');
  });
}

function normalizeTaskLists(root: HTMLElement) {
  root.querySelectorAll('li').forEach(li => {
    const input = li.querySelector('input[type="checkbox"]');
    if (!input) return;
    const parent = li.parentNode as HTMLElement | null;
    if (parent?.tagName?.toLowerCase() === 'ul') parent.setAttribute('data-type', 'taskList');
    li.setAttribute('data-type', 'taskItem');
    li.setAttribute('data-checked', input.hasAttribute('checked') ? 'true' : 'false');
  });
}

export function extractHtmlBody(rawHtml: string, sourceName: string, documentPath = '', assetMap = new Map<string, string>()) {
  const originalRoot = parse(rawHtml);
  const root = parse(rawHtml, {
    blockTextElements: { script: false, noscript: false, style: false, pre: true },
    comment: false,
  });
  root.querySelectorAll('script, style, meta, link, title').forEach(node => node.remove());
  root.querySelectorAll('*').forEach(sanitizeElement);
  normalizeImages(root, documentPath, assetMap);
  normalizeTables(root);
  normalizeTaskLists(root);

  const title = root.querySelector('h1')?.structuredText.trim()
    || originalRoot.querySelector('title')?.structuredText.trim()
    || stripExtension(path.basename(sourceName));
  const body = root.querySelector('body');
  const html = (body?.innerHTML || root.innerHTML || '').trim();
  return {
    title: title || stripExtension(path.basename(sourceName)),
    content: html || '<p></p>',
  };
}

async function importZip(buffer: Buffer, sourceName: string): Promise<ImportedDocumentPayload> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).map(normalizeZipPath);
  const mainPath = chooseMainDocument(names);
  if (!mainPath) throw new Error('压缩包中没有找到可导入的 HTML / Markdown / 文本正文');

  const assetMap = new Map<string, string>();
  for (const name of names) {
    const file = zip.file(name);
    if (!file || !isLikelyAsset(name)) continue;
    const data = await file.async('nodebuffer');
    assetMap.set(name, await writeAsset(name, data));
  }

  const mainFile = zip.file(mainPath);
  if (!mainFile) throw new Error('压缩包正文读取失败');
  const text = await mainFile.async('string');
  const ext = path.extname(mainPath).toLowerCase();
  const parsed = MARKDOWN_EXTENSIONS.has(ext)
    ? { title: stripExtension(path.basename(mainPath)), content: await marked.parse(text) }
    : HTML_EXTENSIONS.has(ext)
      ? extractHtmlBody(text, sourceName, mainPath, assetMap)
      : { title: stripExtension(path.basename(mainPath)), content: buildPlainTextDocument(text) };

  return {
    title: parsed.title || stripExtension(sourceName),
    content: parsed.content || '<p></p>',
    sourceName,
    assetCount: assetMap.size,
    warnings: assetMap.size
      ? [`已从 ZIP 中还原 ${assetMap.size} 个本地资源。`]
      : ['ZIP 中没有检测到可还原的本地资源。'],
    importQuality: 'partial',
    importMetadata: {
      permission: 'unknown',
      readonly: false,
      comments: 'not_supported',
      notes: ['本地导出文件不包含飞书实时权限与评论线程，已作为可编辑副本导入。'],
    },
  };
}

export async function importDocumentFile(file: Express.Multer.File): Promise<ImportedDocumentPayload> {
  const sourceName = decodeUploadedFilename(file.originalname || file.filename || '未命名文档');
  const ext = path.extname(sourceName).toLowerCase();

  if (ext === '.zip') return importZip(file.buffer, sourceName);

  const text = file.buffer.toString('utf-8');
  if (HTML_EXTENSIONS.has(ext)) {
    return {
      ...extractHtmlBody(text, sourceName),
      sourceName,
      assetCount: 0,
      warnings: ['已导入 HTML 正文；飞书私有块数据可能无法完整还原。'],
      importQuality: 'partial',
      importMetadata: {
        permission: 'unknown',
        readonly: false,
        comments: 'not_supported',
        notes: ['HTML 文件导入不包含飞书实时权限与评论线程。'],
      },
    };
  }
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return {
      title: stripExtension(sourceName),
      content: await marked.parse(text),
      sourceName,
      assetCount: 0,
      warnings: ['Markdown 导入仅保留文本结构和基础格式，飞书块级 UI 会降级。'],
      importQuality: 'fallback',
      unsupportedBlocks: [{ type: 'feishu-blocks', reason: 'Markdown 文件不包含飞书结构化 block 数据。' }],
      importMetadata: {
        permission: 'unknown',
        readonly: false,
        comments: 'not_supported',
        notes: ['Markdown 文件不包含飞书权限与评论线程。'],
      },
    };
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    return {
      title: stripExtension(sourceName),
      content: buildPlainTextDocument(text),
      sourceName,
      assetCount: 0,
      warnings: ['纯文本导入仅保留段落和换行，所有飞书块级样式都会降级。'],
      importQuality: 'fallback',
      unsupportedBlocks: [{ type: 'rich-formatting', reason: '纯文本文件不包含富文本或飞书块结构。' }],
      importMetadata: {
        permission: 'unknown',
        readonly: false,
        comments: 'not_supported',
        notes: ['纯文本文件不包含飞书权限与评论线程。'],
      },
    };
  }

  throw new Error('暂不支持该文件类型。请导入飞书导出的 HTML/Markdown/TXT 或包含这些文件的 ZIP');
}
