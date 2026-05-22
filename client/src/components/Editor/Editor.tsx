import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type Editor as TipTapEditor, type NodeViewProps } from '@tiptap/react';
import { Extension, Node as TiptapNode } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { TextSelection } from '@tiptap/pm/state';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ContextMenu from './ContextMenu';
import TableContextMenu from './TableContextMenu';
import { computeBlockPanelPosition } from './floatingPanel';
import { computeTableBlockMenuPosition } from './tableMenu';
import SlashMenu from './SlashMenu';
import { SLASH_MENU_MAX_HEIGHT, SLASH_MENU_WIDTH } from './slashMenuConfig';
import SelectionBubble from './SelectionBubble';
import { DOC_TITLE_CATALOGUE_ID, type HeadingItem } from '../../types';
import { HelpCircleIcon, BookOpenIcon } from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import { IconAddOutlined, IconDragOutlined } from '../../icons/feishuDoc';
import BlockGutterGlyph from './BlockGutterGlyph';
import EmojiPicker from './EmojiPicker';
import { HighlightBlock } from './HighlightBlock';
import { BlockIndent } from './blockIndent';
import { scrollToBlockFromHash } from './blockLink';
import { syncEditorSelectionToAnchoredBlock } from './blockAnchorSelection';
import { FeishuBlockBackspace } from './feishuBlockBackspace';
import { FeishuBoxSelectionKeyboard } from './feishuBoxSelectionKeyboard';
import BoxBlockSelectionLayer from './FeishuBoxBlockSelection';
import { FeishuHeading, readHeadingId } from './feishuHeading';
import { feishuTableExtensions } from './feishuTable';
import { localColumnsExtensions } from './columnsExtensions';
import FeishuTableOverlay from './FeishuTableOverlay';
import { CellSelection } from '@tiptap/pm/tables';
import {
  isCellSelectionInTableHost,
  resolveTableHostFromEditor,
  resolveTableHostFromElement,
} from './tableDom';
import { selectTableNodeFromHost } from './tableInsert';
import {
  getHeadingIdFromBlockEl,
  headingBlockHasChildren,
  syncAllHeadingCollapseStates,
} from './headingCollapse';
import { insertTableFromClipboardData } from './tableInsert';
import './Editor.less';

const Notebook = wrapIcon(BookOpenIcon);
const Help = wrapIcon(HelpCircleIcon);

const lowlight = createLowlight(common);

/** 为段落/标题等块挂稳定 id，便于评论锚点写入 HTML 并可滚动定位。 */
const CommentAnchorAttributes = Extension.create({
  name: 'commentAnchorAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          blockId: {
            default: null,
            parseHTML: element =>
              element.getAttribute('data-block-id') || element.getAttribute('id'),
            renderHTML: (attributes: { blockId?: string | null }) =>
              attributes.blockId
                ? { id: attributes.blockId, 'data-block-id': attributes.blockId }
                : {},
          },
        },
      },
    ];
  },
});

const normalizeTitle = (value: string) => value === '未命名文档' ? '' : value;

function getRelatedNode(target: EventTarget | null): Node | null {
  return target instanceof Node ? target : null;
}

const BLOCK_TOOLS_OVERLAY_SELECTOR =
  '.block-inline-tools, .selection-bubble, .slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .slash-columns-count-flyout, .feishu-table-chrome, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .feishu-columns-block__col-wrap, .feishu-columns-block__add-hover-wrap, .feishu-columns-block__add-btn';

function isBlockToolsOverlayElement(element: Element | null): boolean {
  return Boolean(element?.closest(BLOCK_TOOLS_OVERLAY_SELECTOR));
}

function isPointerInBlockToolsBridge(
  clientX: number,
  clientY: number,
  activeBlock: HTMLElement | null,
  areaEl: HTMLElement | null,
): boolean {
  if (!activeBlock?.isConnected || !areaEl) return false;
  const toolsEl = areaEl.querySelector('.block-inline-tools');
  if (!(toolsEl instanceof HTMLElement)) return false;
  const toolsRect = toolsEl.getBoundingClientRect();
  const blockRect = activeBlock.getBoundingClientRect();
  const bridgeLeft = Math.min(toolsRect.left, blockRect.left) - 6;
  const bridgeRight = blockRect.left + 14;
  const bridgeTop = Math.min(toolsRect.top, blockRect.top) - 8;
  const bridgeBottom = Math.max(toolsRect.bottom, blockRect.bottom) + 8;
  return (
    clientX >= bridgeLeft &&
    clientX <= bridgeRight &&
    clientY >= bridgeTop &&
    clientY <= bridgeBottom
  );
}

const BLOCK_CONTENT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre';

function findBlockContentInColumn(columnEl: Element): HTMLElement | null {
  const inner = columnEl.querySelector(BLOCK_CONTENT_SELECTOR);
  return inner instanceof HTMLElement ? inner : null;
}

function normalizeLinkHref(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/') || t.startsWith('#')) return t;
  return `https://${t}`;
}

function computePageLinkPopPosition(editor: TipTapEditor): { top: number; left: number } {
  const gap = 8;
  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const approxPopW = Math.min(452, vw - 24);
  const approxPopH = 200;

  let coords: { top: number; bottom: number; left: number };
  try {
    coords = editor.view.coordsAtPos(editor.state.selection.head);
  } catch {
    return { top: pad, left: pad };
  }

  let top = coords.bottom + gap;
  if (top + approxPopH > vh - pad) {
    top = coords.top - approxPopH - gap;
  }
  if (top < pad) top = pad;

  let left = coords.left;
  left = Math.max(pad, Math.min(left, vw - pad - approxPopW));
  return { top, left };
}

const FeishuLink = Link.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        if (!this.editor.isEditable) return false;
        window.dispatchEvent(new CustomEvent('feishu-open-page-link-dialog'));
        return true;
      },
    };
  },
});

const CODE_BLOCK_LANGUAGES = [
  { label: 'Plain Text', value: 'plaintext' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Python', value: 'python' },
  { label: 'Java', value: 'java' },
  { label: 'Go', value: 'go' },
  { label: 'SQL', value: 'sql' },
];

// ── Divider NodeView ──────────────────────────────────────────────────────────
function FeishuDividerView({ selected, getPos, editor }: NodeViewProps) {
  const handleClick = () => {
    if (typeof getPos === 'function') {
      const pos = getPos();
      (editor as any).commands.setNodeSelection(pos);
    }
  };
  return (
    <NodeViewWrapper
      as="div"
      className={`feishu-divider${selected ? ' feishu-divider--selected' : ''}`}
      contentEditable={false}
      onClick={handleClick}
    >
      <div className="feishu-divider__line" />
    </NodeViewWrapper>
  );
}

/** 使用官方 HorizontalRule（含 Markdown `---`/输入规则、`canInsertNode` 与安全插入光标逻辑），编辑器内用 NodeView 飞书样式替换 `<hr>` 展示 */
const FeishuHorizontalRule = HorizontalRule.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FeishuDividerView);
  },
});

const LocalFileBlock = TiptapNode.create({
  name: 'localFileBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { name: { default: '视频或文件' }, url: { default: '' }, size: { default: 0 }, mime: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="file"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const size = Number(HTMLAttributes.size || 0);
    const sizeText = size > 0 ? `${(size / 1024 / 1024).toFixed(2)} MB` : '文件';
    const mime = String(HTMLAttributes.mime || '');
    const isVideo = mime.startsWith('video/');
    const isAudio = mime.startsWith('audio/');
    const preview = HTMLAttributes.url && isVideo
      ? ['video', { class: 'feishu-file-preview', src: HTMLAttributes.url, controls: 'true', preload: 'metadata' }]
      : HTMLAttributes.url && isAudio
        ? ['audio', { class: 'feishu-file-preview feishu-file-preview--audio', src: HTMLAttributes.url, controls: 'true', preload: 'metadata' }]
        : null;
    const card = ['div', { class: `feishu-local-card feishu-local-card--file${preview ? ' feishu-local-card--media' : ''}` }, ['div', { class: 'feishu-local-card__icon' }, isVideo ? '▶' : isAudio ? '♪' : '🔗'], ['div', { class: 'feishu-local-card__body' }, ['div', { class: 'feishu-local-card__title' }, HTMLAttributes.name || '视频或文件'], ['div', { class: 'feishu-local-card__desc' }, sizeText]], HTMLAttributes.url ? ['a', { class: 'feishu-local-card__action', href: HTMLAttributes.url, download: HTMLAttributes.name || 'file' }, '下载'] : ['span', { class: 'feishu-local-card__action' }, '文件']];
    return ['div', { ...HTMLAttributes, 'data-local-block': 'file', class: 'feishu-file-block' }, ...(preview ? [preview] : []), card];
  },
});

const LocalDivTableBlock = TiptapNode.create({
  name: 'localDivTableBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { rows: { default: 3 }, cols: { default: 3 }, header: { default: false } };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="div-table"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const rows = Math.max(1, Number(HTMLAttributes.rows || 3));
    const cols = Math.max(1, Number(HTMLAttributes.cols || 3));
    const hasHeader = HTMLAttributes.header === true || HTMLAttributes.header === 'true';
    const tableRows = Array.from({ length: rows }, (_, rowIndex) => [
      'div',
      { class: 'feishu-div-table__row' },
      ...Array.from({ length: cols }, (_, colIndex) => [
        'div',
        { class: `feishu-div-table__cell${hasHeader && rowIndex === 0 ? ' feishu-div-table__cell--header' : ''}${colIndex === cols - 1 ? ' feishu-div-table__cell--last-col' : ''}${rowIndex === rows - 1 ? ' feishu-div-table__cell--last-row' : ''}` },
        ['span', { class: 'feishu-div-table__placeholder' }, ''],
      ]),
    ]);
    return ['div', { ...HTMLAttributes, 'data-local-block': 'div-table', class: 'feishu-div-table', style: `--feishu-table-cols:${cols}` }, ...tableRows];
  },
});

