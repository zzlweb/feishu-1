import { v4 as uuidv4 } from 'uuid';
import { buildBusinessReportDocumentContent } from '../fixtures/businessReportTemplate';
import { mirrorRemoteAsset } from './assetPipeline';
import {
  createFeishuApiClient,
  getFeishuApiConfigFromEnv,
  parseFeishuUrl,
  type FeishuApiClient,
  type FeishuObjectType,
  type ParsedFeishuUrl,
} from './feishuApiClient';
import {
  BUSINESS_REPORT_WIKI_TOKEN,
  enrichBusinessReportBlocks,
  stripBusinessReportOpaqueWarnings,
} from './businessReportEnricher';
import { mapFeishuBitableToBaseTable } from './bitableMapper';
import { mirrorBitableTableAttachments, type BitableAttachmentMirrorContext } from './bitableAttachmentMirror';
import { emitLocalHtml } from './localHtmlEmitter';
import type { EmittedImportPayload, ImportedBlock, ImportedDocument, ImportedInline, ImportWarning } from './types';
import type { ImportedAsset } from './types';

interface FeishuBlock {
  block_id?: string;
  parent_id?: string;
  block_type?: number | string;
  children?: string[];
  page?: { elements?: FeishuTextElement[]; style?: Record<string, unknown> };
  text?: { elements?: FeishuTextElement[]; style?: Record<string, unknown> };
  heading1?: { elements?: FeishuTextElement[] };
  heading2?: { elements?: FeishuTextElement[] };
  heading3?: { elements?: FeishuTextElement[] };
  heading4?: { elements?: FeishuTextElement[] };
  heading5?: { elements?: FeishuTextElement[] };
  heading6?: { elements?: FeishuTextElement[] };
  quote?: { elements?: FeishuTextElement[] };
  bullet?: { elements?: FeishuTextElement[] };
  ordered?: { elements?: FeishuTextElement[] };
  todo?: { elements?: FeishuTextElement[]; checked?: boolean };
  code?: { elements?: FeishuTextElement[]; language?: number | string; wrap?: boolean };
  bitable?: {
    app_token?: string;
    token?: string;
    table_id?: string;
    table_name?: string;
    fields?: Array<Record<string, unknown>>;
    records?: Array<Record<string, unknown>>;
    views?: Array<Record<string, unknown>>;
  };
  callout?: { background_color?: number | string; border_color?: number | string; text_color?: number | string; emoji_id?: string };
  divider?: Record<string, never>;
  file?: { file_token?: string; token?: string; name?: string; mime_type?: string };
  grid?: Record<string, unknown>;
  grid_column?: { width_ratio?: number | string };
  iframe?: { component?: { type?: number | string; url?: string } };
  image?: { token?: string; url?: string };
  table?: { cells?: string[][]; row_size?: number; column_size?: number };
  table_cell?: { row_span?: number; col_span?: number; background_color?: number | string };
  equation?: { elements?: FeishuTextElement[]; content?: string };
  quote_container?: Record<string, never>;
  sheet?: { token?: string; spreadsheet_token?: string; name?: string };
  mindnote?: { token?: string; name?: string };
  diagram?: { diagram_type?: string; name?: string };
  chat_card?: { title?: string; url?: string };
  jira_issue?: { title?: string; url?: string };
  add_ons?: { title?: string; url?: string };
  reference_base?: { layout_mode?: string; token?: string; view_id?: string };
  undefined?: Record<string, unknown>;
  [key: string]: unknown;
}

interface FeishuTextElement {
  text_run?: {
    content?: string;
    text_element_style?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      link?: { url?: string };
    };
  };
  mention_user?: { user_name?: string };
  mention_doc?: { title?: string; url?: string; token?: string };
  equation?: { content?: string };
  [key: string]: unknown;
}

interface FeishuBlockListResponse {
  items?: FeishuBlock[];
  has_more?: boolean;
  page_token?: string;
}

interface FeishuBitableListResponse<T> {
  items?: T[];
  has_more?: boolean;
  page_token?: string;
}

interface FeishuBitableTable {
  table_id?: string;
  name?: string;
}

const BUSINESS_REPORT_TOKEN = BUSINESS_REPORT_WIKI_TOKEN;

function sourceNameFromUrl(sourceUrl: string) {
  return new URL(sourceUrl).pathname.split('/').pop() || 'feishu-doc';
}

function blockTypeName(block: FeishuBlock) {
  return String(block.block_type ?? 'unknown');
}

function isPageBlock(block: FeishuBlock) {
  return block.block_type === 1 || block.block_type === 'page';
}

function decodeFeishuLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // 飞书文本链接的 url 通常是百分号编码的（https%3A%2F%2F...），需还原成可点击地址。
  if (/%[0-9a-fA-F]{2}/.test(url)) {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  }
  return url;
}

function textElementsToInlines(elements: FeishuTextElement[] | undefined): ImportedInline[] {
  if (!elements?.length) return [];
  return elements.map(element => {
    const run = element.text_run;
    if (run) {
      const style = run.text_element_style || {};
      return {
        text: run.content || '',
        bold: Boolean(style.bold),
        italic: Boolean(style.italic),
        underline: Boolean(style.underline),
        strike: Boolean(style.strikethrough),
        link: decodeFeishuLink(style.link?.url),
      };
    }
    if (element.mention_user?.user_name) return { text: `@${element.mention_user.user_name}` };
    if (element.mention_doc?.title || element.mention_doc?.url) {
      return {
        text: element.mention_doc.title || element.mention_doc.url || '飞书文档',
        link: decodeFeishuLink(element.mention_doc.url),
      };
    }
    if (element.equation?.content) return { text: `$${element.equation.content}$` };
    return { text: '' };
  }).filter(inline => inline.text);
}

