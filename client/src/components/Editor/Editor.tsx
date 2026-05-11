import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
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
import { TextSelection } from '@tiptap/pm/state';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import ContextMenu from './ContextMenu';
import SlashMenu from './SlashMenu';
import SelectionBubble from './SelectionBubble';
import { DOC_TITLE_CATALOGUE_ID, type HeadingItem } from '../../types';
import { HelpCircleIcon, BookOpenIcon } from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import { IconAddOutlined, IconDragOutlined } from '../../icons/feishuDoc';
import BlockGutterGlyph from './BlockGutterGlyph';
import EmojiPicker from './EmojiPicker';
import './Editor.less';

const Notebook = wrapIcon(BookOpenIcon);
const Help = wrapIcon(HelpCircleIcon);

const lowlight = createLowlight(common);

const normalizeTitle = (value: string) => value === '未命名文档' ? '' : value;

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

/** 从当前选区解析光标所在的块级 DOM（仅悬停「+」时用于行背景） */
function getBlockDomFromEditor(editorInstance: {
  view: { dom: HTMLElement; domAtPos: (pos: number) => { node: Node; offset: number } };
  state: { selection: { from: number } };
}): HTMLElement | null {
  const root = editorInstance.view.dom as HTMLElement;
  const from = editorInstance.state.selection.from;
  const domAt = editorInstance.view.domAtPos(from);
  let n: Node | null = domAt.node;
  if (n.nodeType === Node.TEXT_NODE) n = (n as Text).parentElement;
  let el = n as HTMLElement | null;
  while (el && el !== root) {
    const feishuCodeBlock = el.closest?.('.feishu-code-block') as HTMLElement | null;
    if (feishuCodeBlock && root.contains(feishuCodeBlock)) return feishuCodeBlock;
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
    return `heading-${$from.before(d)}`;
  }

  let lastPos: number | null = null;
  state.doc.descendants((node: any, pos: number) => {
    if (pos >= from) return false;
    if (node.type.name !== 'heading') return;
    const text = String(node.textContent ?? '').trim();
    if (!text) return;
    lastPos = pos;
  });
  return lastPos !== null ? `heading-${lastPos}` : null;
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

function computePlusMenuPosition(anchor: DOMRect, menuW = 230, menuH = 560, pad = 8, gap = 4): { top: number; left: number } {
  const vw = window.innerWidth;
  const leftX = anchor.left - gap - menuW;
  const rightX = anchor.right + gap;
  const left = leftX >= pad ? leftX : Math.min(Math.max(rightX, pad), vw - menuW - pad);
  return {
    left: Math.max(pad, Math.min(left, vw - menuW - pad)),
    top: clampPanelY(anchor, menuH, pad),
  };
}

/** 默认封面图 URL（占位） */
const DEFAULT_COVER_URL = '/static/01.gif';

interface EditorProps {
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
  const [blockTools, setBlockTools] = useState({ visible: false, top: 0, type: 'paragraph', isEmpty: true });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plusMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const blockAddButtonRef = useRef<HTMLButtonElement>(null);
  const blockDragRowRef = useRef<HTMLButtonElement>(null);
  const menuClosedAtRef = useRef<number>(0);
  /** 当前块工具对应的块 DOM */
  const activeBlockElRef = useRef<HTMLElement | null>(null);
  const [plusHovered, setPlusHovered] = useState(false);
  const catalogueActiveCbRef = useRef<EditorProps['onCatalogueActiveIdChange']>(undefined);
  const editorRefForCatalogue = useRef<any>(null);
  catalogueActiveCbRef.current = onCatalogueActiveIdChange;

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
      setPlusHovered(false);
      closeSlashMenu();
    }, 250);
  }, [cancelPlusMenuClose, closeSlashMenu]);

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
    const block = target.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,hr') as HTMLElement | null;
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
    else if (tag === 'hr') type = 'hr';

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
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    if (next instanceof Element && next.closest('.block-inline-tools')) return;
    if (next instanceof Element && next.closest('.selection-bubble')) return;
    if (next instanceof Element && next.closest('.slash-menu')) return;
    if (next instanceof Element && next.closest('.context-menu')) return;
    if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
    if (next instanceof Element && next.closest('.context-add-below-flyout')) return;

    window.setTimeout(() => {
      if (!document.querySelector('.context-menu') && !document.querySelector('.slash-menu')) {
        setPlusHovered(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
      }
    }, 250);
  }, []);

  /** 指针离开整个编辑器外壳（含 Slash、右键菜单、块工具浮层）时收起面板 */
  const handleEditorWrapMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    if (next instanceof Element && next.closest('.selection-bubble')) return;
    if (next instanceof Element && next.closest('.slash-menu')) return;
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
    setPlusHovered(false);
    setBlockTools(prev => ({ ...prev, visible: false }));
  }, [closeSlashMenu, contextMenu, schedulePlusMenuClose, slashMenuFromPlus, slashMenuVisible]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
      }),
      FeishuCodeBlock.configure({ lowlight }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
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
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
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
          setPlusHovered(false);
          setBlockTools(prev => ({ ...prev, visible: false }));
        }
      }, 80);
    },
  });

  editorRefForCatalogue.current = editor;

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
        id: `heading-${pos}`,
      });
    });
    onHeadingsChange(headings);
  }, [onHeadingsChange]);

  useEffect(() => {
    if (editor) extractHeadings(editor);
  }, [editor, extractHeadings]);

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
    const n = normalizeTitle(title);
    setDocTitle(n);
    onTitleInputChange?.(n);
  }, [title, onTitleInputChange]);

  useEffect(() => {
    setDocIcon(icon || '');
  }, [icon]);

  useEffect(() => {
    setDocCover(coverUrl || '');
  }, [coverUrl]);

  const handleIconSelect = useCallback((emoji: string) => {
    setDocIcon(emoji);
    setShowEmojiPicker(false);
    onSave({ icon: emoji });
  }, [onSave]);

  const handleIconRemove = useCallback(() => {
    setDocIcon('');
    setShowEmojiPicker(false);
    onSave({ icon: '' });
  }, [onSave]);

  const handleAddCover = useCallback(() => {
    setDocCover(DEFAULT_COVER_URL);
    onSave({ cover_url: DEFAULT_COVER_URL });
  }, [onSave]);

  const handleRemoveCover = useCallback(() => {
    setDocCover('');
    onSave({ cover_url: '' });
  }, [onSave]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
      if (readOnly) {
        setPlusHovered(false);
        setBlockTools(prev => ({ ...prev, visible: false }));
        closeSlashMenu();
      }
    }
  }, [readOnly, editor, closeSlashMenu]);

  /** 浅蓝行背景：空段落悬停「+」；或非空 / 非段落时显示块柄与正文行对齐 */
  useEffect(() => {
    const root = editorAreaRef.current?.querySelector('.tiptap');
    root?.querySelectorAll('.block-row-gutter-highlight').forEach(el => {
      el.classList.remove('block-row-gutter-highlight');
    });
    let row: HTMLElement | null = null;
    if (
      plusHovered &&
      blockTools.visible &&
      blockTools.isEmpty &&
      blockTools.type === 'paragraph'
    ) {
      row = activeBlockElRef.current;
    } else if (
      blockTools.visible &&
      !readOnly &&
      !(blockTools.isEmpty && blockTools.type === 'paragraph')
    ) {
      row = activeBlockElRef.current;
    }
    if (row?.isConnected) row.classList.add('block-row-gutter-highlight');
  }, [
    plusHovered,
    blockTools.visible,
    blockTools.isEmpty,
    blockTools.type,
    blockTools.top,
    readOnly,
  ]);

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
    setContextMenu(null);
    menuClosedAtRef.current = Date.now();
    window.requestAnimationFrame(() => {
      const area = editorAreaRef.current;
      if (area?.matches(':hover')) return;
      setPlusHovered(false);
      setBlockTools(prev => ({ ...prev, visible: false }));
    });
  }, []);

  const openBlockConfigMenu = () => {
    if (slashMenuVisible && slashMenuFromPlus) return;
    // Prevent re-opening if just closed by a click (300ms cooldown)
    if (Date.now() - menuClosedAtRef.current < 300) return;
    editor?.commands.focus();
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
    setPlusHovered(true);
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
              const next = e.relatedTarget as Node | null;
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
            {blockTools.visible && !readOnly && (
              <div className="block-inline-tools" style={{ top: blockTools.top }}>
                {(slashMenuVisible && slashMenuFromPlus) || (blockTools.isEmpty && blockTools.type === 'paragraph') ? (
                  <div
                    className="block-add-hover-wrap"
                    onMouseEnter={openPlusMenu}
                    onMouseLeave={(e) => {
                      const next = e.relatedTarget as Node | null;
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
                    onMouseEnter={openBlockConfigMenu}
                    onMouseLeave={(e) => {
                      const next = e.relatedTarget as Node | null;
                      if (next && e.currentTarget.contains(next)) return;
                      if (next instanceof Element && next.closest('.context-menu')) return;
                      if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
                      if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
                    }}
                    onClick={openBlockConfigMenu}
                    title="块配置"
                    aria-label="块配置"
                  >
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
                    <span className="block-drag-caret" aria-hidden>
                      <svg width="8" height="5" viewBox="0 0 8 5" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 5 0 0h8L4 5Z" fill="#1f2329" />
                      </svg>
                    </span>
                  </button>
                )}
              </div>
            )}
            <EditorContent editor={editor} />
            {!readOnly && <SelectionBubble editor={editor} />}
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          editor={editor}
          x={contextMenu.x}
          y={contextMenu.y}
          anchorRef={blockDragRowRef}
          onClose={closeContextMenu}
          onHoverDismiss={dismissContextMenuFromHover}
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
        />
      )}
    </div>
  );
}