const LocalSyncBlock = TiptapNode.create({
  name: 'localSyncBlock',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-local-block="sync"]' }];
  },
  renderHTML() {
    return ['div', { 'data-local-block': 'sync', class: 'feishu-sync-block' }, ['div', { class: 'feishu-sync-block__label' }, '同步块'], ['div', { class: 'feishu-sync-block__content' }, 0]];
  },
});

function normalizeBlockUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/') || t.startsWith('#')) return t;
  return `https://${t}`;
}

function LocalButtonBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const text = node.attrs.text || '按钮';
  const url = node.attrs.url || '';

  const openButtonLink = () => {
    const href = normalizeBlockUrl(url);
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <NodeViewWrapper className={`feishu-button-block${selected ? ' is-selected' : ''}`} contentEditable={false}>
      <div className="feishu-button-block__preview">
        <button type="button" className="feishu-action-button" onClick={openButtonLink}>
          {text}
        </button>
      </div>
      <div className="feishu-button-block__form">
        <input
          className="feishu-block-field"
          value={text}
          placeholder="按钮文字"
          onChange={e => updateAttributes({ text: e.target.value })}
        />
        <input
          className="feishu-block-field"
          value={url}
          placeholder="链接或页面地址"
          onChange={e => updateAttributes({ url: e.target.value })}
        />
      </div>
    </NodeViewWrapper>
  );
}

const LocalButtonBlock = TiptapNode.create({
  name: 'localButtonBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      text: {
        default: '按钮',
        parseHTML: element => element.getAttribute('data-text') || element.textContent || '按钮',
        renderHTML: attributes => ({ 'data-text': attributes.text }),
      },
      url: {
        default: '',
        parseHTML: element => element.getAttribute('data-url') || '',
        renderHTML: attributes => ({ 'data-url': attributes.url }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="button"]' }, { tag: 'button[data-local-block="button"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const href = normalizeBlockUrl(String(HTMLAttributes.url || ''));
    const button = ['span', { class: 'feishu-action-button' }, HTMLAttributes.text || '按钮'];
    return ['div', { ...HTMLAttributes, 'data-local-block': 'button', class: 'feishu-button-block' },
      href ? ['a', { href, class: 'feishu-button-block__link' }, button] : button,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalButtonBlockView);
  },
});

function LocalFormulaBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const formula = node.attrs.formula || '';

  return (
    <NodeViewWrapper className={`feishu-formula-editor${selected ? ' is-selected' : ''}`} contentEditable={false}>
      <div className="feishu-formula-block">{formula || 'E = mc²'}</div>
      <textarea
        className="feishu-formula-editor__input"
        value={formula}
        placeholder="输入公式，例如 E = mc²"
        rows={2}
        onChange={e => updateAttributes({ formula: e.target.value })}
      />
    </NodeViewWrapper>
  );
}

const LocalFormulaBlock = TiptapNode.create({
  name: 'localFormulaBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      formula: {
        default: 'E = mc²',
        parseHTML: element => element.getAttribute('data-formula') || element.textContent || 'E = mc²',
        renderHTML: attributes => ({ 'data-formula': attributes.formula }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="formula"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-local-block': 'formula', class: 'feishu-formula-block' }, HTMLAttributes.formula || 'E = mc²'];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalFormulaBlockView);
  },
});

type BitableRows = string[][];

function parseJsonArray<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_BITABLE_COLUMNS = ['字段 1', '字段 2', '字段 3'];
const DEFAULT_BITABLE_ROWS: BitableRows = [
  ['', '', ''],
  ['', '', ''],
  ['', '', ''],
];

function normalizeBitableRows(rows: BitableRows, columnCount: number): BitableRows {
  return rows.map(row => Array.from({ length: columnCount }, (_, index) => row[index] ?? ''));
}

function LocalBitableBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const title = node.attrs.title || '多维表格';
  const columns = parseJsonArray<string[]>(node.attrs.columns, DEFAULT_BITABLE_COLUMNS);
  const rows = normalizeBitableRows(parseJsonArray<BitableRows>(node.attrs.rows, DEFAULT_BITABLE_ROWS), columns.length);

  const commit = (nextColumns: string[], nextRows: BitableRows, nextTitle = title) => {
    updateAttributes({
      title: nextTitle,
      columns: JSON.stringify(nextColumns),
      rows: JSON.stringify(normalizeBitableRows(nextRows, nextColumns.length)),
    });
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = rows.map(row => [...row]);
    nextRows[rowIndex][colIndex] = value;
    commit(columns, nextRows);
  };

  const updateColumn = (colIndex: number, value: string) => {
    const nextColumns = [...columns];
    nextColumns[colIndex] = value;
    commit(nextColumns, rows);
  };

  const addRow = () => {
    commit(columns, [...rows, Array.from({ length: columns.length }, () => '')]);
  };

  const addColumn = () => {
    if (columns.length >= 8) return;
    commit([...columns, `字段 ${columns.length + 1}`], rows.map(row => [...row, '']));
  };

  const removeRow = (rowIndex: number) => {
    const nextRows = rows.filter((_, index) => index !== rowIndex);
    commit(columns, nextRows.length > 0 ? nextRows : [Array.from({ length: columns.length }, () => '')]);
  };

  const removeColumn = (colIndex: number) => {
    if (columns.length <= 1) return;
    commit(
      columns.filter((_, index) => index !== colIndex),
      rows.map(row => row.filter((_, index) => index !== colIndex)),
    );
  };

  return (
    <NodeViewWrapper className={`feishu-bitable-block${selected ? ' is-selected' : ''}`} contentEditable={false}>
      <div className="feishu-bitable-block__header">
        <input
          className="feishu-bitable-block__title"
          value={title}
          onChange={event => commit(columns, rows, event.target.value)}
        />
        <div className="feishu-bitable-block__actions">
          <button type="button" onClick={addRow}>新增记录</button>
          <button type="button" onClick={addColumn} disabled={columns.length >= 8}>新增字段</button>
        </div>
      </div>
      <div className="feishu-bitable-block__scroll">
        <table className="feishu-bitable-block__table">
          <thead>
            <tr>
              <th className="feishu-bitable-block__index">#</th>
              {columns.map((column, colIndex) => (
                <th key={`bitable-col-${colIndex}`}>
                  <div className="feishu-bitable-block__field">
                    <input value={column} onChange={event => updateColumn(colIndex, event.target.value)} />
                    {columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(colIndex)} aria-label="删除字段">×</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="feishu-bitable-block__tail" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`bitable-row-${rowIndex}`}>
                <td className="feishu-bitable-block__index">
                  <button type="button" onClick={() => removeRow(rowIndex)} title="删除记录">
                    {rowIndex + 1}
                  </button>
                </td>
                {columns.map((_, colIndex) => (
                  <td key={`bitable-cell-${rowIndex}-${colIndex}`}>
                    <input value={row[colIndex] ?? ''} onChange={event => updateCell(rowIndex, colIndex, event.target.value)} />
                  </td>
                ))}
                <td className="feishu-bitable-block__tail" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NodeViewWrapper>
  );
}

const LocalBitableBlock = TiptapNode.create({
  name: 'localBitableBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      title: {
        default: '多维表格',
        parseHTML: element => element.getAttribute('data-title') || '多维表格',
        renderHTML: attributes => ({ 'data-title': attributes.title }),
      },
      columns: {
        default: JSON.stringify(DEFAULT_BITABLE_COLUMNS),
        parseHTML: element => element.getAttribute('data-columns') || JSON.stringify(DEFAULT_BITABLE_COLUMNS),
        renderHTML: attributes => ({ 'data-columns': attributes.columns }),
      },
      rows: {
        default: JSON.stringify(DEFAULT_BITABLE_ROWS),
        parseHTML: element => element.getAttribute('data-rows') || JSON.stringify(DEFAULT_BITABLE_ROWS),
        renderHTML: attributes => ({ 'data-rows': attributes.rows }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="bitable"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const columns = parseJsonArray<string[]>(HTMLAttributes.columns, DEFAULT_BITABLE_COLUMNS);
    const rows = normalizeBitableRows(parseJsonArray<BitableRows>(HTMLAttributes.rows, DEFAULT_BITABLE_ROWS), columns.length);
    return ['div', { ...HTMLAttributes, 'data-local-block': 'bitable', class: 'feishu-bitable-block' },
      ['div', { class: 'feishu-bitable-block__static-title' }, HTMLAttributes.title || '多维表格'],
      ['table', { class: 'feishu-bitable-block__table' },
        ['thead', {}, ['tr', {}, ...columns.map(column => ['th', {}, column || '字段'])]],
        ['tbody', {}, ...rows.map(row => ['tr', {}, ...row.map(cell => ['td', {}, cell || ''])])],
      ],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalBitableBlockView);
  },
});

const EMBED_KIND_META: Record<string, { icon: string; title: string; desc: string }> = {
  bitable: { icon: '▦', title: '多维表格', desc: '表格视图' },
  kanban: { icon: '▤', title: '看板', desc: '多维表格看板视图' },
  gantt: { icon: '↔', title: '甘特图', desc: '多维表格甘特视图' },
  gallery: { icon: '▧', title: '画册', desc: '多维表格画册视图' },
  board: { icon: '✎', title: '画板', desc: '白板内容' },
  mindmap: { icon: '◎', title: '思维导图', desc: '脑图内容' },
  flowchart: { icon: '◇', title: '流程图', desc: '流程图内容' },
  uml: { icon: 'U', title: 'UML 图', desc: 'UML 图内容' },
  mention: { icon: '@', title: '人员', desc: '@成员' },
  template: { icon: '▣', title: '模板', desc: '模板内容' },
  subdoc: { icon: '↗', title: '子文档', desc: '页面链接' },
  image: { icon: '□', title: '图片', desc: '图片上传状态' },
  file: { icon: '⇩', title: '文件', desc: '文件上传状态' },
  embed: { icon: '+', title: '内容块', desc: '' },
};

function LocalEmbedBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const kind = String(node.attrs.kind || 'embed');
  const meta = EMBED_KIND_META[kind] || EMBED_KIND_META.embed;
  const title = node.attrs.title || meta.title;
  const desc = node.attrs.desc || meta.desc;
  const href = node.attrs.href || '';
  const normalizedHref = normalizeBlockUrl(href);

  return (
    <NodeViewWrapper
      className={`feishu-local-card feishu-local-card--${kind}${selected ? ' is-selected' : ''}`}
      data-local-block="embed"
      contentEditable={false}
    >
      <div className="feishu-local-card__icon">{meta.icon}</div>
      <div className="feishu-local-card__body">
        <input
          className="feishu-local-card__title-input"
          value={title}
          placeholder={meta.title}
          onChange={e => updateAttributes({ title: e.target.value })}
        />
        <input
          className="feishu-local-card__desc-input"
          value={desc}
          placeholder={meta.desc}
          onChange={e => updateAttributes({ desc: e.target.value })}
        />
      </div>
      {(kind === 'subdoc' || href) && (
        <input
          className="feishu-local-card__href-input"
          value={href}
          placeholder="/doc/..."
          onChange={e => updateAttributes({ href: e.target.value })}
        />
      )}
      {normalizedHref && (
        <a className="feishu-local-card__action" href={normalizedHref} target="_blank" rel="noreferrer">
          打开
        </a>
      )}
    </NodeViewWrapper>
  );
}

