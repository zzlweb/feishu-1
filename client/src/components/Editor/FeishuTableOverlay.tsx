import type { Editor } from '@tiptap/react';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { useCallback, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { SlashGlyphTable } from '../../icons/slashMenuGlyphs';
import { IconDragOutlined } from '../../icons/feishuDoc';
import {
  getTableChromeMountFromHost,
  getTableElementFromHost,
  getTablePosFromHost,
  getTableScrollFromHost,
  isCellSelectionInTableHost,
  isFocusInTableUi,
  resolveTableCellPos,
  syncTableRailCellHighlight,
  syncTableScrollEdgeFade,
  type TableRailPin,
} from './tableDom';
import {
  insertTableColumnAtBoundary,
  insertTableRowAtBoundary,
  selectTableNodeFromHost,
} from './tableInsert';
import './FeishuTableOverlay.less';

// Keep the rail at least as large as the hover hit target, otherwise the edge
// insert button can be visually clipped on the first row/column.
const RAIL = 12;
const HIT_MARGIN = 12;
const HOST_CHROME_HOT_CLASS = 'feishu-table-host--chrome-hot';

function syncHostChromeHot(host: HTMLElement, active: boolean) {
  const hasClass = host.classList.contains(HOST_CHROME_HOT_CLASS);
  if (active === hasClass) return;
  host.classList.toggle(HOST_CHROME_HOT_CLASS, active);
}

function isPointerOverHost(host: HTMLElement): boolean {
  return host.matches(':hover');
}

interface TableLayout {
  tableOffsetLeft: number;
  tableOffsetTop: number;
  surfaceOffsetLeft: number;
  viewportWidth: number;
  viewStart: number;
  scrollLeft: number;
  tableWidth: number;
  tableHeight: number;
  rowBounds: number[];
  colBounds: number[];
}

interface Props {
  editor: Editor;
  tableHost: HTMLElement;
  handleRef: Ref<HTMLButtonElement>;
  pinChrome?: boolean;
  onOpenBlockMenu: () => void;
  onScheduleCloseBlockMenu: () => void;
  onCancelCloseBlockMenu: () => void;
  onTableHandleActiveChange?: (active: boolean) => void;
}

function isBoundVisible(pos: number, viewStart: number, viewWidth: number): boolean {
  return pos >= viewStart - HIT_MARGIN && pos <= viewStart + viewWidth + HIT_MARGIN;
}

/** 坐标相对 chrome-mount（表格外侧 gutter，不被 scroll 裁剪） */
function measureTableLayout(host: HTMLElement): TableLayout | null {
  const table = getTableElementFromHost(host);
  if (!table) return null;

  const mount = getTableChromeMountFromHost(host);
  const surface = getTableScrollFromHost(host);
  const originRect = mount.getBoundingClientRect();
  const surfaceRect = surface.getBoundingClientRect();
  const scrollLeft = surface.scrollLeft;
  const viewStart = surfaceRect.left - originRect.left;
  const tableRect = table.getBoundingClientRect();
  const tableOffsetLeft = tableRect.left - originRect.left;
  const tableOffsetTop = tableRect.top - originRect.top;
  const surfaceOffsetLeft = surfaceRect.left - originRect.left;

  const trs = Array.from(table.querySelectorAll('tr'));
  const rowBounds: number[] = [];
  for (const tr of trs) {
    const r = tr.getBoundingClientRect();
    rowBounds.push(r.top - originRect.top);
  }
  if (trs.length > 0) {
    const lastTr = trs[trs.length - 1] as HTMLElement;
    const r = lastTr.getBoundingClientRect();
    rowBounds.push(r.bottom - originRect.top);
  }

  const cells = trs[0] ? Array.from(trs[0].querySelectorAll('th, td')) : [];
  const colBounds: number[] = [];
  for (const cell of cells) {
    const r = (cell as HTMLElement).getBoundingClientRect();
    colBounds.push(r.left - originRect.left);
  }
  if (cells.length > 0) {
    const last = cells[cells.length - 1] as HTMLElement;
    const r = last.getBoundingClientRect();
    colBounds.push(r.right - originRect.left);
  }

  const tableHeight = rowBounds.length > 0
    ? rowBounds[rowBounds.length - 1] - tableOffsetTop
    : table.offsetHeight;
  const viewportWidth = surface.clientWidth;

  return {
    tableOffsetLeft,
    tableOffsetTop,
    surfaceOffsetLeft,
    viewportWidth,
    viewStart,
    scrollLeft,
    tableWidth: table.offsetWidth,
    tableHeight,
    rowBounds,
    colBounds,
  };
}

function isSameTableLayout(a: TableLayout | null, b: TableLayout | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.tableOffsetLeft !== b.tableOffsetLeft
    || a.tableOffsetTop !== b.tableOffsetTop
    || a.surfaceOffsetLeft !== b.surfaceOffsetLeft
    || a.viewportWidth !== b.viewportWidth
    || a.viewStart !== b.viewStart
    || a.scrollLeft !== b.scrollLeft
    || a.tableWidth !== b.tableWidth
    || a.tableHeight !== b.tableHeight
    || a.rowBounds.length !== b.rowBounds.length
    || a.colBounds.length !== b.colBounds.length
  ) {
    return false;
  }
  for (let i = 0; i < a.rowBounds.length; i += 1) {
    if (a.rowBounds[i] !== b.rowBounds[i]) return false;
  }
  for (let i = 0; i < a.colBounds.length; i += 1) {
    if (a.colBounds[i] !== b.colBounds[i]) return false;
  }
  return true;
}

