import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { CellSelection } from '@tiptap/pm/tables';
import { IndentLeftIcon, IndentRightIcon } from 'tdesign-icons-react';
import { ContextGlyphText, FEISHU_TOOLBOX } from '../../../icons/contextMenuGlyphs';
import {
  SlashGlyphBulletList,
  SlashGlyphHeading1,
  SlashGlyphHeading2,
  SlashGlyphHeading3,
  SlashGlyphOrderedList,
  SlashGlyphTaskList,
} from '../../../icons/slashMenuGlyphs';
import {
  SelGlyphBold,
  SelGlyphChevronDown,
  SelGlyphCode,
  SelGlyphDelete,
  SelGlyphFontColor,
  SelGlyphItalic,
  SelGlyphShare,
  SelGlyphStrike,
  SelGlyphTableCellBg,
  SelGlyphTableMerge,
  SelGlyphText,
  SelGlyphToolbarMore,
  SelGlyphTypography,
  SelGlyphUnderline,
} from '../../../icons/selectionToolbarGlyphs';
import { wrapIcon } from '../../../icons/wrap';
import {
  getEditorIndentUiState,
  applyEditorIndentDecrease,
  applyEditorIndentIncrease,
} from '../blocks/blockIndent';
import FeishuColorPickerPanel from '../panels/FeishuColorPickerPanel';
import { getActiveTableFlags } from '../tables/tableMenu';
import {
  copySelectedPlainText,
  distributeSelectedTableColumns,
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
} from '../panels/panelActions';
import type { TableRailPin } from '../tables/tableDom';

const IndentRight = wrapIcon(IndentRightIcon);
const IndentLeft = wrapIcon(IndentLeftIcon);

const GLYPH = 16;
const GLYPH_SM = 10;
const STYLE_ICON = 17;
const PRIMARY = FEISHU_TOOLBOX.b500;
const ICON_MUTED = '#646a73';
const DANGER = '#f54a45';

const TABLE_CELL_COLORS = [
  { label: '默认', value: null, color: '#ffffff', border: '#dee0e3' },
  { label: '浅红', value: '#ffccc7', color: '#ffccc7', border: '#ffccc7' },
  { label: '浅橙', value: '#ffe7ba', color: '#ffe7ba', border: '#ffe7ba' },
  { label: '浅黄', value: '#fff1b8', color: '#fff1b8', border: '#fff1b8' },
  { label: '浅绿', value: '#d9f7be', color: '#d9f7be', border: '#d9f7be' },
  { label: '浅蓝', value: '#bae7ff', color: '#bae7ff', border: '#bae7ff' },
  { label: '浅紫', value: '#efdbff', color: '#efdbff', border: '#efdbff' },
  { label: '浅灰', value: '#f5f5f5', color: '#f5f5f5', border: '#f5f5f5' },
] as const;

const ALIGN_OPTIONS = [
  { key: 'left' as const, label: '左对齐' },
  { key: 'center' as const, label: '居中对齐' },
  { key: 'right' as const, label: '右对齐' },
];

interface Props {
  editor: Editor;
  pinnedRail?: TableRailPin | null;
  left: number;
  top: number;
}

function StyleMenuRow({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`feishu-table-selection-toolbar__menu-item${active ? ' is-active' : ''}`}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      <span className="feishu-table-selection-toolbar__menu-icon">{icon}</span>
      <span>{label}</span>
      {active && <span className="feishu-table-selection-toolbar__menu-check" aria-hidden>✓</span>}
    </button>
  );
}

