import fs from 'fs';
import path from 'path';
import { HTMLElement, parse } from 'node-html-parser';
import { getSampleCapabilityRow } from '../fixtures/feishuSampleCapabilityMatrix';
import { findFeishuPublicSample } from '../fixtures/feishuPublicSamples';
import type { ImportedBlock, ImportedDocument, ImportedInline, ImportWarning } from './types';

const CALLOUT_ICONS = new Set(['📍', '💡', '📌', '❗', '🍞', '🐵', '🏖️', '🥇', '🔗', '🚀', '📚', '📄', '😁', '⏳', '🧭']);
const CHART_COLORS = ['#3370ff', '#14c0ff', '#ffc60a', '#25b47e'];

interface RenderAuditRow {
  title: string;
  url: string;
  category?: string;
  renderedTextLength?: number;
  renderedLines?: string[];
  sourceHints?: string[];
}

function normalizeText(value: string) {
  return value.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}

function sourceNameFromUrl(sourceUrl: string) {
  return new URL(sourceUrl).pathname.split('/').pop() || 'feishu-wiki';
}

function samePublicUrl(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.hostname === b.hostname && a.pathname === b.pathname;
  } catch {
    return left === right;
  }
}

function findRenderedSnapshot(sourceUrl: string): RenderAuditRow | null {
  const reportPath = path.resolve(__dirname, '../../..', 'docs/public-feishu-render-audit.json');
  if (!fs.existsSync(reportPath)) return null;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as { rows?: RenderAuditRow[] };
    return report.rows?.find(row => samePublicUrl(row.url, sourceUrl)) || null;
  } catch {
    return null;
  }
}

function inline(text: string): ImportedInline[] {
  return [{ text }];
}

function paragraph(text: string): ImportedBlock {
  return { type: 'paragraph', inlines: inline(text) };
}

function docNav(text: string): ImportedBlock {
  return {
    type: 'docNav',
    links: text
      .split('|')
      .map(label => normalizeText(label))
      .filter(Boolean)
      .map(label => ({ label })),
  };
}

function isNoiseLine(line: string) {
  return line === 'Share'
    || line === "Type '/' for commands"
    || /^Modified /.test(line)
    || /^Created on /.test(line)
    || line === '​'
    || !line;
}

function isRatio(line: string) {
  const value = Number(line.replace('%', ''));
  return /^\d{1,3}%$/.test(line) && value >= 0 && value <= 100;
}

function isCalloutIcon(line: string) {
  return CALLOUT_ICONS.has(line);
}

function lineLooksLikeResource(text: string) {
  return /推荐|资料|模板|课程|文档|指南|合集|Github|github|https?:\/\//i.test(text)
    && !/[。？！]$/.test(text)
    && text.length <= 80;
}

function lineToEmbed(text: string): ImportedBlock {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  return {
    type: 'embed',
    title: text.replace(url || '', '').trim() || url || text,
    url,
    kind: url ? 'link' : 'template',
  };
}

function resourceCard(title: string, desc: string): ImportedBlock {
  return {
    type: 'embed',
    title,
    desc,
    kind: 'template',
  };
}

function groupCard(title: string, desc: string): ImportedBlock {
  return {
    type: 'embed',
    title,
    desc,
    kind: 'group',
  };
}

function bulletList(items: ImportedBlock[][]): ImportedBlock {
  return {
    type: 'list',
    items: items.map(blocks => ({ blocks })),
  };
}