function inlineText(inlines: ImportedInline[]) {
  return inlines.map(inline => inline.text).join('').trim();
}

function codeLanguageName(value: number | string | undefined): string {
  if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  const codeLanguageMap: Record<number, string> = {
    1: 'plaintext',
    2: 'abap',
    3: 'apex',
    4: 'assembly',
    5: 'bash',
    6: 'c',
    7: 'csharp',
    8: 'cpp',
    9: 'css',
    10: 'coffeescript',
    11: 'dart',
    12: 'delphi',
    13: 'django',
    14: 'dockerfile',
    15: 'erlang',
    16: 'fortran',
    17: 'foxpro',
    18: 'go',
    19: 'groovy',
    20: 'html',
    21: 'java',
    22: 'javascript',
    23: 'json',
    24: 'julia',
    25: 'kotlin',
    26: 'latex',
    27: 'lisp',
    28: 'logo',
    29: 'lua',
    30: 'matlab',
    31: 'objective-c',
    32: 'openedge-abl',
    33: 'php',
    34: 'perl',
    35: 'postgresql',
    36: 'powershell',
    37: 'prolog',
    38: 'protobuf',
    39: 'python',
    40: 'r',
    41: 'rpg',
    42: 'ruby',
    43: 'rust',
    44: 'sas',
    45: 'scala',
    46: 'scheme',
    47: 'scratch',
    48: 'shell',
    49: 'sql',
    50: 'swift',
    51: 'thrift',
    52: 'typescript',
    53: 'vbscript',
    54: 'visual-basic',
    55: 'xml',
    56: 'yaml',
  };
  return typeof value === 'number' ? codeLanguageMap[value] || 'plaintext' : 'plaintext';
}

function calloutEmoji(emojiId: string | undefined): string {
  const emojiMap: Record<string, string> = {
    bulb: '💡',
    warning: '⚠️',
    star: '⭐',
    gift: '🎁',
    fire: '🔥',
    memo: '📝',
    book: '📚',
    link: '🔗',
    pin: '📌',
    pushpin: '📌',
    round_pushpin: '📌',
    page_with_curl: '📄',
    speech_balloon: '💬',
    memo_alt: '📝',
  };
  return emojiId ? emojiMap[emojiId] || emojiId : '💡';
}

function colorToken(value: number | string | undefined, fallback: string): string {
  if (typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  const colorMap: Record<number, string> = {
    1: '#fde2e2',
    2: '#fee7cd',
    3: '#fff7e6',
    4: '#d9f5d6',
    5: '#e1eaff',
    6: '#ece2fe',
    7: '#f2f3f5',
  };
  return typeof value === 'number' ? colorMap[value] || fallback : fallback;
}

function decodeIframeUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function mediaDownloadUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`;
}

async function fetchPagedItems<T>(
  client: FeishuApiClient,
  path: string,
  pageSize = 500,
): Promise<T[]> {
  const items: T[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) query.set('page_token', pageToken);
    const data = await client.request<FeishuBitableListResponse<T>>(`${path}?${query.toString()}`);
    items.push(...(data.items || []));
    pageToken = data.has_more && data.page_token ? data.page_token : '';
  } while (pageToken);
  return items;
}

async function fetchBitableTableFromApi(
  client: FeishuApiClient,
  bitable: NonNullable<FeishuBlock['bitable']>,
  blockId: string | undefined,
  preferredViewId?: string,
  mirrorContext?: BitableAttachmentMirrorContext,
) {
  let appToken = bitable.app_token?.trim() || '';
  let tableId = bitable.table_id?.trim();
  // docx 内嵌多维表格块只返回 bitable.token，可能是 "<appToken>_<tableId>" 组合形式。
  if (!appToken && bitable.token?.trim()) {
    const rawToken = bitable.token.trim();
    const separatorIndex = rawToken.indexOf('_');
    if (separatorIndex > 0) {
      appToken = rawToken.slice(0, separatorIndex);
      if (!tableId) tableId = rawToken.slice(separatorIndex + 1) || undefined;
    } else {
      appToken = rawToken;
    }
  }
  if (!appToken) return null;

  let tableName = bitable.table_name?.trim() || '飞书多维表格';
  if (!tableId) {
    const tables = await fetchPagedItems<FeishuBitableTable>(
      client,
      `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`,
      100,
    );
    const firstTable = tables[0];
    tableId = firstTable?.table_id;
    tableName = firstTable?.name || tableName;
  }
  if (!tableId) return null;

  const basePath = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`;
  const [fields, records, views] = await Promise.all([
    fetchPagedItems<Record<string, unknown>>(client, `${basePath}/fields`, 200),
    fetchPagedItems<Record<string, unknown>>(client, `${basePath}/records`, 500),
    fetchPagedItems<Record<string, unknown>>(client, `${basePath}/views`, 200),
  ]);
  if (!fields.length) return null;

  const table = mapFeishuBitableToBaseTable({
    tableId,
    tableName,
    fields,
    records,
    views,
  });
  if (mirrorContext) {
    await mirrorBitableTableAttachments(table, mirrorContext);
  }
  if (preferredViewId && table.views.some(view => view.id === preferredViewId)) {
    table.activeViewId = preferredViewId;
  }
  return table;
}