const LocalEmbedBlock = TiptapNode.create({
  name: 'localEmbedBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      title: {
        default: '内容块',
        parseHTML: element => element.getAttribute('data-title') || element.querySelector('.feishu-local-card__title')?.textContent || '内容块',
        renderHTML: attributes => ({ 'data-title': attributes.title }),
      },
      desc: {
        default: '',
        parseHTML: element => element.getAttribute('data-desc') || element.querySelector('.feishu-local-card__desc')?.textContent || '',
        renderHTML: attributes => ({ 'data-desc': attributes.desc }),
      },
      kind: {
        default: 'embed',
        parseHTML: element => element.getAttribute('data-kind') || 'embed',
        renderHTML: attributes => ({ 'data-kind': attributes.kind }),
      },
      href: {
        default: '',
        parseHTML: element => element.getAttribute('href') || element.getAttribute('data-href') || '',
        renderHTML: attributes => ({ 'data-href': attributes.href }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="embed"]' }, { tag: 'a[data-local-block="embed"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const content = [['div', { class: 'feishu-local-card__icon' }, '＋'], ['div', { class: 'feishu-local-card__body' }, ['div', { class: 'feishu-local-card__title' }, HTMLAttributes.title || '内容块'], ['div', { class: 'feishu-local-card__desc' }, HTMLAttributes.desc || '']]];
    if (HTMLAttributes.href) {
      return ['a', { ...HTMLAttributes, href: HTMLAttributes.href, 'data-local-block': 'embed', class: `feishu-local-card feishu-local-card--link feishu-local-card--${HTMLAttributes.kind || 'embed'}` }, ...content];
    }
    return ['div', { ...HTMLAttributes, 'data-local-block': 'embed', class: `feishu-local-card feishu-local-card--${HTMLAttributes.kind || 'embed'}` }, ...content];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LocalEmbedBlockView);
  },
});

// ── Code Block NodeView ───────────────────────────────────────────────────────
function FeishuCodeBlockView({ node, updateAttributes }: any) {
  const [wrap, setWrap] = useState(false);
  const language = node.attrs.language || 'plaintext';
  const copyCode = () => {
    void navigator.clipboard?.writeText(node.textContent || '');
  };

  return (
    <NodeViewWrapper className={`feishu-code-block${wrap ? ' feishu-code-block--wrap' : ''}`}>
      <div className="feishu-code-block__toolbar" contentEditable={false}>
        <span className="feishu-code-block__title">代码块</span>
        <div className="feishu-code-block__actions">
          <select
            className="feishu-code-block__language"
            value={language}
            onChange={e => updateAttributes({ language: e.target.value })}
          >
            {CODE_BLOCK_LANGUAGES.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <button type="button" className="feishu-code-block__action" onClick={() => setWrap(v => !v)}>
            自动换行
          </button>
          <button type="button" className="feishu-code-block__action" onClick={copyCode}>
            复制
          </button>
        </div>
      </div>
      <pre className="feishu-code-block__pre">
        <NodeViewContent as="code" className="feishu-code-block__content" />
      </pre>
    </NodeViewWrapper>
  );
}

const FeishuCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FeishuCodeBlockView);
  },
});

const editorExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  FeishuHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  CommentAnchorAttributes,
  FeishuHorizontalRule,
  FeishuCodeBlock.configure({ lowlight }),
  Underline,
  FeishuLink.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'editor-link' },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Image.configure({
    inline: false,
    allowBase64: true,
    HTMLAttributes: { class: 'feishu-image' },
  }),
  LocalFileBlock,
  ...localColumnsExtensions,
  LocalDivTableBlock,
  ...feishuTableExtensions,
  LocalSyncBlock,
  LocalButtonBlock,
  LocalFormulaBlock,
  LocalBitableBlock,
  LocalEmbedBlock,
  Placeholder.configure({
    includeChildren: false,
    showOnlyCurrent: false,
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') {
        const level = typeof node.attrs.level === 'number' ? node.attrs.level : 2;
        return `H${level}`;
      }
      return '';
    },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  BlockIndent,
  TextStyle,
  Color,
  Highlight.configure({
    multicolor: true,
  }),
  HighlightBlock,
  FeishuBlockBackspace,
  FeishuBoxSelectionKeyboard,
];

/** 从当前选区解析光标所在的块级 DOM（仅悬停「+」时用于行背景） */
function getBlockDomFromEditor(editorInstance: {
  view: { dom: HTMLElement; domAtPos: (pos: number) => { node: Node; offset: number }; nodeDOM?: (pos: number) => Node | null | undefined };
  state: { selection: { from: number } };
}): HTMLElement | null {
  const root = editorInstance.view.dom as HTMLElement;
  const from = editorInstance.state.selection.from;

  // For NodeSelection (atom nodes like divider), domAtPos may point to the root.
  // Use nodeDOM to directly get the NodeView DOM element.
  try {
    const nodeEl = editorInstance.view.nodeDOM?.(from);
    if (nodeEl instanceof Element && root.contains(nodeEl)) {
      const divider = (nodeEl as HTMLElement).classList?.contains('feishu-divider')
        ? (nodeEl as HTMLElement)
        : (nodeEl.querySelector?.('.feishu-divider') as HTMLElement | null);
      if (divider) return divider;
    }
  } catch { /* ignore */ }

  const domAt = editorInstance.view.domAtPos(from);
  let n: Node | null = domAt.node;
  if (n.nodeType === Node.TEXT_NODE) n = (n as Text).parentElement;
  let el = n as HTMLElement | null;
  while (el && el !== root) {
    const feishuCodeBlock = el.closest?.('.feishu-code-block') as HTMLElement | null;
    if (feishuCodeBlock && root.contains(feishuCodeBlock)) return feishuCodeBlock;
    const highlightBlock = el.closest?.('.feishu-highlight-block') as HTMLElement | null;
    if (highlightBlock && root.contains(highlightBlock)) return highlightBlock;
    const dividerWrapper = el.closest?.('.feishu-divider') as HTMLElement | null;
    if (dividerWrapper && root.contains(dividerWrapper)) return dividerWrapper;
    const tableHost = resolveTableHostFromElement(el);
    if (tableHost && root.contains(tableHost)) return tableHost;
    const tag = el.tagName?.toLowerCase() ?? '';
    if (/^(p|h[1-6]|blockquote|pre|hr)$/.test(tag)) return el;
    if (tag === 'li') return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * ProseMirror `view.hasFocus()` 仅当 document.activeElement === 编辑器根节点时为 true。
 * 个别浏览器/场景下焦点落在 contenteditable 内部节点，导致块柄被误判隐藏。
 * TipTap 的 isFocused 及对 activeElement 的 contains 检测作为补充。
 */
function isEditorTypingFocused(editorInstance: {
  isFocused?: boolean;
  view?: { dom: HTMLElement; hasFocus: () => boolean };
}): boolean {
  if (editorInstance.isFocused) return true;
  const view = editorInstance.view;
  if (!view) return false;
  if (view.hasFocus()) return true;
  if (typeof document === 'undefined') return false;
  const ae = document.activeElement;
  return Boolean(ae && view.dom.contains(ae));
}

/** 侧栏块柄纵轴：标题与首行文字中线对齐，其它块用块级盒子垂直中心 */
/** 与 extractHeadings 一致：仅非空标题进目录；光标在标题内或所属正文上方最近一节 */
function resolveCatalogueActiveId(editorInstance: any): string | null {
  if (!editorInstance?.state) return null;
  const { state } = editorInstance;
  const from = state.selection.from;
  const $from = state.selection.$from;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name !== 'heading') continue;
    const text = String(node.textContent ?? '').trim();
    if (!text) continue;
    return readHeadingId(node.attrs) ?? null;
  }

  let lastId: string | null = null;
  state.doc.descendants((node: any, pos: number) => {
    if (pos >= from) return false;
    if (node.type.name !== 'heading') return;
    const text = String(node.textContent ?? '').trim();
    if (!text) return;
    lastId = readHeadingId(node.attrs);
  });
  return lastId;
}

