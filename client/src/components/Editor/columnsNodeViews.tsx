import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconAddOutlined } from '../../icons/feishuDoc';
import SlashMenu from './SlashMenu';
import {
  buildGridTemplate,
  computeColumnPlusMenuPosition,
  computeSplitterLeft,
  focusColumnAtPos,
  focusColumnEditor,
  insertColumnAfterAt,
  isColumnBlockEmpty,
  MAX_COLUMNS_BLOCK,
  readColumnRatios,
  resizeColumnsAt,
  resolveColumnPaddingX,
  resolveColumnsGap,
} from './columnsHelpers';

const COLUMN_PLUS_OVERLAY_SELECTOR =
  '.slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .slash-columns-count-flyout, .feishu-columns-block__add-hover-wrap, .feishu-columns-block__add-btn, .feishu-columns-block__plus-menu-shell';

function isColumnPlusOverlayElement(element: Element | null): boolean {
  return Boolean(element?.closest(COLUMN_PLUS_OVERLAY_SELECTOR));
}

function getRelatedNode(target: EventTarget | null): Node | null {
  if (target instanceof Node) return target;
  return null;
}

export function ColumnBlockNodeView({ editor, getPos, node }: NodeViewProps) {
  const plusRef = useRef<HTMLButtonElement>(null);
  const columnPosRef = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);

  const closeMenu = useCallback(() => {
    cancelScheduledClose();
    setMenuOpen(false);
  }, [cancelScheduledClose]);

  const ensureColumnFocus = useCallback(() => {
    if (columnPosRef.current != null) {
      focusColumnAtPos(editor, columnPosRef.current);
      return;
    }
    focusColumnEditor(editor, getPos);
  }, [editor, getPos]);

  const openMenu = useCallback(() => {
    if (!editor.isEditable) return;
    const columnPos = typeof getPos === 'function' ? getPos() : null;
    columnPosRef.current = columnPos;
    window.dispatchEvent(
      new CustomEvent('feishu-close-column-plus-menus', { detail: { except: columnPos } }),
    );
    if (columnPos != null) {
      focusColumnAtPos(editor, columnPos);
    }
    const button = plusRef.current;
    if (button?.isConnected) {
      setMenuPos(computeColumnPlusMenuPosition(button.getBoundingClientRect()));
    }
    setMenuOpen(true);
  }, [editor, getPos]);

  useEffect(() => {
    const onCloseAll = (event: Event) => {
      const except = (event as CustomEvent<{ except?: number | null }>).detail?.except;
      if (except != null && typeof getPos === 'function' && getPos() === except) return;
      setMenuOpen(false);
    };
    window.addEventListener('feishu-close-column-plus-menus', onCloseAll);
    return () => window.removeEventListener('feishu-close-column-plus-menus', onCloseAll);
  }, [getPos]);

  const isColumnEmpty = isColumnBlockEmpty(node);

  useEffect(() => {
    if (!isColumnEmpty) {
      closeMenu();
    }
  }, [closeMenu, isColumnEmpty]);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined;
      closeMenu();
    }, 120);
  }, [cancelScheduledClose, closeMenu]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  const handleWrapMouseEnter = useCallback(() => {
    cancelScheduledClose();
    if (isColumnEmpty) openMenu();
  }, [cancelScheduledClose, isColumnEmpty, openMenu]);

  const handleColWrapMouseLeave = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!menuOpen) return;
    const next = getRelatedNode(event.relatedTarget);
    if (next instanceof Element && isColumnPlusOverlayElement(next)) return;
    scheduleClose();
  }, [menuOpen, scheduleClose]);

  const slashMenu = menuOpen && isColumnEmpty
    ? createPortal(
        <div
          className="feishu-columns-block__plus-menu-shell"
          onMouseEnter={() => {
            cancelScheduledClose();
            if (isColumnEmpty) openMenu();
          }}
          onMouseLeave={(event: React.MouseEvent<HTMLDivElement>) => {
            const next = getRelatedNode(event.relatedTarget);
            if (next instanceof Element && isColumnPlusOverlayElement(next)) return;
            if (next instanceof Element && next.closest('.feishu-columns-block__col-wrap')) return;
            closeMenu();
          }}
        >
          <SlashMenu
            editor={editor}
            position={menuPos}
            query=""
            onClose={closeMenu}
            onBeforeSelect={ensureColumnFocus}
            onMouseEnter={() => {
              cancelScheduledClose();
              if (isColumnEmpty) openMenu();
            }}
            anchorRef={plusRef}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <NodeViewWrapper
      className={`feishu-columns-block__col-wrap${menuOpen ? ' is-menu-open' : ''}${isColumnEmpty ? ' is-column-empty' : ''}`}
      onMouseLeave={handleColWrapMouseLeave}
    >
      {editor.isEditable && isColumnEmpty && (
        <div
          className="feishu-columns-block__add-hover-wrap"
          contentEditable={false}
          onMouseEnter={handleWrapMouseEnter}
        >
          <button
            ref={plusRef}
            type="button"
            className="feishu-columns-block__add-btn"
            title="悬浮插入内容"
            aria-label="插入内容"
            onMouseDown={event => event.preventDefault()}
          >
            <span className="feishu-columns-block__add-btn-box">
              <IconAddOutlined size={14} color="currentColor" />
            </span>
          </button>
        </div>
      )}
      <NodeViewContent className="feishu-columns-block__col" />
      {slashMenu}
    </NodeViewWrapper>
  );
}