function parseReferenceBaseToken(rawToken: string): { appToken: string; tableId?: string } {
  const token = rawToken.trim();
  const separatorIndex = token.indexOf('_');
  if (separatorIndex > 0) {
    return {
      appToken: token.slice(0, separatorIndex),
      tableId: token.slice(separatorIndex + 1) || undefined,
    };
  }
  return { appToken: token };
}

async function convertReferenceBaseBlock(
  block: FeishuBlock,
  client: FeishuApiClient,
  warnings: ImportWarning[],
  mirrorContext?: BitableAttachmentMirrorContext,
): Promise<ImportedBlock | null> {
  const reference = block.reference_base;
  const rawToken = reference?.token?.trim();
  if (!rawToken) return null;

  const { appToken, tableId } = parseReferenceBaseToken(rawToken);
  try {
    const table = await fetchBitableTableFromApi(
      client,
      { app_token: appToken, table_id: tableId, token: rawToken },
      block.block_id,
      reference?.view_id?.trim(),
      mirrorContext,
    );
    if (!table) return null;
    const preferredView = reference?.view_id
      ? table.views.find(view => view.id === reference.view_id)
      : undefined;
    return {
      type: 'bitable',
      payload: {
        table,
        defaultView: preferredView?.type || table.views.find(view => view.id === table.activeViewId)?.type || 'grid',
      },
    };
  } catch (error) {
    warnings.push({
      type: 'partial-data',
      blockType: 'reference_base',
      message: `飞书多维表格引用块拉取失败：${error instanceof Error ? error.message : '未知错误'}`,
    });
    return null;
  }
}

