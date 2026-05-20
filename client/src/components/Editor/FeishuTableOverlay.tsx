import type { Editor } from '@tiptap/react';
import { useCallback, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { IconDragOutlined } from '../../icons/feishuDoc';
import { SlashGlyphTable } from '../../icons/slashMenuGlyphs';
import { getTableChromeMountFromHost, getTableElementFromHost } from './tableDom';
import {
  getTablePosFromHost,
  insertTableColumnAtBoundary,
  insertTableRowAtBoundary,
  selectTableNodeFromHost,
} from './tableInsert';
import './FeishuTableOverlay.less';

const RAIL = 12;
const HIT_MARGIN = 12;
const HOST_CHROME_HOT_CLASS = 'feishu-table-host--chrome-hot';

function syncHostChromeHot(host: HTMLElement, active: boolean) {
  host.classList.toggle(HOST_CHROME_HOT_CLASS, active);
}

function isPointerOverHost(host: HTMLElement): boolean {
  return host.matches(':hover');
}

interface TableLayout {
  tableOffsetLeft: number;
  tableOffsetTop: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  tableWidth: number;
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

function isBoundVisible(pos: number, viewport: number): boolean {
  return pos >= -HIT_MARGIN && pos <= viewport + HIT_MARGIN;
}

/** 坐标相对 tableHost 可视区域（getBoundingClientRect，含横向滚动后的屏幕位置） */
function measureTableLayout(host: HTMLElement): TableLayout | null {
  const table = getTableElementFromHost(host);
  if (!table) return null;

  const hostRect = host.getBoundingClientRect();
  const scrollLeft = host.scrollLeft;
  const tableRect = table.getBoundingClientRect();
  const tableOffsetLeft = tableRect.left - hostRect.left;
  const tableOffsetTop = tableRect.top - hostRect.top;

  const trs = Array.from(table.querySelectorAll('tr'));
  const rowBounds: number[] = [];
  for (const tr of trs) {
    const r = tr.getBoundingClientRect();
    rowBounds.push(r.top - hostRect.top);
  }
  if (trs.length > 0) {
    const lastTr = trs[trs.length - 1] as HTMLElement;
    const r = lastTr.getBoundingClientRect();
    rowBounds.push(r.bottom - hostRect.top);
  }

  const cells = trs[0] ? Array.from(trs[0].querySelectorAll('th, td')) : [];
  const colBounds: number[] = [];
  for (const cell of cells) {
    const r = (cell as HTMLElement).getBoundingClientRect();
    colBounds.push(r.left - hostRect.left);
  }
  if (cells.length > 0) {
    const last = cells[cells.length - 1] as HTMLElement;
    const r = last.getBoundingClientRect();
    colBounds.push(r.right - hostRect.left);
  }

  const viewportWidth = host.clientWidth;
  const viewportHeight = Math.max(host.clientHeight, hostRect.height);

  return {
    tableOffsetLeft,
    tableOffsetTop,
    viewportWidth,
    viewportHeight,
    scrollLeft,
    tableWidth: table.offsetWidth,
    rowBounds,
    colBounds,
  };
}

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

  const tableHoverRef = useRef(false);
  const handleHoverRef = useRef(false);
  const pinChromeRef = useRef(pinChrome);
  const hideChromeTimerRef = useRef<number | null>(null);

  pinChromeRef.current = pinChrome;

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
      tableHoverRef.current = false;
      syncHostChromeHot(tableHost, false);
      setChromeVisible(false);
      clearHover();
    }, 280);
  }, [cancelHideChrome, clearHover, tableHost]);

  const showChrome = chromeVisible || handleHovered || pinChrome;
  const railOpacity = showChrome ? 1 : 0;
  const handleOpacity = showChrome || handleHovered ? 1 : 0;

  const remeasure = useCallback(() => {
    if (!tableHost.isConnected) {
      setLayout(null);
      return;
    }
    setLayout(measureTableLayout(tableHost));
  }, [tableHost]);

  const remeasureSoon = useCallback(() => {
    remeasure();
    requestAnimationFrame(() => {
      remeasure();
      requestAnimationFrame(remeasure);
    });
  }, [remeasure]);

  useLayoutEffect(() => {
    setLayout(measureTableLayout(tableHost));
    remeasureSoon();
    const ro = new ResizeObserver(remeasureSoon);
    ro.observe(tableHost);
    const table = getTableElementFromHost(tableHost);
    let mo: MutationObserver | null = null;
    if (table) ro.observe(table);
    mo = new MutationObserver(remeasureSoon);
    if (table) mo.observe(table, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', remeasureSoon);
    document.addEventListener('scroll', remeasureSoon, true);
    tableHost.addEventListener('scroll', remeasureSoon);
    return () => {
      ro.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', remeasureSoon);
      document.removeEventListener('scroll', remeasureSoon, true);
      tableHost.removeEventListener('scroll', remeasureSoon);
    };
  }, [remeasureSoon, tableHost]);

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
    setChromeVisible(true);
  }, [cancelHideChrome, tableHost]);

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
      tableHoverRef.current = false;
      syncHostChromeHot(tableHost, false);
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

  useLayoutEffect(() => {
    if (!layout) return;
    if (isPointerOverHost(tableHost)) activateTableChrome();
  }, [activateTableChrome, layout, tableHost]);

  useLayoutEffect(() => () => cancelHideChrome(), [cancelHideChrome]);

  if (!layout || !tableHost.isConnected) return null;

  const {
    tableOffsetLeft,
    tableOffsetTop,
    viewportWidth,
    viewportHeight,
    tableWidth,
    colBounds,
    rowBounds,
  } = layout;

  const handleLeft = tableOffsetLeft;
  const visibleColHits = colBounds
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => isBoundVisible(x, viewportWidth));
  const colHitsToRender =
    visibleColHits.length > 0 ? visibleColHits : colBounds.map((x, i) => ({ x, i }));

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
        scheduleHideChrome();
      }}
    >
      <button
        ref={handleRef}
        type="button"
        className={`feishu-table-chrome__handle${handleHovered ? ' is-hovered' : ''}`}
        style={{
          left: handleLeft,
          top: tableOffsetTop,
          transform: 'translate(-100%, -100%)',
          opacity: handleOpacity,
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
          left: 0,
          top: Math.max(0, tableOffsetTop - RAIL),
          width: viewportWidth,
          height: RAIL,
          opacity: railOpacity,
        }}
        onMouseEnter={activateTableChrome}
        onMouseLeave={e => {
          const next = e.relatedTarget;
          if (next instanceof Element && next.closest('.feishu-table-chrome__insert-col')) return;
          setHoverCol(null);
        }}
      >
        {colHitsToRender.map(({ x, i }) => (
          <div
            key={`c-${i}`}
            className={`feishu-table-chrome__hit feishu-table-chrome__hit--col${hoverCol === i ? ' is-active' : ''}`}
            style={{ left: x }}
            onMouseEnter={() => {
              activateTableChrome();
              setHoverRow(null);
              setHoverCol(i);
            }}
          >
            <span
              className="feishu-table-chrome__dot"
              style={{ opacity: showChrome && hoverCol !== i ? 1 : 0 }}
              aria-hidden
            />
            <button
              type="button"
              className="feishu-table-chrome__rail-plus feishu-table-chrome__rail-plus--col"
              aria-label="插入列"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runInsertColumn(i)}
            >
              <span className="feishu-table-chrome__rail-plus-icon">+</span>
            </button>
          </div>
        ))}
      </div>

      <div
        className="feishu-table-chrome__rail-left"
        style={{
          left: Math.max(0, tableOffsetLeft - RAIL),
          top: tableOffsetTop,
          width: RAIL,
          height: viewportHeight - tableOffsetTop,
          opacity: railOpacity,
        }}
        onMouseEnter={activateTableChrome}
        onMouseLeave={e => {
          const next = e.relatedTarget;
          if (next instanceof Element && next.closest('.feishu-table-chrome__insert-row')) return;
          setHoverRow(null);
        }}
      >
        {rowBounds.map((y, i) => (
          <div
            key={`r-${i}`}
            className={`feishu-table-chrome__hit feishu-table-chrome__hit--row${hoverRow === i ? ' is-active' : ''}`}
            style={{ top: y - tableOffsetTop }}
            onMouseEnter={() => {
              activateTableChrome();
              setHoverCol(null);
              setHoverRow(i);
            }}
          >
            <span
              className="feishu-table-chrome__dot"
              style={{ opacity: showChrome && hoverRow !== i ? 1 : 0 }}
              aria-hidden
            />
            <button
              type="button"
              className="feishu-table-chrome__rail-plus feishu-table-chrome__rail-plus--row"
              aria-label="插入行"
              onMouseDown={e => e.preventDefault()}
              onClick={() => runInsertRow(i)}
            >
              <span className="feishu-table-chrome__rail-plus-icon">+</span>
            </button>
          </div>
        ))}
      </div>

      {hoverCol != null && isBoundVisible(colBounds[hoverCol], viewportWidth) && (
        <div
          className="feishu-table-chrome__insert-col"
          style={{
            left: colBounds[hoverCol],
            top: tableOffsetTop,
            height: viewportHeight,
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

      {hoverRow != null && (
        <div
          className="feishu-table-chrome__insert-row"
          style={{
            left: tableOffsetLeft,
            top: rowBounds[hoverRow],
            width: Math.min(viewportWidth, Math.max(0, tableOffsetLeft + tableWidth)),
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