function getBlockToolsAnchorTop(
  editorInstance: {
    view: {
      posAtDOM: (node: Node, offset: number) => number;
      coordsAtPos: (pos: number) => { top: number; bottom: number };
    };
  },
  blockEl: HTMLElement,
  areaRectTop: number,
): number {
  const tag = blockEl.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) {
    try {
      const pos = editorInstance.view.posAtDOM(blockEl, 0);
      const c = editorInstance.view.coordsAtPos(pos);
      return (c.top + c.bottom) / 2 - areaRectTop;
    } catch {
      /* 降级为块中心 */
    }
  }
  const rr = blockEl.getBoundingClientRect();
  if (blockEl.classList.contains('feishu-code-block')) {
    const toolbar = blockEl.querySelector('.feishu-code-block__toolbar') as HTMLElement | null;
    const tr = toolbar?.getBoundingClientRect();
    if (tr) return tr.top + tr.height / 2 - areaRectTop;
  }
  if (blockEl.classList.contains('tableWrapper') || blockEl.classList.contains('feishu-table-host')) {
    return rr.top + 20 - areaRectTop;
  }
  return rr.top + rr.height / 2 - areaRectTop;
}

function computePlusMenuPosition(
  anchor: DOMRect,
  _menuW = SLASH_MENU_WIDTH,
  menuH = SLASH_MENU_MAX_HEIGHT,
  pad = 8,
  gap = 0,
): { top: number; left: number } {
  const vh = window.innerHeight;
  const left = anchor.left + gap;
  const visibleMenuH = Math.min(menuH, vh - pad * 2);
  const top = Math.max(
    pad,
    Math.min(anchor.top + anchor.height / 2 - visibleMenuH / 2, vh - pad - visibleMenuH),
  );
  return { top, left };
}

/** 默认封面图 URL（占位） */
const DEFAULT_COVER_URL = '/static/01.gif';

interface EditorProps {
  documentId: string;
  content: string;
  title: string;
  author: string;
  /** ISO 时间，用于展示「今天修改」等 */
  updatedAt?: string;
  /** 文档图标 emoji */
  icon?: string;
  /** 文档封面 URL */
  coverUrl?: string;
  /** 标题输入框展示用快照（可选，供父级等使用） */
  onTitleInputChange?: (displayTitle: string) => void;
  onSave: (data: { title?: string; content?: string; icon?: string; cover_url?: string }) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  /** 侧栏目录高亮：文档标题焦点、正文光标所在章节 */
  onCatalogueActiveIdChange?: (id: string | null) => void;
  readOnly?: boolean;
  /** 当前折叠的标题 id 集合 */
  collapsedHeadingIds?: Set<string>;
  /** 切换标题折叠 */
  onToggleHeadingCollapse?: (headingId: string) => void;
}

function formatModifiedTime(iso?: string): string {
  if (!iso) return '今天修改';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '今天修改';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayStr = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  if (dayStr(d) === dayStr(now)) return '今天修改';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStr(d) === dayStr(yesterday)) return '昨天修改';
  return `${d.getMonth() + 1}月${d.getDate()}日修改`;
}

