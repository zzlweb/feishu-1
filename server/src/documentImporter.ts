import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { HTMLElement, parse } from 'node-html-parser';
import { marked } from 'marked';
import { decodeUploadedFilename } from './encoding';
import { assertImportQualityContract } from './import/importQuality';
import type { ImportMetadata } from './import/types';

const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads');

const HTML_EXTENSIONS = new Set(['.html', '.htm', '.xhtml']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.log']);
const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
]);
const FORBIDDEN_ELEMENTS = 'script, style, iframe, frame, frameset, object, embed, applet, form, button, textarea, select, option, meta, link, base, title';
const SAFE_ATTRIBUTES = new Set([
  'alt', 'checked', 'class', 'colspan', 'data-align', 'data-checked', 'data-type',
  'height', 'href', 'id', 'rel', 'rowspan', 'src', 'style', 'target', 'title', 'type', 'width',
]);
const SAFE_STYLES = new Set(['background-color', 'color', 'height', 'max-width', 'min-width', 'text-align', 'width']);
const MAX_ZIP_ENTRIES = 2_000;
const MAX_ZIP_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_COMPRESSION_RATIO = 100;
const MAX_TEXT_BYTES = 10 * 1024 * 1024;

marked.setOptions({ gfm: true, breaks: false });

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

interface ZipSizeMetadata {
  compressedSize?: number;
  uncompressedSize?: number;
}

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function normalizeZipPath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function assertSafeZipPath(value: string) {
  const normalized = normalizeZipPath(value);
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) {
    throw new Error('压缩包包含无效文件路径');
  }
  if (normalized.split('/').some(part => part === '..')) {
    throw new Error('压缩包包含不安全的跨目录路径');
  }
  return normalized;
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

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.length > 0)) rows.push(row);
  if (!rows.length) return '<p></p>';
  const [header, ...body] = rows;
  return `<table><thead><tr>${header.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${body
    .map(values => `<tr>${values.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function localFileImportMetadata(note: string): ImportMetadata {
  return {
    permission: 'unknown',
    readonly: false,
    comments: 'not_supported',
    notes: [note],
  };
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
  if (!src || /^(https?:|\/static\/)/i.test(src)) return src;
  let clean = src.split('#')[0].split('?')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    return '';
  }
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
  return '';
}