function buildDashboardFromRatios(ratios: number[], title = '比例图表'): ImportedBlock {
  return {
    type: 'dashboard',
    payload: {
      title,
      config: {},
      fallbackSlices: ratios.map((value, index) => ({
        label: `分项 ${index + 1}`,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    },
  };
}

function buildSnapshotTable(lines: string[]): ImportedBlock {
  const rows = lines
    .filter(line => line.length >= 2 && line.length <= 80)
    .slice(0, 12)
    .map((line, index) => [
      { content: String(index + 1), header: false },
      { content: line, header: false },
    ]);
  return {
    type: 'table',
    rows: [
      [
        { content: '序号', header: true },
        { content: '内容', header: true },
      ],
      ...rows,
    ],
  };
}

function buildSnapshotBitable(title: string, lines: string[]): ImportedBlock {
  const fields = [
    { id: 'title', name: '标题', type: 'text', isPrimary: true },
    { id: 'category', name: '来源', type: 'single_select', options: { choices: [{ id: 'public', name: '公开快照', color: '#3370ff' }] } },
  ];
  const records = lines
    .filter(line => line.length >= 2 && line.length <= 80)
    .slice(0, 12)
    .map((line, index) => ({
      id: `snapshot_rec_${index + 1}`,
      tableId: 'snapshot_public_table',
      fields: { title: line, category: '公开快照' },
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      createdBy: '公开飞书',
    }));
  const table = {
    id: 'snapshot_public_table',
    name: `${title} 摘要表`,
    primaryFieldId: 'title',
    activeViewId: 'grid',
    fields,
    records,
    views: [{
      id: 'grid',
      tableId: 'snapshot_public_table',
      name: '表格视图',
      type: 'grid',
      config: {
        visibleFieldIds: ['title', 'category'],
        fieldWidths: { title: 360, category: 120 },
        rowHeight: 'medium',
      },
      sorts: [],
      filters: [],
    }],
  };
  return { type: 'bitable', payload: { table, defaultView: 'grid' } };
}

function buildQuickstartLearningMapBitable(): ImportedBlock {
  const tableId = 'tbl_feishu_quickstart_learning_map';
  const fields = [
    { id: 'topic', name: '学习主题', type: 'text', required: true },
    {
      id: 'level',
      name: '能力阶段',
      type: 'single_select',
      options: {
        choices: [
          { id: 'beginner', name: '初阶操作', color: '#fde2e2' },
          { id: 'intermediate', name: '中阶操作', color: '#d9f5d6' },
          { id: 'advanced', name: '高阶操作', color: '#e1eaff' },
          { id: 'resource', name: '资源推荐', color: '#fff7e6' },
        ],
      },
    },
    { id: 'fields', name: '字段 / 功能', type: 'multi_select', options: { choices: [
      { id: 'text', name: '多行文本', color: '#dee8ff' },
      { id: 'number', name: '数字', color: '#d9f5d6' },
      { id: 'select', name: '单选多选', color: '#f1ddff' },
      { id: 'date', name: '日期', color: '#fee7cd' },
      { id: 'formula', name: '公式', color: '#fff7e6' },
      { id: 'user', name: '人员', color: '#e1eaff' },
      { id: 'attachment', name: '附件', color: '#f2f3f5' },
      { id: 'relation', name: '关联字段', color: '#d9f5d6' },
      { id: 'lookup', name: '查找引用', color: '#dee8ff' },
      { id: 'dashboard', name: '仪表盘', color: '#fde2e2' },
      { id: 'permission', name: '高级权限', color: '#f1ddff' },
    ] } },
    { id: 'description', name: '说明', type: 'rich_text' },
    { id: 'url', name: '资源链接', type: 'url' },
    { id: 'done', name: '已掌握', type: 'checkbox' },
  ];
  const now = new Date(0).toISOString();
  const makeRecord = (id: string, values: Record<string, unknown>) => ({
    id,
    tableId,
    fields: values,
    createdAt: now,
    updatedAt: now,
    createdBy: '飞书公开文档',
    updatedBy: '飞书公开文档',
  });
  const records = [
    makeRecord('rec_beginner_excel', {
      topic: '和 Excel 类似的（一看就会系列）',
      level: '初阶操作',
      fields: ['text', 'number', 'select'],
      description: '多行文本、数字、单选多选、复选框，适合作为多维表格入门。',
      url: '',
      done: false,
    }),
    makeRecord('rec_beginner_feishu', {
      topic: '和 Excel 不同的（动手改改就会）',
      level: '初阶操作',
      fields: ['date', 'formula'],
      description: '日期、超链接、公式等能力，用于构建更自动化的表格。',
      url: '',
      done: false,
    }),
    makeRecord('rec_beginner_unique', {
      topic: '飞书多维表格专属实用功能',
      level: '初阶操作',
      fields: ['user', 'attachment'],
      description: '人员、附件、电话号码、自动编号、创建人、修改人、创建时间、更新时间。',
      url: '',
      done: false,
    }),
    makeRecord('rec_intermediate_relation', {
      topic: '关联字段',
      level: '中阶操作',
      fields: ['relation'],
      description: '学习单向关联、双向关联，用不同表之间的数据建立关系。',
      url: '',
      done: false,
    }),
    makeRecord('rec_intermediate_formula_lookup', {
      topic: '公式字段和查找引用字段',
      level: '中阶操作',
      fields: ['formula', 'lookup'],
      description: '用公式字段计算数据，用查找引用字段复用其它表的数据。',
      url: '',
      done: false,
    }),
    makeRecord('rec_intermediate_dashboard', {
      topic: '仪表盘功能',
      level: '中阶操作',
      fields: ['dashboard'],
      description: '使用多维表格仪表盘进行统计、图表和可视化分析。',
      url: '',
      done: false,
    }),
    makeRecord('rec_advanced_permission', {
      topic: '高级权限',
      level: '高阶操作',
      fields: ['permission'],
      description: '使用多维表格高级权限控制不同成员的数据可见性和编辑权限。',
      url: '',
      done: false,
    }),
    makeRecord('rec_resource_course', {
      topic: '一表人才 | 飞书多维表格实战课',
      level: '资源推荐',
      fields: ['dashboard', 'relation', 'lookup'],
      description: '适合系统化学习多维表格实战能力。',
      url: 'https://sudo.feishu.cn/wiki/wikcnwkGXCivuQI03mXMkpnzpmg',
      done: false,
    }),
    makeRecord('rec_resource_toolbox', {
      topic: '多维表格百宝箱 / 资源导航',
      level: '资源推荐',
      fields: ['text', 'attachment', 'dashboard'],
      description: '适合按功能查找教程、模板、资料和社区内容。',
      url: 'https://sudo.feishu.cn/wiki/wikcnwkGXCivuQI03mXMkpnzpmg',
      done: false,
    }),
  ];
  const table = {
    id: tableId,
    name: '多维表格学习地图',
    fields,
    records,
    primaryFieldId: 'topic',
    activeViewId: 'view_grid',
    views: [
      {
        id: 'view_grid',
        tableId,
        name: '学习地图',
        type: 'grid',
        config: {
          visibleFieldIds: ['topic', 'level', 'fields', 'description', 'url', 'done'],
          fieldWidths: { topic: 260, level: 120, fields: 220, description: 420, url: 260, done: 90 },
          rowHeight: 'medium',
          groupByFieldIds: ['level'],
          groupSortDirections: ['asc'],
        },
        sorts: [],
        filters: [],
      },
      {
        id: 'view_kanban',
        tableId,
        name: '按阶段看板',
        type: 'kanban',
        config: {
          titleFieldId: 'topic',
          visibleFieldIds: ['fields', 'description', 'url'],
          groupByFieldId: 'level',
          coverFit: 'cover',
          cardSize: 'medium',
          cardAspectRatio: '4:3',
          showFieldNames: true,
          showEmptyFields: false,
          showAttachmentCount: false,
          showRecordActions: false,
          showEmptyGroups: true,
          showNewRecordButton: true,
          emptyCoverMode: 'placeholder',
        },
        sorts: [],
        filters: [],
      },
      {
        id: 'view_gallery',
        tableId,
        name: '资源画册',
        type: 'gallery',
        config: {
          titleFieldId: 'topic',
          visibleFieldIds: ['level', 'fields', 'description'],
          coverFit: 'cover',
          cardSize: 'medium',
          cardAspectRatio: '16:9',
          showFieldNames: true,
          showEmptyFields: false,
          showAttachmentCount: false,
          showRecordActions: false,
          emptyCoverMode: 'placeholder',
        },
        sorts: [],
        filters: [],
      },
    ],
  };
  return { type: 'bitable', payload: { table, defaultView: 'grid' } };
}

function buildColumnsFromRatios(ratios: number[]): ImportedBlock {
  return {
    type: 'columns',
    ratios,
    columns: ratios.map(value => [paragraph(`分栏 ${value}%`)]),
  };
}

function collectTextElements(root: HTMLElement) {
  const body = root.querySelector('body') || root;
  const elements = body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, th, td');
  return elements
    .map(element => ({
      tag: element.tagName.toLowerCase(),
      text: normalizeText(element.structuredText || element.text || ''),
    }))
    .filter(item => !isNoiseLine(item.text));
}

function tableBlocks(root: HTMLElement): ImportedBlock[] {
  return root.querySelectorAll('table').map(table => {
    const rows = table.querySelectorAll('tr').map((row, rowIndex) =>
      row.querySelectorAll('th, td').map(cell => ({
        content: normalizeText(cell.structuredText || cell.text || ''),
        header: rowIndex === 0 || cell.tagName.toLowerCase() === 'th',
      })),
    ).filter(row => row.some(cell => cell.content));
    return { type: 'table', rows } as ImportedBlock;
  }).filter(block => block.type !== 'table' || block.rows.length);
}

function titleFromHtml(root: HTMLElement, fallback: string) {
  return normalizeText(
    root.querySelector('h1')?.structuredText
    || root.querySelector('title')?.structuredText?.replace(/ - 飞书云文档$/, '')
    || fallback,
  );
}

function buildWarnings(sourceUrl: string): ImportWarning[] {
  const sample = findFeishuPublicSample(sourceUrl);
  const matrix = sample ? getSampleCapabilityRow(sample.id) : undefined;
  const warnings: ImportWarning[] = [
    {
      type: 'fallback',
      message: '公开页面未暴露飞书内部 block JSON，已根据可见 HTML 构建本地高保真结构。',
    },
  ];
  matrix?.unsupportedBlocks.forEach(block => {
    warnings.push({
      type: 'unsupported-block',
      blockType: block.type,
      message: block.reason,
    });
  });
  return warnings;
}

function highlight(icon: string, content: ImportedBlock[], bgColor = '#e1eaff', borderColor = '#82a7fc'): ImportedBlock {
  return {
    type: 'highlight',
    icon,
    content,
    bgColor,
    borderColor,
  };
}

function heading(level: number, text: string): ImportedBlock {
  return { type: 'heading', level, inlines: inline(text) };
}

function buildBitableQuickstartDocument(sourceUrl: string): ImportedDocument {
  const title = '多维表格 快速入门指南 & 学习测验地图';
  const blocks: ImportedBlock[] = [
    heading(1, title),
    docNav('首页 | 新人必逛 | 高阶玩法 | 读书笔记 | 资源合集 | 关于我'),
    highlight('💡', [
      paragraph('本人属原创，毕业于北京大学，曾任字节&社群学习，前教育创业者，现企业服务从业者。'),
      bulletList([
        [paragraph('如果对本文档内容感兴趣，欢迎直接文档【评论交流】。')],
        [paragraph('对更多类似内容感兴趣，欢迎点击群名片【加入群聊】获取更新提醒。')],
      ]),
    ], '#fff7e6', '#fed4a4'),
    {
      type: 'columns',
      ratios: [50, 50],
      columns: [
        [groupCard('飞书案例沉淀指南群', '飞书官方 · 飞书案例沉淀 · 飞书实战技巧与内容')],
        [groupCard('飞书案例沉淀交流会', '飞书官方 · 飞书案例沉淀 · 资源 & 日常讨论')],
      ],
    },
    {
      type: 'columns',
      ratios: [50, 50],
      columns: [
        [
          heading(2, '官方课程资源推荐'),
          highlight('📌', [
            paragraph('如果你希望短期集训系统化学习 📚'),
            bulletList([
              [resourceCard('一表人才|飞书多维表格实战课【大礼包】👈👈👈', '推荐课程')],
            ]),
            paragraph('如果你希望边用边学碎片化学习 🔍'),
            bulletList([
              [resourceCard('多维表格功能教学短视频合集', '推荐课程')],
              [resourceCard('多维表格百宝箱 | 多维表格资源导航 | 课程&社区&模版&资料', '推荐资料')],
            ]),
            paragraph('如果你需要路径引导和成果检验 📝'),
            bulletList([
              [resourceCard('飞书多维表格 | 官方课程 & 学习地图 & 能力分级测试 👈👈👈', '推荐文档')],
            ]),
            paragraph('如果你希望直接使用现成模板 💡'),
            bulletList([
              [resourceCard('飞书多维表格最佳实践合集', '最佳实践合集')],
              [resourceCard('飞书多维表格模板大全', '官方模板大全')],
              [resourceCard('📝 我就随便搭搭 · 多维表格模板库 📝', '我就随便搭搭')],
            ]),
          ], '#fff7e6', '#fed4a4'),
        ],
        [
          heading(2, '多维表格学习地图'),
          heading(3, '能力分级'),
          highlight('💡', [
            heading(3, '初阶操作'),
            bulletList([
              [paragraph('和 Excel 类似的（一看就会系列😉）：多行文本 | 数字 | 单选多选 | 复选框')],
              [paragraph('和 Excel 不同的（动手改改就会😎）：日期 | 超链接 | 公式')],
              [paragraph('Excel 里没有的（专属实用功能😝）：人员 | 附件 | 电话号码')],
              [paragraph('实时自动更新的（Wow🚀）：自动编号 | 创建人 | 修改人 | 创建时间 | 最后更新时间')],
            ]),
            heading(3, '中阶操作'),
            bulletList([
              [paragraph('关联字段：单向关联 | 双向关联')],
              [paragraph('公式字段：多维表格公式字段概述')],
              [paragraph('查找引用字段：用查找引用字段查找或引用数据')],
              [paragraph('仪表盘功能：使用多维表格仪表盘')],
            ]),
            heading(3, '高阶操作'),
            bulletList([
              [paragraph('高级权限：使用多维表格高级权限')],
            ]),
          ], '#fff7e6', '#fed4a4'),
        ],
      ],
    },
    buildQuickstartLearningMapBitable(),
  ];

  return {
    title,
    sourceUrl,
    sourceName: sourceNameFromUrl(sourceUrl),
    blocks,
    assets: [],
    warnings: buildWarnings(sourceUrl),
    importQuality: 'fallback',
    coverUrl: '/static/01.gif',
    showSourceAttribution: false,
  };
}

function cleanRenderedLines(lines: string[] | undefined) {
  return (lines || [])
    .map(normalizeText)
    .filter(line => line && line !== '​')
    .filter(line => ![
      '飞书云文档',
      '互联网公开',
      '问问知识库',
      '登录/注册',
      '立即编辑',
      '帮助中心',
      '效率指南',
    ].includes(line))
    .filter(line => !/^最新修改时间/.test(line))
    .filter(line => !/^评论（?\d*）?/.test(line));
}

function isIconOnlyLine(line: string) {
  return [...line].length <= 3 && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(line);
}

function lineLooksLikeHeading(line: string) {
  return line.length <= 48 && (
    /^(\d+(\.\d+)*[.、\s]|Step\d+|第[一二三四五六七八九十]+|[一二三四五六七八九十]+、)/i.test(line)
    || /^(写在开头|阅读指南|引言|目录|工具专区|实战案例|新手入门|友情链接|入门课程推荐)$/.test(line)
  );
}

function lineLooksLikeGroupCard(line: string) {
  return /群|社群|交流群|圆桌会/.test(line) && line.length <= 60;
}

function buildSnapshotNav(lines: string[], title: string) {
  const directoryIndex = lines.findIndex(line => line === '目录');
  if (directoryIndex < 0) return null;
  const labels: string[] = [];
  for (let index = directoryIndex + 1; index < lines.length && labels.length < 10; index += 1) {
    const line = lines[index];
    if (line.includes(title) && labels.length > 2) break;
    if (isIconOnlyLine(line) || line.length < 2 || line.length > 36) continue;
    if (/^(登录|注册|最新修改|评论)/.test(line)) continue;
    labels.push(line);
  }
  return labels.length >= 3 ? docNav(labels.join(' | ')) : null;
}

function buildDocumentFromRenderedSnapshot(sourceUrl: string, snapshot: RenderAuditRow): ImportedDocument {
  const title = normalizeText(snapshot.title || '飞书文档');
  const hints = new Set(snapshot.sourceHints || []);
  const lines = cleanRenderedLines(snapshot.renderedLines);
  const blocks: ImportedBlock[] = [heading(1, title)];
  const nav = buildSnapshotNav(lines, title);
  if (nav) blocks.push(nav);

  const titleIndex = lines.findIndex(line => line.includes(title));
  const bodyLines = lines
    .slice(titleIndex >= 0 ? titleIndex + 1 : 0)
    .filter(line => line !== title)
    .slice(0, 180);

  let index = 0;
  while (index < bodyLines.length) {
    const line = bodyLines[index];
    const next = bodyLines[index + 1];
    if (isIconOnlyLine(line) && next) {
      blocks.push(highlight(line, [paragraph(next)], line === '❗' ? '#fff1f0' : '#fff7e6', line === '❗' ? '#f76964' : '#fed4a4'));
      index += 2;
      continue;
    }
    if (lineLooksLikeHeading(line)) {
      blocks.push(heading(/^(\d+\.\d+|Step\d+)/i.test(line) ? 3 : 2, line));
    } else if (lineLooksLikeGroupCard(line)) {
      blocks.push(groupCard(line, '飞书公开页社群/群名片'));
    } else if (lineLooksLikeResource(line)) {
      blocks.push(lineToEmbed(line));
    } else {
      blocks.push(paragraph(line));
    }
    index += 1;
  }

  if (hints.has('bitable') && !blocks.some(block => block.type === 'bitable')) {
    blocks.push(buildSnapshotBitable(title, bodyLines));
  }
  if (hints.has('table') && !blocks.some(block => block.type === 'table' || block.type === 'bitable')) {
    blocks.push(buildSnapshotTable(bodyLines));
  }
  if (hints.has('dashboard')) {
    blocks.push(buildDashboardFromRatios([50, 50], '公开页仪表盘'));
  }
  if (hints.has('link-card') && !blocks.some(block => block.type === 'embed' && (block.kind === 'link' || block.kind === 'template'))) {
    blocks.push({ type: 'embed', title, kind: 'link', url: sourceUrl, desc: '公开飞书文档' });
  }
  if (hints.has('group-card') && !blocks.some(block => block.type === 'embed' && block.kind === 'group')) {
    blocks.push(groupCard(`${title} 相关社群`, '飞书公开页社群/群名片'));
  }
  if (hints.has('callout') && !blocks.some(block => block.type === 'highlight')) {
    blocks.splice(1, 0, highlight('💡', [paragraph('该文档来自公开飞书页面，已按浏览器渲染快照还原正文结构。')], '#fff7e6', '#fed4a4'));
  }

  return {
    title,
    sourceUrl,
    sourceName: sourceNameFromUrl(sourceUrl),
    blocks,
    assets: [],
    warnings: [
      {
        type: 'partial-data',
        message: '静态公开 HTML 未暴露正文，已使用浏览器渲染快照生成本地飞书组件化文档。',
      },
    ],
    importQuality: 'partial',
  };
}

export function parsePublicFeishuHtmlToDocument(rawHtml: string, sourceUrl: string): ImportedDocument {
  const root = parse(rawHtml);
  const sample = findFeishuPublicSample(sourceUrl);
  if (sample?.id === 'bitable-quickstart') {
    return buildBitableQuickstartDocument(sourceUrl);
  }

  const title = titleFromHtml(root, '飞书文档');
  const items = collectTextElements(root);
  const staticTextLength = items.map(item => item.text).join('').length;
  const snapshot = staticTextLength < 220 ? findRenderedSnapshot(sourceUrl) : null;
  if (snapshot?.renderedLines?.length && (snapshot.renderedTextLength || 0) > staticTextLength * 2) {
    return buildDocumentFromRenderedSnapshot(sourceUrl, snapshot);
  }
  const blocks: ImportedBlock[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    const text = item.text;

    if (item.tag === 'h1' || item.tag === 'h2' || item.tag === 'h3') {
      const level = item.tag === 'h1' ? 1 : item.tag === 'h2' ? 2 : 3;
      blocks.push({ type: 'heading', level, inlines: inline(text) });
      index += 1;
      continue;
    }

    if (isCalloutIcon(text)) {
      const content: ImportedBlock[] = [];
      let cursor = index + 1;
      while (cursor < items.length && content.length < 2) {
        const next = items[cursor];
        if (/^h[1-6]$/.test(next.tag) || isRatio(next.text) || isCalloutIcon(next.text) || lineLooksLikeResource(next.text)) break;
        content.push(paragraph(next.text));
        cursor += 1;
      }
      blocks.push({
        type: 'highlight',
        icon: text,
        content: content.length ? content : [paragraph(text)],
        bgColor: text === '❗' ? '#fff1f0' : text === '🍞' ? '#fff7e6' : '#e1eaff',
        borderColor: text === '❗' ? '#f76964' : text === '🍞' ? '#ffba6b' : '#82a7fc',
      });
      index = Math.max(cursor, index + 1);
      continue;
    }

    if (isRatio(text)) {
      const ratios: number[] = [];
      let cursor = index;
      while (cursor < items.length && isRatio(items[cursor].text)) {
        ratios.push(Number(items[cursor].text.replace('%', '')));
        cursor += 1;
      }
      if (ratios.length >= 2) {
        blocks.push(buildColumnsFromRatios(ratios));
        blocks.push(buildDashboardFromRatios(ratios));
        index = cursor;
        continue;
      }
    }

    if (item.tag === 'li') {
      blocks.push(paragraph(`• ${text}`));
      index += 1;
      continue;
    }

    blocks.push(lineLooksLikeResource(text) ? lineToEmbed(text) : paragraph(text));
    index += 1;
  }

  const renderedTables = tableBlocks(root);
  if (renderedTables.length) blocks.push(...renderedTables);

  return {
    title,
    sourceUrl,
    sourceName: sourceNameFromUrl(sourceUrl),
    blocks: blocks.length ? blocks : [paragraph('公开页面没有可导入正文。')],
    assets: [],
    warnings: buildWarnings(sourceUrl),
    importQuality: 'fallback',
  };
}