type SelectedRail = 'col' | 'row' | null;

function FeishuTableOverlay({
  editor,
  tableHost,
  handleRef,
  pinChrome = false,
  onOpenBlockMenu,
  onScheduleCloseBlockMenu,
  onCancelCloseBlockMenu,
  onTableHandleActiveChange,
}: Props) {
  const [layout, setLayout] = useState<TableLayout | null>(() =>
    tableHost.isConnected ? measureTableLayout(tableHost) : null,
  );
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const [selectedRail, setSelectedRail] = useState<SelectedRail>(null);
  const [railSelectionKind, setRailSelectionKind] = useState<'col' | 'row' | 'cell' | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);
  const [tableSelectionPinned, setTableSelectionPinned] = useState(() =>
    isCellSelectionInTableHost(editor, tableHost),
  );
  const [pinnedRail, setPinnedRail] = useState<TableRailPin | null>(null);

  const tableHoverRef = useRef(false);
  const handleHoverRef = useRef(false);
  const pinChromeRef = useRef(pinChrome);
  const chromeVisibleRef = useRef(chromeVisible);
  const hideChromeTimerRef = useRef<number | null>(null);
  const selectedRailRef = useRef<SelectedRail>(null);
  const tableSelectionPinnedRef = useRef(tableSelectionPinned);
  const pinnedRailRef = useRef<TableRailPin | null>(null);
  const suppressSelectionClearRef = useRef(false);
  const remeasureFrameRef = useRef<number | null>(null);

  tableSelectionPinnedRef.current = tableSelectionPinned;
  pinnedRailRef.current = pinnedRail;
  selectedRailRef.current = selectedRail;
  const pinChromeAlways = pinChrome || tableSelectionPinnedRef.current;
  pinChromeRef.current = pinChrome || tableSelectionPinnedRef.current;
  chromeVisibleRef.current = chromeVisible;

  const clearHover = useCallback(() => {
    setHoverCol(null);
    setHoverRow(null);
  }, []);

  const cancelHideChrome = useCallback(() => {
    if (hideChromeTimerRef.current != null) {
      window.clearTimeout(hideChromeTimerRef.current);
      hideChromeTimerRef.current = null;
    }
  }, []);

  const scheduleHideChrome = useCallback(() => {
    cancelHideChrome();
    hideChromeTimerRef.current = window.setTimeout(() => {
      hideChromeTimerRef.current = null;
      if (tableHoverRef.current || handleHoverRef.current || pinChromeRef.current) return;
      if (selectedRailRef.current) return;
      if (tableSelectionPinnedRef.current) return;
      tableHoverRef.current = false;
      syncHostChromeHot(tableHost, false);
      setChromeVisible(false);
      syncTableScrollEdgeFade(tableHost, false);
      clearHover();
    }, 280);
  }, [cancelHideChrome, clearHover, tableHost]);

  const showChrome =
    chromeVisible
    || handleHovered
    || pinChrome
    || tableSelectionPinnedRef.current
    || selectedRailRef.current != null;

  const syncScrollFade = useCallback(() => {
    const hot =
      tableHoverRef.current
      || handleHoverRef.current
      || pinChromeRef.current
      || chromeVisibleRef.current;
    syncTableScrollEdgeFade(tableHost, hot);
  }, [tableHost]);

  const remeasure = useCallback(() => {
    if (!tableHost.isConnected) {
      setLayout(prev => (prev == null ? prev : null));
      syncTableScrollEdgeFade(tableHost, false);
      return;
    }
    const next = measureTableLayout(tableHost);
    setLayout(prev => (isSameTableLayout(prev, next) ? prev : next));
    syncTableRailCellHighlight(tableHost, pinnedRailRef.current);
    syncScrollFade();
  }, [syncScrollFade, tableHost]);

  const remeasureSoon = useCallback(() => {
    if (remeasureFrameRef.current != null) return;
    remeasureFrameRef.current = window.requestAnimationFrame(() => {
      remeasureFrameRef.current = null;
      remeasure();
    });
  }, [remeasure]);

  useLayoutEffect(() => {
    setLayout(prev => {
      const next = measureTableLayout(tableHost);
      return isSameTableLayout(prev, next) ? prev : next;
    });
    remeasureSoon();
    const surface = getTableScrollFromHost(tableHost);
    const ro = new ResizeObserver(remeasureSoon);
    ro.observe(tableHost);
    ro.observe(surface);
    const table = getTableElementFromHost(tableHost);
    if (table) ro.observe(table);
    const onEditorUpdate = () => remeasureSoon();
    editor.on('update', onEditorUpdate);
    editor.on('selectionUpdate', onEditorUpdate);
    window.addEventListener('resize', remeasureSoon);
    document.addEventListener('scroll', remeasureSoon, true);
    surface.addEventListener('scroll', remeasureSoon, { passive: true });
    return () => {
      if (remeasureFrameRef.current != null) {
        window.cancelAnimationFrame(remeasureFrameRef.current);
        remeasureFrameRef.current = null;
      }
      ro.disconnect();
      editor.off('update', onEditorUpdate);
      editor.off('selectionUpdate', onEditorUpdate);
      window.removeEventListener('resize', remeasureSoon);
      document.removeEventListener('scroll', remeasureSoon, true);
      surface.removeEventListener('scroll', remeasureSoon);
    };
  }, [editor, remeasure, remeasureSoon, tableHost]);

  const runInsertColumn = useCallback(
    (index: number) => {
      if (!layout) return;
      const tablePos = getTablePosFromHost(editor, tableHost);
      if (tablePos == null) return;
      if (insertTableColumnAtBoundary(editor, tablePos, index, layout.colBounds.length)) {
        clearHover();
        remeasureSoon();
      }
    },
    [clearHover, editor, layout, remeasureSoon, tableHost],
  );

  const runInsertRow = useCallback(
    (index: number) => {
      if (!layout) return;
      const tablePos = getTablePosFromHost(editor, tableHost);
      if (tablePos == null) return;
      if (insertTableRowAtBoundary(editor, tablePos, index, layout.rowBounds.length)) {
        clearHover();
        remeasureSoon();
      }
    },
    [clearHover, editor, layout, remeasureSoon, tableHost],
  );

  const activateTableChrome = useCallback(() => {
    cancelHideChrome();
    tableHoverRef.current = true;
    syncHostChromeHot(tableHost, true);
    if (!chromeVisibleRef.current) {
      chromeVisibleRef.current = true;
      setChromeVisible(true);
    }
    syncTableScrollEdgeFade(tableHost, true);
  }, [cancelHideChrome, tableHost]);

  const applyPinnedRail = useCallback(
    (pin: TableRailPin | null) => {
      const prev = pinnedRailRef.current;
      const samePin =
        (pin == null && prev == null)
        || (pin != null && prev != null && pin.kind === prev.kind && pin.index === prev.index);
      if (samePin) {
        syncTableRailCellHighlight(tableHost, pin);
        return;
      }

      pinnedRailRef.current = pin;
      setPinnedRail(pin);
      syncTableRailCellHighlight(tableHost, pin);
      if (!pin) {
        setRailSelectionKind(null);
        setSelectionRange(null);
        setSelectedRail(null);
        selectedRailRef.current = null;
        return;
      }
      tableSelectionPinnedRef.current = true;
      setTableSelectionPinned(true);
      selectedRailRef.current = pin.kind;
      setSelectedRail(pin.kind);
      setRailSelectionKind(pin.kind);
      setSelectionRange({
        left: pin.kind === 'col' ? pin.index : 0,
        right: pin.kind === 'col' ? pin.index + 1 : 0,
        top: pin.kind === 'row' ? pin.index : 0,
        bottom: pin.kind === 'row' ? pin.index + 1 : 0,
      });
      tableHost.classList.add('feishu-table-host--selection-pinned');
      activateTableChrome();
    },
    [activateTableChrome, tableHost],
  );

  const selectColumn = useCallback(
    (colIndex: number) => {
      const tablePos = getTablePosFromHost(editor, tableHost);
      if (tablePos == null) return;
      const { state } = editor;
      const cellPos = resolveTableCellPos(editor, tablePos, 0, colIndex);
      if (cellPos == null) return;
      try {
        const $cell = state.doc.resolve(cellPos);
        const selection = CellSelection.colSelection($cell);
        suppressSelectionClearRef.current = true;
        applyPinnedRail({ kind: 'col', index: colIndex });
        editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
        editor.view.focus();
        clearHover();
        window.setTimeout(() => {
          suppressSelectionClearRef.current = false;
        }, 120);
      } catch (e) {
        console.error(e);
      }
    },
    [applyPinnedRail, clearHover, editor, tableHost],
  );

  const selectRow = useCallback(
    (rowIndex: number) => {
      const tablePos = getTablePosFromHost(editor, tableHost);
      if (tablePos == null) return;
      const { state } = editor;
      const cellPos = resolveTableCellPos(editor, tablePos, rowIndex, 0);
      if (cellPos == null) return;
      try {
        const $cell = state.doc.resolve(cellPos);
        const selection = CellSelection.rowSelection($cell);
        suppressSelectionClearRef.current = true;
        applyPinnedRail({ kind: 'row', index: rowIndex });
        editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
        editor.view.focus();
        clearHover();
        window.setTimeout(() => {
          suppressSelectionClearRef.current = false;
        }, 120);
      } catch (e) {
        console.error(e);
      }
    },
    [applyPinnedRail, clearHover, editor, tableHost],
  );

  const releaseTableSelectionPinned = useCallback(() => {
    applyPinnedRail(null);
    setTableSelectionPinned(false);
    tableSelectionPinnedRef.current = false;
    setSelectedRail(null);
    setSelectionRange(null);
    setRailSelectionKind(null);
    tableHost.classList.remove('feishu-table-host--selection-pinned');
    if (!tableHoverRef.current && !handleHoverRef.current && !pinChromeRef.current) {
      syncHostChromeHot(tableHost, false);
      chromeVisibleRef.current = false;
      setChromeVisible(false);
      syncTableScrollEdgeFade(tableHost, false);
    }
  }, [applyPinnedRail, tableHost]);

  useLayoutEffect(() => {
    const onHostPointerEnter = () => activateTableChrome();
    const onHostPointerOver = (e: PointerEvent) => {
      if (e.target instanceof Node && tableHost.contains(e.target)) activateTableChrome();
    };
    const onHostPointerLeave = (e: PointerEvent) => {
      const next = e.relatedTarget;
      if (next instanceof Node && tableHost.contains(next)) return;
      if (next instanceof Element && next.closest('.feishu-table-chrome')) return;
      if (next instanceof Element && next.closest('.context-menu')) return;
      if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
      if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
      if (handleHoverRef.current) return;
      if (tableSelectionPinnedRef.current) return;
      tableHoverRef.current = false;
      if (!pinChromeRef.current && !selectedRailRef.current) syncHostChromeHot(tableHost, false);
      scheduleHideChrome();
    };
    tableHost.addEventListener('pointerenter', onHostPointerEnter);
    tableHost.addEventListener('pointerover', onHostPointerOver);
    tableHost.addEventListener('pointerleave', onHostPointerLeave);
    if (isPointerOverHost(tableHost)) activateTableChrome();
    return () => {
      tableHost.removeEventListener('pointerenter', onHostPointerEnter);
      tableHost.removeEventListener('pointerover', onHostPointerOver);
      tableHost.removeEventListener('pointerleave', onHostPointerLeave);
      syncHostChromeHot(tableHost, false);
    };
  }, [activateTableChrome, scheduleHideChrome, tableHost]);

  useLayoutEffect(() => () => cancelHideChrome(), [cancelHideChrome]);

  useLayoutEffect(() => {
    if (pinChromeAlways || tableSelectionPinnedRef.current) {
      if (!chromeVisibleRef.current) activateTableChrome();
      return;
    }
    if (
      tableHoverRef.current
      || handleHoverRef.current
      || isPointerOverHost(tableHost)
      || selectedRailRef.current
    ) {
      return;
    }
    syncHostChromeHot(tableHost, false);
    if (chromeVisibleRef.current) {
      chromeVisibleRef.current = false;
      setChromeVisible(false);
    }
    syncTableScrollEdgeFade(tableHost, false);
  }, [activateTableChrome, pinChromeAlways, tableHost]);

  useLayoutEffect(() => {
    syncTableRailCellHighlight(tableHost, pinnedRailRef.current);
  }, [pinnedRail, tableHost]);

  // 同步 PM 选区到本地（本地 pinnedRail 为视觉主状态，不被 PM 失败误清）
  useLayoutEffect(() => {
    const onSelectionUpdate = () => {
      if (suppressSelectionClearRef.current || pinnedRailRef.current) return;

      const { state } = editor;
      const tablePos = getTablePosFromHost(editor, tableHost);
      const pmPinned = isCellSelectionInTableHost(editor, tableHost);

      if (state.selection instanceof CellSelection && tablePos != null && pmPinned) {
        try {
          const tableNode = state.doc.nodeAt(tablePos);
          if (tableNode) {
            const map = TableMap.get(tableNode);
            const tableStart = state.selection.$anchorCell.start(-1);
            const anchorRect = map.findCell(state.selection.$anchorCell.pos - tableStart);
            const headRect = map.findCell(state.selection.$headCell.pos - tableStart);
            if (state.selection.isColSelection()) {
              applyPinnedRail({ kind: 'col', index: anchorRect.left });
            } else if (state.selection.isRowSelection()) {
              applyPinnedRail({ kind: 'row', index: anchorRect.top });
            }
            setSelectionRange({
              left: Math.min(anchorRect.left, headRect.left),
              right: Math.max(anchorRect.right, headRect.right),
              top: Math.min(anchorRect.top, headRect.top),
              bottom: Math.max(anchorRect.bottom, headRect.bottom),
            });
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    editor.on('selectionUpdate', onSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
      syncTableRailCellHighlight(tableHost, null);
      tableHost.classList.remove('feishu-table-host--selection-pinned');
    };
  }, [applyPinnedRail, editor, tableHost]);

  /** 点击表格外部时收起列/行选中 */
  useLayoutEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!pinnedRailRef.current || suppressSelectionClearRef.current) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (tableHost.contains(target)) return;
      if (target instanceof Element && target.closest('.selection-bubble')) return;

      const { selection } = editor.state;
      if (selection instanceof CellSelection && isCellSelectionInTableHost(editor, tableHost)) {
        const textPos = selection.$anchorCell.pos + 1;
        editor.chain().setTextSelection(textPos).run();
      }
      releaseTableSelectionPinned();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [editor, releaseTableSelectionPinned, tableHost]);

  /** 表格失焦（焦点离开表格 UI 区域）后收起选中态 */
  useLayoutEffect(() => {
    const onBlur = (e: FocusEvent) => {
      if (suppressSelectionClearRef.current || !pinnedRailRef.current) return;
      const related = e.relatedTarget;
      if (related instanceof Node && tableHost.contains(related)) return;
      if (related instanceof Element && related.closest('.feishu-table-chrome, .selection-bubble')) return;

      window.setTimeout(() => {
        if (suppressSelectionClearRef.current || !pinnedRailRef.current) return;
        if (isFocusInTableUi(editor, document.activeElement, related)) return;
        if (tableHost.contains(document.activeElement)) return;

        const { selection } = editor.state;
        if (selection instanceof CellSelection) {
          const textPos = selection.$anchorCell.pos + 1;
          editor.chain().setTextSelection(textPos).run();
        }
        releaseTableSelectionPinned();
      }, 0);
    };
    editor.view.dom.addEventListener('blur', onBlur, true);
    return () => editor.view.dom.removeEventListener('blur', onBlur, true);
  }, [editor, releaseTableSelectionPinned, tableHost]);

  if (!layout || !tableHost.isConnected) return null;

  const {
    tableOffsetTop,
    surfaceOffsetLeft,
    viewportWidth,
    viewStart,
    tableHeight,
    colBounds,
    rowBounds,
  } = layout;

  const suppressInsertChrome = pinnedRail != null;

  const visibleLeft = surfaceOffsetLeft;
  const visibleWidth = viewportWidth;
  const handleLeft = visibleLeft - 4;
  const handleTop = tableOffsetTop - 4;
  const colHitsToRender = colBounds
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x > colBounds[0] + 2 && x < colBounds[colBounds.length - 1] - 2 && x >= viewStart && x <= viewStart + viewportWidth);

  const chrome = (
    <div
      className={`feishu-table-chrome${showChrome ? ' feishu-table-chrome--visible' : ''}`}
      onMouseLeave={e => {
        const next = e.relatedTarget;
        if (next instanceof Node && e.currentTarget.contains(next)) return;
        if (next instanceof Element && tableHost.contains(next)) return;
        if (next instanceof Element && next.closest('.context-menu')) return;
        if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
        if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
        if (tableHoverRef.current || handleHoverRef.current || pinChromeRef.current) return;
        if (tableSelectionPinnedRef.current) return;
        scheduleHideChrome();
      }}
    >
      <button
        ref={handleRef}
        type="button"
        className={`feishu-table-chrome__handle${handleHovered ? ' is-hovered' : ''}`}
        style={{
          left: handleLeft,
          top: handleTop,
          transform: 'translate(-100%, -100%)',
        }}
        onMouseDown={e => e.preventDefault()}
        onMouseEnter={() => {
          activateTableChrome();
          handleHoverRef.current = true;
          setHandleHovered(true);
          onCancelCloseBlockMenu?.();
          onTableHandleActiveChange?.(true);
          selectTableNodeFromHost(editor, tableHost);
          onOpenBlockMenu?.();
        }}
        onMouseLeave={e => {
          const next = e.relatedTarget;
          if (next instanceof Element && next.closest('.context-menu')) return;
          if (next instanceof Element && next.closest('.context-submenu-flyout')) return;
          if (next instanceof Element && next.closest('.context-add-below-flyout')) return;
          if (next instanceof Element && next.closest('.feishu-table-chrome')) return;
          if (next instanceof Node && tableHost.contains(next)) return;
          handleHoverRef.current = false;
          setHandleHovered(false);
          onTableHandleActiveChange?.(false);
          onScheduleCloseBlockMenu?.();
          scheduleHideChrome();
        }}
        aria-label="表格块配置"
      >
        <SlashGlyphTable size={14} fill="#52c41a" />
        <span className="feishu-table-chrome__handle-divider" aria-hidden />
        <IconDragOutlined size={14} color="#8f959e" />
      </button>

      <div
        className="feishu-table-chrome__rail-top"
        style={{
          left: visibleLeft,
          top: tableOffsetTop - RAIL,
          width: visibleWidth,
          height: RAIL,
        }}
        onMouseEnter={activateTableChrome}
        onMouseLeave={e => {
          const next = e.relatedTarget;
          if (next instanceof Element && next.closest('.feishu-table-chrome__insert-col')) return;
          setHoverCol(null);
        }}
      >
        {colBounds.slice(0, -1).map((x, i) => {
          const nextX = colBounds[i + 1];
          const clampedLeft = Math.max(x, viewStart);
          const clampedRight = Math.min(nextX, viewStart + viewportWidth);
          if (clampedLeft >= clampedRight) return null;

          const isColSelected = pinnedRail?.kind === 'col' && pinnedRail.index === i;

          return (
            <div
              key={`block-c-${i}`}
              className={`feishu-table-chrome__rail-block feishu-table-chrome__rail-block--col${
                isColSelected ? ' is-selected' : ''
              }`}
              style={{
                left: clampedLeft - visibleLeft,
                width: clampedRight - clampedLeft,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectColumn(i);
              }}
              onMouseEnter={() => {
                if (suppressInsertChrome) return;
                setHoverCol(null);
              }}
            />
          );
        })}

        {!suppressInsertChrome && colHitsToRender.map(({ x, i }) => (
          <div
            key={`c-${i}`}
            className={[
              'feishu-table-chrome__hit feishu-table-chrome__hit--col',
              hoverCol === i ? 'is-active' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: x - visibleLeft }}
          >
            <span
              className="feishu-table-chrome__dot"
              aria-hidden
              onMouseEnter={() => {
                activateTableChrome();
                setHoverRow(null);
                setHoverCol(i);
              }}
            />
            <button
              type="button"
              className="feishu-table-chrome__rail-plus feishu-table-chrome__rail-plus--col"
              aria-label="插入列"
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => {
                activateTableChrome();
                setHoverRow(null);
                setHoverCol(i);
              }}
              onClick={(e) => {
                e.stopPropagation();
                runInsertColumn(i);
              }}
            >
              <span className="feishu-table-chrome__rail-plus-icon">+</span>
            </button>
          </div>
        ))}
      </div>

      <div
        className="feishu-table-chrome__rail-left"
        style={{
          left: visibleLeft - RAIL,
          top: tableOffsetTop,
          width: RAIL,
          height: tableHeight,
        }}
        onMouseEnter={activateTableChrome}
        onMouseLeave={e => {
          const next = e.relatedTarget;
          if (next instanceof Element && next.closest('.feishu-table-chrome__insert-row')) return;
          setHoverRow(null);
        }}
      >
        {rowBounds.slice(0, -1).map((y, i) => {
          const isRowSelected = pinnedRail?.kind === 'row' && pinnedRail.index === i;

          return (
            <div
              key={`block-r-${i}`}
              className={`feishu-table-chrome__rail-block feishu-table-chrome__rail-block--row${
                isRowSelected ? ' is-selected' : ''
              }`}
              style={{
                top: y - tableOffsetTop,
                height: rowBounds[i + 1] - y,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectRow(i);
              }}
              onMouseEnter={() => {
                if (suppressInsertChrome) return;
                setHoverRow(null);
              }}
            />
          );
        })}

        {!suppressInsertChrome && rowBounds
          .map((y, i) => ({ y, i }))
          .filter(({ y }) => y > rowBounds[0] + 2 && y < rowBounds[rowBounds.length - 1] - 2)
          .map(({ y, i }) => (
            <div
              key={`r-${i}`}
              className={[
                'feishu-table-chrome__hit feishu-table-chrome__hit--row',
                hoverRow === i ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              style={{ top: y - tableOffsetTop }}
            >
              <span
                className="feishu-table-chrome__dot"
                aria-hidden
                onMouseEnter={() => {
                  activateTableChrome();
                  setHoverCol(null);
                  setHoverRow(i);
                }}
              />
              <button
                type="button"
                className="feishu-table-chrome__rail-plus feishu-table-chrome__rail-plus--row"
                aria-label="插入行"
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => {
                  activateTableChrome();
                  setHoverCol(null);
                  setHoverRow(i);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  runInsertRow(i);
                }}
              >
                <span className="feishu-table-chrome__rail-plus-icon">+</span>
              </button>
            </div>
          ))}
      </div>

      {!suppressInsertChrome && hoverCol != null && isBoundVisible(colBounds[hoverCol], viewStart, viewportWidth) && (
        <div
          className="feishu-table-chrome__insert-col"
          style={{
            left: colBounds[hoverCol],
            top: tableOffsetTop,
            height: tableHeight,
          }}
          onMouseEnter={activateTableChrome}
          onMouseLeave={e => {
            const next = e.relatedTarget;
            if (next instanceof Element && next.closest('.feishu-table-chrome__rail-top')) return;
            setHoverCol(null);
          }}
        >
          <div className="feishu-table-chrome__line feishu-table-chrome__line--col" />
        </div>
      )}

      {!suppressInsertChrome && hoverRow != null && (
        <div
          className="feishu-table-chrome__insert-row"
          style={{
            left: visibleLeft,
            top: rowBounds[hoverRow],
            width: visibleWidth,
          }}
          onMouseEnter={activateTableChrome}
          onMouseLeave={e => {
            const next = e.relatedTarget;
            if (next instanceof Element && next.closest('.feishu-table-chrome__rail-left')) return;
            setHoverRow(null);
          }}
        >
          <div className="feishu-table-chrome__line feishu-table-chrome__line--row" />
        </div>
      )}

    </div>
  );

  const chromeMount = getTableChromeMountFromHost(tableHost);
  return createPortal(chrome, chromeMount);
}

export default FeishuTableOverlay;