function sanitizeUrl(value: string, kind: 'href' | 'src') {
  const compact = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (!compact) return '';
  if (kind === 'src' && compact.startsWith('/static/uploads/')) return compact;
  if (/^https?:\/\//i.test(compact)) return compact;
  if (kind === 'href' && /^(mailto:|tel:|#|\/)/i.test(compact)) return compact;
  return '';
}

function sanitizeStyle(value: string) {
  return value
    .split(';')
    .map(declaration => declaration.trim())
    .filter(Boolean)
    .map(declaration => {
      const separator = declaration.indexOf(':');
      if (separator < 1) return '';
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const styleValue = declaration.slice(separator + 1).trim();
      if (!SAFE_STYLES.has(property) || /url\s*\(|expression\s*\(|javascript:|@import/i.test(styleValue)) return '';
      return `${property}: ${styleValue}`;
    })
    .filter(Boolean)
    .join('; ');
}

function sanitizeElement(element: HTMLElement) {
  for (const attr of Object.keys(element.attributes)) {
    const lower = attr.toLowerCase();
    if (lower.startsWith('on') || !SAFE_ATTRIBUTES.has(lower)) {
      element.removeAttribute(attr);
      continue;
    }
    if (lower === 'href' || lower === 'src') {
      const safe = sanitizeUrl(element.getAttribute(attr) || '', lower);
      if (safe) element.setAttribute(attr, safe);
      else element.removeAttribute(attr);
    } else if (lower === 'style') {
      const safe = sanitizeStyle(element.getAttribute(attr) || '');
      if (safe) element.setAttribute(attr, safe);
      else element.removeAttribute(attr);
    } else if (lower === 'class') {
      const safe = (element.getAttribute(attr) || '')
        .split(/\s+/)
        .filter(name => /^(language-[\w-]+|task-list-item|contains-task-list|feishu-[\w-]+)$/.test(name))
        .join(' ');
      if (safe) element.setAttribute(attr, safe);
      else element.removeAttribute(attr);
    }
  }
  if (element.tagName.toLowerCase() === 'a' && element.getAttribute('target') === '_blank') {
    element.setAttribute('rel', 'noopener noreferrer');
  }
  if (element.tagName.toLowerCase() === 'input') {
    if (element.getAttribute('type') !== 'checkbox') element.remove();
    else {
      for (const attr of Object.keys(element.attributes)) {
        if (!['type', 'checked'].includes(attr.toLowerCase())) element.removeAttribute(attr);
      }
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
  let missingImages = 0;
  root.querySelectorAll('img').forEach(img => {
    const src = resolveAssetKey(img.getAttribute('src') || '', documentPath, assetMap);
    if (!src) {
      missingImages += 1;
      img.replaceWith(`<p>[图片资源未包含在导入文件中：${escapeHtml(img.getAttribute('alt') || '未命名图片')}]</p>`);
      return;
    }
    img.setAttribute('src', src);
    img.classList.add('feishu-image');
    if (!img.getAttribute('data-align')) img.setAttribute('data-align', 'center');
  });
  return missingImages;
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
  root.querySelectorAll(FORBIDDEN_ELEMENTS).forEach(node => node.remove());
  const missingImages = normalizeImages(root, documentPath, assetMap);
  root.querySelectorAll('*').forEach(sanitizeElement);
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
    missingImages,
  };
}

function extractMarkdownFrontMatter(markdown: string) {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return { markdown: normalized, title: '' };
  const titleLine = match[1].split('\n').find(line => /^title\s*:/i.test(line));
  const title = titleLine?.replace(/^title\s*:\s*/i, '').trim().replace(/^(['"])(.*)\1$/, '$2') || '';
  return { markdown: normalized.slice(match[0].length), title };
}

async function parseMarkdownDocument(markdown: string, sourceName: string, documentPath = '', assetMap = new Map<string, string>()) {
  const frontMatter = extractMarkdownFrontMatter(markdown);
  const rendered = await marked.parse(frontMatter.markdown);
  const parsed = extractHtmlBody(rendered, sourceName, documentPath, assetMap);
  return { ...parsed, title: frontMatter.title || parsed.title };
}

function assertTextSize(buffer: Buffer) {
  if (buffer.byteLength > MAX_TEXT_BYTES) throw new Error('正文文件超过 10MB，无法安全解析');
}

function validateZip(zip: JSZip) {
  const entries = Object.entries(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) throw new Error(`压缩包文件数超过 ${MAX_ZIP_ENTRIES} 个限制`);
  const normalizedNames = new Set<string>();
  let totalBytes = 0;
  for (const [rawName, file] of entries) {
    const name = assertSafeZipPath(rawName);
    if (normalizedNames.has(name)) throw new Error('压缩包包含重复文件路径');
    normalizedNames.add(name);
    if (file.dir) continue;
    const metadata = (file as unknown as { _data?: ZipSizeMetadata })._data;
    const uncompressed = metadata?.uncompressedSize ?? 0;
    const compressed = metadata?.compressedSize ?? 0;
    if (uncompressed > MAX_ZIP_ENTRY_BYTES) throw new Error('压缩包包含超过 25MB 的单个文件');
    totalBytes += uncompressed;
    if (totalBytes > MAX_ZIP_TOTAL_BYTES) throw new Error('压缩包解压后超过 100MB 限制');
    if (compressed > 0 && uncompressed / compressed > MAX_ZIP_COMPRESSION_RATIO) {
      throw new Error('压缩包压缩比异常，已停止导入');
    }
  }
  return entries.map(([rawName]) => ({ rawName, name: assertSafeZipPath(rawName) }));
}

async function importZip(buffer: Buffer, sourceName: string): Promise<ImportedDocumentPayload> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = validateZip(zip);
  const mainPath = chooseMainDocument(entries.map(entry => entry.name));
  if (!mainPath) throw new Error('压缩包中没有找到可导入的 HTML / Markdown / 文本正文');

  const assetMap = new Map<string, string>();
  let skippedSvgCount = 0;
  for (const entry of entries) {
    const file = zip.file(entry.rawName);
    if (!file) continue;
    if (path.extname(entry.name).toLowerCase() === '.svg') {
      skippedSvgCount += 1;
      continue;
    }
    if (!isLikelyAsset(entry.name)) continue;
    const data = await file.async('nodebuffer');
    assetMap.set(entry.name, await writeAsset(entry.name, data));
  }

  const mainEntry = entries.find(entry => entry.name === mainPath);
  const mainFile = mainEntry ? zip.file(mainEntry.rawName) : null;
  if (!mainFile) throw new Error('压缩包正文读取失败');
  const mainBuffer = await mainFile.async('nodebuffer');
  assertTextSize(mainBuffer);
  const text = mainBuffer.toString('utf-8');
  const ext = path.extname(mainPath).toLowerCase();
  const parsed = MARKDOWN_EXTENSIONS.has(ext)
    ? await parseMarkdownDocument(text, sourceName, mainPath, assetMap)
    : HTML_EXTENSIONS.has(ext)
      ? extractHtmlBody(text, sourceName, mainPath, assetMap)
      : extractHtmlBody(ext === '.csv' ? parseCsv(text) : buildPlainTextDocument(text), sourceName);
  const warnings = [
    assetMap.size ? `已从 ZIP 中还原 ${assetMap.size} 个本地资源。` : 'ZIP 中没有检测到可还原的本地资源。',
  ];
  if (parsed.missingImages) warnings.push(`有 ${parsed.missingImages} 个图片资源缺失，已在正文中标记。`);
  if (skippedSvgCount) warnings.push(`有 ${skippedSvgCount} 个 SVG 主动内容资源未导入。`);

  return {
    title: parsed.title || stripExtension(sourceName),
    content: parsed.content || '<p></p>',
    sourceName,
    assetCount: assetMap.size,
    warnings,
    importQuality: 'partial',
    importMetadata: localFileImportMetadata('本地导出文件不包含飞书实时权限与评论线程，已作为可编辑副本导入。'),
  };
}

export async function importDocumentFile(file: Express.Multer.File): Promise<ImportedDocumentPayload> {
  const sourceName = decodeUploadedFilename(file.originalname || file.filename || '未命名文档');
  const ext = path.extname(sourceName).toLowerCase();

  if (ext === '.zip') return assertImportQualityContract(await importZip(file.buffer, sourceName));
  assertTextSize(file.buffer);
  const text = file.buffer.toString('utf-8');
  if (HTML_EXTENSIONS.has(ext)) {
    const parsed = extractHtmlBody(text, sourceName);
    return assertImportQualityContract({
      title: parsed.title,
      content: parsed.content,
      sourceName,
      assetCount: 0,
      warnings: [
        '已导入 HTML 正文；飞书私有块数据可能无法完整还原。',
        ...(parsed.missingImages ? [`有 ${parsed.missingImages} 个本地图片资源缺失，已在正文中标记。`] : []),
      ],
      importQuality: 'partial',
      importMetadata: localFileImportMetadata('HTML 文件导入不包含飞书实时权限与评论线程。'),
    });
  }
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    const parsed = await parseMarkdownDocument(text, sourceName);
    return assertImportQualityContract({
      title: parsed.title,
      content: parsed.content,
      sourceName,
      assetCount: 0,
      warnings: [
        '已保留 Markdown 的标题、列表、表格、任务列表、引用和代码块结构。',
        ...(parsed.missingImages ? [`有 ${parsed.missingImages} 个本地图片资源缺失；可改用包含图片的 ZIP 导入。`] : []),
      ],
      importQuality: 'partial',
      unsupportedBlocks: [{ type: 'feishu-private-blocks', reason: 'Markdown 文件不包含飞书私有 block 数据。' }],
      importMetadata: localFileImportMetadata('Markdown 文件不包含飞书权限与评论线程。'),
    });
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    const content = ext === '.csv' ? parseCsv(text) : buildPlainTextDocument(text);
    const parsed = extractHtmlBody(content, sourceName);
    return assertImportQualityContract({
      title: stripExtension(sourceName),
      content: parsed.content,
      sourceName,
      assetCount: 0,
      warnings: [ext === '.csv' ? '已将 CSV 首行识别为表头并导入为表格。' : '纯文本导入仅保留段落和换行。'],
      importQuality: 'fallback',
      unsupportedBlocks: [{ type: 'rich-formatting', reason: '源文件不包含飞书富文本或块结构。' }],
      importMetadata: localFileImportMetadata('文本文件不包含飞书权限与评论线程。'),
    });
  }

  throw new Error('暂不支持该文件类型。请导入飞书导出的 HTML/Markdown/TXT/CSV 或包含这些文件的 ZIP');
}
