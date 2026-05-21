import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import type { SlashMenuItem } from './slashMenuConfig';
import { SLASH_SECTIONS, itemMatchesQuery } from './slashMenuConfig';
import TableGridPicker from './TableGridPicker';
import ColumnsCountPicker from './ColumnsCountPicker';
import { insertFeishuTable } from './tableInsert';
import { insertFeishuColumns } from './columnsInsert';
import './SlashMenu.less';

interface Props {
  editor: Editor;
  position: { top: number; left: number };
  query: string;
  onClose: () => void;
  onBeforeSelect?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  variant?: 'fixed' | 'anchored';
  anchorRef?: RefObject<HTMLElement | null>;
}

export default function SlashMenu({ editor, position, query, onClose, onBeforeSelect, onMouseEnter, onMouseLeave, variant = 'fixed', anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const tableFlyoutRef = useRef<HTMLDivElement>(null);
  const columnsFlyoutRef = useRef<HTMLDivElement>(null);
  const tableSubMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnsSubMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [renderPos, setRenderPos] = useState(position);
  const [tooltipItem, setTooltipItem] = useState<{ item: SlashMenuItem; rect: DOMRect } | null>(null);
  const [tableGridFlyoutPos, setTableGridFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [columnsCountFlyoutPos, setColumnsCountFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const filteredSections = SLASH_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(item => itemMatchesQuery(item, query)),
  })).filter(s => s.items.length > 0);

  const allItems = filteredSections.flatMap(s => s.items);

  const clearTableSubMenuTimer = () => {
    if (tableSubMenuCloseTimerRef.current) {
      clearTimeout(tableSubMenuCloseTimerRef.current);
      tableSubMenuCloseTimerRef.current = null;
    }
  };

  const clearColumnsSubMenuTimer = () => {
    if (columnsSubMenuCloseTimerRef.current) {
      clearTimeout(columnsSubMenuCloseTimerRef.current);
      columnsSubMenuCloseTimerRef.current = null;
    }
  };

  const scheduleTableSubMenuClose = () => {
    clearTableSubMenuTimer();
    tableSubMenuCloseTimerRef.current = setTimeout(() => setTableGridFlyoutPos(null), 220);
  };

  const scheduleColumnsSubMenuClose = () => {
    clearColumnsSubMenuTimer();
    columnsSubMenuCloseTimerRef.current = setTimeout(() => setColumnsCountFlyoutPos(null), 220);
  };

  function isInsideColumnsFlyout(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('.slash-columns-count-flyout'));
  }

  function isInsideTableFlyout(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('.slash-table-grid-flyout'));
  }

  function closeColumnsFlyout() {
    clearColumnsSubMenuTimer();
    setColumnsCountFlyoutPos(null);
  }

  function closeTableFlyout() {
    clearTableSubMenuTimer();
    setTableGridFlyoutPos(null);
  }

  function closeSubmenuFlyouts() {
    closeTableFlyout();
    closeColumnsFlyout();
  }

  const openTableGridFlyout = (el: HTMLElement) => {
    clearTableSubMenuTimer();
    setColumnsCountFlyoutPos(null);
    const r = el.getBoundingClientRect();
    const pad = 8;
    const panelW = 220;
    const gap = 0;
    let left = r.right + gap;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, r.left - panelW - gap);
    }
    let top = r.top;
    const panelH = 240;
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - panelH);
    }
    setTableGridFlyoutPos({ top, left });
  };

  const openColumnsCountFlyout = (el: HTMLElement) => {
    clearColumnsSubMenuTimer();
    setTableGridFlyoutPos(null);
    const r = el.getBoundingClientRect();
    const pad = 8;
    const panelW = 292;
    const gap = 2;
    let left = r.right + gap;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, r.left - panelW - gap);
    }
    let top = r.top - 2;
    const panelH = 214;
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - panelH);
    }
    setColumnsCountFlyoutPos({ top, left });
  };

  useEffect(() => {
    if (allItems.length === 0) onClose();
  }, [allItems.length, onClose]);

  useEffect(() => {
    setActiveIdx(0);
    setTableGridFlyoutPos(null);
    setColumnsCountFlyoutPos(null);
  }, [query]);

  useLayoutEffect(() => {
    if (variant === 'anchored') {
      setRenderPos(position);
      return;
    }
    const menuEl = menuRef.current;
    if (!menuEl) {
      setRenderPos(position);
      return;
    }
    const pad = 8;
    const gap = 8;
    const menuRect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { left, top } = position;

    const anchorEl = anchorRef?.current;
    if (anchorEl?.isConnected) {
      const anchor = anchorEl.getBoundingClientRect();
      left = anchor.left - gap;
    } else {
      left = Math.max(pad, Math.min(left, vw - menuRect.width - pad));
    }

    top = Math.max(pad, Math.min(top, vh - menuRect.height - pad));
    setRenderPos(prev => (prev.left === left && prev.top === top ? prev : { left, top }));
  }, [position, variant, anchorRef, query]);

  useEffect(() => {
    const active = menuRef.current?.querySelector('.slash-item.active, .slash-basic-cell.active') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, Math.max(0, allItems.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onBeforeSelect?.();
        allItems[activeIdx]?.action(editor);
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      clearTableSubMenuTimer();
      clearColumnsSubMenuTimer();
    };
  }, [allItems, activeIdx, editor, onBeforeSelect, onClose]);

  if (allItems.length === 0) return null;

  let globalIdx = 0;
  const gridStroke = 1.65;
  const listStroke = 1.55;

  const showTooltip = (item: SlashMenuItem, el: HTMLElement) => {
    if (item.submenu === 'tableGrid' || item.submenu === 'columnsCount') return;
    clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipItem({ item, rect: el.getBoundingClientRect() });
    }, 400);
  };

  const hideTooltip = () => {
    clearTimeout(tooltipTimerRef.current);
    setTooltipItem(null);
  };

  const hasTooltipContent = (item: SlashMenuItem) =>
    item.tooltip && (item.tooltip.shortcut || item.tooltip.markdown);

  const getTooltipPosition = (rect: DOMRect) => {
    const pad = 8;
    const approxW = 220;
    const approxH = 48;
    let top = rect.top - 8;
    let transform = 'translate(-50%, -100%)';
    if (top - approxH < pad) {
      top = rect.bottom + 8;
      transform = 'translate(-50%, 0)';
    }
    const minLeft = pad + approxW / 2;
    const maxLeft = window.innerWidth - pad - approxW / 2;
    const left = Math.max(minLeft, Math.min(rect.left + rect.width / 2, maxLeft));
    return { top, left, transform };
  };

  const runItemAction = (item: SlashMenuItem) => {
    onBeforeSelect?.();
    item.action(editor);
    onClose();
  };

  const handleTablePick = (rows: number, cols: number) => {
    onBeforeSelect?.();
    insertFeishuTable(editor, rows, cols);
    onClose();
  };

  const handleColumnsPick = (columnCount: number) => {
    onBeforeSelect?.();
    insertFeishuColumns(editor, columnCount);
    onClose();
  };

  const tooltipPortal = tooltipItem && hasTooltipContent(tooltipItem.item)
    ? createPortal(
        <div
          className="slash-tooltip"
          style={getTooltipPosition(tooltipItem.rect)}
        >
          <div className="slash-tooltip__line1">
            {tooltipItem.item.label}
            {tooltipItem.item.tooltip!.shortcut && (
              <span className="slash-tooltip__shortcut"> ({tooltipItem.item.tooltip!.shortcut})</span>
            )}
          </div>
          {tooltipItem.item.tooltip!.markdown && (
            <div className="slash-tooltip__line2">
              Markdown: {tooltipItem.item.tooltip!.markdown}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  const tableGridFlyout =
    tableGridFlyoutPos &&
    createPortal(
      <div
        ref={tableFlyoutRef}
        className="slash-table-grid-flyout"
        style={{
          position: 'fixed',
          top: tableGridFlyoutPos.top,
          left: tableGridFlyoutPos.left,
          zIndex: 10060,
        }}
        onMouseEnter={() => {
          clearTableSubMenuTimer();
          onMouseEnter?.();
        }}
        onMouseLeave={(e) => {
          const next = e.relatedTarget;
          if (isInsideTableFlyout(next)) return;
          if (next instanceof Element && next.closest('.slash-menu')) {
            scheduleTableSubMenuClose();
            return;
          }
          closeTableFlyout();
          onMouseLeave?.();
        }}
        onMouseDown={e => e.preventDefault()}
      >
        <TableGridPicker onPick={handleTablePick} />
      </div>,
      document.body,
    );

  const columnsCountFlyout =
    columnsCountFlyoutPos &&
    createPortal(
      <div
        ref={columnsFlyoutRef}
        className="slash-columns-count-flyout"
        style={{
          position: 'fixed',
          top: columnsCountFlyoutPos.top,
          left: columnsCountFlyoutPos.left,
          zIndex: 10060,
        }}
        onMouseEnter={() => {
          clearColumnsSubMenuTimer();
          onMouseEnter?.();
        }}
        onMouseLeave={(e) => {
          const next = e.relatedTarget;
          if (isInsideColumnsFlyout(next)) return;
          if (next instanceof Element && next.closest('.slash-menu')) {
            scheduleColumnsSubMenuClose();
            return;
          }
          closeColumnsFlyout();
          onMouseLeave?.();
        }}
        onMouseDown={e => e.preventDefault()}
      >
        <ColumnsCountPicker onPick={handleColumnsPick} />
      </div>,
      document.body,
    );

  return (
    <Fragment>
      <div
        className={`slash-menu slash-menu-feishu${variant === 'anchored' ? ' slash-menu--anchored' : ''}${anchorRef ? ' slash-menu--plus-anchor' : ''}`}
        ref={menuRef}
        style={variant === 'anchored' ? undefined : { top: renderPos.top, left: renderPos.left }}
        onMouseEnter={onMouseEnter}
        onScroll={hideTooltip}
        onMouseLeave={() => {
          hideTooltip();
          scheduleTableSubMenuClose();
          scheduleColumnsSubMenuClose();
          onMouseLeave?.();
        }}
      >
        {filteredSections.map(section => (
          <div
            key={section.title}
            className={`slash-section slash-section--${section.layout}${section.gridMuted ? ' slash-section--grid-muted' : ''}`}
          >
            <div className="slash-section-title">{section.title}</div>
            {section.layout === 'grid' ? (
              <div className="slash-basic-grid">
                {section.items.map(item => {
                  const idx = globalIdx++;
                  const Icon = item.Icon;
                  const tint = item.iconColor ?? '#1f2329';
                  return (
                    <button
                      key={`${section.title}-${item.label}`}
                      type="button"
                      className={`slash-basic-cell ${idx === activeIdx ? 'active' : ''}`}
                      aria-label={item.label}
                      onMouseEnter={e => {
                        setActiveIdx(idx);
                        closeSubmenuFlyouts();
                        if (hasTooltipContent(item)) showTooltip(item, e.currentTarget);
                      }}
                      onMouseLeave={hideTooltip}
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        runItemAction(item);
                      }}
                    >
                      <span className="slash-basic-cell-icon" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                        <Icon size={18} strokeWidth={gridStroke} fill={tint} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              section.items.map(item => {
                const idx = globalIdx++;
                const Icon = item.Icon;
                const tint = item.iconColor ?? '#1f2329';
                const isTableGrid = item.submenu === 'tableGrid';
                const isColumnsCount = item.submenu === 'columnsCount';
                const hasSubmenu = isTableGrid || isColumnsCount;
                return (
                  <div
                    key={`${section.title}-${item.label}`}
                    className={`slash-item ${idx === activeIdx ? 'active' : ''}${hasSubmenu ? ' slash-item--has-submenu' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={item.label}
                    onMouseEnter={e => {
                      setActiveIdx(idx);
                      if (isTableGrid) {
                        hideTooltip();
                        closeColumnsFlyout();
                        openTableGridFlyout(e.currentTarget);
                      } else if (isColumnsCount) {
                        hideTooltip();
                        closeTableFlyout();
                        openColumnsCountFlyout(e.currentTarget);
                      } else {
                        closeSubmenuFlyouts();
                        if (hasTooltipContent(item)) {
                          showTooltip(item, e.currentTarget);
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!hasSubmenu) hideTooltip();
                      if (isTableGrid) {
                        if (isInsideTableFlyout(e.relatedTarget)) return;
                        if (e.relatedTarget instanceof Element && e.relatedTarget.closest('.slash-menu')) {
                          closeTableFlyout();
                          return;
                        }
                        scheduleTableSubMenuClose();
                      }
                      if (isColumnsCount) {
                        if (isInsideColumnsFlyout(e.relatedTarget)) return;
                        if (e.relatedTarget instanceof Element && e.relatedTarget.closest('.slash-menu')) {
                          closeColumnsFlyout();
                          return;
                        }
                        scheduleColumnsSubMenuClose();
                      }
                    }}
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!hasSubmenu) runItemAction(item);
                    }}
                  >
                    <span className="slash-icon-wrap" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                      <Icon size={18} strokeWidth={listStroke} fill={tint} />
                    </span>
                    <span className="slash-label">{item.label}</span>
                    {item.hasArrow && (
                      <span className="slash-arrow" aria-hidden>
                        <IconChevronMenuEnd size={14} color="#8f959e" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}

      </div>
      {tableGridFlyout}
      {columnsCountFlyout}
      {tooltipPortal}
    </Fragment>
  );
}
