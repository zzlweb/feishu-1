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
import { FeishuHeading, readHeadingId } from './feishuHeading';
import { feishuTableExtensions } from './feishuTable';
import {
  getHeadingIdFromBlockEl,
  headingBlockHasChildren,
  syncAllHeadingCollapseStates,
} from './headingCollapse';
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

const LocalColumnsBlock = TiptapNode.create({
  name: 'localColumnsBlock',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-local-block="columns"]' }];
  },
  renderHTML() {
    return ['div', { 'data-local-block': 'columns', class: 'feishu-columns-block' }, ['div', { class: 'feishu-columns-block__col' }, '分栏内容'], ['div', { class: 'feishu-columns-block__col' }, '分栏内容']];
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

const LocalButtonBlock = TiptapNode.create({
  name: 'localButtonBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { text: { default: '按钮' } };
  },
  parseHTML() {
    return [{ tag: 'button[data-local-block="button"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['button', { ...HTMLAttributes, type: 'button', 'data-local-block': 'button', class: 'feishu-action-button' }, HTMLAttributes.text || '按钮'];
  },
});

const LocalFormulaBlock = TiptapNode.create({
  name: 'localFormulaBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { formula: { default: 'E = mc²' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-local-block="formula"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-local-block': 'formula', class: 'feishu-formula-block' }, HTMLAttributes.formula || 'E = mc²'];
  },
});

