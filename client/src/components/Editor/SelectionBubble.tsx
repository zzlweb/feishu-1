import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { BubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { isTextSelection } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import { isImageBlockActive } from './imageBlockUtils';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import FeishuColorPickerPanel from './FeishuColorPickerPanel';
import { ContextGlyphText, FEISHU_TOOLBOX } from '../../icons/contextMenuGlyphs';
import {
  SlashGlyphHeading1,
  SlashGlyphHeading2,
  SlashGlyphHeading3,
  SlashGlyphHeading4,
  SlashGlyphHeading5,
  SlashGlyphHeading6,
  SlashGlyphOrderedList,
  SlashGlyphBulletList,
  SlashGlyphTaskList,
  SlashGlyphCode,
  SlashGlyphQuote,
  SlashGlyphHighlight,
  SlashGlyphSyncMuted,
} from '../../icons/slashMenuGlyphs';
import {
  SelGlyphChevronDown,
  SelGlyphTypography,
  SelGlyphBold,
  SelGlyphStrike,
  SelGlyphItalic,
  SelGlyphUnderline,
  SelGlyphLink,
  SelGlyphCode,
  SelGlyphFontColor,
  SelGlyphToolbarMore,
  SelGlyphShare,
  SelGlyphComment,
  SelGlyphTableMerge,
  SelGlyphTableCellBg,
  SelGlyphTableGrid,
  SelGlyphTableInsert,
  SelGlyphDelete,
} from '../../icons/selectionToolbarGlyphs';
import { IndentRightIcon, IndentLeftIcon } from 'tdesign-icons-react';
import { wrapIcon } from '../../icons/wrap';
import {
  getEditorIndentUiState,
  applyEditorIndentIncrease,
  applyEditorIndentDecrease,
} from './blockIndent';
import './SelectionBubble.less';
import { openCommentSidebarForEditorSelection } from './commentBlockAnchor';
import { resolveTableHostFromEditor } from './tableDom';
import { getActiveTableSelectionContext } from './tableInsert';
import { getActiveTableFlags } from './tableMenu';
import {
  insertTableColumn,
  insertTableRow,
  mergeOrSplitSelectedCells,
  removeSelectedTableColumn,
  removeSelectedTableRow,
  setHeadingLevel,
  setSelectedTableCellBackground,
  setTextAlignment,
  toggleBlockStyle,
  toggleTableHeaderColumn,
  toggleTableHeaderRow,
  distributeSelectedTableColumns,
  removeActiveTable,
} from './panelActions';

const IndentRight = wrapIcon(IndentRightIcon);
const IndentLeft = wrapIcon(IndentLeftIcon);
const SUBMENU_ICON_STROKE = { strokeWidth: 2.75 as const };

const GLYPH = 16;
const GLYPH_SM = 10;
const STYLE_ICON = 17;
const ICON_MUTED = '#646a73';
const PRIMARY = FEISHU_TOOLBOX.b500;
const TINT_LIST = FEISHU_TOOLBOX.i500;
const TINT_CODE = FEISHU_TOOLBOX.g500;
const TINT_HI = FEISHU_TOOLBOX.o500;
const TINT_SYNC = FEISHU_TOOLBOX.n1;

const TABLE_CELL_COLORS = [
  { label: '默认', value: null, color: '#ffffff', border: '#dee0e3' },
  { label: '浅红', value: '#ffccc7', color: '#ffccc7', border: '#ffccc7' },
  { label: '浅橙', value: '#ffe7ba', color: '#ffe7ba', border: '#ffe7ba' },
  { label: '浅黄', value: '#fff1b8', color: '#fff1b8', border: '#fff1b8' },
  { label: '浅绿', value: '#d9f7be', color: '#d9f7be', border: '#d9f7be' },
  { label: '浅蓝', value: '#bae7ff', color: '#bae7ff', border: '#bae7ff' },
  { label: '浅紫', value: '#efdbff', color: '#efdbff', border: '#efdbff' },
  { label: '浅灰', value: '#f5f5f5', color: '#f5f5f5', border: '#f5f5f5' },
];

function StyleMenuRow({
  icon,
  active,
  tag,
  label,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  active: boolean;
  tag?: string;
  label: string;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  const end = trailing !== undefined ? trailing : active ? <span className="selection-bubble-style-check" aria-hidden>✓</span> : null;
  return (
    <button
      type="button"
      className={`selection-bubble-style-row ${active ? 'selection-bubble-style-row--active' : ''}`}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      <span className="selection-bubble-style-icon" aria-hidden>
        {icon}
      </span>
      <span className="selection-bubble-style-text">
        {tag ? <span className="selection-bubble-style-tag">{tag}</span> : null}
        <span className="selection-bubble-style-label">{label}</span>
      </span>
      {end}
    </button>
  );
}

const ALIGN_OPTIONS: { key: 'left' | 'center' | 'right'; label: string }[] = [
  { key: 'left', label: '左对齐' },
  { key: 'center', label: '居中对齐' },
  { key: 'right', label: '右对齐' },
];

interface SelectionBubbleProps {
  editor: Editor;
  /** 与路由文档 id 一致，避免仅靠 editor.__documentId 时出现未挂载导致评论无响应 */
  documentId: string;
}

function shouldShowBubble({
  editor,
  element,
  view,
  state,
  from,
  to,
}: {
  editor: Editor;
  element: HTMLElement;
  view: EditorView;
  state: EditorState;
  from: number;
  to: number;
}) {
  const { doc, selection } = state;
  const { empty } = selection;
  const isCellSelection = selection instanceof CellSelection;
  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(selection);
  const isChildOfMenu = element.contains(document.activeElement);
  const hasEditorFocus = view.hasFocus() || isChildOfMenu;

  if ((!isCellSelection && !hasEditorFocus) || (!isCellSelection && empty) || isEmptyTextBlock || !editor.isEditable) {
    return false;
  }
  if (document.querySelector('.context-menu')) return false;
  if (document.querySelector('.slash-menu')) return false;
  if (editor.isActive('codeBlock')) return false;
  if (isImageBlockActive(editor)) return false;
  return true;
}

function copySelectedPlainText(editor: Editor) {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, '\n');
  void navigator.clipboard?.writeText(text);
}

/** 气泡「块类型」触发器：列表先于内层 paragraph，避免列表内仍显示正文图标 */
function resolveBlockStyleTrigger(editor: Editor): { icon: ReactNode; label: string } {
  for (let i = 1; i <= 6; i++) {
    if (!editor.isActive('heading', { level: i })) continue;
    if (i === 1)
      return { icon: <SlashGlyphHeading1 size={GLYPH} fill={PRIMARY} />, label: 'H1' };
    if (i === 2)
      return { icon: <SlashGlyphHeading2 size={GLYPH} fill={PRIMARY} />, label: 'H2' };
    if (i === 3)
      return { icon: <SlashGlyphHeading3 size={GLYPH} fill={PRIMARY} />, label: 'H3' };
    return { icon: <SlashGlyphHeading3 size={GLYPH} fill={PRIMARY} />, label: `H${i}` };
  }

  if (editor.isActive('blockquote')) {
    return { icon: <SlashGlyphQuote size={GLYPH} fill={PRIMARY} />, label: '引用' };
  }
  if (editor.isActive('taskList')) {
    return { icon: <SlashGlyphTaskList size={GLYPH} fill={PRIMARY} />, label: '任务' };
  }
  if (editor.isActive('orderedList')) {
    return { icon: <SlashGlyphOrderedList size={GLYPH} fill={PRIMARY} />, label: '有序列表' };
  }
  if (editor.isActive('bulletList')) {
    return { icon: <SlashGlyphBulletList size={GLYPH} fill={PRIMARY} />, label: '无序列表' };
  }
  if (editor.isActive('highlightBlock')) {
    return { icon: <SlashGlyphHighlight size={GLYPH} fill={PRIMARY} />, label: '高亮块' };
  }
  if (editor.isActive('paragraph')) {
    return { icon: <ContextGlyphText size={GLYPH} fill={PRIMARY} />, label: '正文' };
  }

  return { icon: <ContextGlyphText size={GLYPH} fill={ICON_MUTED} />, label: '正文' };
}

function resolveTableCellElement(view: EditorView, cellPos: number): HTMLElement | null {
  try {
    const dom = view.domAtPos(cellPos + 1);
    let node: Node | null = dom.node;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    return node instanceof Element ? (node.closest('td, th') as HTMLElement | null) : null;
  } catch {
    return null;
  }
}

interface TableBubbleAnchor {
  placement: 'top' | 'top-start' | 'bottom' | 'right';
  offset: [number, number];
  getRect: (() => DOMRect | null) | null;
}

function resolveTableHostElement(cellEl: HTMLElement): HTMLElement | null {
  return cellEl.closest('.feishu-table-host') as HTMLElement | null;
}

const TABLE_CHROME_GUTTER = 28;

/** 功能面板锚在块柄上方，避免遮挡列/行选择触发区（对齐飞书图三） */
function resolveTableHandleAnchorRect(tableHost: HTMLElement | null): DOMRect {
  if (tableHost) {
    const handle = tableHost.querySelector('.feishu-table-chrome__handle');
    if (handle instanceof HTMLElement) {
      const handleRect = handle.getBoundingClientRect();
      if (handleRect.width > 0 && handleRect.height > 0) {
        return new DOMRect(handleRect.left, handleRect.top, handleRect.width, handleRect.height);
      }
    }
    const hostRect = tableHost.getBoundingClientRect();
    return new DOMRect(hostRect.left, hostRect.top - TABLE_CHROME_GUTTER, 2, 2);
  }
  return new DOMRect(0, 0, 2, 2);
}

function resolveSelectedTableCellsRect(tableHost: HTMLElement | null, fallbackA: HTMLElement, fallbackB: HTMLElement): DOMRect {
  const selectedCells = tableHost
    ? Array.from(tableHost.querySelectorAll('td.selectedCell, th.selectedCell, td.feishu-table__cell--rail-selected, th.feishu-table__cell--rail-selected, [data-feishu-rail-selected="true"]'))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
    : [];
  const cells = selectedCells.length > 0 ? selectedCells : [fallbackA, fallbackB];
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  cells.forEach(cell => {
    const rect = cell.getBoundingClientRect();
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  });
  if (!Number.isFinite(left) || !Number.isFinite(top)) return fallbackA.getBoundingClientRect();
  return new DOMRect(left, top, Math.max(2, right - left), Math.max(2, bottom - top));
}

function resolveTableBubbleAnchor(editor: Editor): TableBubbleAnchor {
  const { selection } = editor.state;
  if (!(selection instanceof CellSelection)) {
    return { placement: 'top', offset: [0, 12], getRect: null };
  }

  const view = editor.view;
  const anchorEl = resolveTableCellElement(view, selection.$anchorCell.pos);
  const headEl = resolveTableCellElement(view, selection.$headCell.pos);
  if (!anchorEl?.isConnected || !headEl?.isConnected) {
    return { placement: 'top', offset: [0, 12], getRect: null };
  }

  const tableHost = resolveTableHostElement(anchorEl);

  if (selection.isColSelection()) {
    return {
      placement: 'top-start',
      offset: [0, 14],
      getRect: () => resolveSelectedTableCellsRect(tableHost, anchorEl, headEl),
    };
  }

  if (selection.isRowSelection()) {
    return {
      placement: 'top-start',
      offset: [0, 14],
      getRect: () => resolveSelectedTableCellsRect(tableHost, anchorEl, headEl),
    };
  }

  return {
    placement: 'top',
    offset: [0, 12],
    getRect: () => resolveSelectedTableCellsRect(tableHost, anchorEl, headEl),
  };
}

export default function SelectionBubble({ editor, documentId }: SelectionBubbleProps) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showTableCellColorMenu, setShowTableCellColorMenu] = useState(false);
  const [showTableOptions, setShowTableOptions] = useState(false);
  const [showTableInsert, setShowTableInsert] = useState(false);
  const [showTableDelete, setShowTableDelete] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const headingRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const tableCellColorRef = useRef<HTMLDivElement>(null);
  const tableOptionsRef = useRef<HTMLDivElement>(null);
  const tableInsertRef = useRef<HTMLDivElement>(null);
  const tableDeleteRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const moreHeadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCellSelectionRef = useRef<CellSelection | null>(null);
  const [showHeadingMoreFlyout, setShowHeadingMoreFlyout] = useState(false);

  const cancelMoreHeadingClose = useCallback(() => {
    if (moreHeadingTimerRef.current) {
      clearTimeout(moreHeadingTimerRef.current);
      moreHeadingTimerRef.current = null;
    }
  }, []);

  const scheduleMoreHeadingClose = useCallback(() => {
    cancelMoreHeadingClose();
    moreHeadingTimerRef.current = window.setTimeout(() => setShowHeadingMoreFlyout(false), 220);
  }, [cancelMoreHeadingClose]);

  useEffect(() => {
    const onSel = () => {
      if (editor.state.selection instanceof CellSelection) {
        lastCellSelectionRef.current = editor.state.selection;
      }
      refresh();
    };
    editor.on('selectionUpdate', onSel);
    editor.on('transaction', onSel);
    return () => {
      editor.off('selectionUpdate', onSel);
      editor.off('transaction', onSel);
    };
  }, [editor]);

  const runWithCellSelection = useCallback((action: () => void) => {
    const saved = lastCellSelectionRef.current;
    if (saved && !(editor.state.selection instanceof CellSelection)) {
      try {
        editor.view.dispatch(editor.state.tr.setSelection(saved));
      } catch {
        lastCellSelectionRef.current = null;
      }
    }
    editor.view.focus();
    action();
  }, [editor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (headingRef.current && !headingRef.current.contains(t)) {
        cancelMoreHeadingClose();
        setShowHeadingMoreFlyout(false);
        setShowHeadingMenu(false);
      }
      if (alignRef.current && !alignRef.current.contains(t)) setShowAlignMenu(false);
      if (moreRef.current && !moreRef.current.contains(t)) setShowMoreMenu(false);
      if (colorRef.current && !colorRef.current.contains(t)) setShowColorMenu(false);
      if (tableCellColorRef.current && !tableCellColorRef.current.contains(t)) setShowTableCellColorMenu(false);
      if (tableOptionsRef.current && !tableOptionsRef.current.contains(t)) setShowTableOptions(false);
      if (tableInsertRef.current && !tableInsertRef.current.contains(t)) setShowTableInsert(false);
      if (tableDeleteRef.current && !tableDeleteRef.current.contains(t)) setShowTableDelete(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cancelMoreHeadingClose]);

  useEffect(
    () => () => {
      cancelMoreHeadingClose();
    },
    [cancelMoreHeadingClose],
  );

  const blockStyleTrigger = resolveBlockStyleTrigger(editor);

  const closeHeadingStylePanel = () => {
    cancelMoreHeadingClose();
    setShowHeadingMoreFlyout(false);
    setShowHeadingMenu(false);
  };

  const setHeading = (level: number) => {
    setHeadingLevel(editor, level);
    closeHeadingStylePanel();
  };

  const headingMoreActive =
    editor.isActive('heading', { level: 4 })
    || editor.isActive('heading', { level: 5 })
    || editor.isActive('heading', { level: 6 });

  const setLink = () => {
    const href = linkUrl.trim();
    const text = linkText.trim();
    if (!href) return;
    if (text) {
      editor.chain().focus().deleteSelection().insertContent({
        type: 'text',
        text,
        marks: [{ type: 'link', attrs: { href } }],
      }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setShowLinkInput(false);
    setLinkText('');
    setLinkUrl('');
  };

  const handleLinkClick = () => {
    const existingHref = editor.getAttributes('link').href as string | undefined;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    setLinkText(selectedText);
    if (existingHref) setLinkUrl(existingHref);
    else setLinkUrl('');
    setShowLinkInput(!showLinkInput);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  };

  const currentAlign =
    (editor.getAttributes('paragraph').textAlign as string | undefined)
    ?? (editor.getAttributes('heading').textAlign as string | undefined)
    ?? 'left';

  const indentUi = getEditorIndentUiState(editor);
  const isTableSelection = editor.isActive('table') || editor.state.selection instanceof CellSelection;
  const canMergeCells = editor.can().mergeCells();
  const canSplitCell = editor.can().splitCell();
  const tableSelectionContext = isTableSelection ? getActiveTableSelectionContext(editor) : null;
  const canDeleteTableColumn = Boolean(tableSelectionContext);
  const canDeleteTableRow = Boolean(tableSelectionContext);
  const tableBubbleAnchor = resolveTableBubbleAnchor(editor);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="selectionBubbleMenu"
      className="selection-bubble"
      updateDelay={100}
      shouldShow={props => shouldShowBubble(props)}
      tippyOptions={{
        placement: tableBubbleAnchor.placement,
        duration: [120, 80],
        zIndex: 260,
        offset: tableBubbleAnchor.offset,
        moveTransition: 'transform 0.15s ease-out',
        maxWidth: 'none',
        appendTo: () => {
          const tableHost = resolveTableHostFromEditor(editor);
          return tableHost || editor.view.dom.parentElement || document.body;
        },
        ...(tableBubbleAnchor.getRect
          ? {
              getReferenceClientRect: () => {
                const rect = tableBubbleAnchor.getRect?.();
                if (rect) return rect;
                return editor.view.dom.getBoundingClientRect();
              },
            }
          : {}),
      }}
    >
      <div
        className="selection-bubble-inner"
        role="toolbar"
        aria-label="选区格式"
        data-floating-panel="true"
        data-no-marquee-selection="true"
      >
        {isTableSelection && (
          <>
            <button
              type="button"
              className="selection-bubble-btn"
              data-table-toolbar-action="merge-split"
              disabled={!canMergeCells && !canSplitCell}
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => mergeOrSplitSelectedCells(editor))}
              title={canSplitCell ? '拆分单元格' : '合并单元格'}
            >
              <SelGlyphTableMerge size={GLYPH} />
            </button>
            <div className="selection-bubble-dropdown" ref={tableCellColorRef}>
              <button
                type="button"
                className="selection-bubble-btn"
                data-table-toolbar-action="cell-background"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowTableCellColorMenu(!showTableCellColorMenu)}
                title="单元格背景色"
              >
                <SelGlyphTableCellBg size={GLYPH} />
              </button>
              {showTableCellColorMenu && (
                <div className="selection-bubble-menu selection-bubble-menu--table-color">
                  <div className="selection-bubble-table-color-title">单元格背景颜色</div>
                  <div className="selection-bubble-table-color-grid">
                    {TABLE_CELL_COLORS.map(c => (
                      <button
                        key={c.label}
                        type="button"
                        className="selection-bubble-table-color-cell"
                        data-table-cell-bg-color={c.value ?? 'default'}
                        style={{ background: c.color, borderColor: c.border }}
                        title={c.label}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          runWithCellSelection(() => setSelectedTableCellBackground(editor, c.value));
                          setShowTableCellColorMenu(false);
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="selection-bubble-table-color-reset"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => setSelectedTableCellBackground(editor, null));
                      setShowTableCellColorMenu(false);
                    }}
                  >
                    恢复默认
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        <div className="selection-bubble-group selection-bubble-group--main">
          <div className="selection-bubble-dropdown" ref={headingRef}>
            <button
              type="button"
              className="selection-bubble-submenu selection-bubble-heading-trigger"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
              title={blockStyleTrigger.label}
            >
              <span className="selection-bubble-heading-icon selection-bubble-color-b500" aria-hidden>
                {blockStyleTrigger.icon}
              </span>
              <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron" />
            </button>
            {showHeadingMenu && (
              <div
                className="selection-bubble-menu selection-bubble-menu--block-style"
                onMouseDown={e => e.preventDefault()}
              >
                <StyleMenuRow
                  icon={<ContextGlyphText size={STYLE_ICON} fill={ICON_MUTED} />}
                  active={editor.isActive('paragraph')}
                  label="正文"
                  onClick={() => setHeading(0)}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphHeading1
                      size={STYLE_ICON}
                      fill={editor.isActive('heading', { level: 1 }) ? PRIMARY : ICON_MUTED}
                    />
                  }
                  active={editor.isActive('heading', { level: 1 })}
                  tag="H1"
                  label="一级标题"
                  onClick={() => setHeading(1)}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphHeading2
                      size={STYLE_ICON}
                      fill={editor.isActive('heading', { level: 2 }) ? PRIMARY : ICON_MUTED}
                    />
                  }
                  active={editor.isActive('heading', { level: 2 })}
                  tag="H2"
                  label="二级标题"
                  onClick={() => setHeading(2)}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphHeading3
                      size={STYLE_ICON}
                      fill={editor.isActive('heading', { level: 3 }) ? PRIMARY : ICON_MUTED}
                    />
                  }
                  active={editor.isActive('heading', { level: 3 })}
                  tag="H3"
                  label="三级标题"
                  onClick={() => setHeading(3)}
                />

                <div
                  className="selection-bubble-style-more-wrap"
                  onMouseEnter={() => {
                    cancelMoreHeadingClose();
                    setShowHeadingMoreFlyout(true);
                  }}
                  onMouseLeave={scheduleMoreHeadingClose}
                >
                  <div
                    role="presentation"
                    className={`selection-bubble-style-row selection-bubble-style-row--trigger${headingMoreActive ? ' selection-bubble-style-row--sub-active' : ''}`}
                  >
                    <span className="selection-bubble-style-icon" aria-hidden>
                      <SlashGlyphHeading3 size={STYLE_ICON} fill={ICON_MUTED} />
                    </span>
                    <span className="selection-bubble-style-text">
                      <span className="selection-bubble-style-tag selection-bubble-style-tag--muted">Hn</span>
                      <span className="selection-bubble-style-label">其他标题</span>
                    </span>
                    <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron-right" />
                  </div>
                  {showHeadingMoreFlyout && (
                    <div
                      className="selection-bubble-style-more-flyout"
                      onMouseEnter={() => {
                        cancelMoreHeadingClose();
                        setShowHeadingMoreFlyout(true);
                      }}
                      onMouseLeave={scheduleMoreHeadingClose}
                    >
                      <StyleMenuRow
                        icon={
                          <SlashGlyphHeading4
                            size={STYLE_ICON}
                            fill={editor.isActive('heading', { level: 4 }) ? PRIMARY : ICON_MUTED}
                          />
                        }
                        active={editor.isActive('heading', { level: 4 })}
                        tag="H4"
                        label="四级标题"
                        onClick={() => setHeading(4)}
                      />
                      <StyleMenuRow
                        icon={
                          <SlashGlyphHeading5
                            size={STYLE_ICON}
                            fill={editor.isActive('heading', { level: 5 }) ? PRIMARY : ICON_MUTED}
                          />
                        }
                        active={editor.isActive('heading', { level: 5 })}
                        tag="H5"
                        label="五级标题"
                        onClick={() => setHeading(5)}
                      />
                      <StyleMenuRow
                        icon={
                          <SlashGlyphHeading6
                            size={STYLE_ICON}
                            fill={editor.isActive('heading', { level: 6 }) ? PRIMARY : ICON_MUTED}
                          />
                        }
                        active={editor.isActive('heading', { level: 6 })}
                        tag="H6"
                        label="六级标题"
                        onClick={() => setHeading(6)}
                      />
                    </div>
                  )}
                </div>

                <div className="selection-bubble-menu-divider" role="presentation" />

                <StyleMenuRow
                  icon={
                    <SlashGlyphOrderedList
                      size={STYLE_ICON}
                      fill={editor.isActive('orderedList') ? PRIMARY : TINT_LIST}
                    />
                  }
                  active={editor.isActive('orderedList')}
                  label="有序列表"
                  onClick={() => {
                    toggleBlockStyle(editor, 'orderedList');
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphBulletList
                      size={STYLE_ICON}
                      fill={editor.isActive('bulletList') ? PRIMARY : TINT_LIST}
                    />
                  }
                  active={editor.isActive('bulletList')}
                  label="无序列表"
                  onClick={() => {
                    toggleBlockStyle(editor, 'bulletList');
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphTaskList
                      size={STYLE_ICON}
                      fill={editor.isActive('taskList') ? PRIMARY : TINT_LIST}
                    />
                  }
                  active={editor.isActive('taskList')}
                  label="任务"
                  onClick={() => {
                    toggleBlockStyle(editor, 'taskList');
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={
                    <SlashGlyphCode
                      size={STYLE_ICON}
                      fill={editor.isActive('codeBlock') ? PRIMARY : TINT_CODE}
                    />
                  }
                  active={editor.isActive('codeBlock')}
                  label="代码块"
                  onClick={() => {
                    toggleBlockStyle(editor, 'codeBlock');
                    closeHeadingStylePanel();
                  }}
                />

                <div className="selection-bubble-menu-divider" role="presentation" />

                <StyleMenuRow
                  icon={
                    <SlashGlyphQuote size={STYLE_ICON} fill={editor.isActive('blockquote') ? PRIMARY : ICON_MUTED} />
                  }
                  active={editor.isActive('blockquote')}
                  label="引用"
                  onClick={() => {
                    toggleBlockStyle(editor, 'blockquote');
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={<SlashGlyphHighlight size={STYLE_ICON} fill={editor.isActive('highlightBlock') ? PRIMARY : TINT_HI} />}
                  active={editor.isActive('highlightBlock')}
                  label="高亮块"
                  onClick={() => {
                    toggleBlockStyle(editor, 'highlightBlock');
                    closeHeadingStylePanel();
                  }}
                />
                <StyleMenuRow
                  icon={<SlashGlyphSyncMuted size={STYLE_ICON} fill={TINT_SYNC} />}
                  active={false}
                  label="同步块"
                  trailing={null}
                  onClick={() => {
                    closeHeadingStylePanel();
                  }}
                />
              </div>
            )}
          </div>

          <span className="selection-bubble-divider selection-bubble-divider--thin" aria-hidden />

          <div className="selection-bubble-dropdown" ref={alignRef}>
            <button
              type="button"
              className="selection-bubble-submenu selection-bubble-align-trigger"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowAlignMenu(!showAlignMenu)}
              title="对齐"
            >
              <SelGlyphTypography size={GLYPH} />
              <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron" />
            </button>
            {showAlignMenu && (
              <div className="selection-bubble-menu selection-bubble-menu--align">
                {ALIGN_OPTIONS.map(a => (
                  <button
                    key={a.key}
                    type="button"
                    className={`selection-bubble-menu-item ${currentAlign === a.key ? 'active' : ''}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      if (editor.state.selection instanceof CellSelection || lastCellSelectionRef.current) {
                        runWithCellSelection(() => setTextAlignment(editor, a.key));
                      } else {
                        setTextAlignment(editor, a.key);
                      }
                      setShowAlignMenu(false);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
                <div className="selection-bubble-menu-divider" aria-hidden />
                <button
                  type="button"
                  className="selection-bubble-indent-row"
                  disabled={!indentUi.canIncrease}
                  title={!indentUi.canIncrease ? indentUi.increaseDisabledTitle : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    if (!indentUi.canIncrease) return;
                    applyEditorIndentIncrease(editor);
                    setShowAlignMenu(false);
                  }}
                >
                  <span className="selection-bubble-indent-row-icon" aria-hidden>
                    <IndentRight
                      {...SUBMENU_ICON_STROKE}
                      size={16}
                      fill={!indentUi.canIncrease ? '#c5c9ce' : ICON_MUTED}
                    />
                  </span>
                  <span className="selection-bubble-indent-row-label">增加缩进</span>
                </button>
                <button
                  type="button"
                  className="selection-bubble-indent-row"
                  disabled={!indentUi.canDecrease}
                  title={!indentUi.canDecrease ? indentUi.decreaseDisabledTitle : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    if (!indentUi.canDecrease) return;
                    applyEditorIndentDecrease(editor);
                    setShowAlignMenu(false);
                  }}
                >
                  <span className="selection-bubble-indent-row-icon" aria-hidden>
                    <IndentLeft
                      {...SUBMENU_ICON_STROKE}
                      size={16}
                      fill={!indentUi.canDecrease ? '#c5c9ce' : ICON_MUTED}
                    />
                  </span>
                  <span className="selection-bubble-indent-row-label">减少缩进</span>
                </button>
              </div>
            )}
          </div>

          <span className="selection-bubble-divider selection-bubble-divider--thin" aria-hidden />

          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
            data-selection-action="bold"
            onMouseDown={e => e.preventDefault()}
            onClick={() => runWithCellSelection(() => editor.chain().focus().toggleBold().run())}
            title="粗体"
          >
            <SelGlyphBold size={GLYPH} />
          </button>
          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
            data-selection-action="strike"
            onMouseDown={e => e.preventDefault()}
            onClick={() => runWithCellSelection(() => editor.chain().focus().toggleStrike().run())}
            title="删除线"
          >
            <SelGlyphStrike size={GLYPH} />
          </button>
          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
            data-selection-action="italic"
            onMouseDown={e => e.preventDefault()}
            onClick={() => runWithCellSelection(() => editor.chain().focus().toggleItalic().run())}
            title="斜体"
          >
            <SelGlyphItalic size={GLYPH} />
          </button>
          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('underline') ? 'active' : ''}`}
            data-selection-action="underline"
            onMouseDown={e => e.preventDefault()}
            onClick={() => runWithCellSelection(() => editor.chain().focus().toggleUnderline().run())}
            title="下划线"
          >
            <SelGlyphUnderline size={GLYPH} />
          </button>

          {!isTableSelection && <div className="selection-bubble-dropdown selection-bubble-dropdown--link">
            <button
              type="button"
              className={`selection-bubble-btn ${editor.isActive('link') ? 'selection-bubble-btn--brand active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={handleLinkClick}
              title="链接"
            >
              <SelGlyphLink size={GLYPH} className={editor.isActive('link') ? 'selection-bubble-link-glyph' : undefined} />
            </button>
            {showLinkInput && (
              <div className="selection-bubble-link-pop">
                <div className="selection-bubble-link-form">
                  <label className="selection-bubble-link-row">
                    <span className="selection-bubble-link-label">文本</span>
                    <input
                      ref={linkInputRef}
                      type="text"
                      placeholder="输入文本"
                      value={linkText}
                      onChange={e => setLinkText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') setLink();
                        if (e.key === 'Escape') {
                          setShowLinkInput(false);
                          setLinkText('');
                          setLinkUrl('');
                        }
                      }}
                    />
                  </label>
                  <label className="selection-bubble-link-row">
                    <span className="selection-bubble-link-label">链接</span>
                    <input
                      type="url"
                      placeholder="粘贴或输入链接"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') setLink();
                        if (e.key === 'Escape') {
                          setShowLinkInput(false);
                          setLinkText('');
                          setLinkUrl('');
                        }
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="selection-bubble-link-ok"
                  disabled={!linkUrl.trim()}
                  onMouseDown={e => e.preventDefault()}
                  onClick={setLink}
                >
                  确定
                </button>
              </div>
            )}
          </div>}

          <button
            type="button"
            className={`selection-bubble-btn ${editor.isActive('code') ? 'active' : ''}`}
            data-selection-action="inline-code"
            onMouseDown={e => e.preventDefault()}
            onClick={() => runWithCellSelection(() => editor.chain().focus().toggleCode().run())}
            title="行内代码"
          >
            <SelGlyphCode size={GLYPH} />
          </button>

          <div className="selection-bubble-dropdown" ref={colorRef}>
            <button
              type="button"
              className="selection-bubble-submenu selection-bubble-color-trigger"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowColorMenu(!showColorMenu)}
              title="文字与背景色"
            >
              <span className="selection-bubble-fontcolor-chip" aria-hidden>
                <SelGlyphFontColor size={GLYPH} />
              </span>
              <SelGlyphChevronDown size={GLYPH_SM} className="selection-bubble-chevron" />
            </button>
            {showColorMenu && (
              <div className="selection-bubble-menu selection-bubble-menu--color">
                <FeishuColorPickerPanel editor={editor} onAfterPick={() => setShowColorMenu(false)} />
              </div>
            )}
          </div>
        </div>

        {isTableSelection && (
          <>
            <span className="selection-bubble-divider selection-bubble-divider--thin" aria-hidden />
            <div className="selection-bubble-dropdown" ref={tableOptionsRef}>
              <button
                type="button"
                className={`selection-bubble-btn ${showTableOptions ? 'active' : ''}`}
                data-table-toolbar-action="table-options"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowTableOptions(!showTableOptions)}
                title="表格配置"
              >
                <SelGlyphTableGrid size={GLYPH} />
              </button>
              {showTableOptions && (
                <div className="selection-bubble-menu">
                  <button
                    type="button"
                    className={`selection-bubble-menu-item selection-bubble-menu-item--toggle ${
                      getActiveTableFlags(editor).hasHeaderRow ? 'active' : ''
                    }`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      toggleTableHeaderRow(editor);
                      setShowTableOptions(false);
                    }}
                  >
                    <span>标题行</span>
                    <span
                      className={`selection-bubble-menu-item-switch${
                        getActiveTableFlags(editor).hasHeaderRow ? ' is-on' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    className={`selection-bubble-menu-item selection-bubble-menu-item--toggle ${
                      getActiveTableFlags(editor).hasHeaderCol ? 'active' : ''
                    }`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      toggleTableHeaderColumn(editor);
                      setShowTableOptions(false);
                    }}
                  >
                    <span>标题列</span>
                    <span
                      className={`selection-bubble-menu-item-switch${
                        getActiveTableFlags(editor).hasHeaderCol ? ' is-on' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => distributeSelectedTableColumns(editor));
                      setShowTableOptions(false);
                    }}
                  >
                    均分列宽
                  </button>
                </div>
              )}
            </div>
            <div className="selection-bubble-dropdown" ref={tableInsertRef}>
              <button
                type="button"
                className={`selection-bubble-btn ${showTableInsert ? 'active' : ''}`}
                data-table-toolbar-action="insert"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowTableInsert(!showTableInsert)}
                title="插入行列"
              >
                <SelGlyphTableInsert size={GLYPH} />
              </button>
              {showTableInsert && (
                <div className="selection-bubble-menu">
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => insertTableColumn(editor, 'before'));
                      setShowTableInsert(false);
                    }}
                  >
                    左侧插入列
                  </button>
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => insertTableColumn(editor, 'after'));
                      setShowTableInsert(false);
                    }}
                  >
                    右侧插入列
                  </button>
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => insertTableRow(editor, 'before'));
                      setShowTableInsert(false);
                    }}
                  >
                    上方插入行
                  </button>
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => insertTableRow(editor, 'after'));
                      setShowTableInsert(false);
                    }}
                  >
                    下方插入行
                  </button>
                </div>
              )}
            </div>
            <div className="selection-bubble-dropdown" ref={tableDeleteRef}>
              <button
                type="button"
                className={`selection-bubble-btn ${showTableDelete ? 'active' : ''}`}
                data-table-toolbar-action="delete"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowTableDelete(!showTableDelete)}
                title="删除"
              >
                <SelGlyphDelete size={GLYPH} />
              </button>
              {showTableDelete && (
                <div className="selection-bubble-menu selection-bubble-menu--more">
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => removeSelectedTableColumn(editor));
                      setShowTableDelete(false);
                    }}
                  >
                    删除当前列
                  </button>
                  <button
                    type="button"
                    className="selection-bubble-menu-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => removeSelectedTableRow(editor));
                      setShowTableDelete(false);
                    }}
                  >
                    删除当前行
                  </button>
                  <button
                    type="button"
                    className="selection-bubble-menu-item context-menu-item--danger"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      runWithCellSelection(() => removeActiveTable(editor));
                      setShowTableDelete(false);
                    }}
                  >
                    删除表格
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {!isTableSelection && (
          <>
            <span className="selection-bubble-divider selection-bubble-divider--section" aria-hidden />
            <div className="selection-bubble-group selection-bubble-group--extra">
              <div className="selection-bubble-dropdown" ref={moreRef}>
                <button
                  type="button"
                  className="selection-bubble-btn selection-bubble-btn--icon-quiet"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  title="更多"
                >
                  <SelGlyphToolbarMore size={GLYPH} />
                </button>
                {showMoreMenu && (
                  <div className="selection-bubble-menu selection-bubble-menu--more">
                    <button
                      type="button"
                      className="selection-bubble-menu-item"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        copySelectedPlainText(editor);
                        setShowMoreMenu(false);
                      }}
                    >
                      复制选中文本
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="selection-bubble-btn selection-bubble-btn--brand-outline"
                onMouseDown={e => e.preventDefault()}
                onClick={() => copySelectedPlainText(editor)}
                title="分享 / 复制文本"
              >
                <SelGlyphShare size={GLYPH} />
              </button>

              <button
                type="button"
                className="selection-bubble-btn selection-bubble-btn--icon-quiet"
                onMouseDown={e => {
                  e.preventDefault();
                  openCommentSidebarForEditorSelection(editor, documentId);
                }}
                title="评论"
              >
                <SelGlyphComment size={GLYPH} />
              </button>
            </div>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
