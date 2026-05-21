import type { Editor } from '@tiptap/react';
import { useCallback, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { IconDragOutlined } from '../../icons/feishuDoc';
import { SlashGlyphTable } from '../../icons/slashMenuGlyphs';
import {
  getTableChromeMountFromHost,
  getTableElementFromHost,
  getTableScrollFromHost,
  syncTableScrollEdgeFade,
} from './tableDom';
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
    viewportWidth,
    viewStart,
    scrollLeft,
    tableWidth: table.offsetWidth,
    tableHeight,
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
  const chromeVisibleRef = useRef(chromeVisible);
  const hideChromeTimerRef = useRef<number | null>(null);

  pinChromeRef.current = pinChrome;
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
      tableHoverRef.current = false;
      syncHostChromeHot(tableHost, false);
      setChromeVisible(false);
      syncTableScrollEdgeFade(tableHost, false);
      clearHover();
    }, 280);
  }, [cancelHideChrome, clearHover, tableHost]);

  const showChrome = chromeVisible || handleHovered || pinChrome;

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
      setLayout(null);
      syncTableScrollEdgeFade(tableHost, false);
      return;
    }
    setLayout(measureTableLayout(tableHost));
    syncScrollFade();
  }, [syncScrollFade, tableHost]);

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
    const surface = getTableScrollFromHost(tableHost);
    const ro = new ResizeObserver(remeasureSoon);
    ro.observe(tableHost);
    ro.observe(surface);
    const table = getTableElementFromHost(tableHost);
    let mo: MutationObserver | null = null;
    if (table) ro.observe(table);
    mo = new MutationObserver(remeasureSoon);
    if (table) mo.observe(table, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', remeasureSoon);
    document.addEventListener('scroll', remeasureSoon, true);
    surface.addEventListener('scroll', remeasureSoon, { passive: true });
    return () => {
      ro.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', remeasureSoon);
      document.removeEventListener('scroll', remeasureSoon, true);
      surface.removeEventListener('scroll', remeasureSoon);
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
    chromeVisibleRef.current = true;
    setChromeVisible(true);
    syncTableScrollEdgeFade(tableHost, true);
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
      if (!pinChromeRef.current) syncHostChromeHot(tableHost, false);
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

  useLayoutEffect(() => {
    if (pinChrome) {
      activateTableChrome();
      return;
    }
    if (
      tableHoverRef.current
      || handleHoverRef.current
      || isPointerOverHost(tableHost)
    ) {
      return;
    }
    syncHostChromeHot(tableHost, false);
    chromeVisibleRef.current = false;
    setChromeVisible(false);
    syncTableScrollEdgeFade(tableHost, false);
  }, [activateTableChrome, pinChrome, tableHost]);

  if (!layout || !tableHost.isConnected) return null;

  const {
    tableOffsetLeft,
    tableOffsetTop,
    viewportWidth,
    viewStart,
    tableWidth,
    tableHeight,
    colBounds,
    rowBounds,
  } = layout;

  const handleLeft = tableOffsetLeft;
  const visibleColHits = colBounds
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => isBoundVisible(x, viewStart, viewportWidth));
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
          left: tableOffsetLeft,
          top: tableOffsetTop - RAIL,
          width: tableWidth,
          height: RAIL,
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
            className={[
              'feishu-table-chrome__hit feishu-table-chrome__hit--col',
              hoverCol === i ? 'is-active' : '',
              i === 0 ? 'is-edge-start' : '',
              i === colBounds.length - 1 ? 'is-edge-end' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: x - tableOffsetLeft }}
            onMouseEnter={() => {
              activateTableChrome();
              setHoverRow(null);
              setHoverCol(i);
            }}
          >
            <span className="feishu-table-chrome__dot" aria-hidden />
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
          left: tableOffsetLeft - RAIL,
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
        {rowBounds.map((y, i) => (
          <div
            key={`r-${i}`}
            className={[
              'feishu-table-chrome__hit feishu-table-chrome__hit--row',
              hoverRow === i ? 'is-active' : '',
              i === 0 ? 'is-edge-start' : '',
              i === rowBounds.length - 1 ? 'is-edge-end' : '',
            ].filter(Boolean).join(' ')}
            style={{ top: y - tableOffsetTop }}
            onMouseEnter={() => {
              activateTableChrome();
              setHoverCol(null);
              setHoverRow(i);
            }}
          >
            <span className="feishu-table-chrome__dot" aria-hidden />
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

      {hoverCol != null && isBoundVisible(colBounds[hoverCol], viewStart, viewportWidth) && (
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

      {hoverRow != null && (
        <div
          className="feishu-table-chrome__insert-row"
          style={{
            left: tableOffsetLeft,
            top: rowBounds[hoverRow],
            width: tableWidth,
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
