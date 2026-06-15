import type { Editor } from '@tiptap/react';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { SlashGlyphTable } from '../../../icons/slashMenuGlyphs';
import { IconAddOutlined, IconDragOutlined } from '../../../icons/feishuDoc';
import TableSelectionToolbar from '../toolbars/TableSelectionToolbar';
import BlockGutterGlyph from '../blocks/BlockGutterGlyph';
import { resolveTableCellHandle, type TableCellHandleState } from './tableCellHandle';
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
  moveTableColumn,
  selectTableNodeFromHost,
  setTableColumnWidth,
  setTableRowHeight,
} from './tableInsert';
import './FeishuTableOverlay.less';

// Keep the rail at least as large as the hover hit target, otherwise the edge
// insert button can be visually clipped on the first row/column.
const RAIL = 10;
const HIT_MARGIN = 12;
const DRAG_THRESHOLD = 4;
const MIN_COL_WIDTH = 120;
const MIN_ROW_HEIGHT = 36;
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
  onBlockDragStart?: (event: ReactPointerEvent<HTMLButtonElement>, source: HTMLElement) => void;
  onScheduleCloseBlockMenu: () => void;
  onCancelCloseBlockMenu: () => void;
  onTableHandleActiveChange?: (active: boolean) => void;
}

function findNearestBoundary(bounds: number[], coordinate: number): number {
  if (bounds.length === 0) return 0;
  let closestIndex = 0;
  let closestDistance = Math.abs(bounds[0] - coordinate);
  for (let i = 1; i < bounds.length; i += 1) {
    const distance = Math.abs(bounds[i] - coordinate);
    if (distance < closestDistance) {
      closestIndex = i;
      closestDistance = distance;
    }
  }
  return closestIndex;
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

  const cols = Array.from(table.querySelectorAll('colgroup col'));
  const colBounds: number[] = [];
  for (const col of cols) {
    const r = (col as HTMLElement).getBoundingClientRect();
    colBounds.push(r.left - originRect.left);
  }
  if (cols.length > 0) {
    const last = cols[cols.length - 1] as HTMLElement;
    const r = last.getBoundingClientRect();
    colBounds.push(r.right - originRect.left);
  } else {
    const cells = trs[0] ? Array.from(trs[0].querySelectorAll('th, td')) : [];
    for (const cell of cells) {
      const r = (cell as HTMLElement).getBoundingClientRect();
      colBounds.push(r.left - originRect.left);
    }
    if (cells.length > 0) {
      const last = cells[cells.length - 1] as HTMLElement;
      const r = last.getBoundingClientRect();
      colBounds.push(r.right - originRect.left);
    }
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
type RailDragPreview = { kind: 'col'; from: number; target: number; active: boolean } | null;
type ColumnResizePreview = { colIndex: number; x: number; active: boolean } | null;
type RowResizePreview = { rowIndex: number; y: number; active: boolean } | null;
type CellHandleState = TableCellHandleState | null;

interface ColumnResizeSession {
  colIndex: number;
  startX: number;
  startWidth: number;
  widths: number[];
  nextWidth: number;
  raf: number | null;
}

interface RowResizeSession {
  rowIndex: number;
  startY: number;
  startHeight: number;
  nextHeight: number;
  raf: number | null;
}

function FeishuTableOverlay({
  editor,
  tableHost,
  handleRef,
  pinChrome = false,
  onOpenBlockMenu,
  onBlockDragStart,
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
  const [railDragPreview, setRailDragPreview] = useState<RailDragPreview>(null);
  const [columnResizePreview, setColumnResizePreview] = useState<ColumnResizePreview>(null);
  const [rowResizePreview, setRowResizePreview] = useState<RowResizePreview>(null);
  const [cellHandle, setCellHandle] = useState<CellHandleState>(null);
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
  const columnResizeSessionRef = useRef<ColumnResizeSession | null>(null);
  const rowResizeSessionRef = useRef<RowResizeSession | null>(null);
  const cellHandleOpenKeyRef = useRef<string | null>(null);
  const cellHandleRef = useRef<HTMLButtonElement>(null);

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
    syncTableRailCellHighlight(tableHost, pinnedRailRef.current, editor);
    syncScrollFade();
  }, [editor, syncScrollFade, tableHost]);

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

  const syncCellHandle = useCallback(() => {
    if (
      pinnedRailRef.current
      || columnResizeSessionRef.current
      || rowResizeSessionRef.current
    ) {
      setCellHandle(prev => (prev == null ? prev : null));
      return;
    }
    const next = resolveTableCellHandle(editor, tableHost);
    if (!next) {
      setCellHandle(prev => (prev == null ? prev : null));
      return;
    }
    activateTableChrome();
    setCellHandle(prev =>
      prev
      && prev.row === next.row
      && prev.col === next.col
      && prev.mode === next.mode
      && prev.blockType === next.blockType
      && Math.abs(prev.left - next.left) < 0.5
      && Math.abs(prev.top - next.top) < 0.5
        ? prev
        : next,
    );
  }, [activateTableChrome, editor, tableHost]);

  const openCellInsertMenu = useCallback(
    (handle: TableCellHandleState, clientX: number, clientY: number) => {
      const tablePos = getTablePosFromHost(editor, tableHost);
      if (tablePos == null) return;
      const cellPos = resolveTableCellPos(editor, tablePos, handle.row, handle.col);
      if (cellPos == null) return;
      editor.chain().focus().setTextSelection(handle.cursorPos || cellPos + 1).run();
      window.dispatchEvent(new CustomEvent('feishu-open-table-cell-slash-menu', {
        detail: { x: clientX + 8, y: clientY + 8 },
      }));
    },
    [editor, tableHost],
  );

  const openCellBlockMenu = useCallback(
    (handle: TableCellHandleState, clientX: number, clientY: number) => {
      editor.chain().focus().run();
      window.dispatchEvent(new CustomEvent('feishu-open-table-cell-block-menu', {
        detail: {
          x: clientX,
          y: clientY,
          blockType: handle.blockType,
          cursorPos: handle.cursorPos,
        },
      }));
    },
    [editor],
  );

  const applyPinnedRail = useCallback(
    (pin: TableRailPin | null) => {
      const prev = pinnedRailRef.current;
      const samePin =
        (pin == null && prev == null)
        || (pin != null && prev != null && pin.kind === prev.kind && pin.index === prev.index);
      if (samePin) {
        syncTableRailCellHighlight(tableHost, pin, editor);
        if (pin) {
          tableSelectionPinnedRef.current = true;
          setTableSelectionPinned(true);
          setRailSelectionKind(pin.kind);
          setSelectionRange({
            left: pin.kind === 'col' ? pin.index : 0,
            right: pin.kind === 'col' ? pin.index + 1 : Math.max(0, (layout?.colBounds.length ?? 1) - 1),
            top: pin.kind === 'row' ? pin.index : 0,
            bottom: pin.kind === 'row' ? pin.index + 1 : Math.max(0, (layout?.rowBounds.length ?? 1) - 1),
          });
          tableHost.classList.add('feishu-table-host--selection-pinned');
          activateTableChrome();
        }
        return;
      }

      pinnedRailRef.current = pin;
      setPinnedRail(pin);
      syncTableRailCellHighlight(tableHost, pin, editor);
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
        right: pin.kind === 'col' ? pin.index + 1 : Math.max(0, (layout?.colBounds.length ?? 1) - 1),
        top: pin.kind === 'row' ? pin.index : 0,
        bottom: pin.kind === 'row' ? pin.index + 1 : Math.max(0, (layout?.rowBounds.length ?? 1) - 1),
      });
      tableHost.classList.add('feishu-table-host--selection-pinned');
      activateTableChrome();
    },
    [activateTableChrome, editor, layout, tableHost],
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
        const surface = getTableScrollFromHost(tableHost);
        const scrollLeft = surface.scrollLeft;
        suppressSelectionClearRef.current = true;
        applyPinnedRail({ kind: 'col', index: colIndex });
        editor.view.dispatch(state.tr.setSelection(selection));
        surface.scrollLeft = scrollLeft;
        syncTableRailCellHighlight(tableHost, { kind: 'col', index: colIndex }, editor);
        editor.view.focus();
        window.requestAnimationFrame(() => {
          surface.scrollLeft = scrollLeft;
          syncTableRailCellHighlight(tableHost, { kind: 'col', index: colIndex }, editor);
        });
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
        const surface = getTableScrollFromHost(tableHost);
        const scrollLeft = surface.scrollLeft;
        suppressSelectionClearRef.current = true;
        applyPinnedRail({ kind: 'row', index: rowIndex });
        editor.view.dispatch(state.tr.setSelection(selection));
        surface.scrollLeft = scrollLeft;
        syncTableRailCellHighlight(tableHost, { kind: 'row', index: rowIndex }, editor);
        editor.view.focus();
        window.requestAnimationFrame(() => {
          surface.scrollLeft = scrollLeft;
          syncTableRailCellHighlight(tableHost, { kind: 'row', index: rowIndex }, editor);
        });
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

  const beginRailDrag = useCallback(
    (index: number, e: ReactPointerEvent<HTMLDivElement>) => {
      if (!layout) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      activateTableChrome();
      clearHover();
      selectColumn(index);

      const pointerId = e.pointerId;
      const targetEl = e.currentTarget;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let latestTarget = index + 1;
      let previewActive = false;

      const resolveTarget = (event: PointerEvent) => {
        const mountRect = getTableChromeMountFromHost(tableHost).getBoundingClientRect();
        const coordinate = event.clientX - mountRect.left;
        return findNearestBoundary(layout.colBounds, coordinate);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (!dragging && distance < DRAG_THRESHOLD) return;
        dragging = true;
        const nextTarget = resolveTarget(event);
        if (nextTarget !== latestTarget || !previewActive) {
          latestTarget = nextTarget;
          previewActive = true;
          setRailDragPreview({ kind: 'col', from: index, target: nextTarget, active: true });
        }
      };

      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', finish);
        document.removeEventListener('pointercancel', finish);
        try {
          targetEl.releasePointerCapture?.(pointerId);
        } catch {
          // The pointer may already be released if the browser cancelled it.
        }
        setRailDragPreview(null);

        event.preventDefault();
        event.stopPropagation();

        if (!dragging) {
          return;
        }

        const tablePos = getTablePosFromHost(editor, tableHost);
        if (tablePos == null) return;
        const movedIndex = moveTableColumn(editor, tablePos, index, latestTarget);

        if (movedIndex == null) return;
        suppressSelectionClearRef.current = true;
        remeasureSoon();
        window.requestAnimationFrame(() => {
          selectColumn(movedIndex);
          window.setTimeout(() => {
            suppressSelectionClearRef.current = false;
          }, 120);
        });
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', finish);
      document.addEventListener('pointercancel', finish);
    },
    [
      activateTableChrome,
      clearHover,
      editor,
      layout,
      remeasureSoon,
      selectColumn,
      tableHost,
    ],
  );

  const applyColumnResizePreview = useCallback(
    (session: ColumnResizeSession) => {
      const table = getTableElementFromHost(tableHost);
      if (!table) return;
      const colgroup = table.querySelector('colgroup');
      if (!colgroup) return;

      let totalWidth = 0;
      session.widths.forEach((width, index) => {
        const nextWidth = index === session.colIndex ? session.nextWidth : width;
        totalWidth += nextWidth;
        const col = colgroup.children[index] as HTMLElement | undefined;
        if (col) col.style.width = `${nextWidth}px`;
      });
      table.style.width = `${totalWidth}px`;
      table.style.minWidth = '100%';
    },
    [tableHost],
  );

  const beginColumnResize = useCallback(
    (colIndex: number, e: ReactPointerEvent<HTMLDivElement>) => {
      if (!layout) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      activateTableChrome();
      clearHover();
      tableHost.classList.add('feishu-table-host--column-resizing');

      const widths = layout.colBounds.slice(0, -1).map((x, index) =>
        Math.max(MIN_COL_WIDTH, layout.colBounds[index + 1] - x),
      );
      const session: ColumnResizeSession = {
        colIndex,
        startX: e.clientX,
        startWidth: widths[colIndex] ?? MIN_COL_WIDTH,
        widths,
        nextWidth: widths[colIndex] ?? MIN_COL_WIDTH,
        raf: null,
      };
      columnResizeSessionRef.current = session;
      setColumnResizePreview({
        colIndex,
        x: layout.colBounds[colIndex + 1],
        active: true,
      });

      const pointerId = e.pointerId;
      const targetEl = e.currentTarget;

      const schedulePreview = (clientX: number) => {
        const activeSession = columnResizeSessionRef.current;
        if (!activeSession) return;
        activeSession.nextWidth = Math.max(
          MIN_COL_WIDTH,
          Math.round(activeSession.startWidth + clientX - activeSession.startX),
        );
        const nextX = layout.colBounds[colIndex] + activeSession.nextWidth;
        setColumnResizePreview({ colIndex, x: nextX, active: true });
        if (activeSession.raf != null) return;
        activeSession.raf = window.requestAnimationFrame(() => {
          activeSession.raf = null;
          applyColumnResizePreview(activeSession);
        });
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        schedulePreview(event.clientX);
      };

      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', finish);
        document.removeEventListener('pointercancel', finish);

        try {
          targetEl.releasePointerCapture?.(pointerId);
        } catch {
          // Pointer capture can already be gone after a browser cancel.
        }

        const activeSession = columnResizeSessionRef.current;
        columnResizeSessionRef.current = null;
        tableHost.classList.remove('feishu-table-host--column-resizing');
        setColumnResizePreview(null);

        if (!activeSession) return;
        if (activeSession.raf != null) {
          window.cancelAnimationFrame(activeSession.raf);
          activeSession.raf = null;
        }
        activeSession.nextWidth = Math.max(
          MIN_COL_WIDTH,
          Math.round(activeSession.startWidth + event.clientX - activeSession.startX),
        );
        applyColumnResizePreview(activeSession);

        const tablePos = getTablePosFromHost(editor, tableHost);
        if (tablePos == null) return;
        if (setTableColumnWidth(editor, tablePos, colIndex, activeSession.nextWidth)) {
          remeasureSoon();
        }
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', finish);
      document.addEventListener('pointercancel', finish);
    },
    [
      activateTableChrome,
      applyColumnResizePreview,
      clearHover,
      editor,
      layout,
      remeasureSoon,
      tableHost,
    ],
  );

  const applyRowResizePreview = useCallback(
    (session: RowResizeSession) => {
      const table = getTableElementFromHost(tableHost);
      const row = table?.querySelectorAll('tr')[session.rowIndex] as HTMLElement | undefined;
      if (row) row.style.height = `${session.nextHeight}px`;
    },
    [tableHost],
  );

  const beginRowResize = useCallback(
    (rowIndex: number, e: ReactPointerEvent<HTMLDivElement>) => {
      if (!layout) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      activateTableChrome();
      clearHover();
      tableHost.classList.add('feishu-table-host--row-resizing');
      const startHeight = Math.max(MIN_ROW_HEIGHT, layout.rowBounds[rowIndex + 1] - layout.rowBounds[rowIndex]);
      const session: RowResizeSession = {
        rowIndex,
        startY: e.clientY,
        startHeight,
        nextHeight: startHeight,
        raf: null,
      };
      rowResizeSessionRef.current = session;
      setRowResizePreview({ rowIndex, y: layout.rowBounds[rowIndex + 1], active: true });
      const pointerId = e.pointerId;
      const targetEl = e.currentTarget;
      const schedulePreview = (clientY: number) => {
        const active = rowResizeSessionRef.current;
        if (!active) return;
        active.nextHeight = Math.max(MIN_ROW_HEIGHT, Math.round(active.startHeight + clientY - active.startY));
        setRowResizePreview({ rowIndex, y: layout.rowBounds[rowIndex] + active.nextHeight, active: true });
        if (active.raf != null) return;
        active.raf = window.requestAnimationFrame(() => {
          active.raf = null;
          applyRowResizePreview(active);
        });
      };
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId === pointerId) schedulePreview(event.clientY);
      };
      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', finish);
        document.removeEventListener('pointercancel', finish);
        try {
          targetEl.releasePointerCapture?.(pointerId);
        } catch {
          // Pointer capture can already be gone after a browser cancel.
        }
        const active = rowResizeSessionRef.current;
        rowResizeSessionRef.current = null;
        tableHost.classList.remove('feishu-table-host--row-resizing');
        setRowResizePreview(null);
        if (!active) return;
        if (active.raf != null) window.cancelAnimationFrame(active.raf);
        active.nextHeight = Math.max(MIN_ROW_HEIGHT, Math.round(active.startHeight + event.clientY - active.startY));
        applyRowResizePreview(active);
        const tablePos = getTablePosFromHost(editor, tableHost);
        if (tablePos != null && setTableRowHeight(editor, tablePos, rowIndex, active.nextHeight)) remeasureSoon();
      };
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', finish);
      document.addEventListener('pointercancel', finish);
    },
    [activateTableChrome, applyRowResizePreview, clearHover, editor, layout, remeasureSoon, tableHost],
  );

  const releaseTableSelectionPinned = useCallback(() => {
    applyPinnedRail(null);
    setTableSelectionPinned(false);
    tableSelectionPinnedRef.current = false;
    setSelectedRail(null);
    setSelectionRange(null);
    setRailSelectionKind(null);
    tableHost.classList.remove('feishu-table-host--selection-pinned');
    tableHost.classList.remove('feishu-table-host--rail-col-selected');
    tableHost.classList.remove('feishu-table-host--rail-row-selected');
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

  useLayoutEffect(() => () => {
    const session = columnResizeSessionRef.current;
    if (session?.raf != null) window.cancelAnimationFrame(session.raf);
    columnResizeSessionRef.current = null;
    tableHost.classList.remove('feishu-table-host--column-resizing');
  }, [tableHost]);

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
    syncTableRailCellHighlight(tableHost, pinnedRailRef.current, editor);
  }, [editor, pinnedRail, tableHost]);

  useLayoutEffect(() => {
    syncCellHandle();
    const onChange = () => syncCellHandle();
    editor.on('selectionUpdate', onChange);
    editor.on('update', onChange);
    editor.on('focus', onChange);
    editor.on('blur', onChange);
    const mount = getTableChromeMountFromHost(tableHost);
    const onScroll = () => syncCellHandle();
    mount.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      editor.off('selectionUpdate', onChange);
      editor.off('update', onChange);
      editor.off('focus', onChange);
      editor.off('blur', onChange);
      mount.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [editor, syncCellHandle, tableHost]);

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
            } else {
              tableSelectionPinnedRef.current = true;
              setTableSelectionPinned(true);
              setRailSelectionKind('cell');
              setSelectedRail(null);
              selectedRailRef.current = null;
              tableHost.classList.add('feishu-table-host--selection-pinned');
              activateTableChrome();
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
      syncTableRailCellHighlight(tableHost, null, editor);
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
      if (target instanceof Element && target.closest('.feishu-table-chrome, .selection-bubble')) return;

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
    tableOffsetLeft,
    tableOffsetTop,
    surfaceOffsetLeft,
    viewportWidth,
    viewStart,
    tableHeight,
    tableWidth,
    colBounds,
    rowBounds,
  } = layout;

  const suppressInsertChrome = pinnedRail != null;

  const visibleLeft = surfaceOffsetLeft;
  const visibleWidth = viewportWidth;
  const handleLeft = visibleLeft - 4;
  const handleTop = tableOffsetTop - 4;
  const visibleSelection = selectionRange
    && colBounds[selectionRange.left] != null
    && colBounds[selectionRange.right] != null
    && rowBounds[selectionRange.top] != null
    && rowBounds[selectionRange.bottom] != null
    ? {
      left: Math.max(colBounds[selectionRange.left], viewStart),
      right: Math.min(colBounds[selectionRange.right], viewStart + viewportWidth),
      top: rowBounds[selectionRange.top],
      bottom: rowBounds[selectionRange.bottom],
    }
    : null;
  const clippedSelection = visibleSelection && visibleSelection.left < visibleSelection.right
    ? visibleSelection
    : null;
  const selectionToolbar = clippedSelection && (pinnedRail || railSelectionKind === 'cell')
    ? {
      left: (clippedSelection.left + clippedSelection.right) / 2,
      top: Math.max(0, clippedSelection.top - 48),
    }
    : null;
  const colHitsToRender = colBounds
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x > colBounds[0] + 2 && x < colBounds[colBounds.length - 1] - 2 && x >= viewStart && x <= viewStart + viewportWidth);

  const chrome = (
    <div
      className={`feishu-table-chrome${showChrome ? ' feishu-table-chrome--visible' : ''}${
        railDragPreview?.active ? ' feishu-table-chrome--dragging' : ''
      }`}
      data-no-marquee-selection="true"
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
        data-no-marquee-selection="true"
        data-block-action-button="true"
        style={{
          left: handleLeft,
          top: handleTop,
          transform: 'translate(-100%, -100%)',
        }}
        onMouseDown={e => e.preventDefault()}
        onPointerDown={e => onBlockDragStart?.(e, tableHost)}
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
        data-no-marquee-selection="true"
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
              data-no-marquee-selection="true"
              data-table-axis-handle="true"
              style={{
                left: clampedLeft - visibleLeft,
                width: clampedRight - clampedLeft,
              }}
              onPointerDown={e => beginRailDrag(i, e)}
              onMouseEnter={() => {
                if (suppressInsertChrome) return;
                setHoverCol(null);
              }}
            />
          );
        })}

        {colHitsToRender.map(({ x, i }) => (
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
              data-no-marquee-selection="true"
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
              data-no-marquee-selection="true"
              data-tooltip="插入列"
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
        data-no-marquee-selection="true"
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
              data-no-marquee-selection="true"
              data-table-axis-handle="true"
              style={{
                top: y - tableOffsetTop,
                height: rowBounds[i + 1] - y,
              }}
              onPointerDown={e => {
                e.preventDefault();
                e.stopPropagation();
                activateTableChrome();
                clearHover();
                selectRow(i);
              }}
              onMouseEnter={() => {
                if (suppressInsertChrome) return;
                setHoverRow(null);
              }}
            />
          );
        })}

        {rowBounds
          .map((y, i) => ({ y, i }))
          .filter(({ y }) => (
            rowBounds.length <= 2
              ? y >= rowBounds[0] - 1 && y <= rowBounds[rowBounds.length - 1] + 1
              : y > rowBounds[0] + 2 && y < rowBounds[rowBounds.length - 1] - 2
          ))
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
                data-no-marquee-selection="true"
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
                data-no-marquee-selection="true"
                data-tooltip="插入行"
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

      {railDragPreview?.active
        && railDragPreview.kind === 'col'
        && colBounds[railDragPreview.target] != null
        && isBoundVisible(colBounds[railDragPreview.target], viewStart, viewportWidth) && (
        <div
          className="feishu-table-chrome__drag-line feishu-table-chrome__drag-line--col"
          style={{
            left: colBounds[railDragPreview.target],
            top: tableOffsetTop,
            height: tableHeight,
          }}
        />
      )}

      {showChrome && colBounds.slice(1).map((x, boundaryIndex) => {
        const colIndex = boundaryIndex;
        if (!isBoundVisible(x, viewStart, viewportWidth)) return null;
        return (
          <div
            key={`resize-c-${colIndex}`}
            className="feishu-table-chrome__resize-col"
            data-no-marquee-selection="true"
            data-table-resize-handle="true"
            style={{
              left: x,
              top: tableOffsetTop,
              height: tableHeight,
            }}
            onPointerDown={e => beginColumnResize(colIndex, e)}
          />
        );
      })}

      {columnResizePreview?.active
        && isBoundVisible(columnResizePreview.x, viewStart, viewportWidth) && (
        <div
          className="feishu-table-chrome__resize-line feishu-table-chrome__resize-line--col"
          style={{
            left: columnResizePreview.x,
            top: tableOffsetTop,
            height: tableHeight,
          }}
        />
      )}

      {showChrome && rowBounds.slice(1).map((y, boundaryIndex) => (
        <div
          key={`resize-r-${boundaryIndex}`}
          className="feishu-table-chrome__resize-row"
          data-no-marquee-selection="true"
          data-table-resize-handle="true"
          style={{
            left: tableOffsetLeft,
            top: y,
            width: tableWidth,
          }}
          onPointerDown={e => beginRowResize(boundaryIndex, e)}
        />
      ))}

      {rowResizePreview?.active && (
        <div
          className="feishu-table-chrome__resize-line feishu-table-chrome__resize-line--row"
          style={{
            left: tableOffsetLeft,
            top: rowResizePreview.y,
            width: tableWidth,
          }}
        />
      )}

      {clippedSelection && (
        <div
          className={`feishu-table-chrome__selection-outline feishu-table-chrome__selection-outline--${railSelectionKind ?? 'cell'}`}
          style={{
            left: clippedSelection.left,
            top: clippedSelection.top,
            width: clippedSelection.right - clippedSelection.left,
            height: clippedSelection.bottom - clippedSelection.top,
          }}
        />
      )}

      {selectionToolbar && (
        <TableSelectionToolbar
          editor={editor}
          pinnedRail={pinnedRail}
          left={selectionToolbar.left}
          top={selectionToolbar.top}
        />
      )}

      {cellHandle && !pinnedRail && !railDragPreview?.active && !columnResizePreview?.active && !rowResizePreview?.active && (
        cellHandle.mode === 'insert' ? (
          <button
            type="button"
            className="feishu-table-chrome__cell-handle feishu-table-chrome__cell-handle--insert"
            data-no-marquee-selection="true"
            data-floating-panel="true"
            style={{ left: cellHandle.left, top: cellHandle.top }}
            aria-label="插入内容"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerEnter={() => {
              activateTableChrome();
              onCancelCloseBlockMenu();
            }}
            onMouseEnter={e => {
              activateTableChrome();
              onCancelCloseBlockMenu();
              const key = `${cellHandle.row}:${cellHandle.col}:insert`;
              if (cellHandleOpenKeyRef.current === key) return;
              cellHandleOpenKeyRef.current = key;
              openCellInsertMenu(cellHandle, e.clientX, e.clientY);
            }}
            onMouseLeave={e => {
              const next = e.relatedTarget;
              if (next instanceof Element && next.closest('.slash-menu, .slash-submenu-portal')) return;
              cellHandleOpenKeyRef.current = null;
            }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              activateTableChrome();
              openCellInsertMenu(cellHandle, e.clientX, e.clientY);
            }}
          >
            <span className="feishu-table-chrome__cell-handle-plus-box">
              <IconAddOutlined size={14} color="currentColor" />
            </span>
          </button>
        ) : (
          <button
            ref={cellHandleRef}
            type="button"
            className="feishu-table-chrome__cell-handle feishu-table-chrome__cell-handle--block"
            data-no-marquee-selection="true"
            data-floating-panel="true"
            style={{ left: cellHandle.left, top: cellHandle.top }}
            aria-label="块配置"
            onMouseDown={e => e.preventDefault()}
            onMouseEnter={e => {
              activateTableChrome();
              onCancelCloseBlockMenu();
              const rect = e.currentTarget.getBoundingClientRect();
              openCellBlockMenu(cellHandle, rect.left, rect.bottom);
            }}
            onMouseLeave={e => {
              const next = e.relatedTarget;
              if (next instanceof Element && next.closest('.context-menu, .context-submenu-flyout')) return;
              onScheduleCloseBlockMenu();
            }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              activateTableChrome();
              const rect = e.currentTarget.getBoundingClientRect();
              openCellBlockMenu(cellHandle, rect.left, rect.bottom);
            }}
          >
            <div className="feishu-table-chrome__cell-handle-drag">
              <div className="feishu-table-chrome__cell-handle-type">
                <span className="menu_ud_icon color-b-500">
                  <BlockGutterGlyph type={cellHandle.blockType} />
                </span>
              </div>
              <span className="feishu-table-chrome__cell-handle-grip" aria-hidden>
                <IconDragOutlined size={16} color="#8f959e" />
              </span>
            </div>
          </button>
        )
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