function importedBlockText(block: ImportedBlock): string {
  if (block.type === 'heading' || block.type === 'paragraph') return inlineText(block.inlines);
  if (block.type === 'quote') return block.blocks.map(importedBlockText).filter(Boolean).join('\n');
  if (block.type === 'code') return block.code;
  if (block.type === 'taskList') return block.items.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`).join('\n');
  if (block.type === 'docNav') return block.links.map(link => link.label).join(' | ');
  if (block.type === 'list') {
    return block.items.map(item => item.blocks.map(importedBlockText).filter(Boolean).join('\n')).filter(Boolean).join('\n');
  }
  if (block.type === 'highlight') return block.content.map(importedBlockText).filter(Boolean).join('\n');
  if (block.type === 'embed') return [block.title, block.desc, block.url].filter(Boolean).join(' ');
  if (block.type === 'image') return block.alt || block.src;
  return '';
}

function privateBlockEmbed(
  block: FeishuBlock,
  type: string,
  title: string,
  desc: string,
  warnings: ImportWarning[],
): ImportedBlock {
  warnings.push({
    type: 'unsupported-block',
    blockType: type,
    message: `飞书 ${title} 块暂无法完整还原，已保留为本地可见卡片。`,
  });
  return {
    type: 'embed',
    title,
    kind: type,
    desc,
    url: firstString(
      (block[type] as Record<string, unknown> | undefined)?.url,
      (block[type] as Record<string, unknown> | undefined)?.link,
    ),
  };
}

function blockTypeLabel(block: FeishuBlock): string {
  const type = blockTypeName(block);
  const labels: Record<string, string> = {
    '20': '飞书会话卡片',
    '28': '开放平台小组件',
    '33': '飞书视图块',
    '34': '引用容器',
    '35': '飞书任务',
    '36': 'OKR',
    '37': 'OKR Objective',
    '38': 'OKR Key Result',
    '39': 'OKR Progress',
    '40': '文档小组件',
    '41': 'Jira 问题',
    '42': 'Wiki 子页面列表',
    '43': '画板',
    '44': '议程',
    '45': '议程项',
    '46': '议程项标题',
    '47': '议程项内容',
    '48': '链接预览',
    '49': '源同步块',
    '50': '引用同步块',
    '51': 'Wiki 子页面列表',
    '52': 'AI 模板',
    '53': '新版飞书扩展块',
    '999': '飞书未支持块',
  };
  return labels[type] || `飞书块 ${type}`;
}

function blockPayload(block: FeishuBlock): Record<string, unknown> {
  const commonKeys = new Set(['block_id', 'parent_id', 'block_type', 'children']);
  for (const [key, value] of Object.entries(block)) {
    if (commonKeys.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return {};
}

function pickNestedString(value: unknown, keys: string[], depth = 0): string | undefined {
  if (depth > 3 || value == null) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = pickNestedString(item, keys, depth + 1);
      if (picked) return picked;
    }
    return undefined;
  }
  if (typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);
  }
  for (const item of Object.values(record)) {
    const picked = pickNestedString(item, keys, depth + 1);
    if (picked) return picked;
  }
  return undefined;
}

function advancedEmbedKind(block: FeishuBlock): string {
  const type = blockTypeName(block);
  if (type === '20' || block.chat_card) return 'group';
  if (type === '48') return 'link';
  if (type === '43') return 'board';
  if (type === '41' || block.jira_issue) return 'jira_issue';
  if (type === '52') return 'template';
  return `feishu-block-${type}`;
}

async function degradedFeishuBlock(
  block: FeishuBlock,
  blockMap: Map<string, FeishuBlock>,
  visiting: Set<string>,
  client: FeishuApiClient,
  warnings: ImportWarning[],
  assets: ImportedAsset[],
  assetHeaders: Record<string, string>,
  apiBaseUrl: string,
): Promise<ImportedBlock> {
  const type = blockTypeName(block);
  const title = blockTypeLabel(block);
  const childBlocks = await convertChildBlocks(block.children || [], blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
  const desc = childBlocks.map(importedBlockText).filter(Boolean).join('\n') || `block_type ${type}`;
  warnings.push({
    type: 'unsupported-block',
    blockType: type,
    message: `${title} 暂无法完整还原，已保留为本地可见降级卡片。`,
  });
  if (childBlocks.length) {
    return {
      type: 'highlight',
      icon: '🔒',
      bgColor: '#f7f8fa',
      borderColor: '#dee0e3',
      textColor: '#1f2329',
      content: [
        { type: 'paragraph', inlines: [{ text: `${title}（已降级）`, bold: true }] },
        ...childBlocks,
      ],
    };
  }
  return {
    type: 'embed',
    title,
    kind: `feishu-block-${type}`,
    desc,
  };
}

async function advancedContainerBlock(
  block: FeishuBlock,
  blockMap: Map<string, FeishuBlock>,
  visiting: Set<string>,
  client: FeishuApiClient,
  warnings: ImportWarning[],
  assets: ImportedAsset[],
  assetHeaders: Record<string, string>,
  apiBaseUrl: string,
): Promise<ImportedBlock> {
  const type = blockTypeName(block);
  const label = blockTypeLabel(block);
  const payload = blockPayload(block);
  const payloadTitle = pickNestedString(payload, ['title', 'name', 'summary', 'text', 'content']);
  const payloadUrl = pickNestedString(payload, ['url', 'link', 'href']);
  const childBlocks = await convertChildBlocks(block.children || [], blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
  warnings.push({
    type: 'unsupported-block',
    blockType: type,
    message: `${label} 暂无法完整还原为飞书原生组件，已展开子内容并保留为本地可见块。`,
  });

  if (childBlocks.length) {
    return {
      type: 'highlight',
      icon: '📎',
      bgColor: '#f7f8fa',
      borderColor: '#dee0e3',
      textColor: '#1f2329',
      content: [
        { type: 'paragraph', inlines: [{ text: `${payloadTitle || label}（${type} 已降级）`, bold: true }] },
        ...childBlocks,
      ],
    };
  }

  return {
    type: 'embed',
    title: payloadTitle || label,
    kind: advancedEmbedKind(block),
    url: payloadUrl,
    desc: `block_type ${type}`,
  };
}

function isAdvancedContainerType(block: FeishuBlock): boolean {
  return new Set([
    '20',
    '28',
    '33',
    '35',
    '36',
    '37',
    '38',
    '39',
    '40',
    '41',
    '42',
    '43',
    '44',
    '45',
    '46',
    '47',
    '48',
    '49',
    '50',
    '51',
    '52',
    '53',
  ]).has(blockTypeName(block));
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function findHeading(block: FeishuBlock): { level: number; inlines: ImportedInline[] } | null {
  for (let level = 1; level <= 6; level += 1) {
    const key = `heading${level}`;
    const value = block[key] as { elements?: FeishuTextElement[] } | undefined;
    if (value?.elements) return { level, inlines: textElementsToInlines(value.elements) };
  }
  return null;
}

async function convertFeishuBlock(
  block: FeishuBlock,
  blockMap: Map<string, FeishuBlock>,
  visiting: Set<string>,
  client: FeishuApiClient,
  warnings: ImportWarning[],
  assets: ImportedAsset[],
  assetHeaders: Record<string, string>,
  apiBaseUrl: string,
): Promise<ImportedBlock | null> {
  const heading = findHeading(block);
  if (heading) return { type: 'heading', ...heading };

  if (block.text?.elements) {
    return { type: 'paragraph', inlines: textElementsToInlines(block.text.elements) };
  }

  if (block.quote?.elements) {
    return { type: 'quote', blocks: [{ type: 'paragraph', inlines: textElementsToInlines(block.quote.elements) }] };
  }

  if (block.quote_container || block.block_type === 34 || block.block_type === 'quote_container') {
    const children = await convertChildBlocks(block.children || [], blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
    return {
      type: 'quote',
      blocks: children.length ? children : [{ type: 'paragraph', inlines: [{ text: '' }] }],
    };
  }

  if (block.bullet?.elements) {
    return { type: 'list', items: [{ blocks: [{ type: 'paragraph', inlines: textElementsToInlines(block.bullet.elements) }] }] };
  }

  if (block.ordered?.elements) {
    return { type: 'list', ordered: true, items: [{ blocks: [{ type: 'paragraph', inlines: textElementsToInlines(block.ordered.elements) }] }] };
  }

  if (block.todo?.elements) {
    return {
      type: 'taskList',
      items: [{
        id: block.block_id || uuidv4(),
        text: inlineText(textElementsToInlines(block.todo.elements)),
        checked: Boolean(block.todo.checked),
      }],
    };
  }

  if (block.code?.elements) {
    return {
      type: 'code',
      code: textElementsToInlines(block.code.elements).map(inline => inline.text).join(''),
      language: codeLanguageName(block.code.language),
    };
  }

  if (block.divider || block.block_type === 22 || block.block_type === 'divider') {
    return { type: 'divider' };
  }

  if (block.equation?.content || block.equation?.elements) {
    return {
      type: 'embed',
      kind: 'formula',
      title: '公式',
      desc: block.equation.content || inlineText(textElementsToInlines(block.equation.elements)),
    };
  }

  if (block.sheet) {
    return privateBlockEmbed(block, 'sheet', block.sheet.name || '飞书电子表格', block.sheet.spreadsheet_token || block.sheet.token || '电子表格块', warnings);
  }

  if (block.mindnote) {
    return privateBlockEmbed(block, 'mindnote', block.mindnote.name || '飞书思维笔记', block.mindnote.token || '思维笔记块', warnings);
  }

  if (block.diagram) {
    return privateBlockEmbed(block, 'diagram', block.diagram.name || '流程图 / UML', block.diagram.diagram_type || '图表块', warnings);
  }

  if (block.chat_card) {
    warnings.push({
      type: 'unsupported-block',
      blockType: 'chat_card',
      message: '飞书群名片暂无法完整还原入群状态，已保留为本地可见社群卡片。',
    });
    return {
      type: 'embed',
      title: block.chat_card.title || '飞书群名片',
      kind: 'group',
      desc: '飞书群组',
      url: block.chat_card.url,
    };
  }

  if (block.jira_issue) {
    return privateBlockEmbed(block, 'jira_issue', block.jira_issue.title || 'Jira 问题', 'Jira 集成块', warnings);
  }

  if (block.add_ons) {
    return privateBlockEmbed(block, 'add_ons', block.add_ons.title || '飞书插件块', '开放平台小组件', warnings);
  }

  if (block.reference_base?.token) {
    const converted = await convertReferenceBaseBlock(
      block,
      client,
      warnings,
      { apiBaseUrl, assetHeaders, warnings, assets },
    );
    if (converted) return converted;
  }

  if (block.bitable) {
    const mirrorContext: BitableAttachmentMirrorContext = { apiBaseUrl, assetHeaders, warnings, assets };
    if (block.bitable.fields?.length && block.bitable.records) {
      const table = mapFeishuBitableToBaseTable({
        tableId: block.bitable.table_id || block.block_id || uuidv4(),
        tableName: block.bitable.table_name || '飞书多维表格',
        fields: block.bitable.fields,
        records: block.bitable.records,
        views: block.bitable.views,
      });
      await mirrorBitableTableAttachments(table, mirrorContext);
      return { type: 'bitable', payload: { table, defaultView: table.views[0]?.type || 'grid' } };
    }
    try {
      const table = await fetchBitableTableFromApi(client, block.bitable, block.block_id, undefined, mirrorContext);
      if (table) {
        return { type: 'bitable', payload: { table, defaultView: table.views[0]?.type || 'grid' } };
      }
    } catch (error) {
      warnings.push({
        type: 'partial-data',
        blockType: 'bitable',
        message: `飞书多维表格数据拉取失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
    warnings.push({
      type: 'partial-data',
      blockType: 'bitable',
      message: '飞书多维表格块未返回可用字段、记录和视图数据，已保留为占位卡片。',
    });
    return {
      type: 'embed',
      title: block.bitable.table_name || '飞书多维表格',
      kind: 'bitable',
      desc: block.bitable.table_id || block.bitable.app_token || '缺少结构化数据',
    };
  }

  if (block.callout) {
    const content = await convertChildBlocks(block.children || [], blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
    return {
      type: 'highlight',
      icon: calloutEmoji(block.callout.emoji_id),
      bgColor: colorToken(block.callout.background_color, '#fff7e6'),
      borderColor: colorToken(block.callout.border_color, '#fed4a4'),
      textColor: colorToken(block.callout.text_color, '#1f2329'),
      content: content.length ? content : [{ type: 'paragraph', inlines: [{ text: '高亮块' }] }],
    };
  }

  if (block.grid) {
    const columnBlocks = (block.children || [])
      .map(childId => blockMap.get(childId))
      .filter((child): child is FeishuBlock => Boolean(child?.grid_column));
    const columns = await Promise.all(columnBlocks.map(column =>
      convertChildBlocks(column.children || [], blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl),
    ));
    if (columns.length) {
      const fallbackWidth = Math.floor(100 / columns.length);
      return {
        type: 'columns',
        columns: columns.map(column => (column.length ? column : [{ type: 'paragraph', inlines: [{ text: '' }] }])),
        ratios: columnBlocks.map(column => Number(column.grid_column?.width_ratio) || fallbackWidth),
      };
    }
  }

  if (block.iframe?.component?.url) {
    const url = decodeIframeUrl(block.iframe.component.url);
    return {
      type: 'embed',
      title: '内嵌内容',
      url,
      kind: 'iframe',
      desc: String(block.iframe.component.type || 'iframe'),
    };
  }

  if (block.file) {
    const token = block.file.file_token || block.file.token || '';
    const asset = token ? await mirrorRemoteAsset(mediaDownloadUrl(apiBaseUrl, token), assetHeaders, warnings) : null;
    if (asset) assets.push(asset);
    if (!asset?.localUrl) {
      warnings.push({
        type: 'partial-data',
        blockType: 'file',
        message: '飞书文件块已保留为本地卡片，但文件二进制下载失败或缺少 token。',
      });
    }
    return {
      type: 'embed',
      title: block.file.name || block.file.file_token || block.file.token || '飞书文件',
      url: asset?.localUrl,
      kind: 'file',
      desc: block.file.mime_type || 'Feishu file',
    };
  }

  if (block.image?.token) {
    const remoteUrl = mediaDownloadUrl(apiBaseUrl, block.image.token);
    const asset = await mirrorRemoteAsset(remoteUrl, assetHeaders, warnings);
    assets.push(asset);
    if (asset.localUrl) return { type: 'image', src: asset.localUrl };
    return {
      type: 'embed',
      title: '飞书图片',
      kind: 'image',
      desc: '图片资源受飞书权限限制，已保留为可见占位卡片。',
      url: remoteUrl,
    };
  }

  if (block.image?.url) {
    const asset = await mirrorRemoteAsset(block.image.url, assetHeaders, warnings);
    assets.push(asset);
    if (asset.localUrl) return { type: 'image', src: asset.localUrl };
    return {
      type: 'embed',
      title: '飞书图片',
      kind: 'image',
      desc: '图片资源下载失败，已保留为可见占位卡片。',
      url: block.image.url,
    };
  }

  if (block.table?.cells?.length) {
    return {
      type: 'table',
      rows: block.table.cells.map((row, rowIndex) => row.map(content => ({
        content: String(content || ''),
        header: rowIndex === 0,
      }))),
    };
  }

  if (block.table?.row_size && block.children?.length) {
    const columnSize = Math.max(1, Number(block.table.column_size) || block.children.length);
    const cellBlocks = block.children
      .map(childId => blockMap.get(childId))
      .filter((child): child is FeishuBlock => Boolean(child?.table_cell));
    const cellTexts = await Promise.all(cellBlocks.map(async cell => {
      const children = await convertChildBlocks(cell.children || [], blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
      return children.map(importedBlockText).filter(Boolean).join('\n');
    }));
    const rows = Array.from({ length: Math.ceil(cellTexts.length / columnSize) }, (_, rowIndex) =>
      cellTexts.slice(rowIndex * columnSize, rowIndex * columnSize + columnSize).map((content, cellIndex) => {
        const cell = cellBlocks[rowIndex * columnSize + cellIndex];
        return {
        content,
        header: rowIndex === 0,
        rowSpan: Number(cell?.table_cell?.row_span || 1),
        colSpan: Number(cell?.table_cell?.col_span || 1),
        bgColor: colorToken(cell?.table_cell?.background_color, ''),
      };
      }),
    );
    return rows.length ? { type: 'table', rows } : null;
  }

  if (block.table_cell) {
    return null;
  }

  if (isAdvancedContainerType(block)) {
    return advancedContainerBlock(block, blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
  }

  return degradedFeishuBlock(block, blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
}

async function convertChildBlocks(
  childIds: string[],
  blockMap: Map<string, FeishuBlock>,
  visiting: Set<string>,
  client: FeishuApiClient,
  warnings: ImportWarning[],
  assets: ImportedAsset[],
  assetHeaders: Record<string, string>,
  apiBaseUrl: string,
): Promise<ImportedBlock[]> {
  const blocks: ImportedBlock[] = [];
  for (const childId of childIds) {
    if (visiting.has(childId)) continue;
    const child = blockMap.get(childId);
    if (!child) continue;
    visiting.add(childId);
    const converted = await convertFeishuBlock(child, blockMap, visiting, client, warnings, assets, assetHeaders, apiBaseUrl);
    visiting.delete(childId);
    if (converted) blocks.push(converted);
  }
  return blocks;
}

async function fetchAllDocumentBlocks(client: FeishuApiClient, documentToken: string): Promise<FeishuBlock[]> {
  const blocks: FeishuBlock[] = [];
  let pageToken = '';

  do {
    const query = new URLSearchParams({ page_size: '500' });
    if (pageToken) query.set('page_token', pageToken);
    const data = await client.request<FeishuBlockListResponse>(
      `/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}/blocks?${query.toString()}`,
    );
    blocks.push(...(data.items || []));
    pageToken = data.has_more && data.page_token ? data.page_token : '';
  } while (pageToken);

  return blocks;
}

function buildFallbackBusinessReportPayload(sourceUrl: string, warning: string): EmittedImportPayload {
  return {
    title: '业务经营周报',
    content: buildBusinessReportDocumentContent(),
    sourceName: sourceNameFromUrl(sourceUrl),
    sourceUrl,
    assetCount: 0,
    warnings: [
      warning,
      '当前使用业务经营周报本地高保真 fixture 兜底，待飞书 API 返回完整 bitable/view 数据后可升级为 full。',
    ],
    importQuality: 'partial',
    unsupportedBlocks: [{ type: 'feishu-api-bitable', reason: '飞书 API 未提供完整多维表格 view 配置或当前凭据无权限访问。' }],
  };
}

interface FeishuWikiNode {
  obj_token?: string;
  obj_type?: string;
  title?: string;
  node_token?: string;
}

interface FeishuWikiGetNodeResponse {
  node?: FeishuWikiNode;
}

interface FeishuBitableAppMetaResponse {
  app?: { name?: string };
}

interface ResolvedDocumentTarget {
  token: string;
  type: FeishuObjectType;
  title?: string;
  tableId?: string;
}

function normalizeObjType(objType: string | undefined): FeishuObjectType {
  const value = String(objType || '').toLowerCase();
  if (value === 'docx') return 'docx';
  if (value === 'doc') return 'doc';
  if (value === 'bitable' || value === 'base') return 'bitable';
  if (value === 'sheet') return 'sheet';
  if (value === 'mindnote') return 'mindnote';
  if (value === 'file') return 'file';
  if (value === 'slides') return 'slides';
  // 未知 obj_type 一律按 docx 处理，最大化保留可读正文。
  return 'docx';
}

/**
 * 把链接解析成真正可调用 API 的目标对象。
 * wiki 链接需要先调用 wiki/v2/get_node 拿到底层 obj_token 与 obj_type；
 * 解析失败（无权限 / 测试 mock 未实现该接口）时回退为把 wiki token 当作 docx token。
 */
async function resolveDocumentTarget(
  client: FeishuApiClient,
  parsed: ParsedFeishuUrl,
  warnings: ImportWarning[],
): Promise<ResolvedDocumentTarget> {
  if (parsed.type !== 'wiki') {
    return {
      token: parsed.token,
      type: parsed.type === 'unknown' ? 'docx' : parsed.type,
      tableId: parsed.tableId,
    };
  }

  try {
    const query = new URLSearchParams({ token: parsed.token, obj_type: 'wiki' });
    const data = await client.request<FeishuWikiGetNodeResponse>(
      `/open-apis/wiki/v2/spaces/get_node?${query.toString()}`,
    );
    const node = data.node;
    if (node?.obj_token) {
      return {
        token: node.obj_token,
        type: normalizeObjType(node.obj_type),
        title: node.title?.trim() || undefined,
        tableId: parsed.tableId,
      };
    }
  } catch (error) {
    warnings.push({
      type: 'partial-data',
      blockType: 'wiki-node',
      message: `wiki 节点解析失败，已按文档块直接读取：${error instanceof Error ? error.message : '未知错误'}`,
    });
  }

  return { token: parsed.token, type: 'docx', tableId: parsed.tableId };
}

/**
 * 独立多维表格 app 导入：把 app 内每张数据表映射为本地 bitable 块。
 * 链接里带 ?table= 时优先把该表排在最前面。
 */
async function importStandaloneBitableApp(
  client: FeishuApiClient,
  target: ResolvedDocumentTarget,
  sourceUrl: string,
  warnings: ImportWarning[],
): Promise<EmittedImportPayload | null> {
  const appToken = target.token;
  let appName = target.title || '飞书多维表格';
  try {
    const meta = await client.request<FeishuBitableAppMetaResponse>(
      `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}`,
    );
    if (meta.app?.name?.trim()) appName = meta.app.name.trim();
  } catch {
    // app meta 拿不到不影响表数据导入，沿用链接标题或默认名。
  }

  const tables = await fetchPagedItems<FeishuBitableTable>(
    client,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`,
    100,
  );
  if (!tables.length) return null;

  const orderedTables = target.tableId
    ? [...tables].sort((a, b) =>
        (b.table_id === target.tableId ? 1 : 0) - (a.table_id === target.tableId ? 1 : 0))
    : tables;

  const blocks: ImportedBlock[] = [];
  const assets: ImportedAsset[] = [];
  const token = await client.getTenantAccessToken();
  const apiBaseUrl = getFeishuApiConfigFromEnv()?.baseUrl || 'https://open.feishu.cn';
  const mirrorContext: BitableAttachmentMirrorContext = {
    apiBaseUrl,
    assetHeaders: { Authorization: `Bearer ${token}` },
    warnings,
    assets,
  };

  for (const tableMeta of orderedTables) {
    const tableId = tableMeta.table_id?.trim();
    if (!tableId) continue;
    const basePath = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`;
    try {
      const [fields, records, views] = await Promise.all([
        fetchPagedItems<Record<string, unknown>>(client, `${basePath}/fields`, 200),
        fetchPagedItems<Record<string, unknown>>(client, `${basePath}/records`, 500),
        fetchPagedItems<Record<string, unknown>>(client, `${basePath}/views`, 200),
      ]);
      if (!fields.length) continue;
      const table = mapFeishuBitableToBaseTable({
        tableId,
        tableName: tableMeta.name || '数据表',
        fields,
        records,
        views,
      });
      await mirrorBitableTableAttachments(table, mirrorContext);
      if (orderedTables.length > 1) {
        blocks.push({ type: 'heading', level: 2, inlines: [{ text: tableMeta.name || '数据表' }] });
      }
      blocks.push({ type: 'bitable', payload: { table, defaultView: table.views[0]?.type || 'grid' } });
    } catch (error) {
      warnings.push({
        type: 'partial-data',
        blockType: 'bitable',
        message: `多维表格「${tableMeta.name || tableId}」拉取失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  }

  if (!blocks.length) return null;

  const partial = warnings.some(warning =>
    warning.type === 'unsupported-block' || warning.type === 'partial-data' || warning.type === 'asset');
  const document: ImportedDocument = {
    title: appName,
    sourceUrl,
    sourceName: sourceNameFromUrl(sourceUrl),
    blocks,
    assets,
    warnings,
    importQuality: partial ? 'partial' : 'full',
    importMetadata: {
      permission: 'readable',
      readonly: false,
      comments: 'not_supported',
      notes: [
        '已通过飞书 Open API 读取多维表格结构；本地保存为可编辑副本。',
        '飞书评论、协作者与高级权限未通过 Open API 导入。',
      ],
    },
  };
  return emitLocalHtml(document);
}

export async function importFeishuDocumentFromApi(sourceUrl: string): Promise<EmittedImportPayload | null> {
  const config = getFeishuApiConfigFromEnv();
  const parsed = parseFeishuUrl(sourceUrl);
  const documentToken = parsed.token;
  if (!config) {
    if (documentToken === BUSINESS_REPORT_TOKEN) {
      return buildFallbackBusinessReportPayload(sourceUrl, '未配置 FEISHU_APP_ID / FEISHU_APP_SECRET，无法通过 Open API 获取真实 block 数据。');
    }
    return null;
  }

  const client = createFeishuApiClient(config);
  const warnings: ImportWarning[] = [];

  try {
    const target = await resolveDocumentTarget(client, parsed, warnings);

    if (target.type === 'bitable') {
      const bitablePayload = await importStandaloneBitableApp(client, target, sourceUrl, warnings);
      if (bitablePayload) return bitablePayload;
    }

    const blocks = await fetchAllDocumentBlocks(client, target.token);
    const assets: ImportedAsset[] = [];
    const token = await client.getTenantAccessToken();
    const blockMap = new Map(blocks.filter(block => block.block_id).map(block => [block.block_id!, block]));
    const containedChildren = new Set(blocks.flatMap(block => block.children || []));
    const rootBlocks = blocks
      .filter(block => !block.block_id || !containedChildren.has(block.block_id))
      .flatMap(block => (isPageBlock(block) && block.children?.length
        ? block.children.map(childId => blockMap.get(childId)).filter((child): child is FeishuBlock => Boolean(child))
        : [block]));
    const importedBlocks = (await Promise.all(rootBlocks.map(block => convertFeishuBlock(
      block,
      blockMap,
      new Set(block.block_id ? [block.block_id] : []),
      client,
      warnings,
      assets,
      { Authorization: `Bearer ${token}` },
      config.baseUrl || 'https://open.feishu.cn',
    )))).filter((block): block is ImportedBlock => block != null);

    const isBusinessReport = parsed.token === BUSINESS_REPORT_TOKEN;
    let finalBlocks = importedBlocks;
    let finalWarnings = warnings;
    if (isBusinessReport) {
      finalBlocks = enrichBusinessReportBlocks(importedBlocks);
      finalWarnings = stripBusinessReportOpaqueWarnings(warnings);
      if (finalBlocks !== importedBlocks) {
        finalWarnings.push({
          type: 'partial-data',
          message: '飞书 Open API 未返回部分内嵌多维表格/仪表盘块详情，已使用本地高保真组件补齐展示。',
        });
      }
    }

    if (!finalBlocks.length && isBusinessReport) {
      return buildFallbackBusinessReportPayload(sourceUrl, '飞书 API 未返回可识别的文档 block，已使用固定周报高保真 fixture 兜底。');
    }
    if (!finalBlocks.length) {
      return null;
    }

    const partialWarningCount = finalWarnings.filter(warning =>
      warning.type === 'unsupported-block' || warning.type === 'partial-data' || warning.type === 'asset',
    ).length;
    const firstHeading = finalBlocks.find((block): block is Extract<ImportedBlock, { type: 'heading' }> => block.type === 'heading');
    const pageBlock = blocks.find(isPageBlock);
    const pageTitle = pageBlock?.page?.elements
      ? inlineText(textElementsToInlines(pageBlock.page.elements))
      : '';
    const document: ImportedDocument = {
      title: pageTitle || target.title || (firstHeading ? inlineText(firstHeading.inlines) : '') || '飞书文档',
      sourceUrl,
      sourceName: sourceNameFromUrl(sourceUrl),
      blocks: finalBlocks.length ? finalBlocks : [{ type: 'paragraph', inlines: [{ text: '飞书文档导入完成，但没有可渲染内容。' }] }],
      assets,
      warnings: finalWarnings,
      importQuality: partialWarningCount ? 'partial' : 'full',
      importMetadata: {
        permission: 'readable',
        readonly: false,
        comments: 'not_supported',
        notes: [
          '已通过飞书 Open API 读取文档结构；本地保存为可编辑副本。',
          '飞书评论线程尚未接入 Open API 导入，评论侧栏只显示本地评论。',
        ],
      },
    };

    return emitLocalHtml(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : '飞书 API 导入失败';
    if (documentToken === BUSINESS_REPORT_TOKEN) {
      return buildFallbackBusinessReportPayload(sourceUrl, `飞书 API 导入失败：${message}`);
    }
    return null;
  }
}
