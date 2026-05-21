import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconAddOutlined } from '../../icons/feishuDoc';
import SlashMenu from './SlashMenu';
import {
  MAX_COLUMNS,
  buildGridTemplate,
  computeColumnPlusMenuPosition,
  focusColumnAtPos,
  focusColumnEditor,
  insertColumnAfterAt,
  readColumnRatios,
  resizeColumnsAt,
} from './columnsHelpers';

export function ColumnBlockNodeView({ editor, getPos }: NodeViewProps) {
  const plusRef = useRef<HTMLButtonElement>(null);
  const columnPosRef = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setMenuOpen(false);
  }, [clearCloseTimer]);

  const ensureColumnFocus = useCallback(() => {
    if (columnPosRef.current != null) {
      focusColumnAtPos(editor, columnPosRef.current);
      return;
    }
    focusColumnEditor(editor, getPos);
  }, [editor, getPos]);

  const openMenu = useCallback(() => {
    if (!editor.isEditable) return;
    clearCloseTimer();
    const columnPos = typeof getPos === 'function' ? getPos() : null;
    columnPosRef.current = columnPos;
    window.dispatchEvent(
      new CustomEvent('feishu-close-column-plus-menus', { detail: { except: columnPos } }),
    );
    if (columnPos != null) {
      focusColumnAtPos(editor, columnPos);
    }
    const button = plusRef.current;
    if (button) {
      setMenuPos(computeColumnPlusMenuPosition(button.getBoundingClientRect()));
    }
    setMenuOpen(true);
  }, [clearCloseTimer, editor, getPos]);

  const scheduleCloseMenu = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), 220);
  }, [clearCloseTimer]);

  useEffect(() => {
    const onCloseAll = (event: Event) => {
      const except = (event as CustomEvent<{ except?: number | null }>).detail?.except;
      if (except != null && typeof getPos === 'function' && getPos() === except) return;
      setMenuOpen(false);
    };
    window.addEventListener('feishu-close-column-plus-menus', onCloseAll);
    return () => window.removeEventListener('feishu-close-column-plus-menus', onCloseAll);
  }, [getPos]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const slashMenu = menuOpen
    ? createPortal(
        <SlashMenu
          editor={editor}
          position={menuPos}
          query=""
          onClose={closeMenu}
          onBeforeSelect={ensureColumnFocus}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleCloseMenu}
        />,
        document.body,
      )
    : null;

  return (
    <NodeViewWrapper className={`feishu-columns-block__col-wrap${menuOpen ? ' is-menu-open' : ''}`}>
      {editor.isEditable && (
        <div
          className="feishu-columns-block__add-hover-wrap"
          contentEditable={false}
          onMouseEnter={() => {
            clearCloseTimer();
            openMenu();
          }}
          onMouseLeave={scheduleCloseMenu}
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
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [editor, getPos]);

  return (
    <NodeViewWrapper
      className={`feishu-columns-node${selected ? ' is-selected' : ''}`}
      data-columns-count={columnCount}
      style={{
        ['--feishu-columns-template' as string]: gridTemplate,
        ['--feishu-columns-count' as string]: String(columnCount),
      }}
    >
      <div ref={blockRef} className="feishu-columns-node__frame">
        <NodeViewContent className="feishu-columns-block" />
      </div>

      {columnCount > 1 && (
        <div className="feishu-columns-node__splitter-layer" contentEditable={false}>
          {Array.from({ length: columnCount - 1 }, (_, index) => {
            const leftPercent = readColumnRatios(node)
              .slice(0, index + 1)
              .reduce((sum, value) => sum + value, 0);
            const canInsert = columnCount < MAX_COLUMNS;
            return (
              <div
                key={`columns-splitter-${index}`}
                className="feishu-columns-node__splitter"
                style={{ left: `${leftPercent}%` }}
              >
                <div
                  className="feishu-columns-node__resize-handle"
                  title="拖动调整栏宽"
                  onMouseDown={event => handleResizeStart(index, event)}
                />
                {canInsert && (
                  <button
                    type="button"
                    className="feishu-columns-node__insert-btn"
                    title="新增分栏"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => insertColumnAfterAt(editor, getPos, index)}
                  >
                    <span className="feishu-columns-node__insert-tooltip">新增分栏</span>
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </NodeViewWrapper>
  );
}