export default function TableSelectionToolbar({ editor, pinnedRail, left, top }: Props) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [showCellBgMenu, setShowCellBgMenu] = useState(false);
  const [showTurnIntoMenu, setShowTurnIntoMenu] = useState(false);
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const cellBgRef = useRef<HTMLDivElement>(null);
  const turnIntoRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const lastCellSelectionRef = useRef<CellSelection | null>(null);

  useEffect(() => {
    const onUpdate = () => {
      if (editor.state.selection instanceof CellSelection) {
        lastCellSelectionRef.current = editor.state.selection;
      }
      refresh();
    };
    editor.on('selectionUpdate', onUpdate);
    editor.on('transaction', onUpdate);
    return () => {
      editor.off('selectionUpdate', onUpdate);
      editor.off('transaction', onUpdate);
    };
  }, [editor]);

  const closeAllMenus = useCallback(() => {
    setShowCellBgMenu(false);
    setShowTurnIntoMenu(false);
    setShowAlignMenu(false);
    setShowColorMenu(false);
    setShowMoreMenu(false);
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cellBgRef.current?.contains(t)) return;
      if (turnIntoRef.current?.contains(t)) return;
      if (alignRef.current?.contains(t)) return;
      if (colorRef.current?.contains(t)) return;
      if (moreRef.current?.contains(t)) return;
      closeAllMenus();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [closeAllMenus]);

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

  const canMergeCells = editor.can().mergeCells();
  const canSplitCell = editor.can().splitCell();
  const currentAlign =
    (editor.getAttributes('paragraph').textAlign as string | undefined)
    ?? (editor.getAttributes('heading').textAlign as string | undefined)
    ?? 'left';
  const indentUi = getEditorIndentUiState(editor);
  const tableFlags = getActiveTableFlags(editor);

  const setHeading = (level: number) => {
    runWithCellSelection(() => setHeadingLevel(editor, level));
    setShowTurnIntoMenu(false);
  };

  const toggleList = (type: 'orderedList' | 'bulletList' | 'taskList') => {
    runWithCellSelection(() => toggleBlockStyle(editor, type));
    setShowTurnIntoMenu(false);
  };

  return (
    <div
      className="feishu-table-selection-toolbar"
      data-no-marquee-selection="true"
      data-floating-panel="true"
      style={{ left, top }}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        className="feishu-table-selection-toolbar__btn"
        title={canSplitCell ? '拆分单元格' : '合并单元格'}
        disabled={!canMergeCells && !canSplitCell}
        onClick={() => runWithCellSelection(() => mergeOrSplitSelectedCells(editor))}
      >
        <SelGlyphTableMerge size={GLYPH} />
      </button>

      <span className="feishu-table-selection-toolbar__divider" aria-hidden />

      <div className="feishu-table-selection-toolbar__dropdown" ref={cellBgRef}>
        <button
          type="button"
          className={`feishu-table-selection-toolbar__submenu${showCellBgMenu ? ' is-active' : ''}`}
          title="单元格背景"
          onClick={() => {
            closeAllMenus();
            setShowCellBgMenu(v => !v);
          }}
        >
          <SelGlyphTableCellBg size={GLYPH} />
        </button>
        {showCellBgMenu && (
          <div className="feishu-table-selection-toolbar__flyout feishu-table-selection-toolbar__flyout--color">
            <div className="feishu-table-selection-toolbar__color-grid">
              {TABLE_CELL_COLORS.map(c => (
                <button
                  key={c.label}
                  type="button"
                  className="feishu-table-selection-toolbar__color-swatch"
                  title={c.label}
                  style={{ background: c.color, borderColor: c.border }}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    runWithCellSelection(() => setSelectedTableCellBackground(editor, c.value));
                    setShowCellBgMenu(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="feishu-table-selection-toolbar__divider" aria-hidden />

      <div className="feishu-table-selection-toolbar__dropdown" ref={turnIntoRef}>
        <button
          type="button"
          className={`feishu-table-selection-toolbar__submenu feishu-table-selection-toolbar__submenu--brand${showTurnIntoMenu ? ' is-active' : ''}`}
          title="转成"
          onClick={() => {
            closeAllMenus();
            setShowTurnIntoMenu(v => !v);
          }}
        >
          <span className="feishu-table-selection-toolbar__icon feishu-table-selection-toolbar__icon--brand">
            <SelGlyphText size={GLYPH} fill={PRIMARY} />
          </span>
          <SelGlyphChevronDown size={GLYPH_SM} />
        </button>
        {showTurnIntoMenu && (
          <div className="feishu-table-selection-toolbar__flyout feishu-table-selection-toolbar__flyout--style">
            <StyleMenuRow
              icon={<ContextGlyphText size={STYLE_ICON} fill={ICON_MUTED} />}
              label="正文"
              active={editor.isActive('paragraph') && !editor.isActive('heading')}
              onClick={() => setHeading(0)}
            />
            <StyleMenuRow
              icon={<SlashGlyphHeading1 size={STYLE_ICON} fill={editor.isActive('heading', { level: 1 }) ? PRIMARY : ICON_MUTED} />}
              label="一级标题"
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => setHeading(1)}
            />
            <StyleMenuRow
              icon={<SlashGlyphHeading2 size={STYLE_ICON} fill={editor.isActive('heading', { level: 2 }) ? PRIMARY : ICON_MUTED} />}
              label="二级标题"
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => setHeading(2)}
            />
            <StyleMenuRow
              icon={<SlashGlyphHeading3 size={STYLE_ICON} fill={editor.isActive('heading', { level: 3 }) ? PRIMARY : ICON_MUTED} />}
              label="三级标题"
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => setHeading(3)}
            />
            <div className="feishu-table-selection-toolbar__menu-divider" />
            <StyleMenuRow
              icon={<SlashGlyphOrderedList size={STYLE_ICON} fill={editor.isActive('orderedList') ? PRIMARY : ICON_MUTED} />}
              label="有序列表"
              active={editor.isActive('orderedList')}
              onClick={() => toggleList('orderedList')}
            />
            <StyleMenuRow
              icon={<SlashGlyphBulletList size={STYLE_ICON} fill={editor.isActive('bulletList') ? PRIMARY : ICON_MUTED} />}
              label="无序列表"
              active={editor.isActive('bulletList')}
              onClick={() => toggleList('bulletList')}
            />
            <StyleMenuRow
              icon={<SlashGlyphTaskList size={STYLE_ICON} fill={editor.isActive('taskList') ? PRIMARY : ICON_MUTED} />}
              label="任务"
              active={editor.isActive('taskList')}
              onClick={() => toggleList('taskList')}
            />
          </div>
        )}
      </div>

      <span className="feishu-table-selection-toolbar__divider" aria-hidden />

      <div className="feishu-table-selection-toolbar__dropdown" ref={alignRef}>
        <button
          type="button"
          className={`feishu-table-selection-toolbar__submenu${showAlignMenu ? ' is-active' : ''}`}
          title="对齐"
          onClick={() => {
            closeAllMenus();
            setShowAlignMenu(v => !v);
          }}
        >
          <SelGlyphTypography size={GLYPH} />
          <SelGlyphChevronDown size={GLYPH_SM} />
        </button>
        {showAlignMenu && (
          <div className="feishu-table-selection-toolbar__flyout feishu-table-selection-toolbar__flyout--align">
            {ALIGN_OPTIONS.map(a => (
              <button
                key={a.key}
                type="button"
                className={`feishu-table-selection-toolbar__menu-item${currentAlign === a.key ? ' is-active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  runWithCellSelection(() => setTextAlignment(editor, a.key));
                  setShowAlignMenu(false);
                }}
              >
                {a.label}
              </button>
            ))}
            <div className="feishu-table-selection-toolbar__menu-divider" />
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              disabled={!indentUi.canIncrease}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (!indentUi.canIncrease) return;
                runWithCellSelection(() => applyEditorIndentIncrease(editor));
                setShowAlignMenu(false);
              }}
            >
              <span className="feishu-table-selection-toolbar__menu-icon">
                <IndentRight size={16} strokeWidth={2} fill={ICON_MUTED} />
              </span>
              增加缩进
            </button>
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              disabled={!indentUi.canDecrease}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (!indentUi.canDecrease) return;
                runWithCellSelection(() => applyEditorIndentDecrease(editor));
                setShowAlignMenu(false);
              }}
            >
              <span className="feishu-table-selection-toolbar__menu-icon">
                <IndentLeft size={16} strokeWidth={2} fill={ICON_MUTED} />
              </span>
              减少缩进
            </button>
          </div>
        )}
      </div>

      <span className="feishu-table-selection-toolbar__divider" aria-hidden />

      <button
        type="button"
        className={`feishu-table-selection-toolbar__btn${editor.isActive('bold') ? ' is-active' : ''}`}
        title="加粗"
        onClick={() => runWithCellSelection(() => editor.chain().focus().toggleBold().run())}
      >
        <SelGlyphBold size={GLYPH} />
      </button>
      <button
        type="button"
        className={`feishu-table-selection-toolbar__btn${editor.isActive('strike') ? ' is-active' : ''}`}
        title="删除线"
        onClick={() => runWithCellSelection(() => editor.chain().focus().toggleStrike().run())}
      >
        <SelGlyphStrike size={GLYPH} />
      </button>
      <button
        type="button"
        className={`feishu-table-selection-toolbar__btn${editor.isActive('italic') ? ' is-active' : ''}`}
        title="斜体"
        onClick={() => runWithCellSelection(() => editor.chain().focus().toggleItalic().run())}
      >
        <SelGlyphItalic size={GLYPH} />
      </button>
      <button
        type="button"
        className={`feishu-table-selection-toolbar__btn${editor.isActive('underline') ? ' is-active' : ''}`}
        title="下划线"
        onClick={() => runWithCellSelection(() => editor.chain().focus().toggleUnderline().run())}
      >
        <SelGlyphUnderline size={GLYPH} />
      </button>
      <button
        type="button"
        className={`feishu-table-selection-toolbar__btn${editor.isActive('code') ? ' is-active' : ''}`}
        title="行内代码"
        onClick={() => runWithCellSelection(() => editor.chain().focus().toggleCode().run())}
      >
        <SelGlyphCode size={GLYPH} />
      </button>

      <div className="feishu-table-selection-toolbar__dropdown" ref={colorRef}>
        <button
          type="button"
          className={`feishu-table-selection-toolbar__submenu feishu-table-selection-toolbar__submenu--fontcolor${showColorMenu ? ' is-active' : ''}`}
          title="文字颜色"
          onClick={() => {
            closeAllMenus();
            setShowColorMenu(v => !v);
          }}
        >
          <span className="feishu-table-selection-toolbar__fontcolor-chip">
            <SelGlyphFontColor size={GLYPH} />
          </span>
          <SelGlyphChevronDown size={GLYPH_SM} />
        </button>
        {showColorMenu && (
          <div className="feishu-table-selection-toolbar__flyout feishu-table-selection-toolbar__flyout--picker">
            <FeishuColorPickerPanel
              editor={editor}
              onBeforeApply={() => {
                const saved = lastCellSelectionRef.current;
                if (saved && !(editor.state.selection instanceof CellSelection)) {
                  try {
                    editor.view.dispatch(editor.state.tr.setSelection(saved));
                  } catch {
                    lastCellSelectionRef.current = null;
                  }
                }
              }}
              onAfterPick={() => setShowColorMenu(false)}
            />
          </div>
        )}
      </div>

      <span className="feishu-table-selection-toolbar__divider feishu-table-selection-toolbar__divider--tall" aria-hidden />

      <div className="feishu-table-selection-toolbar__dropdown" ref={moreRef}>
        <button
          type="button"
          className={`feishu-table-selection-toolbar__btn${showMoreMenu ? ' is-active' : ''}`}
          title="更多"
          onClick={() => {
            closeAllMenus();
            setShowMoreMenu(v => !v);
          }}
        >
          <SelGlyphToolbarMore size={GLYPH} />
        </button>
        {showMoreMenu && (
          <div className="feishu-table-selection-toolbar__flyout feishu-table-selection-toolbar__flyout--more">
            <button
              type="button"
              className={`feishu-table-selection-toolbar__menu-item feishu-table-selection-toolbar__menu-item--toggle${tableFlags.hasHeaderRow ? ' is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => toggleTableHeaderRow(editor))}
            >
              <span>标题行</span>
              <span className={`feishu-table-selection-toolbar__switch${tableFlags.hasHeaderRow ? ' is-on' : ''}`} />
            </button>
            <button
              type="button"
              className={`feishu-table-selection-toolbar__menu-item feishu-table-selection-toolbar__menu-item--toggle${tableFlags.hasHeaderCol ? ' is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => toggleTableHeaderColumn(editor))}
            >
              <span>标题列</span>
              <span className={`feishu-table-selection-toolbar__switch${tableFlags.hasHeaderCol ? ' is-on' : ''}`} />
            </button>
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => distributeSelectedTableColumns(editor))}
            >
              均分列宽
            </button>
            <div className="feishu-table-selection-toolbar__menu-divider" />
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => insertTableColumn(editor, 'before'))}
            >
              左侧插入列
            </button>
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => insertTableColumn(editor, 'after'))}
            >
              右侧插入列
            </button>
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => insertTableRow(editor, 'before'))}
            >
              上方插入行
            </button>
            <button
              type="button"
              className="feishu-table-selection-toolbar__menu-item"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runWithCellSelection(() => insertTableRow(editor, 'after'))}
            >
              下方插入行
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="feishu-table-selection-toolbar__btn feishu-table-selection-toolbar__btn--brand"
        title="分享 / 复制文本"
        onClick={() => runWithCellSelection(() => copySelectedPlainText(editor))}
      >
        <SelGlyphShare size={GLYPH} fill={PRIMARY} />
      </button>

      {pinnedRail && (
        <>
          <span className="feishu-table-selection-toolbar__divider" aria-hidden />
          <button
            type="button"
            className="feishu-table-selection-toolbar__btn feishu-table-selection-toolbar__btn--danger"
            title={pinnedRail.kind === 'col' ? '删除列' : '删除行'}
            onClick={() => runWithCellSelection(() => {
              if (pinnedRail.kind === 'col') removeSelectedTableColumn(editor);
              else removeSelectedTableRow(editor);
            })}
          >
            <SelGlyphDelete size={GLYPH} fill={DANGER} />
          </button>
        </>
      )}
    </div>
  );
}