const LocalEmbedBlock = TiptapNode.create({
  name: 'localEmbedBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { title: { default: '内容块' }, desc: { default: '' }, kind: { default: 'embed' }, href: { default: '' } };
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
  LocalColumnsBlock,
  LocalDivTableBlock,
  ...feishuTableExtensions,
  LocalSyncBlock,
  LocalButtonBlock,
  LocalFormulaBlock,
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
  if (blockEl.classList.contains('tableWrapper')) {
    return rr.top + 20 - areaRectTop;
  }
  return rr.top + rr.height / 2 - areaRectTop;
}

function clampPanelY(anchor: DOMRect, menuH: number, pad: number): number {
  const vh = window.innerHeight;
  const anchorCenterY = anchor.top + anchor.height / 2;
  const y = anchorCenterY - menuH / 2;
  return Math.max(pad, Math.min(y, vh - pad - menuH));
}

/** 块配置面板：优先在块柄左侧展示，减少遮挡正文；左侧放不下时再切到右侧 */
function computeBlockPanelPosition(
  anchor: DOMRect,
  menuW = 230,
  menuH = 420,
  pad = 8,
  gap = 4,
): { x: number; y: number } {
  const vw = window.innerWidth;

  const leftX = anchor.left - gap - menuW;
  const rightX = anchor.right + gap;
  const fitsLeft = leftX >= pad;
  const fitsRight = rightX + menuW <= vw - pad;

  if (fitsLeft) {
    return { x: leftX, y: clampPanelY(anchor, menuH, pad) };
  }

  let x = fitsRight ? rightX : Math.min(Math.max(leftX, pad), vw - menuW - pad);
  x = Math.max(pad, Math.min(x, vw - menuW - pad));
  return { x, y: clampPanelY(anchor, menuH, pad) };
}

function computePlusMenuPosition(
  anchor: DOMRect,
  menuW = SLASH_MENU_WIDTH,
  menuH = SLASH_MENU_MAX_HEIGHT,
  pad = 8,
  gap = 8,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const effectiveMenuW = Math.min(menuW, vw - 2 * pad);
  const leftX = anchor.left - gap - effectiveMenuW;
  const rightX = anchor.right + gap;
  const fitsLeft = leftX >= pad;
  const fitsRight = rightX + effectiveMenuW <= vw - pad;

  let left: number;
  if (fitsLeft) {
    left = leftX;
  } else if (fitsRight) {
    left = rightX;
  } else {
    left = Math.min(Math.max(leftX, pad), vw - effectiveMenuW - pad);
  }

  left = Math.max(pad, Math.min(left, vw - effectiveMenuW - pad));
  if (left + effectiveMenuW + gap > anchor.left && left < anchor.right) {
    left = Math.max(pad, anchor.left - gap - effectiveMenuW);
  }

  return {
    left,
    top: clampPanelY(anchor, menuH, pad),
  };
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  /** 面板是否由段落旁「+」悬停/点击打开（与输入 `/` 打开的菜单分流，便于嵌套在同一 hover 容器内） */
  const [slashMenuFromPlus, setSlashMenuFromPlus] = useState(false);
  const [pageLinkDialogVisible, setPageLinkDialogVisible] = useState(false);
  const [pageLinkPopPos, setPageLinkPopPos] = useState({ top: 0, left: 0 });
  const [pageLinkText, setPageLinkText] = useState('');
  const [pageLinkUrl, setPageLinkUrl] = useState('');
  const [blockTools, setBlockTools] = useState({ visible: false, top: 0, type: 'paragraph', isEmpty: true });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plusMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const blockAddButtonRef = useRef<HTMLButtonElement>(null);
  const blockDragRowRef = useRef<HTMLButtonElement>(null);
  /** 「在下方添加」打开链接弹窗时在 confirm 用 insertContentAt */
  const pageLinkInsertPosRef = useRef<number | null>(null);
  const menuClosedAtRef = useRef<number>(0);
  /** 当前块工具对应的块 DOM */
  const activeBlockElRef = useRef<HTMLElement | null>(null);
  const [plusHovered, setPlusHovered] = useState(false);
  const [blockGutterHovered, setBlockGutterHovered] = useState(false);
  const [rowHighlightBand, setRowHighlightBand] = useState<{ top: number; height: number } | null>(null);

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
    if (plusMenuCloseTimerRef.current) {
      clearTimeout(plusMenuCloseTimerRef.current);
      plusMenuCloseTimerRef.current = null;
    }
    setSlashMenuVisible(false);
    setSlashMenuFromPlus(false);
  }, []);

  const cancelPlusMenuClose = useCallback(() => {
    if (plusMenuCloseTimerRef.current) {
      clearTimeout(plusMenuCloseTimerRef.current);
      plusMenuCloseTimerRef.current = null;
    }
  }, []);

  const schedulePlusMenuClose = useCallback(() => {
    cancelPlusMenuClose();
    plusMenuCloseTimerRef.current = window.setTimeout(() => {
      plusMenuCloseTimerRef.current = null;
      setPlusHoveredState(false);
      closeSlashMenu();
    }, 250);
  }, [cancelPlusMenuClose, closeSlashMenu]);

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
    const tableWrapper = target.closest('.tableWrapper') as HTMLElement | null;
    if (tableWrapper && editorAreaRef.current.contains(tableWrapper)) {
      const cell = target.closest('td, th') as HTMLElement | null;
      const anchor = (cell?.querySelector('p') ?? cell ?? tableWrapper) as HTMLElement;
      const isEmpty = anchor.tagName.toLowerCase() === 'p' && anchor.textContent?.trim() === '';
      return { element: anchor, type: 'table', isEmpty };
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

  const updateBlockTools = useCallback((editorInstance: any) => {
    if (readOnly || !editorAreaRef.current || !isEditorTypingFocused(editorInstance)) {
      activeBlockElRef.current = null;
      setBlockTools(prev => ({ ...prev, visible: false }));
      return;
    }

    const { from, to } = editorInstance.state.selection;
    const isEmpty = (from === to && editorInstance.state.doc.textBetween(Math.max(0, from - 1), Math.min(editorInstance.state.doc.content.size, from + 1), ' ', '\0').trim() === '') && editorInstance.isActive('paragraph');

    const areaRect = editorAreaRef.current.getBoundingClientRect();

    activeBlockElRef.current = getBlockDomFromEditor(editorInstance);
    const row = activeBlockElRef.current;
    let top: number;
    if (row) {
      top = getBlockToolsAnchorTop(editorInstance, row, areaRect.top);
    } else {
      const c = editorInstance.view.coordsAtPos(from);
      top = (c.top + c.bottom) / 2 - areaRect.top;
    }

    setBlockTools({
      visible: true,
      top,
      type: getCurrentBlockType(editorInstance),
      isEmpty,
    });
  }, [getCurrentBlockType, readOnly]);

  const handleEditorMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const next = getRelatedNode(e.relatedTarget);
    if (next && e.currentTarget.contains(next)) return;
    if (next instanceof Element && next.closest('.block-inline-tools')) return;
    if (next instanceof Element && next.closest('.selection-bubble')) return;
    if (next instanceof Element && next.closest('.slash-menu')) return;
    if (next instanceof Element && next.closest('.slash-table-grid-flyout')) return;
    if (next instanceof Element && next.closest('.feishu-table-overlay')) return;
    if (next instanceof Element && next.closest('.context-menu')) return;
    if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
    if (next instanceof Element && next.closest('.context-add-below-flyout')) return;

    window.setTimeout(() => {
      if (!document.querySelector('.context-menu') && !document.querySelector('.slash-menu')) {
        setPlusHoveredState(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
      }
    }, 250);
  }, []);

  /** 指针离开整个编辑器外壳（含 Slash、右键菜单、块工具浮层）时收起面板 */
  const handleEditorWrapMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const next = getRelatedNode(e.relatedTarget);
    if (next && e.currentTarget.contains(next)) return;
    if (next instanceof Element && next.closest('.selection-bubble')) return;
    if (next instanceof Element && next.closest('.slash-menu')) return;
    if (next instanceof Element && next.closest('.slash-table-grid-flyout')) return;
    if (next instanceof Element && next.closest('.feishu-table-overlay')) return;
    // 子菜单 Portal 在 body 下，移入浮层不应当作离开编辑器外壳
    if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
    if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
    if (next instanceof Element && next.closest('.context-menu')) return;
    if (slashMenuVisible && slashMenuFromPlus) {
      schedulePlusMenuClose();
      return;
    }
    if (contextMenu) return;
    closeSlashMenu();
    setContextMenu(null);
    setPlusHoveredState(false);
    setBlockTools(prev => ({ ...prev, visible: false }));
  }, [closeSlashMenu, contextMenu, schedulePlusMenuClose, slashMenuFromPlus, slashMenuVisible]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: content || '<p></p>',
    editable: !readOnly,
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
          setBlockTools(prev => ({ ...prev, visible: false }));
        }
      }, 80);
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
      (blockGutterHovered || plusHovered || Boolean(contextMenu) ||
        (slashMenuVisible && slashMenuFromPlus));
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
    const top = rowRect.top - areaRect.top;
    const height = rowRect.height;
    setRowHighlightBand(prev =>
      prev && prev.top === top && prev.height === height ? prev : { top, height },
    );
  }, [
    readOnly,
    blockTools.visible,
    blockGutterHovered,
    plusHovered,
    contextMenu,
    slashMenuVisible,
    slashMenuFromPlus,
  ]);

  const syncRowHighlightBandRef = useRef(syncRowHighlightBand);
  syncRowHighlightBandRef.current = syncRowHighlightBand;

  const handleEditorMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !editorAreaRef.current || !editor) return;
      if (slashMenuVisible && slashMenuFromPlus) return;
      if (contextMenu) return;
      const info = getElementBlockInfo(e.target);
      if (!info) return;

      const areaRect = editorAreaRef.current.getBoundingClientRect();
      activeBlockElRef.current = info.element;
      const centerY = getBlockToolsAnchorTop(editor, info.element, areaRect.top);
      setBlockTools({
        visible: true,
        top: centerY,
        type: info.type,
        isEmpty: info.isEmpty,
      });
      requestAnimationFrame(() => syncRowHighlightBandRef.current());
    },
    [contextMenu, getElementBlockInfo, readOnly, editor, slashMenuFromPlus, slashMenuVisible],
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
    menuClosedAtRef.current = Date.now();
  }, []);

  /** 指针离开面板关闭菜单时，若未悬停在正文区则一并收起块柄 */
  const dismissContextMenuFromHover = useCallback(() => {
    cancelContextMenuClose();
    setContextMenu(null);
    menuClosedAtRef.current = Date.now();
    window.requestAnimationFrame(() => {
      const area = editorAreaRef.current;
      if (area?.matches(':hover')) return;
      setPlusHoveredState(false);
      setBlockTools(prev => ({ ...prev, visible: false }));
    });
  }, [cancelContextMenuClose]);

  const scheduleContextMenuClose = useCallback(() => {
    cancelContextMenuClose();
    contextMenuCloseTimerRef.current = window.setTimeout(() => {
      contextMenuCloseTimerRef.current = null;
      dismissContextMenuFromHover();
    }, 200);
  }, [cancelContextMenuClose, dismissContextMenuFromHover]);

  const openBlockConfigMenu = () => {
    if (slashMenuVisible && slashMenuFromPlus) return;
    // Prevent re-opening if just closed by a click (300ms cooldown)
    if (Date.now() - menuClosedAtRef.current < 300) return;
    cancelContextMenuClose();
    // For atom blocks (divider), ensure a NodeSelection so context menu actions target the right node
    if (blockTools.type === 'hr' && activeBlockElRef.current && editor) {
      try {
        const pos = editor.view.posAtDOM(activeBlockElRef.current, 0);
        editor.commands.setNodeSelection(pos);
      } catch {
        editor.commands.focus();
      }
    } else if (blockTools.type === 'table' && activeBlockElRef.current && editor) {
      syncEditorSelectionToAnchoredBlock(editor, activeBlockElRef.current);
    } else {
      editor?.commands.focus();
    }
    closeSlashMenu();
    const btn = blockDragRowRef.current;
    if (btn?.isConnected) {
      setContextMenu(computeBlockPanelPosition(btn.getBoundingClientRect()));
      return;
    }
    const area = editorAreaRef.current;
    if (area) {
      const ar = area.getBoundingClientRect();
      setContextMenu({ x: ar.left - 8, y: ar.top + blockTools.top + 30 });
    } else {
      setContextMenu({ x: 24, y: blockTools.top + 30 });
    }
  };

  const openPlusMenu = useCallback(() => {
    cancelPlusMenuClose();
    setContextMenu(null);
    const btn = blockAddButtonRef.current;
    if (btn?.isConnected) {
      setSlashMenuPos(computePlusMenuPosition(btn.getBoundingClientRect()));
    }
    setPlusHoveredState(true);
    setBlockTools(prev => ({ ...prev, type: 'paragraph', isEmpty: true }));
    setSlashMenuFromPlus(true);
    setSlashQuery('');
    setSlashMenuVisible(true);
  }, [cancelPlusMenuClose]);

  const focusPlusMenuTarget = useCallback(() => {
    const row = activeBlockElRef.current;
    if (!editor || !row?.isConnected) return;
    try {
      const pos = editor.view.posAtDOM(row, 0);
      editor.chain().focus(Math.min(pos + 1, editor.state.doc.content.size)).run();
    } catch {
      editor.commands.focus();
    }
  }, [editor]);

  useEffect(() => () => cancelPlusMenuClose(), [cancelPlusMenuClose]);
  useEffect(() => () => cancelContextMenuClose(), [cancelContextMenuClose]);

  useEffect(() => {
    if (!contextMenu || readOnly) return;
    const updatePos = () => {
      const button = blockDragRowRef.current;
      if (!button?.isConnected) return;
      const next = computeBlockPanelPosition(button.getBoundingClientRect());
      setContextMenu(prev => {
        if (!prev) return null;
        if (prev.x === next.x && prev.y === next.y) return prev;
        return next;
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
            onMouseMove={handleEditorMouseMove}
            onMouseLeave={handleEditorMouseLeave}
            onClick={handleEditorBlankClick}
          >
            <EditorContent editor={editor} />
            {blockTools.visible && !readOnly && (
              <div
                className="block-inline-tools"
                style={{ top: blockTools.top }}
                onMouseEnter={() => setBlockGutterHoveredState(true)}
                onMouseLeave={(e) => {
                  const next = getRelatedNode(e.relatedTarget);
                  if (next && e.currentTarget.contains(next)) return;
                  if (next instanceof Element && next.closest('.context-menu')) return;
                  if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
                  if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
                  if (next instanceof Element && next.closest('.slash-menu')) return;
                  if (next instanceof Element && next.closest('.slash-table-grid-flyout')) return;
                  if (next instanceof Element && next.closest('.feishu-table-overlay')) return;
                  setBlockGutterHoveredState(false);
                }}
              >
                {(slashMenuVisible && slashMenuFromPlus) || (blockTools.isEmpty && blockTools.type === 'paragraph') ? (
                  <div
                    className="block-add-hover-wrap"
                    onMouseEnter={openPlusMenu}
                    onMouseLeave={(e) => {
                      const next = getRelatedNode(e.relatedTarget);
                      if (next && e.currentTarget.contains(next)) return;
                      if (next instanceof Element && next.closest('.slash-menu')) return;
                      schedulePlusMenuClose();
                    }}
                  >
                    <button
                      ref={blockAddButtonRef}
                      type="button"
                      className="block-add-btn"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        openPlusMenu();
                      }}
                      title="点击或悬浮添加内容"
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
                    onMouseEnter={blockTools.type === 'table' ? undefined : openBlockConfigMenu}
                    onMouseLeave={(e) => {
                      const next = getRelatedNode(e.relatedTarget);
                      if (next && e.currentTarget.contains(next)) return;
                      if (next instanceof Element && next.closest('.context-menu')) return;
                      if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
                      if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
                      scheduleContextMenuClose();
                    }}
                    onClick={openBlockConfigMenu}
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
            {rowHighlightBand && (
              <div
                className="block-row-gutter-highlight-band"
                style={{ top: rowHighlightBand.top, height: rowHighlightBand.height }}
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
      {contextMenu && (
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
        />
      )}
      {slashMenuVisible && slashMenuFromPlus && (
        <SlashMenu
          editor={editor}
          position={slashMenuPos}
          query={slashQuery}
          onClose={closeSlashMenu}
          onBeforeSelect={focusPlusMenuTarget}
          onMouseEnter={cancelPlusMenuClose}
          onMouseLeave={schedulePlusMenuClose}
          anchorRef={blockAddButtonRef}
        />
      )}

    </div>
  );
}