export default function Editor({
  documentId,
  content,
  title,
  author,
  updatedAt,
  icon,
  coverUrl,
  onTitleInputChange,
  onSave,
  onHeadingsChange,
  onCatalogueActiveIdChange,
  readOnly = false,
  collapsedHeadingIds,
  onToggleHeadingCollapse,
}: EditorProps) {
  const [docTitle, setDocTitle] = useState(normalizeTitle(title));
  const [docIcon, setDocIcon] = useState(icon || '');
  const [docCover, setDocCover] = useState(coverUrl || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [titleHovered, setTitleHovered] = useState(false);
  const emojiPickerAnchorRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    variant: 'block' | 'table';
  } | null>(null);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuFromPlus, setSlashMenuFromPlus] = useState(false);
  const [pageLinkDialogVisible, setPageLinkDialogVisible] = useState(false);
  const [pageLinkPopPos, setPageLinkPopPos] = useState({ top: 0, left: 0 });
  const [pageLinkText, setPageLinkText] = useState('');
  const [pageLinkUrl, setPageLinkUrl] = useState('');
  const [blockTools, setBlockTools] = useState({
    visible: false,
    top: 0,
    left: 0,
    type: 'paragraph',
    isEmpty: true,
    isInColumns: false,
  });
  const [activeTableHost, setActiveTableHost] = useState<HTMLElement | null>(null);
  const [tableHandleHovered, setTableHandleHovered] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const blockAddButtonRef = useRef<HTMLButtonElement>(null);
  const blockDragRowRef = useRef<HTMLButtonElement>(null);
  const tableHandleRef = useRef<HTMLButtonElement>(null);
  /** 「在下方添加」打开链接弹窗时在 confirm 用 insertContentAt */
  const pageLinkInsertPosRef = useRef<number | null>(null);
  const menuClosedAtRef = useRef<number>(0);
  /** 当前块工具对应的块 DOM */
  const activeBlockElRef = useRef<HTMLElement | null>(null);
  const [plusHovered, setPlusHovered] = useState(false);
  const [blockGutterHovered, setBlockGutterHovered] = useState(false);
  const [rowHighlightBand, setRowHighlightBand] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const setBlockGutterHoveredState = useCallback((value: boolean) => {
    setBlockGutterHovered(value);
  }, []);

  const setPlusHoveredState = useCallback((value: boolean) => {
    setPlusHovered(value);
  }, []);
  const catalogueActiveCbRef = useRef<EditorProps['onCatalogueActiveIdChange']>(undefined);
  const editorRefForCatalogue = useRef<any>(null);
  catalogueActiveCbRef.current = onCatalogueActiveIdChange;

  /** 切换标题折叠状态 */
  const toggleHeadingCollapse = useCallback(() => {
    const blockEl = activeBlockElRef.current;
    const ed = editorRefForCatalogue.current;
    if (!blockEl || !onToggleHeadingCollapse || !ed) return;
    const headingId = getHeadingIdFromBlockEl(ed, blockEl);
    if (!headingId) return;
    onToggleHeadingCollapse(headingId);
  }, [onToggleHeadingCollapse]);

  const closeSlashMenu = useCallback(() => {
    setSlashMenuVisible(false);
    setSlashMenuFromPlus(false);
  }, []);

  const openPlusMenu = useCallback(() => {
    if (readOnly) return;
    const btn = blockAddButtonRef.current;
    if (btn?.isConnected) {
      setSlashMenuPos(computePlusMenuPosition(btn.getBoundingClientRect()));
    }
    if (slashMenuVisible && slashMenuFromPlus) return;
    setContextMenu(null);
    setPlusHoveredState(true);
    setSlashMenuFromPlus(true);
    setSlashQuery('');
    setSlashMenuVisible(true);
  }, [readOnly, setPlusHoveredState, slashMenuFromPlus, slashMenuVisible]);

  const cancelContextMenuClose = useCallback(() => {
    if (contextMenuCloseTimerRef.current) {
      clearTimeout(contextMenuCloseTimerRef.current);
      contextMenuCloseTimerRef.current = null;
    }
  }, []);

  const handleCatalogueTitleFocus = useCallback(() => {
    const cb = catalogueActiveCbRef.current;
    if (!cb) return;
    cb(docTitle.trim().length ? DOC_TITLE_CATALOGUE_ID : null);
  }, [docTitle]);

  const handleCatalogueTitleBlur = useCallback(() => {
    window.setTimeout(() => {
      const cb = catalogueActiveCbRef.current;
      if (!cb) return;
      const ae = document.activeElement;
      if (ae instanceof Element && ae.matches('.editor-title-input')) return;
      if (ae instanceof Element && ae.closest('.catalogue-aside')) return;
      const ed = editorRefForCatalogue.current;
      if (ed && isEditorTypingFocused(ed)) {
        cb(resolveCatalogueActiveId(ed));
      } else {
        cb(null);
      }
    }, 0);
  }, []);

  const getElementBlockInfo = useCallback((target: EventTarget | null) => {
    if (!editorAreaRef.current || !(target instanceof Element)) return null;
    const codeBlockWrapper = target.closest('.feishu-code-block') as HTMLElement | null;
    if (codeBlockWrapper && editorAreaRef.current.contains(codeBlockWrapper)) {
      return { element: codeBlockWrapper, type: 'codeBlock', isEmpty: false };
    }
    const highlightBlockWrapper = target.closest('.feishu-highlight-block') as HTMLElement | null;
    if (highlightBlockWrapper && editorAreaRef.current.contains(highlightBlockWrapper)) {
      return { element: highlightBlockWrapper, type: 'highlightBlock', isEmpty: false };
    }
    const dividerWrapper = target.closest('.feishu-divider') as HTMLElement | null;
    if (dividerWrapper && editorAreaRef.current.contains(dividerWrapper)) {
      return { element: dividerWrapper, type: 'hr', isEmpty: false };
    }
    const tableHost = resolveTableHostFromElement(target);
    if (tableHost && editorAreaRef.current.contains(tableHost)) {
      const cell = target instanceof Element ? target.closest('td, th') : null;
      const isEmpty = !cell?.textContent?.trim();
      return { element: tableHost, type: 'table', isEmpty };
    }
    const block = target.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre') as HTMLElement | null;
    if (!block || !editorAreaRef.current.contains(block)) return null;

    let type = 'paragraph';
    const tag = block.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) type = tag;
    else if (tag === 'li') {
      if (block.closest('ul[data-type="taskList"]')) type = 'task';
      else if (block.closest('ol')) type = 'orderedList';
      else type = 'bulletList';
    } else if (tag === 'blockquote') type = 'blockquote';
    else if (tag === 'pre') type = 'codeBlock';

    const isEmpty = block.textContent?.trim() === '' && tag === 'p';
    return { element: block, type, isEmpty };
  }, []);

  const getCurrentBlockType = useCallback((editorInstance: any) => {
    for (let i = 1; i <= 6; i++) {
      if (editorInstance.isActive('heading', { level: i })) return `h${i}`;
    }
    if (editorInstance.isActive('taskList')) return 'task';
    if (editorInstance.isActive('orderedList')) return 'orderedList';
    if (editorInstance.isActive('bulletList')) return 'bulletList';
    if (editorInstance.isActive('blockquote')) return 'blockquote';
    if (editorInstance.isActive('codeBlock')) return 'codeBlock';
    if (editorInstance.isActive('highlightBlock')) return 'highlightBlock';
    if (editorInstance.isActive('horizontalRule')) return 'hr';
    if (editorInstance.isActive('table')) return 'table';
    return 'paragraph';
  }, []);

  const getColumnContentFromBlock = useCallback((block: HTMLElement | null) => {
    const columnContent = block?.closest('.feishu-columns-block__col') as HTMLElement | null;
    return columnContent?.isConnected ? columnContent : null;
  }, []);

  const updateBlockTools = useCallback((editorInstance: any) => {
    if (readOnly || !editorAreaRef.current) return;
    const row = activeBlockElRef.current;
    if (!row?.isConnected) return;

    const selectedRow = getBlockDomFromEditor(editorInstance);
    if (selectedRow && selectedRow !== row) return;

    const { from, to } = editorInstance.state.selection;
    const isEmpty = (from === to && editorInstance.state.doc.textBetween(Math.max(0, from - 1), Math.min(editorInstance.state.doc.content.size, from + 1), ' ', '\0').trim() === '') && editorInstance.isActive('paragraph');

    const areaRect = editorAreaRef.current.getBoundingClientRect();
    const top = getBlockToolsAnchorTop(editorInstance, row, areaRect.top);
    const columnContent = getColumnContentFromBlock(row);
    const left = columnContent ? columnContent.getBoundingClientRect().left - areaRect.left : 0;
    const blockType = getCurrentBlockType(editorInstance);

    setBlockTools(prev => {
      if (!prev.visible) return prev;
      return {
        ...prev,
        top,
        left,
        type: blockType,
        isEmpty,
        isInColumns: Boolean(columnContent),
      };
    });
  }, [getColumnContentFromBlock, getCurrentBlockType, readOnly]);

  const hideBlockTools = useCallback(() => {
    activeBlockElRef.current = null;
    setBlockGutterHoveredState(false);
    setPlusHoveredState(false);
    setRowHighlightBand(null);
    setBlockTools(prev => (prev.visible ? { ...prev, visible: false } : prev));
  }, [setBlockGutterHoveredState, setPlusHoveredState]);

  const resolveHoveredBlockInfo = useCallback(
    (target: EventTarget | null): NonNullable<ReturnType<typeof getElementBlockInfo>> | 'keep' | null => {
      if (!(target instanceof Element)) return null;
      if (isBlockToolsOverlayElement(target)) return 'keep';

      const info = getElementBlockInfo(target);
      if (info) return info;

      const columnWrap = target.closest('.feishu-columns-block__col-wrap');
      if (columnWrap instanceof HTMLElement && editorAreaRef.current?.contains(columnWrap)) {
        const columnEl = columnWrap.querySelector('.feishu-columns-block__col');
        const innerBlock = columnEl ? findBlockContentInColumn(columnEl) : null;
        if (innerBlock) return getElementBlockInfo(innerBlock);
        return 'keep';
      }
      return null;
    },
    [getElementBlockInfo],
  );

  const revealBlockToolsFromInfo = useCallback(
    (info: NonNullable<ReturnType<typeof getElementBlockInfo>>) => {
      const editorInstance = editorRefForCatalogue.current;
      if (readOnly || !editorAreaRef.current || !editorInstance) return;
      const areaRect = editorAreaRef.current.getBoundingClientRect();
      activeBlockElRef.current = info.element;
      if (info.type === 'table') setActiveTableHost(info.element);
      const centerY = getBlockToolsAnchorTop(editorInstance, info.element, areaRect.top);
      const columnContent = getColumnContentFromBlock(info.element);
      const left = columnContent ? columnContent.getBoundingClientRect().left - areaRect.left : 0;
      setBlockTools({
        visible: true,
        top: centerY,
        left,
        type: info.type,
        isEmpty: info.isEmpty,
        isInColumns: Boolean(columnContent),
      });
    },
    [getColumnContentFromBlock, readOnly],
  );

  const handleEditorPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || !editorAreaRef.current || !editorRefForCatalogue.current) return;
      if (slashMenuVisible && slashMenuFromPlus) return;
      if (contextMenu) return;

      const resolved = resolveHoveredBlockInfo(e.target);
      if (resolved === 'keep') return;
      if (!resolved) {
        if (
          activeBlockElRef.current?.isConnected &&
          isPointerInBlockToolsBridge(
            e.clientX,
            e.clientY,
            activeBlockElRef.current,
            editorAreaRef.current,
          )
        ) {
          return;
        }
        hideBlockTools();
        return;
      }
      revealBlockToolsFromInfo(resolved);
    },
    [contextMenu, hideBlockTools, readOnly, resolveHoveredBlockInfo, revealBlockToolsFromInfo, slashMenuFromPlus, slashMenuVisible],
  );

  const handleEditorMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const next = getRelatedNode(e.relatedTarget);
      if (next && e.currentTarget.contains(next)) return;
      if (next instanceof Element && isBlockToolsOverlayElement(next)) return;
      if (editorRefForCatalogue.current?.state.selection instanceof CellSelection) return;

      hideBlockTools();
      setActiveTableHost(null);
    },
    [hideBlockTools],
  );

  /** 指针离开整个编辑器外壳（含 Slash、右键菜单、块工具浮层）时收起面板 */
  const handleEditorWrapMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const next = getRelatedNode(e.relatedTarget);
    if (next && e.currentTarget.contains(next)) return;
    if (next instanceof Element && next.closest('.selection-bubble')) return;
    if (next instanceof Element && next.closest('.slash-menu')) return;
    if (next instanceof Element && next.closest('.slash-submenu-portal')) return;
    if (next instanceof Element && next.closest('.slash-table-grid-flyout')) return;
    if (next instanceof Element && next.closest('.slash-columns-count-flyout')) return;
    if (next instanceof Element && next.closest('.feishu-table-chrome')) return;
    // 子菜单 Portal 在 body 下，移入浮层不应当作离开编辑器外壳
    if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
    if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
    if (next instanceof Element && next.closest('.context-menu')) return;
    if (editorRefForCatalogue.current?.state.selection instanceof CellSelection) return;
    if (slashMenuVisible && slashMenuFromPlus) {
      closeSlashMenu();
      setPlusHoveredState(false);
      return;
    }
    if (contextMenu) return;
    closeSlashMenu();
    setContextMenu(null);
    hideBlockTools();
    setActiveTableHost(null);
  }, [closeSlashMenu, contextMenu, hideBlockTools, setPlusHoveredState, slashMenuFromPlus, slashMenuVisible]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: content || '<p></p>',
    editable: !readOnly,
    editorProps: {
      handlePaste: (_view, event) => {
        if (readOnly) return false;
        const activeEditor = editorRefForCatalogue.current;
        if (!activeEditor) return false;
        return insertTableFromClipboardData(activeEditor, event.clipboardData);
      },
    },
    onCreate: ({ editor: ed }) => {
      ed.commands.fixTables();
    },
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave({ content: editor.getHTML() });
      }, 1000);
      extractHeadings(editor);

      const catCb = catalogueActiveCbRef.current;
      if (catCb && isEditorTypingFocused(editor)) {
        catCb(resolveCatalogueActiveId(editor));
      }

      // Slash menu detection
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\0');
      const slashIdx = textBefore.lastIndexOf('/');
      if (slashIdx !== -1) {
        const query = textBefore.slice(slashIdx + 1);
        // Only show if no space in query
        if (!query.includes(' ') && !query.includes('\n')) {
          const coords = editor.view.coordsAtPos(from);
          setSlashMenuPos({ top: coords.bottom + 4, left: coords.left });
          setSlashQuery(query);
          setSlashMenuFromPlus(false);
          setSlashMenuVisible(true);
        } else {
          closeSlashMenu();
        }
      } else {
        closeSlashMenu();
      }

      updateBlockTools(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      updateBlockTools(editor);
      const tableHost = resolveTableHostFromEditor(editor);
      if (tableHost) setActiveTableHost(tableHost);
      const catCb = catalogueActiveCbRef.current;
      if (catCb && isEditorTypingFocused(editor)) {
        catCb(resolveCatalogueActiveId(editor));
      }
    },
    onFocus: ({ editor }) => {
      updateBlockTools(editor);
      const catCb = catalogueActiveCbRef.current;
      if (catCb && isEditorTypingFocused(editor)) {
        catCb(resolveCatalogueActiveId(editor));
      }
    },
    onBlur: ({ editor: ed }) => {
      setTimeout(() => {
        const ae = document.activeElement;
        if (ae instanceof Element && ae.closest('.selection-bubble')) return;
        const catCb = catalogueActiveCbRef.current;
        if (catCb) {
          const inTitle = ae instanceof Element && ae.matches('.editor-title-input');
          const inEd = ed && ae instanceof Element && ed.view.dom.contains(ae);
          const inCatalogue = ae instanceof Element && ae.closest('.catalogue-aside');
          if (!inTitle && !inEd && !inCatalogue) {
            catCb(null);
          }
        }
        if (!document.querySelector('.context-menu') && !document.querySelector('.slash-menu')) {
          setPlusHoveredState(false);
        }
      }, 0);
    },
  });

  editorRefForCatalogue.current = editor;

  /** 浅蓝行背景：hover 块柄/菜单时用 overlay 高亮（ProseMirror 会清掉直接加在块节点上的 class） */
  const shouldShowRowHighlight =
    !readOnly &&
    blockTools.visible &&
    (blockGutterHovered || plusHovered || Boolean(contextMenu) || (slashMenuVisible && slashMenuFromPlus));

  const syncRowHighlightBand = useCallback(() => {
    const show =
      !readOnly &&
      blockTools.visible &&
      (blockGutterHovered || plusHovered || Boolean(contextMenu) || (slashMenuVisible && slashMenuFromPlus));
    if (!show) {
      setRowHighlightBand(null);
      return;
    }
    const row = activeBlockElRef.current;
    const area = editorAreaRef.current;
    if (!row?.isConnected || !area) {
      setRowHighlightBand(null);
      return;
    }
    const rowRect = row.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    const columnContent = getColumnContentFromBlock(row);
    const highlightRect = columnContent ? columnContent.getBoundingClientRect() : rowRect;
    const top = highlightRect.top - areaRect.top;
    const left = columnContent?.isConnected ? highlightRect.left - areaRect.left : 0;
    const width = columnContent?.isConnected ? highlightRect.width : areaRect.width;
    const height = highlightRect.height;
    setRowHighlightBand(prev =>
      prev && prev.top === top && prev.left === left && prev.width === width && prev.height === height
        ? prev
        : { top, left, width, height },
    );
  }, [
    readOnly,
    blockTools.visible,
    blockGutterHovered,
    plusHovered,
    contextMenu,
    slashMenuVisible,
    slashMenuFromPlus,
    getColumnContentFromBlock,
  ]);

  const syncRowHighlightBandRef = useRef(syncRowHighlightBand);
  syncRowHighlightBandRef.current = syncRowHighlightBand;

  const handleEditorPointerOver = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || !editorAreaRef.current) return;
      const host = resolveTableHostFromElement(e.target);
      if (host && editorAreaRef.current.contains(host)) setActiveTableHost(host);

      if (!editorRefForCatalogue.current) return;
      if (slashMenuVisible && slashMenuFromPlus) return;
      if (contextMenu) return;

      const resolved = resolveHoveredBlockInfo(e.target);
      if (resolved === 'keep' || !resolved) return;
      revealBlockToolsFromInfo(resolved);
    },
    [contextMenu, readOnly, resolveHoveredBlockInfo, revealBlockToolsFromInfo, slashMenuFromPlus, slashMenuVisible],
  );

  const handleBlockToolsMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const next = getRelatedNode(e.relatedTarget);
      if (next && e.currentTarget.contains(next)) return;
      if (next instanceof Element && isBlockToolsOverlayElement(next)) return;
      if (next instanceof Element && next.closest('.slash-menu')) return;

      const resolved = resolveHoveredBlockInfo(next);
      if (resolved) return;

      if (slashMenuFromPlus) {
        closeSlashMenu();
      }
      setPlusHoveredState(false);
      hideBlockTools();
    },
    [closeSlashMenu, hideBlockTools, resolveHoveredBlockInfo, setPlusHoveredState, slashMenuFromPlus],
  );

  const handleEditorBlankClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !editor) return;
    if (slashMenuVisible || contextMenu) return;
    if (e.defaultPrevented) return;
    if (e.target !== e.currentTarget && !(e.target instanceof Element && e.target.classList.contains('tiptap'))) return;

    const tiptap = editor.view.dom as HTMLElement;
    const lastBlock = tiptap.lastElementChild as HTMLElement | null;
    const lastBlockRect = lastBlock?.getBoundingClientRect();
    const clickedBelowLastBlock = Boolean(lastBlockRect && e.clientY > lastBlockRect.bottom + 8);

    if (!clickedBelowLastBlock) {
      const posAtClick = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (posAtClick) {
        const resolved = editor.state.doc.resolve(posAtClick.pos);
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(resolved)));
        editor.view.focus();
        return;
      }
    }

    const docEnd = editor.state.doc.content.size;
    const lastChild = editor.state.doc.lastChild;
    const needsTrailingParagraph = !lastChild || lastChild.type.name !== 'paragraph' || lastChild.textContent.length > 0;

    if (needsTrailingParagraph) {
      editor.chain().insertContentAt(docEnd, { type: 'paragraph' }).run();
      window.requestAnimationFrame(() => {
        const nextEnd = editor.state.doc.content.size;
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, nextEnd - 1)));
        editor.view.focus();
      });
      return;
    }

    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, docEnd - 1)));
    editor.view.focus();
  }, [contextMenu, editor, readOnly, slashMenuVisible]);

  const extractHeadings = useCallback((editorInstance: any) => {
    if (!onHeadingsChange || !editorInstance) return;
    const headings: HeadingItem[] = [];
    editorInstance.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name !== 'heading') return;
      const text = String(node.textContent ?? '').trim();
      if (!text) return;
      headings.push({
        level: node.attrs.level,
        text,
        id: readHeadingId(node.attrs) ?? `heading-pos-${pos}`,
      });
    });
    onHeadingsChange(headings);
  }, [onHeadingsChange]);

  useEffect(() => {
    if (editor) extractHeadings(editor);
  }, [editor, extractHeadings]);

  useEffect(() => {
    if (!editor) return;
    syncAllHeadingCollapseStates(editor, collapsedHeadingIds);
  }, [editor, collapsedHeadingIds]);

  useEffect(() => {
    if (!editor || !collapsedHeadingIds?.size) return;
    let rafId = 0;
    const resyncAfterDocChange = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        syncAllHeadingCollapseStates(editor, collapsedHeadingIds);
      });
    };
    editor.on('update', resyncAfterDocChange);
    return () => {
      cancelAnimationFrame(rafId);
      editor.off('update', resyncAfterDocChange);
    };
  }, [editor, collapsedHeadingIds]);

  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      if (currentContent !== content && content) {
        editor.commands.setContent(content);
        extractHeadings(editor);
      }
    }
  }, [content, editor, extractHeadings]);

  useEffect(() => {
    if (!editor) return;
    const scroll = () => {
      window.requestAnimationFrame(() => {
        scrollToBlockFromHash();
      });
    };
    scroll();
    window.addEventListener('hashchange', scroll);
    return () => window.removeEventListener('hashchange', scroll);
  }, [content, editor]);

  useLayoutEffect(() => {
    if (editor) (editor as any).__documentId = documentId;
  }, [documentId, editor]);

  useEffect(() => {
    const openPageLinkDialog = (ev: Event) => {
      if (!editor || readOnly) return;
      closeSlashMenu();
      const insertAt = (ev as CustomEvent<{ insertAt?: number }>).detail?.insertAt;
      pageLinkInsertPosRef.current = typeof insertAt === 'number' ? insertAt : null;
      const { from, to } = editor.state.selection;
      setPageLinkText(editor.state.doc.textBetween(from, to, '\n'));
      setPageLinkUrl('');
      setPageLinkPopPos(computePageLinkPopPosition(editor));
      setPageLinkDialogVisible(true);
    };
    window.addEventListener('feishu-open-page-link-dialog', openPageLinkDialog as EventListener);
    return () => window.removeEventListener('feishu-open-page-link-dialog', openPageLinkDialog as EventListener);
  }, [closeSlashMenu, editor, readOnly]);

  useEffect(() => {
    setDocTitle(normalizeTitle(title));
  }, [title]);

  useEffect(() => {
    setDocIcon(icon || '');
  }, [icon]);

  useEffect(() => {
    setDocCover(coverUrl || '');
  }, [coverUrl]);

  const handleAddCover = useCallback(() => {
    setDocCover(DEFAULT_COVER_URL);
    onSave({ cover_url: DEFAULT_COVER_URL });
  }, [onSave]);

  const handleRemoveCover = useCallback(() => {
    setDocCover('');
    onSave({ cover_url: '' });
  }, [onSave]);

  const handleIconSelect = useCallback((emoji: string) => {
    setDocIcon(emoji);
    setShowEmojiPicker(false);
    setTitleHovered(false);
    onSave({ icon: emoji });
  }, [onSave]);

  const handleIconRemove = useCallback(() => {
    setDocIcon('');
    setShowEmojiPicker(false);
    setTitleHovered(false);
    onSave({ icon: '' });
  }, [onSave]);

  const closePageLinkDialog = useCallback(() => {
    setPageLinkDialogVisible(false);
    setPageLinkText('');
    setPageLinkUrl('');
    pageLinkInsertPosRef.current = null;
  }, []);

  const confirmPageLink = useCallback(() => {
    if (!editor) return;
    const href = normalizeLinkHref(pageLinkUrl);
    const text = pageLinkText.trim() || href;
    if (!href) return;
    const markContent = { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] };
    const insertPos = pageLinkInsertPosRef.current;
    if (insertPos != null) {
      editor.chain().focus().insertContentAt(insertPos, { type: 'paragraph', content: [markContent] }).run();
      pageLinkInsertPosRef.current = null;
    } else {
      editor.chain().focus().insertContent(markContent).run();
    }
    closePageLinkDialog();
  }, [closePageLinkDialog, editor, pageLinkText, pageLinkUrl]);

  useEffect(() => {
    if (!pageLinkDialogVisible || !editor) return;
    const reposition = () => setPageLinkPopPos(computePageLinkPopPosition(editor));
    reposition();
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [editor, pageLinkDialogVisible]);

  useEffect(() => {
    if (!pageLinkDialogVisible) return;
    let removed: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      const handleOutside = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (target?.closest('.editor-page-link-pop')) return;
        if (target?.closest('.slash-menu')) return;
        closePageLinkDialog();
      };
      document.addEventListener('mousedown', handleOutside);
      removed = () => document.removeEventListener('mousedown', handleOutside);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removed?.();
    };
  }, [closePageLinkDialog, pageLinkDialogVisible]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
      if (readOnly) {
        setPlusHoveredState(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
        closeSlashMenu();
      }
    }
  }, [readOnly, editor, closeSlashMenu]);

  useLayoutEffect(() => {
    syncRowHighlightBand();
  }, [
    syncRowHighlightBand,
    blockTools.top,
    blockTools.type,
    blockTools.visible,
    blockGutterHovered,
    plusHovered,
    contextMenu,
    slashMenuVisible,
    slashMenuFromPlus,
  ]);

  useEffect(() => {
    const show =
      !readOnly &&
      blockTools.visible &&
      (blockGutterHovered || plusHovered || Boolean(contextMenu) || (slashMenuVisible && slashMenuFromPlus));
    if (!show) return;
    const handle = () => syncRowHighlightBandRef.current();
    window.addEventListener('resize', handle);
    document.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      document.removeEventListener('scroll', handle, true);
    };
  }, [
    readOnly,
    blockTools.visible,
    blockGutterHovered,
    plusHovered,
    contextMenu,
    slashMenuVisible,
    slashMenuFromPlus,
  ]);

  useEffect(() => {
    if (!blockTools.visible) setBlockGutterHoveredState(false);
  }, [blockTools.visible, setBlockGutterHoveredState]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
    onTitleInputChange?.(newTitle);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave({ title: newTitle });
    }, 500);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setTableHandleHovered(false);
    menuClosedAtRef.current = Date.now();
  }, []);

  useLayoutEffect(() => {
    const host = activeTableHost;
    if (!host?.isConnected) return;
    const highlighted = tableHandleHovered || contextMenu?.variant === 'table';
    host.classList.toggle('is-table-block-active', highlighted);
    return () => {
      host.classList.remove('is-table-block-active');
    };
  }, [activeTableHost, tableHandleHovered, contextMenu?.variant]);

  /** 指针离开面板关闭菜单时，若未悬停在正文区则一并收起块柄 */
  const dismissContextMenuFromHover = useCallback(() => {
    cancelContextMenuClose();
    setContextMenu(null);
    setTableHandleHovered(false);
    menuClosedAtRef.current = Date.now();
    window.requestAnimationFrame(() => {
      const area = editorAreaRef.current;
      if (area?.matches(':hover')) return;
      hideBlockTools();
    });
  }, [cancelContextMenuClose, hideBlockTools]);

  const scheduleContextMenuClose = useCallback(() => {
    cancelContextMenuClose();
    dismissContextMenuFromHover();
  }, [cancelContextMenuClose, dismissContextMenuFromHover]);

  const openBlockConfigMenu = (options?: { skipCooldown?: boolean }) => {
    if (slashMenuVisible && slashMenuFromPlus) return;
    const isTableTarget = blockTools.type === 'table' || Boolean(activeTableHost);
    if (
      !options?.skipCooldown
      && !isTableTarget
      && Date.now() - menuClosedAtRef.current < 300
    ) {
      return;
    }
    cancelContextMenuClose();
    // For atom blocks (divider), ensure a NodeSelection so context menu actions target the right node
    if (blockTools.type === 'hr' && activeBlockElRef.current && editor) {
      try {
        const pos = editor.view.posAtDOM(activeBlockElRef.current, 0);
        editor.commands.setNodeSelection(pos);
      } catch {
        editor.commands.focus();
      }
    } else if ((blockTools.type === 'table' || activeTableHost) && editor) {
      const host = activeTableHost ?? activeBlockElRef.current;
      if (host) {
        setTableHandleHovered(true);
        selectTableNodeFromHost(editor, host);
      }
    } else {
      editor?.commands.focus();
    }
    closeSlashMenu();
    const tableBtn = blockTools.type === 'table' || activeTableHost ? tableHandleRef.current : null;
    if (tableBtn?.isConnected) {
      const pos = computeTableBlockMenuPosition(tableBtn.getBoundingClientRect());
      setContextMenu({ ...pos, variant: 'table' });
      return;
    }
    const btn = blockDragRowRef.current;
    if (btn?.isConnected) {
      const pos = computeBlockPanelPosition(btn.getBoundingClientRect());
      setContextMenu({ ...pos, variant: 'block' });
      return;
    }
    const area = editorAreaRef.current;
    if (area) {
      const ar = area.getBoundingClientRect();
      setContextMenu({ x: ar.left - 8, y: ar.top + blockTools.top + 30, variant: 'block' });
    } else {
      setContextMenu({ x: 24, y: blockTools.top + 30, variant: 'block' });
    }
  };

  const focusPlusMenuTarget = useCallback(() => {
    const row = activeBlockElRef.current;
    if (!editor || !row?.isConnected) return;
    try {
      const pos = editor.view.posAtDOM(row, 0);
      const node = editor.state.doc.nodeAt(pos);
      if (node?.isBlock) {
        (editor as any).__plusInsertRange = { from: pos, to: pos + node.nodeSize };
      } else {
        (editor as any).__plusInsertRange = null;
      }
      editor.chain().focus(Math.min(pos + 1, editor.state.doc.content.size)).run();
    } catch {
      (editor as any).__plusInsertRange = null;
      editor.commands.focus();
    }
  }, [editor]);

  useEffect(() => () => cancelContextMenuClose(), [cancelContextMenuClose]);

  useEffect(() => {
    if (!contextMenu || readOnly) return;
    const updatePos = () => {
      const isTableMenu = contextMenu?.variant === 'table';
      const button = isTableMenu ? tableHandleRef.current : blockDragRowRef.current;
      if (!button?.isConnected) return;
      const nextRect = button.getBoundingClientRect();
      const next = isTableMenu
        ? computeTableBlockMenuPosition(nextRect)
        : computeBlockPanelPosition(nextRect);
      setContextMenu(prev => {
        if (!prev) return null;
        if (prev.x === next.x && prev.y === next.y) return prev;
        return { ...next, variant: prev.variant };
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    document.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      document.removeEventListener('scroll', updatePos, true);
    };
  }, [contextMenu, readOnly]);

  useEffect(() => {
    if (!slashMenuVisible || !slashMenuFromPlus || readOnly) return;
    const updatePos = () => {
      const button = blockAddButtonRef.current;
      if (!button?.isConnected) return;
      const next = computePlusMenuPosition(button.getBoundingClientRect());
      setSlashMenuPos(prev =>
        prev.left === next.left && prev.top === next.top ? prev : next,
      );
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    document.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      document.removeEventListener('scroll', updatePos, true);
    };
  }, [slashMenuVisible, slashMenuFromPlus, readOnly]);

  if (!editor) return null;

  const isCurrentBlockHeading = /^h[1-6]$/.test(blockTools.type);
  const currentBlockHasChildren = isCurrentBlockHeading && headingBlockHasChildren(activeBlockElRef.current);
  const currentHeadingCatalogueId = isCurrentBlockHeading && activeBlockElRef.current
    ? getHeadingIdFromBlockEl(editor, activeBlockElRef.current)
    : null;
  const isCurrentBlockCollapsed = Boolean(
    currentHeadingCatalogueId && collapsedHeadingIds?.has(currentHeadingCatalogueId),
  );

  return (
    <div className="editor-wrap" onMouseLeave={handleEditorWrapMouseLeave}>
      <div className="editor-scroll">
        <div className="editor-container">
          {/* Title area wrapper for hover detection */}
          <div
            className="editor-title-area"
            ref={emojiPickerAnchorRef}
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={(e) => {
              const next = getRelatedNode(e.relatedTarget);
              if (next && e.currentTarget.contains(next)) return;
              if (!showEmojiPicker) setTitleHovered(false);
            }}
          >
            {/* Hover meta bar: 添加图标 / 添加封面 — absolutely positioned in top padding */}
            {titleHovered && !readOnly && !showEmojiPicker && (
              <div className="page-block-header-top">
                <div className="doc-meta-entry-container">
                  <button
                    type="button"
                    className="doc-meta-entry"
                    onClick={() => { setShowEmojiPicker(true); }}
                  >
                    <span className="universe-icon">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.376 13h2.023c.066-.49.101-.991.101-1.5 0-6.075-4.925-11-11-11s-11 4.925-11 11 4.925 11 11 11c.509 0 1.01-.035 1.5-.101v-2.023A9 9 0 1 1 20.376 13Z" fill="currentColor"/>
                        <path d="M14.5 8a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm-6 0a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm7.574 5.5h-1.459a.5.5 0 0 0-.389.185c-.114.142-.21.25-.285.323A3.489 3.489 0 0 1 11.5 15a3.488 3.488 0 0 1-2.428-.98 3.876 3.876 0 0 1-.298-.335.5.5 0 0 0-.389-.185H6.92a.354.354 0 0 0-.313.514A5.5 5.5 0 0 0 11.5 17a5.5 5.5 0 0 0 4.892-2.984.355.355 0 0 0-.318-.516ZM19 23a1 1 0 0 1-1-1v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 0 1-1 1Z" fill="currentColor"/>
                      </svg>
                    </span>
                    <span className="doc-meta-entry-text">{docIcon ? '修改图标' : '添加图标'}</span>
                  </button>
                </div>
                {!docCover && (
                  <div className="doc-meta-entry-container">
                    <button
                      type="button"
                      className="doc-meta-entry"
                      onClick={handleAddCover}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6.76 11.993l-2.85-.007a.2.2 0 01-.142-.341l2.755-2.756a.267.267 0 01.378 0l1.27 1.272 3.373-3.372a.267.267 0 01.455.189V11.8a.2.2 0 01-.2.2H6.815a.203.203 0 01-.056-.008zm-4.095 2.674c-.733 0-1.333-.6-1.333-1.333V2.667c0-.733.6-1.333 1.333-1.333h10.667c.733 0 1.333.6 1.333 1.333v10.667c0 .733-.6 1.333-1.333 1.333H2.665zm0-1.333h10.667V2.667H2.665v10.667zM4 4.001h2v2h-2V4z" fill="#646A73"/>
                      </svg>
                      <span className="doc-meta-entry-text">添加封面</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Emoji picker popover */}
            {showEmojiPicker && (
              <EmojiPicker
                currentEmoji={docIcon || undefined}
                onSelect={handleIconSelect}
                onRemove={handleIconRemove}
                onClose={() => { setShowEmojiPicker(false); setTitleHovered(false); }}
              />
            )}

            {/* Icon display + Title */}
            <div className="editor-title-row">
              {docIcon && (
                <button
                  type="button"
                  className="editor-doc-icon"
                  onClick={() => !readOnly && setShowEmojiPicker(v => !v)}
                  title={readOnly ? undefined : '点击修改图标'}
                >
                  {docIcon}
                </button>
              )}
              <input
                className="editor-title-input"
                aria-label="文档标题"
                placeholder="请输入标题"
                value={docTitle}
                onChange={handleTitleChange}
                onKeyDown={handleTitleKeyDown}
                onFocus={handleCatalogueTitleFocus}
                onBlur={handleCatalogueTitleBlur}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="editor-meta">
            <div className="meta-author">
              <div className="meta-avatar">{author.charAt(0)}</div>
              <span className="meta-name">{author}</span>
            </div>
            <span className="meta-divider">|</span>
            <span className="meta-time">{formatModifiedTime(updatedAt)}</span>
          </div>

          {/* Content */}
          <div
            ref={editorAreaRef}
            className="editor-content-area"
            aria-label="文档正文编辑区"
            onPointerOver={handleEditorPointerOver}
            onPointerMove={handleEditorPointerMove}
            onMouseLeave={handleEditorMouseLeave}
            onClick={handleEditorBlankClick}
          >
            <EditorContent editor={editor} />
            {!readOnly && (
              <BoxBlockSelectionLayer editor={editor} editorAreaRef={editorAreaRef} readOnly={readOnly} />
            )}
            {(blockTools.visible || (slashMenuVisible && slashMenuFromPlus)) && !readOnly && blockTools.type !== 'table' && !(blockTools.isInColumns && blockTools.isEmpty && !(slashMenuVisible && slashMenuFromPlus)) && (
              <div
                className={`block-inline-tools${blockTools.isInColumns ? ' is-in-columns' : ''}`}
                style={{ top: blockTools.top, left: blockTools.left }}
                onMouseEnter={() => {
                  setBlockGutterHoveredState(true);
                }}
                onMouseLeave={handleBlockToolsMouseLeave}
              >
                {blockTools.isEmpty && blockTools.type === 'paragraph' ? (
                  <div
                    className="block-add-hover-wrap"
                    onPointerEnter={openPlusMenu}
                    onMouseLeave={(e) => {
                      const next = getRelatedNode(e.relatedTarget);
                      if (next instanceof Element && next.closest('.slash-menu')) return;
                      if (next instanceof Element && next.closest('.slash-submenu-portal')) return;
                      if (!slashMenuFromPlus) setPlusHoveredState(false);
                    }}
                  >
                    <button
                      ref={blockAddButtonRef}
                      type="button"
                      className="block-add-btn"
                      onMouseDown={e => e.preventDefault()}
                      aria-label="插入内容"
                    >
                      <span className="block-add-btn-box">
                        <IconAddOutlined size={14} color="currentColor" />
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    ref={blockDragRowRef}
                    type="button"
                    className="block-drag-row"
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={blockTools.type === 'table' ? undefined : () => openBlockConfigMenu()}
                    onMouseLeave={(e) => {
                      const next = getRelatedNode(e.relatedTarget);
                      if (next && e.currentTarget.contains(next)) return;
                      if (next instanceof Element && next.closest('.context-menu')) return;
                      if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
                      if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
                      scheduleContextMenuClose();
                    }}
                    onClick={() => openBlockConfigMenu()}
                    aria-label="块配置"
                  >
                    {!contextMenu && <span className="block-drag-row-tooltip">块配置</span>}
                    <div className="hover-drag-icon-wrapper">
                      <div className="hover-block-type-icon-container">
                        <span className="menu_ud_icon color-b-500">
                          <BlockGutterGlyph type={blockTools.type} />
                        </span>
                      </div>
                      <span className="drag-handle" aria-hidden>
                        <IconDragOutlined size={16} color="#8f959e" />
                      </span>
                    </div>
                  </button>
                )}
                {currentBlockHasChildren && (
                  <button
                    type="button"
                    className={`heading-collapse-toggle${isCurrentBlockCollapsed ? ' heading-collapse-toggle--collapsed' : ''}${isCurrentBlockHeading ? ' color-b-500' : ''}`}
                    title={isCurrentBlockCollapsed ? '展开' : '收起'}
                    aria-label={isCurrentBlockCollapsed ? '展开' : '收起'}
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => {
                      e.stopPropagation();
                      toggleHeadingCollapse();
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M6 3.5L11 8L6 12.5" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {!readOnly && editor && (() => {
              const host =
                activeTableHost?.isConnected
                  ? activeTableHost
                  : resolveTableHostFromEditor(editor);
              const pinTableChrome =
                tableHandleHovered
                || contextMenu?.variant === 'table'
                || (host?.isConnected ? isCellSelectionInTableHost(editor, host) : false);
              return host?.isConnected ? (
              <FeishuTableOverlay
                editor={editor}
                tableHost={host}
                handleRef={tableHandleRef}
                pinChrome={pinTableChrome}
                onTableHandleActiveChange={setTableHandleHovered}
                onOpenBlockMenu={() => openBlockConfigMenu({ skipCooldown: true })}
                onScheduleCloseBlockMenu={scheduleContextMenuClose}
                onCancelCloseBlockMenu={cancelContextMenuClose}
              />
              ) : null;
            })()}
            {rowHighlightBand && blockTools.type !== 'table' && (
              <div
                className="block-row-gutter-highlight-band"
                style={{
                  top: rowHighlightBand.top,
                  left: rowHighlightBand.left,
                  width: rowHighlightBand.width,
                  height: rowHighlightBand.height,
                  right: 'auto',
                }}
                aria-hidden
              />
            )}
            {pageLinkDialogVisible && !readOnly && (
              <div
                className="editor-page-link-pop"
                style={{ top: pageLinkPopPos.top, left: pageLinkPopPos.left }}
              >
                <div className="editor-page-link-form">
                  <label className="editor-page-link-row">
                    <span className="editor-page-link-label">文本</span>
                    <input
                      className="editor-page-link-input"
                      type="text"
                      placeholder="输入文本"
                      value={pageLinkText}
                      onChange={e => setPageLinkText(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmPageLink();
                        if (e.key === 'Escape') closePageLinkDialog();
                      }}
                    />
                  </label>
                  <div className="editor-page-link-row editor-page-link-row--with-action">
                    <label className="editor-page-link-url-field">
                      <span className="editor-page-link-label">链接</span>
                      <input
                        className="editor-page-link-input"
                        type="text"
                        placeholder="粘贴或输入链接"
                        value={pageLinkUrl}
                        onChange={e => setPageLinkUrl(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmPageLink();
                          if (e.key === 'Escape') closePageLinkDialog();
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="editor-page-link-ok"
                      disabled={!normalizeLinkHref(pageLinkUrl)}
                      onClick={confirmPageLink}
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="editor-floating-actions" aria-label="快捷帮助">
        <button type="button" title="文档助手" aria-label="文档助手">
          <Notebook theme="outline" size={15} strokeWidth={3} fill="#646a73" />
        </button>
        <button type="button" title="帮助" aria-label="帮助">
          <Help theme="outline" size={15} strokeWidth={3} fill="#646a73" />
        </button>
      </div>

      {/* SelectionBubble 使用 tippy.js，会把 DOM portal 到 body。
          放在 editor-content-area 内会让 React 在 hover 触发条件渲染时
          以已被 tippy 搬走的 DOM 作为 insertBefore 参考节点而抛错。
          这里挂在 editor-wrap 末尾，与条件渲染的块工具/行高亮解耦。 */}
      {!readOnly && editor && (
        <SelectionBubble editor={editor} documentId={documentId} />
      )}

      {/* Context Menu */}
      {contextMenu?.variant === 'table' && (
        <TableContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={tableHandleRef}
          blockAnchorRef={activeBlockElRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
          onMouseEnterCancel={cancelContextMenuClose}
        />
      )}
      {contextMenu?.variant === 'block' && (
        <ContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={blockDragRowRef}
          blockAnchorRef={activeBlockElRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
          onMouseEnterCancel={cancelContextMenuClose}
        />
      )}

      {slashMenuVisible && !slashMenuFromPlus && (
        <SlashMenu
          editor={editor}
          position={slashMenuPos}
          query={slashQuery}
          onClose={closeSlashMenu}
          onBeforeSelect={() => editor.commands.focus()}
        />
      )}
      {slashMenuVisible && slashMenuFromPlus && (
        <div
          className="block-plus-menu-shell"
          onMouseLeave={(e) => {
            const next = getRelatedNode(e.relatedTarget);
            if (next instanceof Element && next.closest('.block-add-hover-wrap')) return;
            if (next instanceof Element && next.closest('.slash-menu')) return;
            if (next instanceof Element && next.closest('.slash-submenu-portal')) return;
            closeSlashMenu();
            setPlusHoveredState(false);
          }}
        >
          <SlashMenu
            editor={editor}
            position={slashMenuPos}
            query=""
            onClose={closeSlashMenu}
            onBeforeSelect={focusPlusMenuTarget}
            onMouseEnter={() => setPlusHoveredState(true)}
            onMouseLeave={() => {
              closeSlashMenu();
              setPlusHoveredState(false);
            }}
            anchorRef={blockAddButtonRef}
          />
        </div>
      )}

    </div>
  );
}
