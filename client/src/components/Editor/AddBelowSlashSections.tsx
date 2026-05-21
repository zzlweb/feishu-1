import { Fragment, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import { SLASH_SECTIONS, type SlashMenuItem } from './slashMenuConfig';
import TableGridPicker from './TableGridPicker';
import ColumnsCountPicker from './ColumnsCountPicker';

const GRID_STROKE = 1.65;
const LIST_STROKE = 1.55;

interface Props {
  onPickItem: (sectionTitle: string, item: SlashMenuItem) => void;
  onPickTable: (rows: number, cols: number) => void;
  onPickColumns: (columnCount: number) => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: (e: MouseEvent) => void;
}

export default function AddBelowSlashSections({
  onPickItem,
  onPickTable,
  onPickColumns,
  onPanelMouseEnter,
  onPanelMouseLeave,
}: Props) {
  const tableFlyoutRef = useRef<HTMLDivElement>(null);
  const columnsFlyoutRef = useRef<HTMLDivElement>(null);
  const tableCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tableFlyoutPos, setTableFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [columnsFlyoutPos, setColumnsFlyoutPos] = useState<{ top: number; left: number } | null>(null);

  const clearTableTimer = () => {
    if (tableCloseTimerRef.current) {
      clearTimeout(tableCloseTimerRef.current);
      tableCloseTimerRef.current = null;
    }
  };

  const clearColumnsTimer = () => {
    if (columnsCloseTimerRef.current) {
      clearTimeout(columnsCloseTimerRef.current);
      columnsCloseTimerRef.current = null;
    }
  };

  const scheduleTableClose = () => {
    clearTableTimer();
    tableCloseTimerRef.current = setTimeout(() => setTableFlyoutPos(null), 220);
  };

  const scheduleColumnsClose = () => {
    clearColumnsTimer();
    columnsCloseTimerRef.current = setTimeout(() => setColumnsFlyoutPos(null), 220);
  };

  const openTableFlyout = (el: HTMLElement) => {
    clearTableTimer();
    setColumnsFlyoutPos(null);
    const r = el.getBoundingClientRect();
    const pad = 8;
    const panelW = 220;
    const gap = 2;
    let left = r.right + gap;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, r.left - panelW - gap);
    }
    let top = r.top - 2;
    const panelH = 240;
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - panelH);
    }
    setTableFlyoutPos({ top, left });
  };

  const openColumnsFlyout = (el: HTMLElement) => {
    clearColumnsTimer();
    setTableFlyoutPos(null);
    const r = el.getBoundingClientRect();
    const pad = 8;
    const panelW = 184;
    const gap = 2;
    let left = r.right + gap;
    if (left + panelW > window.innerWidth - pad) {
      left = Math.max(pad, r.left - panelW - gap);
    }
    let top = r.top - 2;
    const panelH = 96;
    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - panelH);
    }
    setColumnsFlyoutPos({ top, left });
  };

  const tableFlyout =
    tableFlyoutPos &&
    createPortal(
      <div
        ref={tableFlyoutRef}
        className="slash-table-grid-flyout"
        style={{
          position: 'fixed',
          top: tableFlyoutPos.top,
          left: tableFlyoutPos.left,
          zIndex: 10070,
        }}
        onMouseEnter={() => {
          clearTableTimer();
          onPanelMouseEnter?.();
        }}
        onMouseLeave={e => {
          scheduleTableClose();
          onPanelMouseLeave?.(e);
        }}
        onMouseDown={e => e.preventDefault()}
      >
        <TableGridPicker onPick={onPickTable} />
      </div>,
      document.body,
    );

  const columnsFlyout =
    columnsFlyoutPos &&
    createPortal(
      <div
        ref={columnsFlyoutRef}
        className="slash-columns-count-flyout"
        style={{
          position: 'fixed',
          top: columnsFlyoutPos.top,
          left: columnsFlyoutPos.left,
          zIndex: 10070,
        }}
        onMouseEnter={() => {
          clearColumnsTimer();
          onPanelMouseEnter?.();
        }}
        onMouseLeave={e => {
          scheduleColumnsClose();
          onPanelMouseLeave?.(e);
        }}
        onMouseDown={e => e.preventDefault()}
      >
        <ColumnsCountPicker onPick={onPickColumns} />
      </div>,
      document.body,
    );

  return (
    <Fragment>
      {SLASH_SECTIONS.map(section => (
        <div
          key={section.title}
          className={`slash-section slash-section--${section.layout}${section.gridMuted ? ' slash-section--grid-muted' : ''}`}
        >
          <div className="slash-section-title">{section.title}</div>
          {section.layout === 'grid' ? (
            <div className="slash-basic-grid">
              {section.items.map(item => {
                const Icon = item.Icon;
                const tint = item.iconColor ?? '#1f2329';
                return (
                  <button
                    key={`${section.title}-${item.label}`}
                    type="button"
                    className="slash-basic-cell"
                    title={item.label}
                    onMouseDown={e => {
                      e.preventDefault();
                      onPickItem(section.title, item);
                    }}
                  >
                    <span className="slash-basic-cell-icon" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                      <Icon size={18} strokeWidth={GRID_STROKE} fill={tint} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            section.items.map(item => {
              const Icon = item.Icon;
              const tint = item.iconColor ?? '#1f2329';
              const isTableGrid = item.submenu === 'tableGrid';
              const isColumnsCount = item.submenu === 'columnsCount';
              const hasSubmenu = isTableGrid || isColumnsCount;
              return (
                <div
                  key={`${section.title}-${item.label}`}
                  className={`slash-item${hasSubmenu ? ' slash-item--has-submenu' : ''}`}
                  role="button"
                  tabIndex={0}
                  title={item.label}
                  onMouseEnter={e => {
                    if (isTableGrid) openTableFlyout(e.currentTarget);
                    else if (isColumnsCount) openColumnsFlyout(e.currentTarget);
                  }}
                  onMouseLeave={() => {
                    if (isTableGrid) scheduleTableClose();
                    if (isColumnsCount) scheduleColumnsClose();
                  }}
                  onMouseDown={e => {
                    e.preventDefault();
                    if (!hasSubmenu) onPickItem(section.title, item);
                  }}
                >
                  <span className="slash-icon-wrap" style={{ '--slash-icon-tint': tint } as CSSProperties}>
                    <Icon size={18} strokeWidth={LIST_STROKE} fill={tint} />
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
      {tableFlyout}
      {columnsFlyout}
    </Fragment>
  );
}
