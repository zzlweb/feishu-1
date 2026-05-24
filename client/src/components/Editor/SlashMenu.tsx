import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { IconChevronMenuEnd } from '../../icons/feishuDoc';
import type { SlashMenuItem } from './slashMenuConfig';
import { insertTemplateContent, SLASH_SECTIONS, itemMatchesQuery } from './slashMenuConfig';
import TableGridPicker from './TableGridPicker';
import ColumnsCountPicker from './ColumnsCountPicker';
import TemplatePicker from './TemplatePicker';
import ButtonTypePicker from './ButtonTypePicker';
import { insertFeishuTable } from './tableInsert';
import { insertFeishuColumns } from './columnsInsert';
import { computeSubmenuFlyoutPosition } from './contextSubmenuFlyout';
import './SlashMenu.less';

interface Props {
  editor: Editor;
  position: { top: number; left: number };
  query: string;
  onClose: () => void;
  onBeforeSelect?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (relatedTarget: EventTarget | null) => void;
  variant?: 'fixed' | 'anchored';
  anchorRef?: RefObject<HTMLElement | null>;
}

export default function SlashMenu({ editor, position, query, onClose, onBeforeSelect, onMouseEnter, onMouseLeave, variant = 'fixed', anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [renderPos, setRenderPos] = useState(position);
  const [tooltipItem, setTooltipItem] = useState<{ item: SlashMenuItem; rect: DOMRect } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<{
    kind: 'tableGrid' | 'columnsCount' | 'templateList' | 'buttonType';
    rect: DOMRect;
  } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const filteredSections = SLASH_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(item => itemMatchesQuery(item, query)),
  })).filter(s => s.items.length > 0);

  const allItems = filteredSections.flatMap(s => s.items);

  useEffect(() => {
    if (allItems.length === 0) onClose();
  }, [allItems.length, onClose]);

  useEffect(() => {
    setActiveIdx(0);
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
    const gap = anchorRef ? 0 : 8;
    const menuRect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { left, top } = position;

    const anchorEl = anchorRef?.current;
    if (anchorEl?.isConnected) {
      const anchor = anchorEl.getBoundingClientRect();
      left = anchor.left + gap;
      top = anchor.top + anchor.height / 2 - menuRect.height / 2;
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
        (editor as any).__plusInsertRange = null;
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
    };
  }, [allItems, activeIdx, editor, onBeforeSelect, onClose]);

  if (allItems.length === 0) return null;

  let globalIdx = 0;
  const gridStroke = 1.65;
  const listStroke = 1.55;

  const showTooltip = (item: SlashMenuItem, el: HTMLElement) => {
    if (item.submenu === 'tableGrid' || item.submenu === 'columnsCount' || item.submenu === 'templateList' || item.submenu === 'buttonType') return;
    clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipItem({ item, rect: el.getBoundingClientRect() });
    }, 180);
  };

  const hideTooltip = () => {
    clearTimeout(tooltipTimerRef.current);
    setTooltipItem(null);
  };

  const pointerInsideMenuShell = (next: EventTarget | null) => {
    if (!(next instanceof Element)) return false;
    return Boolean(
      menuRef.current?.contains(next)
      || next.closest('.slash-submenu-portal')
      || next.closest('.slash-tooltip'),
    );
  };

  const openSubmenu = (kind: 'tableGrid' | 'columnsCount' | 'templateList' | 'buttonType', el: HTMLElement) => {
    hideTooltip();
    setActiveSubmenu({ kind, rect: el.getBoundingClientRect() });
  };

  const closeSubmenuByPointer = (next: EventTarget | null) => {
    if (pointerInsideMenuShell(next)) return;
    setActiveSubmenu(null);
    onMouseLeave?.(next);
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
    (editor as any).__plusInsertRange = null;
    onClose();
  };

  const handleTablePick = (rows: number, cols: number) => {
    setActiveSubmenu(null);
    hideTooltip();
    queueMicrotask(() => {
      onBeforeSelect?.();
      insertFeishuTable(editor, rows, cols);
      (editor as any).__plusInsertRange = null;
      onClose();
    });
  };

  const handleColumnsPick = (columnCount: number) => {
    setActiveSubmenu(null);
    hideTooltip();
    queueMicrotask(() => {
      onBeforeSelect?.();
      insertFeishuColumns(editor, columnCount);
      (editor as any).__plusInsertRange = null;
      onClose();
    });
  };

  const submenuPosition = activeSubmenu
    ? computeSubmenuFlyoutPosition({
        trigger: activeSubmenu.rect,
        panelWidth: activeSubmenu.kind === 'tableGrid' ? 304 : activeSubmenu.kind === 'columnsCount' ? 184 : activeSubmenu.kind === 'buttonType' ? 230 : 264,
        panelHeight: activeSubmenu.kind === 'tableGrid' ? 334 : activeSubmenu.kind === 'columnsCount' ? 164 : activeSubmenu.kind === 'buttonType' ? 144 : 340,
        gap: 8,
        pad: 8,
      })
    : null;

  const submenuPortal = activeSubmenu && submenuPosition
      ? createPortal(
        <div
          className="slash-submenu-portal"
          style={{
            position: 'fixed',
            left: submenuPosition.left,
            top: submenuPosition.top,
            zIndex: 10030,
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={e => closeSubmenuByPointer(e.relatedTarget)}
          onMouseDown={e => e.preventDefault()}
        >
          {activeSubmenu.kind === 'tableGrid' ? (
            <div className="slash-table-grid-flyout is-portal">
              <TableGridPicker onPick={handleTablePick} />
            </div>
          ) : activeSubmenu.kind === 'columnsCount' ? (
            <div className="slash-columns-count-flyout is-portal">
              <ColumnsCountPicker onPick={handleColumnsPick} />
            </div>
          ) : activeSubmenu.kind === 'templateList' ? (
            <div className="slash-template-flyout is-portal">
              <TemplatePicker
                onPick={template => {
                  onBeforeSelect?.();
                  insertTemplateContent(editor, template.content);
                  (editor as any).__plusInsertRange = null;
                  onClose();
                }}
              />
            </div>
          ) : (
            <div className="slash-button-type-flyout is-portal">
              <ButtonTypePicker
                editor={editor}
                onPick={() => {
                  (editor as any).__plusInsertRange = null;
                  onClose();
                }}
              />
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

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

  return (
    <Fragment>
      <div
        className={`slash-menu slash-menu-feishu${variant === 'anchored' ? ' slash-menu--anchored' : ''}${anchorRef ? ' slash-menu--plus-anchor' : ''}`}
        ref={menuRef}
        style={variant === 'anchored' ? undefined : { top: renderPos.top, left: renderPos.left }}
        onMouseEnter={onMouseEnter}
        onScroll={hideTooltip}
        onMouseLeave={e => {
          hideTooltip();
          closeSubmenuByPointer(e.relatedTarget);
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
                const isTemplateList = item.submenu === 'templateList';
                const isButtonType = item.submenu === 'buttonType';
                const hasSubmenu = isTableGrid || isColumnsCount || isTemplateList || isButtonType;
                return (
                  <div
                    key={`${section.title}-${item.label}`}
                    className={`slash-item ${idx === activeIdx ? 'active' : ''}${hasSubmenu ? ' slash-item--has-submenu' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={item.label}
                    onMouseEnter={e => {
                      setActiveIdx(idx);
                      if (!hasSubmenu && hasTooltipContent(item)) {
                        showTooltip(item, e.currentTarget);
                      } else {
                        hideTooltip();
                      }
                      if (isTableGrid) openSubmenu('tableGrid', e.currentTarget);
                      else if (isColumnsCount) openSubmenu('columnsCount', e.currentTarget);
                      else if (isTemplateList) openSubmenu('templateList', e.currentTarget);
                      else if (isButtonType) openSubmenu('buttonType', e.currentTarget);
                      else setActiveSubmenu(null);
                    }}
                    onMouseLeave={() => {
                      if (!hasSubmenu) hideTooltip();
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
      {submenuPortal}
      {tooltipPortal}
    </Fragment>
  );
}