export function ColumnsNodeView({ editor, node, getPos, selected }: NodeViewProps) {
  const columnCount = node.childCount;
  const blockRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ leftIndex: number; startX: number; blockWidth: number } | null>(null);
  const gridTemplate = useMemo(() => buildGridTemplate(node), [node]);
  const columnRatios = useMemo(() => readColumnRatios(node), [node]);
  const columnsGap = useMemo(() => resolveColumnsGap(columnCount), [columnCount]);
  const columnPaddingX = useMemo(() => resolveColumnPaddingX(columnCount), [columnCount]);
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const canAddColumn = columnCount < MAX_COLUMNS_BLOCK;

  const handleResizeStart = useCallback((leftIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const blockEl = blockRef.current;
    if (!blockEl) return;

    dragStateRef.current = {
      leftIndex,
      startX: event.clientX,
      blockWidth: blockEl.getBoundingClientRect().width || 1,
    };
    setResizingIndex(leftIndex);

    const handleMove = (moveEvent: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const deltaRatio = ((moveEvent.clientX - dragState.startX) / dragState.blockWidth) * 100;
      if (Math.abs(deltaRatio) < 0.35) return;
      resizeColumnsAt(editor, getPos, dragState.leftIndex, deltaRatio);
      dragStateRef.current = {
        ...dragState,
        startX: moveEvent.clientX,
      };
    };

    const handleUp = () => {
      dragStateRef.current = null;
      setResizingIndex(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [editor, getPos]);

  const isResizing = resizingIndex != null;

  return (
    <NodeViewWrapper
      className={`feishu-columns-node${selected ? ' is-selected' : ''}${isResizing ? ' is-resizing' : ''}`}
      data-columns-count={columnCount}
      style={{
        ['--feishu-columns-template' as string]: gridTemplate,
        ['--feishu-columns-count' as string]: String(columnCount),
        ['--feishu-columns-gap' as string]: `${columnsGap}px`,
        ['--feishu-column-padding-x' as string]: `${columnPaddingX}px`,
      }}
    >
      <div ref={blockRef} className="feishu-columns-node__frame">
        <NodeViewContent className="feishu-columns-block" />
        {isResizing && (
          <div className="feishu-columns-node__ratio-badges" contentEditable={false}>
            {readColumnRatios(node).map((ratio, index) => (
              <div key={`ratio-badge-${index}`} className="feishu-columns-node__ratio-badge">
                <span className="feishu-columns-node__ratio-badge-text">
                  {Math.round(ratio)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {columnCount > 1 && (
        <div className="feishu-columns-node__splitter-layer" contentEditable={false}>
          {Array.from({ length: columnCount - 1 }, (_, index) => (
            <div
              key={`columns-splitter-${index}`}
              className={`feishu-columns-node__splitter${resizingIndex === index ? ' is-resizing' : ''}`}
              style={{ left: computeSplitterLeft(index, columnRatios, columnsGap) }}
            >
              <span className="feishu-columns-node__insert-line" aria-hidden />
              <button
                type="button"
                className="feishu-columns-node__insert-btn"
                aria-label="新增分栏"
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={event => {
                  event.stopPropagation();
                  if (canAddColumn) insertColumnAfterAt(editor, getPos, index);
                }}
                disabled={!canAddColumn}
              >
                <span className="feishu-columns-node__insert-dot" />
                <span className="feishu-columns-node__insert-plus">
                  <span className="feishu-columns-node__insert-plus-icon">+</span>
                </span>
                <span className="feishu-columns-node__insert-tooltip">
                  {canAddColumn ? '新增分栏' : `最多 ${MAX_COLUMNS_BLOCK} 栏`}
                </span>
              </button>
              <div
                className="feishu-columns-node__resize-handle"
                title="拖动调整栏宽"
                onMouseDown={event => handleResizeStart(index, event)}
              />
            </div>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}
